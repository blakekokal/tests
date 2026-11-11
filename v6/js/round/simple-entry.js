import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { showAuthPage } from '../auth/auth.js';
import { show } from '../core/nav.js';
import { autoSaveRound, saveIncompleteRound } from './save.js';
import { resetRoundState } from './setup.js';
import { renderSummary } from './summary.js';

// ─── SIMPLE ENTRY ─────────────────────────────────────────────────────────────
export function buildSimpleForm() {
  var container = document.getElementById('simpleHolesList');
  container.innerHTML = '';
  for (var h = 1; h <= S.totalHoles; h++) {
    var hasCourseData = S.courseHoleData && S.courseHoleData[h - 1];
    var holePar = hasCourseData ? S.courseHoleData[h - 1].par : 4;
    var holeYards = hasCourseData ? S.courseHoleData[h - 1].yards : '';
    var div = document.createElement('div');
    div.id = 'simple_hole_' + h;
    div.dataset.par = holePar;
    div.style.cssText = 'background:#222222;border-radius:12px;padding:10px 14px;border:1px solid #282828;';

    var parColors = {3:'#3d96ee',4:'#00a06d',5:'#f0c830'};
    var parBtns = [3,4,5].map(function(p) {
      var sel = p === holePar;
      return '<button onclick="simpleSetPar(' + h + ',' + p + ',this)" style="width:32px;height:32px;border-radius:8px;border:none;font-size:13px;font-weight:700;cursor:pointer;background:' + (sel ? parColors[p] : '#333333') + ';color:' + (sel ? '#ffffff' : '#606060') + ';">' + p + '</button>';
    }).join('');

    div.innerHTML = '<div style="display:flex;align-items:center;gap:10px;">'
      + '<div style="font-size:14px;font-weight:800;color:#ffffff;width:50px;">Hole ' + h + '</div>'
      + '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">'
      + '<div style="font-size:9px;color:#606060;text-transform:uppercase;letter-spacing:0.5px;">Par</div>'
      + '<div style="display:flex;gap:4px;">' + parBtns + '</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">'
      + '<div style="font-size:9px;color:#606060;text-transform:uppercase;letter-spacing:0.5px;">Yds</div>'
      + '<input id="simple_yards_' + h + '" type="number" inputmode="numeric" value="' + (holeYards || '') + '" placeholder="-" style="width:52px;height:32px;background:#282828;color:#ffffff;border:none;border-radius:8px;text-align:center;font-size:12px;" onfocus="this.select()">'
      + '</div>'
      + '<div style="margin-left:auto;display:flex;flex-direction:column;align-items:center;gap:2px;">'
      + '<div style="font-size:9px;color:#606060;text-transform:uppercase;letter-spacing:0.5px;">Score <span id="simple_topar_' + h + '" style="font-size:9px;font-weight:700;">' + simpleToParLabel(holePar, holePar) + '</span></div>'
      + '<div style="display:flex;align-items:center;gap:4px;">'
      + '<button onclick="simpleAdj(' + h + ',-1)" style="width:30px;height:30px;border-radius:8px;border:none;background:#333333;color:#ffffff;font-size:18px;font-weight:700;cursor:pointer;">-</button>'
      + '<input id="simple_score_' + h + '" type="number" inputmode="numeric" value="' + holePar + '" min="1" style="width:40px;height:32px;background:#282828;color:#ffffff;border:none;border-radius:8px;text-align:center;font-size:16px;font-weight:700;-moz-appearance:textfield;" onfocus="this.select()" oninput="simpleUpdateToPar(' + h + ')">'
      + '<button onclick="simpleAdj(' + h + ',1)" style="width:30px;height:30px;border-radius:8px;border:none;background:#333333;color:#ffffff;font-size:18px;font-weight:700;cursor:pointer;">+</button>'
      + '</div></div>'
      + '</div>';
    container.appendChild(div);
  }
}

function simpleToParLabel(score, par) {
  var diff = score - par;
  if (diff === 0) return '<span style="color:#00a06d;">E</span>';
  if (diff > 0) return '<span style="color:#d4706e;">+' + diff + '</span>';
  return '<span style="color:#3d96ee;">' + diff + '</span>';
}

function simpleUpdateToPar(hole) {
  var card = document.getElementById('simple_hole_' + hole);
  var par = parseInt(card.dataset.par) || 4;
  var score = parseInt(document.getElementById('simple_score_' + hole).value) || 0;
  document.getElementById('simple_topar_' + hole).innerHTML = simpleToParLabel(score, par);
}

function simpleSetPar(hole, p, btn) {
  var card = document.getElementById('simple_hole_' + hole);
  card.dataset.par = p;
  var parColors = {3:'#3d96ee',4:'#00a06d',5:'#f0c830'};
  var btns = card.querySelectorAll('button[onclick^="simpleSetPar"]');
  btns.forEach(function(b) { var bp = parseInt(b.textContent); b.style.background = '#333333'; b.style.color = '#606060'; });
  btn.style.background = parColors[p]; btn.style.color = '#ffffff';
  simpleUpdateToPar(hole);
}

function simpleAdj(hole, delta) {
  var inp = document.getElementById('simple_score_' + hole);
  var v = Math.max(1, (parseInt(inp.value) || 0) + delta);
  inp.value = v;
  simpleUpdateToPar(hole);
}

function submitSimple() {
  // Save values before reset clears them
  var savedTotalHoles = S.totalHoles;
  var savedCourseName = document.getElementById('courseName').value || '';
  var savedPlayerName = document.getElementById('playerName').value || '';
  var savedRoundDate = document.getElementById('roundDate').value || '';
  var savedRoundType = document.getElementById('roundType').value || 'Casual';
  var savedHandicap = document.getElementById('playerHandicap').value || 'pro';
  var savedCourseHoleData = S.courseHoleData;

  // Read form data before reset
  var holeData = [];
  for (var h = 1; h <= S.totalHoles; h++) {
    var card = document.getElementById('simple_hole_' + h);
    var parVal = parseInt(card.dataset.par) || 4;
    var scoreVal = parseInt(document.getElementById('simple_score_' + h).value) || parVal;
    var yardsVal = parseInt(document.getElementById('simple_yards_' + h).value) || 0;
    holeData.push({ hole: h, par: parVal, score: scoreVal, yards: yardsVal });
  }

  resetRoundState();
  S.currentRoundId = null;
  S.totalHoles = savedTotalHoles;

  // Restore form fields so autoSaveRound can read them
  document.getElementById('courseName').value = savedCourseName;
  document.getElementById('playerName').value = savedPlayerName;
  document.getElementById('roundDate').value = savedRoundDate;
  document.getElementById('roundType').value = savedRoundType;
  document.getElementById('playerHandicap').value = savedHandicap;

  for (var i = 0; i < holeData.length; i++) {
    var hd = holeData[i];
    S.allHoles.push({
      hole: hd.hole, par: hd.par, yards: hd.yards, score: hd.score, putts: 0,
      firstPuttDist: 0, expectedPutts: 0,
      sgOTT: 0, sgAPP: 0, sgARG: 0, sgPutting: 0,
      shots: []
    });

    if (hd.par === 3) { S.c3++; S.p3 += hd.score; }
    if (hd.par === 4) { S.c4++; S.p4 += hd.score; }
    if (hd.par === 5) { S.c5++; S.p5 += hd.score; }
    S.totalStrokes += hd.score;
    S.totalPar += hd.par;
  }

  scoreBar.style.display = 'none';
  renderSummary();
  document.getElementById('backToRoundsBtn').style.display = 'none';
  document.getElementById('saveStatus').textContent = '';
  S.viewingStudentRound = false;
  var saveBtn = document.getElementById('saveToAccountBtn');
  if (saveBtn) saveBtn.style.display = S.currentUser ? '' : 'none';
  show('summaryPage');

  if (S.currentUser && S.allHoles.length > 0) {
    autoSaveRound();
  }
}

async function saveSimpleForLater() {
  if (!S.currentUser) { alert('Please log in to save rounds.'); showAuthPage(); return; }

  var enteredCount = 0;
  var simpleFormData = [];
  for (var h = 1; h <= S.totalHoles; h++) {
    var card = document.getElementById('simple_hole_' + h);
    var parVal = parseInt(card.dataset.par) || 4;
    var scoreVal = parseInt(document.getElementById('simple_score_' + h).value) || 0;
    var yardsVal = parseInt(document.getElementById('simple_yards_' + h).value) || 0;
    simpleFormData.push({ hole: h, par: parVal, score: scoreVal, yards: yardsVal });
    if (scoreVal > 0) enteredCount++;
  }
  if (enteredCount === 0) { alert('Enter at least one score before saving.'); return; }
  if (!confirm('Save your progress and finish later?')) return;

  await saveIncompleteRound(null, simpleFormData);
}

// Functions called from inline HTML handlers
expose({ simpleUpdateToPar, simpleSetPar, simpleAdj, submitSimple, saveSimpleForLater });
