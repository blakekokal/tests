// Photo entry. Two kinds of photo, each opened in a normal entry form to check before submitting:
//   scorecard  a normal scorecard with score / F / G / Putts / Pen rows  -> Simple form
//   card       the printable stat card with a bubble per shot           -> Hole-by-Hole form
import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { onEnter, show } from '../core/router.js';
import { goToNewRound } from '../home/home.js';
import { fillHoleByHoleForm, fillSimpleForm } from '../round/form-fill.js';
import { buildHoleByHoleForm } from '../round/hole-entry.js';
import { setEntryMode } from '../round/setup.js';
import { buildSimpleForm, simpleUpdateToPar } from '../round/simple-entry.js';
import { readRoundPhoto, readStatCards } from './reader.js';

var photoKind = 'scorecard';   // 'scorecard' | 'card'
var photoFiles = [];
var reading = false;

function el(id) { return document.getElementById(id); }

function setStatus(msg, color) {
  var s = el('photoStatus');
  s.textContent = msg || '';
  s.style.color = color || '#9a9a9a';
}

function setPhotoKind(kind) {
  photoKind = kind;
  ['scorecard', 'card'].forEach(function(k) {
    var btn = el('photoKind_' + k);
    btn.style.background = k === kind ? '#2d7abc' : 'transparent';
    btn.style.color = k === kind ? '#ffffff' : '#606060';
    el('photoGuide_' + k).style.display = k === kind ? 'block' : 'none';
  });
  el('photoPrintCardBtn').style.display = kind === 'card' ? '' : 'none';
}

function printStatCard() {
  window.open('stat-card.html', '_blank');
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
  el('photoPickBtn').textContent = photoFiles.length ? '📷 Choose Different Photos' : '📷 Take or Choose Photo';
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

/** Stat card: each shot's lie is filled in; the player types the distances. */
function openCardForReview(holes, warnings) {
  // Holes missing from the photos still get a card so the round stays in order
  var last = Math.max.apply(null, holes.map(function(h) { return h.hole; }));
  S.totalHoles = last <= 9 ? 9 : 18;
  el('customHoles').value = S.totalHoles;
  setEntryMode('hole');
  buildHoleByHoleForm();
  fillHoleByHoleForm(holes.map(withCourseData));
  var cName = el('courseName').value || '';
  el('hbhCourseName').innerText = cName;
  el('hbhCourseName').style.display = cName ? 'block' : 'none';
  el('courseLabel').innerText = cName;
  show('holeByHolePage');
  var note = el('hbhPhotoNotice');
  note.textContent = '📷 Filled in from your stat card. Check each hole, then type the yardage and the distance left '
    + 'for each shot from your card. Distances are what strokes gained is worked out from.';
  warnings.forEach(function(w) {
    var line = document.createElement('div');
    line.textContent = '⚠ ' + w;
    line.style.cssText = 'color:#d4706e;margin-top:4px;';
    note.appendChild(line);
  });
  note.style.display = 'block';
}

async function readChosenPhotos() {
  if (reading || photoFiles.length === 0) return;
  reading = true;
  var btn = el('photoReadBtn');
  btn.style.opacity = '0.5';
  try {
    var onStatus = function(msg) { setStatus(msg); };
    S.currentRoundId = null;
    if (photoKind === 'card') {
      var cards = await readStatCards(photoFiles, onStatus);
      openCardForReview(cards.holes, cards.warnings);
    } else {
      var result = await readRoundPhoto(photoFiles, onStatus);
      openForReview(result.holes, result.source);
    }
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

// Functions called from inline HTML handlers
expose({ setPhotoKind, printStatCard, onPhotoFilesChosen, readChosenPhotos, startPhotoRound });
