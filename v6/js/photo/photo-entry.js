// Photo entry: read a scorecard photo (score, fairways, greens, putts, penalties), then
// open it in the Simple form so the player can check it before submitting.
import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { onEnter, show } from '../core/router.js';
import { goToNewRound } from '../home/home.js';
import { fillSimpleForm } from '../round/form-fill.js';
import { setEntryMode } from '../round/setup.js';
import { buildSimpleForm, simpleUpdateToPar } from '../round/simple-entry.js';
import { readRoundPhoto } from './reader.js';

var photoFiles = [];
var reading = false;

function el(id) { return document.getElementById(id); }

function setStatus(msg, color) {
  var s = el('photoStatus');
  s.textContent = msg || '';
  s.style.color = color || '#9a9a9a';
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

/** Course data, when a course was picked, is more reliable than what was read off the photo. */
function withCourseData(hole) {
  var c = S.courseHoleData && S.courseHoleData[hole.hole - 1];
  if (c) { hole.par = c.par; hole.yards = c.yards; }
  return hole;
}

function openForReview(holes, source) {
  S.totalHoles = holes.length;
  el('customHoles').value = holes.length;
  setEntryMode('simple');
  buildSimpleForm(true);
  fillSimpleForm(holes.map(withCourseData));
  holes.forEach(function(h) { simpleUpdateToPar(h.hole); });
  var cName = el('courseName').value || '';
  el('simplCourseName').innerText = cName;
  el('simplCourseName').style.display = cName ? 'block' : 'none';
  el('courseLabel').innerText = cName;
  show('simpleEntryPage');
  var note = el('simplePhotoNotice');
  note.textContent = '📷 Filled in from your photo' + (source === 'device' ? ' (read on this device)' : '')
    + '. Check every hole and fix anything that was misread before you submit.';
  note.style.display = 'block';
}

async function readChosenPhotos() {
  if (reading || photoFiles.length === 0) return;
  reading = true;
  var btn = el('photoReadBtn');
  btn.style.opacity = '0.5';
  try {
    var result = await readRoundPhoto(photoFiles, function(msg) { setStatus(msg); });
    S.currentRoundId = null;
    openForReview(result.holes, result.source);
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
  renderPreviews();
});

// Functions called from inline HTML handlers
expose({ onPhotoFilesChosen, readChosenPhotos, startPhotoRound });
