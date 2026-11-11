// Reads a round out of one or more photos.
//
// Two readers, same result shape:
//   1. AI vision  - the "read-round-photo" Supabase Edge Function (see supabase/functions/).
//                   Used automatically once that function is deployed; handles handwriting,
//                   including the check and x marks.
//   2. On device  - Tesseract.js OCR in the browser. Free, no setup, best on clear printed text.
import { S } from '../core/state.js';
import { _sb } from '../core/supabase.js';
import { cardHolesToForm, readStatCard } from './card-scan.js';
import { parseScorecardText } from './parse-text.js';

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

async function readWithAI(dataUrls) {
  var images = dataUrls.map(function(d) { return { media_type: 'image/jpeg', data: d.split(',')[1] }; });
  var res = await _sb.functions.invoke(AI_FUNCTION, { body: { images: images } });
  if (res.error) throw res.error;
  if (!res.data || !Array.isArray(res.data.holes) || res.data.holes.length === 0) {
    throw new Error((res.data && res.data.error) || 'No holes found in the photo.');
  }
  return res.data.holes;
}

// Tesseract page layout mode 4: a table whose rows vary in size, which is what a scorecard is.
var OCR_LAYOUT = '4';

async function readOnDevice(dataUrls, onStatus) {
  var Tesseract = await loadTesseract();
  var label = 'Reading photo';
  var worker = await Tesseract.createWorker('eng', 1, {
    logger: function(m) {
      if (m.status === 'recognizing text') onStatus(label + '... ' + Math.round(m.progress * 100) + '%');
    }
  });
  var text = '';
  try {
    await worker.setParameters({ tessedit_pageseg_mode: OCR_LAYOUT });
    for (var i = 0; i < dataUrls.length; i++) {
      if (dataUrls.length > 1) label = 'Reading photo ' + (i + 1) + ' of ' + dataUrls.length;
      var result = await worker.recognize(dataUrls[i]);
      text += result.data.text + '\n';
    }
  } finally {
    await worker.terminate();
  }
  return parseScorecardText(text);
}

function loadImage(file) {
  return new Promise(function(resolve, reject) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function() { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = function() { URL.revokeObjectURL(url); reject(new Error('Could not open that image.')); };
    img.src = url;
  });
}

/**
 * Printed stat cards: read the colored bubbles. One photo per card; the cards say which
 * holes they hold, so the photos can be in any order.
 * @returns {Promise<{source:'card', holes:object[], warnings:string[]}>} holes in the Hole-by-Hole form's shape
 */
export async function readStatCards(files, onStatus) {
  var scanned = [], warnings = [];
  for (var i = 0; i < files.length; i++) {
    onStatus(files.length > 1 ? 'Reading card ' + (i + 1) + ' of ' + files.length + '...' : 'Reading card...');
    var card = readStatCard(await loadImage(files[i]));
    if (!card) continue;   // the cover card has no holes
    scanned = scanned.concat(card.holes);
    warnings = warnings.concat(card.warnings);
  }
  if (scanned.length === 0) {
    throw new Error('No colored bubbles were found. Take one photo of each holes card, sharp and well lit.');
  }
  var form = cardHolesToForm(scanned);
  return { source: 'card', holes: form.holes, warnings: warnings.concat(form.warnings) };
}

/**
 * @param {File[]} files  photos of the scorecard (for example one per nine), in hole order
 * @param {(msg:string)=>void} onStatus  progress text for the UI
 * @returns {Promise<{source:'ai'|'device', holes:object[]}>}
 *   holes: {hole, par, yards, score, fairway, gir, putts, penalties} (see parse-text.js)
 */
export async function readRoundPhoto(files, onStatus) {
  onStatus('Preparing photo...');
  var dataUrls = [];
  for (var i = 0; i < files.length; i++) dataUrls.push(await toJpegDataUrl(files[i]));

  // The AI reader needs a signed-in user so the paid key behind it can't be used anonymously
  if (aiAvailable !== false && S.currentUser && _sb.functions) {
    try {
      onStatus('Reading photo...');
      var aiHoles = await readWithAI(dataUrls);
      aiAvailable = true;
      return { source: 'ai', holes: aiHoles };
    } catch (e) {
      // Not deployed or unreachable: stop trying this session and read on the device instead
      if (aiAvailable === null) aiAvailable = false;
    }
  }

  onStatus('Reading photo on this device...');
  var holes = await readOnDevice(dataUrls, onStatus);
  if (!holes) {
    throw new Error('Could not find a row of scores in that photo. Try a sharper, straight-on photo of the scorecard.');
  }
  return { source: 'device', holes: holes };
}
