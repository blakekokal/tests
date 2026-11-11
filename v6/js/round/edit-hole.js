import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { show } from '../core/router.js';
import { _sb } from '../core/supabase.js';
import { renderSummary } from './summary.js';
import { getExpectedPutts, getExpectedStrokes } from '../sg/calc.js';
import { showFullStatTab, showFullStats } from '../stats/full-stats.js';

// ===== v2.7.0: EDIT HOLE FUNCTIONALITY =====


function editHole(holeIdx) {
  
  if (holeIdx < 0 || holeIdx >= S.allHoles.length) {
    return;
  }
  
  // Make sure we're not already editing
  if (S.editingHoleIndex !== null) {
    S.editingHoleIndex = null;
  }
  
  var hole = S.allHoles[holeIdx];
  S.editingHoleIndex = holeIdx;
  
  
  // Set up state to re-enter this hole
  S.currentHole = hole.hole;
  S.currentPar = hole.par;
  S.par = hole.par;
  S.currentYards = hole.yards;
  
  // Reset ALL hole-level tracking
  S.shots = 1;
  S.putts = 0;
  S.currentHoleShots = [];
  S.girThisHole = false;
  S.scrCountedThisHole = false;
  S.firstPuttThisHole = null;
  S.processingClick = false; // v3.0.0: Reset click guard
  
  // Set up currentHoleData
  S.currentHoleData = {
    hole: S.currentHole,
    par: S.currentPar,
    yards: S.currentYards,
    score: 0,
    putts: 0,
    shots: []
  };
  
  // Update UI - go to PAR PAGE so user can change par/yardage
  document.getElementById('holeHeader').innerText = 'Hole ' + S.currentHole + ' (Edit)';
  document.getElementById('holeYards').value = S.currentYards;
  
  // Pre-select the par button
  document.querySelectorAll('.par-btn').forEach(function(btn) {
    btn.classList.remove('selected');
    if (parseInt(btn.dataset.par) === S.currentPar) {
      btn.classList.add('selected');
    }
  });
  
  // Update score bar
  scoreBar.style.display = 'flex';
  var editCLabel = document.getElementById('courseLabel');
  if (editCLabel) editCLabel.innerText = document.getElementById('courseName').value || '';
  document.getElementById('scoreBarText').innerText = 'Editing Hole ' + S.currentHole;
  
  // Go to par page instead of lie page
  show('parPage');
}

export function finishEditedHole() {
  
  var holeStrokes = S.shots + S.putts;
  
  // Use currentHoleData which has the user's NEW selections from startHole()
  var holeData = {
    hole: S.currentHoleData.hole,
    par: S.currentHoleData.par,
    yards: S.currentHoleData.yards,
    score: holeStrokes,
    putts: S.putts,
    shots: JSON.parse(JSON.stringify(S.currentHoleShots)),
    sgOTT: 0,
    sgAPP: 0,
    sgARG: 0,
    sgPutting: 0
  };
  
  // Recalculate SG for this hole
  var hcp = document.getElementById('playerHandicap').value || 'pro';
  recalculateHoleSG(holeData, hcp);
  
  // Replace in allHoles
  S.allHoles[S.editingHoleIndex] = holeData;
  
  
  // Reset editing state BEFORE recalculating
  var wasEditing = S.editingHoleIndex;
  S.editingHoleIndex = null;
  
  
  // Recalculate all stats from scratch
  recalculateAllStatsFromHoles();
  
  // Reset hole-level flags for next use
  S.girThisHole = false;
  S.scrCountedThisHole = false;
  S.firstPuttThisHole = null;
  S.processingClick = false;
  
  // Hide score bar and go back to full stats play-by-play tab
  scoreBar.style.display = 'none';
  renderSummary();
  refreshFullStats(6);
  show('fullStatsPage');
  
  
  // If we're viewing a saved round, update it in the database
  if (S.currentRoundId && S.currentUser) {
    updateSavedRound();
  }
}

// Update the saved round in the database after editing
async function updateSavedRound() {
  if (!S.currentRoundId || !S.currentUser) return;
  
  
  // Collect all round stats for the JSON blob
  const roundBlob = {
    allHoles: S.allHoles.map(h => ({
      hole: h.hole, par: h.par, yards: h.yards, score: h.score, putts: h.putts,
      firstPuttDist: h.firstPuttDist, expectedPutts: h.expectedPutts,
      sgOTT: h.sgOTT, sgAPP: h.sgAPP, sgARG: h.sgARG, sgPutting: h.sgPutting,
      shots: h.shots.map(s => ({
        shotNum: s.shotNum, lie: s.lie, distanceBefore: s.distanceBefore,
        distanceAfter: s.distanceAfter, isPutt: s.isPutt
      }))
    })),
    stats: {
      fwHit: S.fwHit, fwOpp: S.fwOpp, fwLeft: S.fwLeft, fwRight: S.fwRight,
      girHit: S.gir, girOpp: S.girOpp,
      scrMade: S.scr, scrOpp: S.scrOpp,
      bunMade: S.bun, bunOpp: S.bunOpp,
      totalPutts: S.allHoles.reduce((s,h)=>s+h.putts,0),
      onePutts: S.onePuttMade,
      threePutts: S.threePlusPutts,
      avgDrive: (function(){ let t=0,c=0; S.allHoles.forEach(h=>{ if(h.par>=4){ const ts=h.shots.find(s=>s.shotNum===1); if(ts&&ts.distanceAfter>0&&ts.lie!=='PENALTY'&&ts.lie!=='OB'&&ts.lie!=='WATER'){ t+=ts.distanceBefore-ts.distanceAfter; c++; }}});  return c>0?Math.round(t/c):0; })()
    }
  };
  
  const { error } = await _sb.from('rounds').update({
    score: S.totalStrokes,
    par: S.totalPar,
    to_par: S.totalStrokes - S.totalPar,
    round_data: roundBlob
  }).eq('id', S.currentRoundId);
  
  if (error) {
    console.error('Error updating round:', error);
    document.getElementById('saveStatus').textContent = 'Error saving changes';
    document.getElementById('saveStatus').style.color = '#d4706e';
  } else {
    document.getElementById('saveStatus').textContent = '✓ Changes saved';
    document.getElementById('saveStatus').style.color = '#00b87a';
  }
}

// Recalculate SG for a single hole
function recalculateHoleSG(hole, hcp) {
  var holeSgOTT = 0, holeSgAPP = 0, holeSgARG = 0, holeSgPutt = 0;
  
  hole.shots.forEach(function(s, idx) {
    s.sg = 0;
    if (!s.lie || s.lie === 'PENALTY') return;
    
    var distBefore = s.distanceBefore || 0;
    var distAfter = s.distanceAfter || 0;
    var shotNum = s.shotNum;
    var isTeeShotPar45 = shotNum === 1 && (hole.par === 4 || hole.par === 5);
    var isTeeShotPar3 = shotNum === 1 && hole.par === 3;
    var isPutt = s.isPutt;
    var isShortGame = !isPutt && distBefore <= 30 && !isTeeShotPar45;
    
    if (isPutt) {
      var expectedBefore = getExpectedPutts(distBefore, hcp);
      var expectedAfter = (s.lie === 'HOLED' || s.distanceAfter === 0) ? 0 : getExpectedPutts(s.distanceAfter, hcp);
      s.sg = expectedBefore - expectedAfter - 1;
      holeSgPutt += s.sg;
    } else if (s.lie === 'HOLED') {
      var expBefore = isTeeShotPar45 || isTeeShotPar3 ? 
        getExpectedStrokes(hole.yards, 'TEE', hcp) :
        getExpectedStrokes(distBefore, idx > 0 ? hole.shots[idx-1].lie : 'FAIRWAY', hcp);
      s.sg = expBefore - 1;
      if (isTeeShotPar45) holeSgOTT += s.sg;
      else if (isTeeShotPar3 || !isShortGame) holeSgAPP += s.sg;
      else holeSgARG += s.sg;
    } else if (isTeeShotPar45) {
      var expBefore = getExpectedStrokes(hole.yards, 'TEE', hcp);
      var expAfter = s.lie === 'GREEN' ? getExpectedPutts(distAfter, hcp) : 
        (distAfter > 0 ? getExpectedStrokes(distAfter, s.lie, hcp) : 2.5);
      s.sg = expBefore - expAfter - 1;
      holeSgOTT += s.sg;
    } else if (isTeeShotPar3) {
      var expBefore = getExpectedStrokes(hole.yards, 'TEE', hcp);
      var expAfter = s.lie === 'GREEN' ? getExpectedPutts(distAfter, hcp) : 
        (distAfter > 0 ? getExpectedStrokes(distAfter, s.lie, hcp) : 2.5);
      s.sg = expBefore - expAfter - 1;
      holeSgAPP += s.sg;
    } else if (isShortGame) {
      var prevLie = idx > 0 ? hole.shots[idx-1].lie : 'FAIRWAY';
      var expBefore = getExpectedStrokes(distBefore, prevLie, hcp);
      var expAfter = s.lie === 'GREEN' ? getExpectedPutts(distAfter, hcp) : 
        (distAfter > 0 ? getExpectedStrokes(distAfter, s.lie, hcp) : 2.5);
      s.sg = expBefore - expAfter - 1;
      holeSgARG += s.sg;
    } else {
      var prevLie = idx > 0 ? hole.shots[idx-1].lie : 'FAIRWAY';
      var expBefore = getExpectedStrokes(distBefore, prevLie, hcp);
      var expAfter = s.lie === 'GREEN' ? getExpectedPutts(distAfter, hcp) : 
        (distAfter > 0 ? getExpectedStrokes(distAfter, s.lie, hcp) : 2.5);
      s.sg = expBefore - expAfter - 1;
      holeSgAPP += s.sg;
    }
  });
  
  hole.sgOTT = holeSgOTT;
  hole.sgAPP = holeSgAPP;
  hole.sgARG = holeSgARG;
  hole.sgPutting = holeSgPutt;
}

// Recalculate ALL stats by walking through allHoles data (the source of truth)
function recalculateAllStatsFromHoles() {
  // Reset all global stat counters
  S.fwOpp = 0; S.fwHit = 0; S.fwLeft = 0; S.fwRight = 0;
  S.gir = 0; S.girFirstPuttDist = 0; S.girPutts = 0;
  S.girOpp = 0; S.missLeft = 0; S.missRight = 0; S.missShort = 0; S.missLong = 0;
  S.scrOpp = 0; S.scr = 0;
  S.bunOpp = 0; S.bun = 0;
  S.p3 = 0; S.p4 = 0; S.p5 = 0; S.c3 = 0; S.c4 = 0; S.c5 = 0;
  S.totalPutts = 0;
  S.threePlusPutts = 0;
  S.onePuttOpp = 0; S.onePuttMade = 0;
  S.totalStrokes = 0; S.totalPar = 0;
  S.sgOTTTotal = 0; S.sgAPPTotal = 0; S.sgARGTotal = 0; S.sgPuttingTotal = 0;
  
  S.allHoles.forEach(function(h) {
    // Par averages
    if (h.par === 3) { S.c3++; S.p3 += h.score; }
    if (h.par === 4) { S.c4++; S.p4 += h.score; }
    if (h.par === 5) { S.c5++; S.p5 += h.score; }
    
    S.totalStrokes += h.score;
    S.totalPar += h.par;
    S.totalPutts += h.putts || 0;
    
    // SG totals
    S.sgOTTTotal += h.sgOTT || 0;
    S.sgAPPTotal += h.sgAPP || 0;
    S.sgARGTotal += h.sgARG || 0;
    S.sgPuttingTotal += h.sgPutting || 0;
    
    // Fairway stats (only par 4/5)
    if ((h.par === 4 || h.par === 5) && h.shots && h.shots.length > 0) {
      var teeShot = h.shots[0];
      S.fwOpp++;
      if (teeShot.lie === 'FAIRWAY' || teeShot.lie === 'GREEN') S.fwHit++;
      if (teeShot.lie === 'LEFT ROUGH') S.fwLeft++;
      if (teeShot.lie === 'RIGHT ROUGH') S.fwRight++;
    }
    
    // GIR stats
    var hitGIR = false;
    var firstPuttDist = 0;
    if (h.shots) {
      h.shots.forEach(function(s, idx) {
        if (s.lie === 'GREEN' && s.shotNum <= h.par - 2) {
          hitGIR = true;
          var nextS = h.shots[idx + 1];
          if (nextS && nextS.isPutt) {
            firstPuttDist = nextS.distanceBefore || 0;
          }
        }
        // Bunker opportunities
        if (s.lie === 'GS BUNKER') S.bunOpp++;
        // Missed green directions
        if (s.lie && s.lie.startsWith('MISS ')) {
          S.girOpp++;
          if (s.lie === 'MISS LEFT') S.missLeft++;
          if (s.lie === 'MISS RIGHT') S.missRight++;
          if (s.lie === 'MISS SHORT') S.missShort++;
          if (s.lie === 'MISS LONG') S.missLong++;
        }
      });
    }
    
    if (hitGIR) {
      S.gir++;
      S.girFirstPuttDist += firstPuttDist;
      S.girPutts += h.putts || 0;
    } else {
      // Check for scrambling (hit green from <=30 yards, made par or better)
      var hitGreenLater = false;
      if (h.shots) {
        h.shots.forEach(function(s) {
          if (s.lie === 'GREEN' && s.distanceBefore && s.distanceBefore <= 30) {
            hitGreenLater = true;
          }
        });
      }
      if (hitGreenLater) {
        S.scrOpp++;
        if (h.putts === 1) S.scr++;
      }
    }
    
    // Bunker saves
    var hadBunker = h.shots && h.shots.some(function(s) { return s.lie === 'GS BUNKER'; });
    if (hadBunker && h.putts === 1) S.bun++;
    
    // Putt stats
    if (h.putts > 0) {
      S.onePuttOpp++;
      if (h.putts === 1) S.onePuttMade++;
    }
    if (h.putts >= 3) S.threePlusPutts++;
  });
}

export function refreshFullStats(tabIndex) {
  showFullStats();
  if (typeof tabIndex === 'number') {
    setTimeout(function() { showFullStatTab(tabIndex); }, 50);
  }
}

// Functions called from inline HTML handlers
expose({ editHole });
