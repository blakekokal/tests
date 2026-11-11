import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { show } from '../core/nav.js';
import { autoSaveRound } from './save.js';
import { resetRoundState } from './setup.js';
import { renderSummary } from './summary.js';
import { getExpectedPutts, getExpectedStrokes } from '../sg/calc.js';

// ─── HOLE-BY-HOLE FORM ────────────────────────────────────
var HBH_LIES = [
  'FAIRWAY','GREEN','MISSED GREEN','GS BUNKER','FW BUNKER',
  'LEFT ROUGH','RIGHT ROUGH','OB','RECOVERY','WATER','HOLE'
];
var HBH_PUTT_LIES = ['GREEN (putting)','HOLED'];

export function buildHoleByHoleForm() {
  var container = document.getElementById('hbhHolesList');
  container.innerHTML = '';
  for (var h = 1; h <= S.totalHoles; h++) {
    container.appendChild(buildHoleCard(h));
  }
}

function buildHoleCard(holeNum) {
  var card = document.createElement('div');
  card.id = 'hbh_hole_' + holeNum;
  card.style.cssText = 'background:#222222;border-radius:14px;padding:14px 14px 10px;border:1px solid #282828;';

  // Check if we have course data for this hole
  var hasCourseData = S.courseHoleData && S.courseHoleData[holeNum - 1];
  var holePar = hasCourseData ? S.courseHoleData[holeNum - 1].par : 4;
  var holeYards = hasCourseData ? S.courseHoleData[holeNum - 1].yards : '';
  var holeHcp = hasCourseData ? S.courseHoleData[holeNum - 1].hcp : '';
  var hcpLabel = holeHcp ? ' <span style="font-size:11px;color:#2e2e2e;font-weight:400;">(HCP ' + holeHcp + ')</span>' : '';
  var yardsPlaceholder = hasCourseData ? '' : 'e.g. 385';

  // Pre-select par button colors
  var p3bg = holePar === 3 ? '#3d96ee' : '#333333', p3c = holePar === 3 ? '#000' : '#9a9a9a';
  var p4bg = holePar === 4 ? '#00a06d' : '#333333', p4c = holePar === 4 ? '#000' : '#9a9a9a';
  var p5bg = holePar === 5 ? '#f0c830' : '#333333', p5c = holePar === 5 ? '#000' : '#9a9a9a';

  card.innerHTML = `
    <div style="font-size:14px;font-weight:800;margin-bottom:10px;color:#ffffff;">Hole ${holeNum}${hcpLabel}</div>

    <!-- Par selector -->
    <div style="margin-bottom:8px;">
      <div style="font-size:10px;color:#2e2e2e;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.5px;">Par</div>
      <div style="display:flex;gap:6px;">
        <button onclick="hbhSetPar(${holeNum},3,this)" style="flex:1;height:34px;border:none;border-radius:8px;background:${p3bg};color:${p3c};font-weight:700;font-size:13px;cursor:pointer;">3</button>
        <button onclick="hbhSetPar(${holeNum},4,this)" style="flex:1;height:34px;border:none;border-radius:8px;background:${p4bg};color:${p4c};font-weight:700;font-size:13px;cursor:pointer;">4</button>
        <button onclick="hbhSetPar(${holeNum},5,this)" style="flex:1;height:34px;border:none;border-radius:8px;background:${p5bg};color:${p5c};font-weight:700;font-size:13px;cursor:pointer;">5</button>
      </div>
    </div>

    <!-- Yardage -->
    <div style="margin-bottom:10px;">
      <div style="font-size:10px;color:#2e2e2e;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.5px;">Yardage</div>
      <input id="hbh_yards_${holeNum}" type="number" inputmode="numeric" placeholder="${yardsPlaceholder}" value="${holeYards}" style="width:100%;height:36px;background:#282828;color:#ffffff;border:none;border-radius:8px;text-align:center;font-size:14px;box-sizing:border-box;">
    </div>

    <!-- Shots -->
    <div id="hbh_shots_${holeNum}">
      <div style="font-size:10px;color:#2e2e2e;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Shots</div>
      ${buildShotRow(holeNum, 1)}
    </div>
    <button onclick="hbhAddShot(${holeNum})" style="width:100%;height:30px;background:transparent;border:1px dashed #3d3d3d;border-radius:8px;color:#2e2e2e;font-size:12px;cursor:pointer;margin-top:6px;">+ Add Shot</button>
  `;

  // Store par value on card
  card.dataset.par = holePar;

  return card;
}

function buildShotRow(holeNum, shotNum) {
  var lieOptions = HBH_LIES.map(function(l) {
    return '<option value="' + l + '">' + l + '</option>';
  }).join('');

  return `<div id="hbh_shot_${holeNum}_${shotNum}" style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
    <div style="font-size:11px;color:#606060;width:20px;flex-shrink:0;text-align:center;">${shotNum}</div>
    <select id="hbh_lie_${holeNum}_${shotNum}" onchange="hbhLieChanged(${holeNum},${shotNum},this)" style="flex:1;height:34px;background:#282828;color:#ffffff;border:none;border-radius:8px;font-size:12px;padding:0 6px;appearance:none;-webkit-appearance:none;">
      <option value="">End Lie...</option>
      ${lieOptions}
    </select>
    <div style="position:relative;flex-shrink:0;">
      <input id="hbh_dist_${holeNum}_${shotNum}" type="number" inputmode="numeric" placeholder="Dist" style="width:76px;height:34px;background:#282828;color:#ffffff;border:none;border-radius:8px;text-align:center;font-size:12px;padding-right:22px;box-sizing:border-box;">
      <span id="hbh_unit_${holeNum}_${shotNum}" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:9px;color:#2e2e2e;pointer-events:none;">yds</span>
    </div>
  </div>`;
}

export function hbhLieChanged(holeNum, shotNum, selectEl) {
  var lie = selectEl.value;
  var unitEl = document.getElementById('hbh_unit_' + holeNum + '_' + shotNum);
  var distEl = document.getElementById('hbh_dist_' + holeNum + '_' + shotNum);
  if (!unitEl) return;
  if (lie === 'GREEN') {
    unitEl.textContent = 'ft';
    unitEl.style.color = '#44b8f0';
    distEl.placeholder = 'Feet';
  } else {
    unitEl.textContent = 'yds';
    unitEl.style.color = '#2e2e2e';
    distEl.placeholder = 'Dist';
  }
}

export function hbhSetPar(holeNum, parVal, btn) {
  // Update button styles
  var btns = btn.parentElement.querySelectorAll('button');
  btns.forEach(function(b) { b.style.background = '#282828'; b.style.color = '#9a9a9a'; });
  btn.style.background = parVal === 3 ? '#3d96ee' : parVal === 4 ? '#00a06d' : '#f0c830';
  btn.style.color = '#000';
  btn.dataset.parSelected = parVal;
  // Only update yardage to default if no course data for this hole
  var yardsInput = document.getElementById('hbh_yards_' + holeNum);
  if (!S.courseHoleData || !S.courseHoleData[holeNum - 1]) {
    yardsInput.value = parVal === 3 ? 150 : parVal === 4 ? 400 : 520;
  }
  // Store par value on card
  var card = document.getElementById('hbh_hole_' + holeNum);
  card.dataset.par = parVal;
}

export function hbhAddShot(holeNum) {
  var shotsContainer = document.getElementById('hbh_shots_' + holeNum);
  var existing = shotsContainer.querySelectorAll('[id^="hbh_shot_' + holeNum + '_"]');
  var nextShotNum = existing.length + 1;
  if (nextShotNum > 10) return; // max 10 shots
  shotsContainer.insertAdjacentHTML('beforeend', buildShotRow(holeNum, nextShotNum));
}

function submitHoleByHole() {
  // Validate first before resetting anything
  var errors = [];
  for (var h = 1; h <= S.totalHoles; h++) {
    var shotsContainer = document.getElementById('hbh_shots_' + h);
    if (!shotsContainer) { errors.push('Hole ' + h + ': missing'); continue; }
    var shotEls = shotsContainer.querySelectorAll('[id^="hbh_shot_' + h + '_"]');
    var hasShot = false;
    for (var s = 0; s < shotEls.length; s++) {
      var lieEl = document.getElementById('hbh_lie_' + h + '_' + (s + 1));
      if (lieEl && lieEl.value) { hasShot = true; break; }
    }
    if (!hasShot) errors.push('Hole ' + h + ': no shots entered');
  }
  if (errors.length > 0) {
    alert('Please fix:\n' + errors.join('\n'));
    return;
  }

  // Save totalHoles before reset clears it
  var savedTotalHoles = S.totalHoles;

  // Reset all round state
  resetRoundState();
  S.currentRoundId = null;

  // Restore totalHoles (resetRoundState doesn't touch it but be safe)
  S.totalHoles = savedTotalHoles;

  for (var h = 1; h <= S.totalHoles; h++) {
    var card = document.getElementById('hbh_hole_' + h);
    var parVal = parseInt(card.dataset.par) || 4;
    var yardsVal = parseInt(document.getElementById('hbh_yards_' + h).value) || (parVal === 3 ? 150 : parVal === 4 ? 400 : 520);

    var shotsContainer = document.getElementById('hbh_shots_' + h);
    var shotEls = shotsContainer.querySelectorAll('[id^="hbh_shot_' + h + '_"]');
    var holeShots = [];
    var shotCount = 0;
    var puttCount = 0;

    for (var s = 0; s < shotEls.length; s++) {
      var sNum = s + 1;
      var lieEl = document.getElementById('hbh_lie_' + h + '_' + sNum);
      var distEl = document.getElementById('hbh_dist_' + h + '_' + sNum);
      if (!lieEl) continue;
      var lie = lieEl.value;
      if (!lie) continue;

      var distLeft = parseFloat(distEl ? distEl.value : 0) || 0;

      // Determine if this shot is a putt:
      // A shot is a putt if the PREVIOUS shot ended on GREEN
      var prevShot = holeShots.length > 0 ? holeShots[holeShots.length - 1] : null;
      var isPutt = prevShot && prevShot.lie === 'GREEN';

      shotCount++;
      if (isPutt) puttCount++;

      // distanceBefore: if putt, use previous shot's distanceAfter (feet); else use yards
      var distBefore;
      if (isPutt) {
        distBefore = prevShot.distanceAfter || 0; // already in feet
      } else if (holeShots.length > 0) {
        distBefore = prevShot.distanceAfter || 0; // yards
      } else {
        distBefore = yardsVal; // tee shot
      }

      // Normalise lie: HOLE means holed out
      var normLie = lie;

      holeShots.push({
        shotNum: shotCount,
        lie: normLie,
        distanceBefore: distBefore,
        distanceAfter: distLeft,
        isPutt: isPutt
      });
    }

    // Ensure last shot is marked as holed
    if (holeShots.length > 0) {
      var last = holeShots[holeShots.length - 1];
      if (last.lie !== 'HOLE' && last.lie !== 'HOLED') {
        last.lie = 'HOLE';
        last.distanceAfter = 0;
      }
    }

    S.currentHoleData = { hole: h, par: parVal, yards: yardsVal };
    S.currentHoleShots = holeShots;
    S.par = parVal;
    S.shots = shotCount - puttCount;
    S.putts = puttCount;
    S.currentHole = h;
    S.totalPutts += puttCount;

    S.firstPuttThisHole = null;
    for (var i = 0; i < holeShots.length; i++) {
      if (holeShots[i].isPutt) {
        S.firstPuttThisHole = holeShots[i].distanceBefore; // in feet
        break;
      }
    }

    S.girThisHole = false;
    S.scrCountedThisHole = false;

    finishHole_hbh();
  }

  // Show summary
  scoreBar.style.display = 'none';
  renderSummary();
  document.getElementById('backToRoundsBtn').style.display = 'none';
  document.getElementById('saveStatus').textContent = '';
  S.viewingStudentRound = false;
  var saveBtn = document.getElementById('saveToAccountBtn');
  if (saveBtn) saveBtn.style.display = S.currentUser ? '' : 'none';
  show('summaryPage');

  // Auto-save if logged in
  if (S.currentUser && S.allHoles.length > 0) {
    autoSaveRound();
  }
}

// Wrapper around finishHole that skips page navigation
function finishHole_hbh() {
  var holeStrokes = S.shots + S.putts;
  S.currentHoleData.score = holeStrokes;
  S.currentHoleData.putts = S.putts;
  S.currentHoleData.shots = S.currentHoleShots;

  // ── Reuse all the stat counting from finishHole ──
  // FAIRWAY
  if (S.par === 4 || S.par === 5) {
    var teeShot = S.currentHoleShots[0];
    if (teeShot && teeShot.lie) {
      S.fwOpp++;
      if (teeShot.lie === 'FAIRWAY' || teeShot.lie === 'GREEN') S.fwHit++;
      else if (teeShot.lie === 'LEFT ROUGH') S.fwLeft++;
      else if (teeShot.lie === 'RIGHT ROUGH') S.fwRight++;
    }
  }
  // GIR
  var shotsToGreen = S.currentHoleShots.filter(function(s) { return !s.isPutt && s.lie !== 'PENALTY'; }).length;
  var hitGIR = shotsToGreen <= S.par - 2 && S.currentHoleShots.some(function(s) { return s.lie === 'GREEN' || s.lie === 'HOLED'; });
  if (hitGIR) {
    S.gir++;
    S.girPutts += S.putts;
    if (S.firstPuttThisHole !== null) S.girFirstPuttDist += S.firstPuttThisHole;
  }
  // SCRAMBLING
  if (!hitGIR) {
    var hadScr = false;
    S.currentHoleShots.forEach(function(s) {
      if (!s.isPutt && s.lie === 'GREEN' && s.distanceBefore <= 30) hadScr = true;
    });
    if (hadScr) { S.scrOpp++; if (S.putts === 1) S.scr++; }
  }
  // BUNKER
  var hitBunker = false;
  S.currentHoleShots.forEach(function(s) { if (s.lie === 'GS BUNKER') { S.bunOpp++; hitBunker = true; } });
  if (hitBunker && S.putts === 1) S.bun++;
  // MISSED GREEN DIRECTION
  S.currentHoleShots.forEach(function(s) {
    if (s.lie && s.lie.startsWith('MISS ')) {
      S.girOpp++;
      if (s.lie === 'MISS LEFT') S.missLeft++;
      if (s.lie === 'MISS RIGHT') S.missRight++;
      if (s.lie === 'MISS SHORT') S.missShort++;
      if (s.lie === 'MISS LONG') S.missLong++;
    }
  });
  // PUTTING
  if (S.putts > 0) {
    S.onePuttOpp++;
    if (S.putts === 1) S.onePuttMade++;
    if (S.putts >= 3) S.threePlusPutts++;
  }

  // SG calculations (reuse existing functions)
  var holeSgOTT = 0, holeSgAPP = 0, holeSgARG = 0, holeSgPutt = 0;
  S.currentHoleShots.forEach(function(s, idx) {
    s.sg = 0;
    if (!s.lie || s.lie === 'PENALTY') return;
    var distBefore = s.distanceBefore || 0;
    var distAfter = s.distanceAfter || 0;
    var shotNum = s.shotNum;
    var isTeeShotPar45 = shotNum === 1 && (S.par === 4 || S.par === 5);
    var isTeeShotPar3 = shotNum === 1 && S.par === 3;
    var isPutt = s.isPutt;
    var isShortGame = !isPutt && distBefore <= 30 && !isTeeShotPar45;
    var isApproach = !isPutt && !isTeeShotPar45 && !isShortGame;

    if (isPutt) {
      var puttDist = distBefore;
      var expectedBefore = getExpectedPutts(puttDist);
      var expectedAfter = (s.lie === 'HOLE' || distAfter === 0) ? 0 : getExpectedPutts(distAfter);
      var sg = expectedBefore - expectedAfter - 1;
      s.sg = sg;
      holeSgPutt += sg;
    } else if (isTeeShotPar45) {
      var expectedBefore = getExpectedStrokes(S.currentHoleData.yards, 'TEE');
      var expectedAfter = s.lie === 'GREEN' ? getExpectedPutts(distAfter) : (distAfter > 0 ? getExpectedStrokes(distAfter, s.lie) : 2.5);
      var sg = expectedBefore - expectedAfter - 1;
      s.sg = sg; holeSgOTT += sg;
    } else if (isTeeShotPar3) {
      var expectedBefore = getExpectedStrokes(S.currentHoleData.yards, 'TEE');
      var expectedAfter = s.lie === 'GREEN' ? getExpectedPutts(distAfter) : (distAfter > 0 ? getExpectedStrokes(distAfter, s.lie) : 2.5);
      var sg = expectedBefore - expectedAfter - 1;
      s.sg = sg; holeSgAPP += sg;
    } else if (isShortGame) {
      var prevShot = S.currentHoleShots[idx - 1];
      var prevLie = prevShot ? prevShot.lie : 'FAIRWAY';
      var expectedBefore = getExpectedStrokes(distBefore, prevLie);
      var expectedAfter = s.lie === 'GREEN' ? getExpectedPutts(distAfter) : (distAfter > 0 ? getExpectedStrokes(distAfter, s.lie) : 2.5);
      var sg = expectedBefore - expectedAfter - 1;
      s.sg = sg; holeSgARG += sg;
    } else if (isApproach) {
      var prevShot = S.currentHoleShots[idx - 1];
      var prevLie = prevShot ? prevShot.lie : 'FAIRWAY';
      var expectedBefore = getExpectedStrokes(distBefore, prevLie);
      var expectedAfter = s.lie === 'GREEN' ? getExpectedPutts(distAfter) : (distAfter > 0 ? getExpectedStrokes(distAfter, s.lie) : 2.5);
      var sg = expectedBefore - expectedAfter - 1;
      s.sg = sg; holeSgAPP += sg;
    }
  });

  var firstPuttDist = 0;
  S.currentHoleShots.forEach(function(s) {
    if (s.isPutt && firstPuttDist === 0) firstPuttDist = s.distanceBefore || 0;
  });
  S.currentHoleData.firstPuttDist = firstPuttDist;
  S.currentHoleData.expectedPutts = firstPuttDist > 0 ? getExpectedPutts(firstPuttDist) : 0;
  S.currentHoleData.sgOTT = holeSgOTT;
  S.currentHoleData.sgAPP = holeSgAPP;
  S.currentHoleData.sgARG = holeSgARG;
  S.currentHoleData.sgPutting = holeSgPutt;

  S.sgOTTTotal += holeSgOTT;
  S.sgAPPTotal += holeSgAPP;
  S.sgARGTotal += holeSgARG;
  S.sgPuttingTotal += holeSgPutt;

  S.allHoles.push(S.currentHoleData);

  if (S.par === 3) { S.c3++; S.p3 += holeStrokes; }
  if (S.par === 4) { S.c4++; S.p4 += holeStrokes; }
  if (S.par === 5) { S.c5++; S.p5 += holeStrokes; }
  S.totalStrokes += holeStrokes;
  S.totalPar += S.par;
}

// Functions called from inline HTML handlers
expose({ hbhLieChanged, hbhSetPar, hbhAddShot, submitHoleByHole });
