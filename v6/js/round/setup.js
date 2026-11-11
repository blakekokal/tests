import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { show } from '../core/router.js';
import { getTodayCentral } from '../core/util.js';
import { buildHoleByHoleForm } from './hole-entry.js';
import { updateParPageRoundActions } from './save.js';
import { buildSimpleForm } from './simple-entry.js';

export function resetRoundState() {
  S.allHoles = [];
  S.currentHole = 1;
  S.totalPar = 0; S.totalStrokes = 0; S.par = 4; S.shots = 0; S.putts = 0;
  S.fwOpp = 0; S.fwHit = 0; S.fwLeft = 0; S.fwRight = 0;
  S.gir = 0; S.girFirstPuttDist = 0; S.girOpp = 0; 
  S.missLeft = 0; S.missRight = 0; S.missShort = 0; S.missLong = 0;
  S.scrOpp = 0; S.scr = 0; S.bunOpp = 0; S.bun = 0;
  S.p3 = 0; S.p4 = 0; S.p5 = 0; S.c3 = 0; S.c4 = 0; S.c5 = 0;
  S.firstPuttThisHole = null;
  S.girThisHole = false; S.scrCountedThisHole = false;
  S.totalPutts = 0; S.girPutts = 0; S.threePlusPutts = 0;
  S.onePuttOpp = 0; S.onePuttMade = 0;
  S.sgPuttingTotal = 0; S.sgOTTTotal = 0; S.sgAPPTotal = 0; S.sgARGTotal = 0;
  S.currentHoleShots = [];
  
  S.currentRoundId = null;
  S.viewingStudentRound = false;
  S.editingHoleIndex = null;
  S.selectedCourse = null;
  S.selectedTee = null;
  S.courseHoleData = null;

  if(document.getElementById('playerName')) document.getElementById('playerName').value = '';
  if(document.getElementById('courseName')) document.getElementById('courseName').value = '';
  if(document.getElementById('roundDate')) document.getElementById('roundDate').value = getTodayCentral();
  if(document.getElementById('holeHeader')) document.getElementById('holeHeader').innerText = 'Hole 1';
  if(document.getElementById('scoreBarText')) document.getElementById('scoreBarText').innerText = 'E through 0';
  if(document.getElementById('courseLabel')) document.getElementById('courseLabel').innerText = '';
  if(document.getElementById('hbhCourseName')) { document.getElementById('hbhCourseName').innerText = ''; document.getElementById('hbhCourseName').style.display = 'none'; }
  if(document.getElementById('teeSelector')) { document.getElementById('teeSelector').style.display = 'none'; document.getElementById('teeSelector').innerHTML = '<option value="">Select Tee Box...</option>'; }
  if(document.getElementById('teeInfo')) document.getElementById('teeInfo').style.display = 'none';
}

// ─── ENTRY MODE ───────────────────────────────────────────
// S.entryMode: 'shot', 'hole', 'simple' or 'photo'. Photo hands over to 'simple' or 'hole'
// once the photo is read, so saved rounds only ever carry the first three.

// Button colour for each entry mode when selected
var ENTRY_MODE_COLORS = { shot: '#007a52', hole: '#2d7abc', simple: '#3d96ee', photo: '#1a4a8a' };

export function setEntryMode(mode) {
  S.entryMode = mode;
  Object.keys(ENTRY_MODE_COLORS).forEach(function(m) {
    var btn = document.getElementById('modeBtn_' + m);
    btn.style.background = 'transparent';
    btn.style.color = '#606060';
  });
  var selected = document.getElementById('modeBtn_' + mode);
  selected.style.background = ENTRY_MODE_COLORS[mode];
  selected.style.color = '#ffffff';
}

/** The "filled in from your photo" note only applies to a form opened from Photo entry. */
export function hidePhotoNotices() {
  var n = document.getElementById('simplePhotoNotice');
  if (n) n.style.display = 'none';
}

function enterScoring() {
  const c = parseInt(customHoles.value);
  S.totalHoles = (c >= 3 && c <= 18) ? c : (S.totalHoles || 9);
  S.currentRoundId = null;
  if (document.getElementById('holeHeader')) document.getElementById('holeHeader').innerText = 'Hole 1';

  // Set course name in score bar
  var cLabel = document.getElementById('courseLabel');
  var cName = document.getElementById('courseName').value || '';
  if (cLabel) cLabel.innerText = cName;

  hidePhotoNotices();
  if (S.entryMode === 'photo') {
    show('photoEntryPage');
  } else if (S.entryMode === 'simple') {
    var sCN = document.getElementById('simplCourseName');
    if (sCN) { sCN.innerText = cName; sCN.style.display = cName ? 'block' : 'none'; }
    buildSimpleForm();
    show('simpleEntryPage');
  } else if (S.entryMode === 'hole') {
    var hbhCN = document.getElementById('hbhCourseName');
    if (hbhCN) { hbhCN.innerText = cName; hbhCN.style.display = cName ? 'block' : 'none'; }
    buildHoleByHoleForm();
    show('holeByHolePage');
  } else {
    // Auto-populate par/yardage for hole 1 if course data available
    if (S.courseHoleData && S.courseHoleData.length >= 1) {
      var h1 = S.courseHoleData[0];
      S.par = h1.par;
      document.getElementById('holeYards').value = h1.yards;
      // Highlight correct par button
      var parBtns = document.querySelectorAll('#parPage .par3, #parPage .par4, #parPage .par5');
      parBtns.forEach(function(b) { b.classList.remove('selected'); });
      if (h1.par === 3 && parBtns[0]) parBtns[0].classList.add('selected');
      else if (h1.par === 4 && parBtns[1]) parBtns[1].classList.add('selected');
      else if (h1.par === 5 && parBtns[2]) parBtns[2].classList.add('selected');
    }
    scoreBar.style.display = 'flex';
    show('parPage');
    updateParPageRoundActions();
  }
}

// Functions called from inline HTML handlers
expose({ setEntryMode, enterScoring });
