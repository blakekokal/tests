// Reads a round out of one or more photos.
//
// Two readers, same result shape:
//   1. AI vision  - the "read-round-photo" Supabase Edge Function (see supabase/functions/).
//                   Used automatically once that function is deployed; handles handwriting well.
//   2. On device  - Tesseract.js OCR in the browser. Free, no setup, best on clear printed text.
import { S } from '../core/state.js';
import { _sb } from '../core/supabase.js';
import { parseScorecardText, parseShotNotesText } from './parse-text.js';

var AI_FUNCTION = 'read-round-photo';
var TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
var MAX_IMAGE_SIDE = 1800;

// null = not tried yet this session; false = function not deployed / unreachable
var aiAvailable = null;

/** Downscale a photo and return it as a JPEG data URL (keeps uploads small and OCR fast). */
function toJpegDataUrl(file) {
  return new Promise(function(resolve, reject) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function() {
      var scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = function() { URL.revokeObjectURL(url); reject(new Error('Could not open that image.')); };
    img.src = url;
  });
}

function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise(function(resolve, reject) {
    var s = document.createElement('script');
    s.src = TESSERACT_URL;
    s.onload = function() { resolve(window.Tesseract); };
    s.onerror = function() { reject(new Error('Could not load the on-device reader. Check your connection.')); };
    document.head.appendChild(s);
  });
}

async function readWithAI(kind, dataUrls) {
  var images = dataUrls.map(function(d) { return { media_type: 'image/jpeg', data: d.split(',')[1] }; });
  var res = await _sb.functions.invoke(AI_FUNCTION, { body: { kind: kind, images: images } });
  if (res.error) throw res.error;
  if (!res.data || !Array.isArray(res.data.holes) || res.data.holes.length === 0) {
    throw new Error((res.data && res.data.error) || 'No holes found in the photo.');
  }
  return res.data.holes;
}

// Tesseract page layout modes: a scorecard is a table (rows of varying size),
// shot notes are one uniform block of lines.
var OCR_LAYOUT = { scorecard: '4', shots: '6' };

async function readOnDevice(kind, dataUrls, onStatus) {
  var Tesseract = await loadTesseract();
  var label = 'Reading photo';
  var worker = await Tesseract.createWorker('eng', 1, {
    logger: function(m) {
      if (m.status === 'recognizing text') onStatus(label + '... ' + Math.round(m.progress * 100) + '%');
    }
  });
  var text = '';
  try {
    await worker.setParameters({ tessedit_pageseg_mode: OCR_LAYOUT[kind] });
    for (var i = 0; i < dataUrls.length; i++) {
      if (dataUrls.length > 1) label = 'Reading photo ' + (i + 1) + ' of ' + dataUrls.length;
      var result = await worker.recognize(dataUrls[i]);
      text += result.data.text + '\n';
    }
  } finally {
    await worker.terminate();
  }
  return kind === 'shots' ? parseShotNotesText(text) : parseScorecardText(text);
}

/**
 * @param {File[]} files  photos, in hole order
 * @param {'scorecard'|'shots'} kind
 * @param {(msg:string)=>void} onStatus  progress text for the UI
 * @returns {Promise<{source:'ai'|'device', holes:object[]}>}
 *   scorecard holes: {hole, par, yards, score}
 *   shots holes:     {hole, par, yards, shots:[{lie, dist}]}
 */
export async function readRoundPhoto(files, kind, onStatus) {
  onStatus('Preparing photo...');
  var dataUrls = [];
  for (var i = 0; i < files.length; i++) dataUrls.push(await toJpegDataUrl(files[i]));

  // The AI reader needs a signed-in user so the paid key behind it can't be used anonymously
  if (aiAvailable !== false && S.currentUser && _sb.functions) {
    try {
      onStatus('Reading photo...');
      var aiHoles = await readWithAI(kind, dataUrls);
      aiAvailable = true;
      return { source: 'ai', holes: aiHoles };
    } catch (e) {
      // Not deployed or unreachable: stop trying this session and read on the device instead
      if (aiAvailable === null) aiAvailable = false;
    }
  }

  onStatus('Reading photo on this device...');
  var holes = await readOnDevice(kind, dataUrls, onStatus);
  if (!holes) {
    throw new Error(kind === 'shots'
      ? 'Could not find any holes in that photo. Check the notes format below and try a sharper, closer photo.'
      : 'Could not find a row of scores in that photo. Try a sharper, straight-on photo of the scorecard.');
  }
  return { source: 'device', holes: holes };
}
