// Photo entry: read a scorecard or shot-notes photo, then hand the result to the
// normal Simple / Hole-by-Hole forms so the player can check it before submitting.
// The saved round is identical to one typed in by hand.
import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { onEnter, show } from '../core/router.js';
import { goToNewRound } from '../home/home.js';
import { fillHoleByHoleForm, fillSimpleForm } from '../round/form-fill.js';
import { buildHoleByHoleForm } from '../round/hole-entry.js';
import { setEntryMode } from '../round/setup.js';
import { buildSimpleForm, simpleUpdateToPar } from '../round/simple-entry.js';
import { readRoundPhoto, readScanCard } from './reader.js';

var photoKind = 'card';   // 'card' (printed scan card) | 'scorecard' | 'shots'
var photoFiles = [];
var reading = false;

var KIND_HELP = {
  card: 'Print the scan card, check the boxes as you play, then take a photo with all four corner squares showing. Every shot is filled in for you to check.',
  scorecard: 'Take a straight-on photo of the scorecard. Your par and score for each hole are filled in for you to check.',
  shots: 'Take a photo of your shot-by-shot notes. Every shot is filled in for you to check, so you get full strokes gained.'
};

function el(id) { return document.getElementById(id); }

function setStatus(msg, color) {
  var s = el('photoStatus');
  s.textContent = msg || '';
  s.style.color = color || '#9a9a9a';
}

function setPhotoKind(kind) {
  photoKind = kind;
  var on = { card: el('photoKind_card'), scorecard: el('photoKind_scorecard'), shots: el('photoKind_shots') };
  Object.keys(on).forEach(function(k) {
    on[k].style.background = k === kind ? '#2d7abc' : 'transparent';
    on[k].style.color = k === kind ? '#ffffff' : '#606060';
  });
  el('photoKindHelp').textContent = KIND_HELP[kind];
  el('photoNotesGuide').style.display = kind === 'shots' ? 'block' : 'none';
  el('photoPrintCardBtn').style.display = kind === 'card' ? '' : 'none';
}

function renderPreviews() {
  var box = el('photoPreviews');
  box.innerHTML = '';
  photoFiles.forEach(function(file) {
    var img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.onload = function() { URL.revokeObjectURL(img.src); };
    img.style.cssText = 'width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid #333333;';
    box.appendChild(img);
  });
  var btn = el('photoReadBtn');
  btn.style.display = photoFiles.length ? '' : 'none';
  btn.textContent = photoFiles.length > 1 ? 'Read ' + photoFiles.length + ' Photos' : 'Read Photo';
}

function onPhotoFilesChosen(input) {
  photoFiles = Array.prototype.slice.call(input.files || []);
  input.value = '';
  setStatus('');
  renderPreviews();
}

function showFromPhotoNotice(pageKind, source, warnings) {
  var note = el(pageKind === 'shots' ? 'hbhPhotoNotice' : 'simplePhotoNotice');
  var msg = '📷 Filled in from your photo' + (source === 'device' ? ' (read on this device)' : '')
    + '. Check every hole and fix anything that was misread before you submit.';
  if (source === 'card') {
    msg = '📷 Filled in from your scan card. Check every hole before you submit. '
      + 'The card has no distances: add the distance left for each shot to get strokes gained, '
      + 'or submit as it is for score, fairways, greens and putts.';
  }
  note.textContent = msg;
  (warnings || []).forEach(function(w) {
    var line = document.createElement('div');
    line.textContent = '⚠ ' + w;
    line.style.cssText = 'color:#d4706e;margin-top:4px;';
    note.appendChild(line);
  });
  note.style.display = 'block';
}

/** Course data, when a course was picked, is more reliable than what was read off the photo. */
function withCourseData(hole) {
  var c = S.courseHoleData && S.courseHoleData[hole.hole - 1];
  if (c) { hole.par = c.par; hole.yards = c.yards; }
  return hole;
}

function openInSimpleForm(holes, source) {
  S.totalHoles = holes.length;
  el('customHoles').value = holes.length;
  setEntryMode('simple');
  buildSimpleForm();
  fillSimpleForm(holes.map(withCourseData));
  holes.forEach(function(h) { simpleUpdateToPar(h.hole); });
  var cName = el('courseName').value || '';
  el('simplCourseName').innerText = cName;
  el('simplCourseName').style.display = cName ? 'block' : 'none';
  el('courseLabel').innerText = cName;
  show('simpleEntryPage');
  showFromPhotoNotice('scorecard', source);
}

function openInHoleByHoleForm(holes, source, warnings) {
  // Holes missing from the notes still get a card so the round stays in order
  var count = Math.max.apply(null, holes.map(function(h) { return h.hole; }));
  S.totalHoles = Math.max(3, count);
  el('customHoles').value = S.totalHoles;
  setEntryMode('hole');
  buildHoleByHoleForm();
  fillHoleByHoleForm(holes.map(withCourseData));
  var cName = el('courseName').value || '';
  el('hbhCourseName').innerText = cName;
  el('hbhCourseName').style.display = cName ? 'block' : 'none';
  el('courseLabel').innerText = cName;
  show('holeByHolePage');
  showFromPhotoNotice('shots', source, warnings);
}

async function readChosenPhotos() {
  if (reading || photoFiles.length === 0) return;
  reading = true;
  var btn = el('photoReadBtn');
  btn.style.opacity = '0.5';
  try {
    var onStatus = function(msg) { setStatus(msg); };
    var result = photoKind === 'card'
      ? await readScanCard(photoFiles, onStatus)
      : await readRoundPhoto(photoFiles, photoKind, onStatus);
    S.currentRoundId = null;
    if (photoKind !== 'scorecard') openInHoleByHoleForm(result.holes, result.source, result.warnings);
    else openInSimpleForm(result.holes, result.source);
    photoFiles = [];
    renderPreviews();
    setStatus('');
  } catch (e) {
    setStatus(e && e.message ? e.message : 'Could not read that photo.', '#d4706e');
  }
  btn.style.opacity = '1';
  reading = false;
}

/** Round History shortcut: start a new round with Photo entry already selected. */
function startPhotoRound() {
  goToNewRound();
  setEntryMode('photo');
}

onEnter('photoEntryPage', function() {
  var cName = el('courseName').value || '';
  el('photoCourseName').innerText = cName;
  el('photoCourseName').style.display = cName ? 'block' : 'none';
  setPhotoKind(photoKind);
  renderPreviews();
});

function printScanCard() {
  window.open('scorecard.html', '_blank');
}

// Functions called from inline HTML handlers
expose({ setPhotoKind, onPhotoFilesChosen, readChosenPhotos, startPhotoRound, printScanCard });
