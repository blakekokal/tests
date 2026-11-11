import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { getExpectedPutts, getExpectedStrokes } from '../sg/calc.js';
import { renderSGRadarSummary } from '../stats/radar.js';

// Calculate SG for a specific handicap WITHOUT modifying globals (for export)
export function calculateSGForHandicap(hcp){
  let ott=0, app=0, arg=0, putt=0;
  S.allHoles.forEach(h => {
    const holeShots = h.shots || [];
    holeShots.forEach((s, idx) => {
      if(!s.lie || s.lie === 'PENALTY') return;
      const distBefore = s.distanceBefore || 0;
      const distAfter = s.distanceAfter || 0;
      const isTeeShotPar45 = s.shotNum === 1 && (h.par === 4 || h.par === 5);
      const isTeeShotPar3 = s.shotNum === 1 && h.par === 3;
      const isPutt = s.isPutt;
      const isShortGame = !isPutt && distBefore <= 30 && !isTeeShotPar45;
      if(isPutt){
        const eb = getExpectedPutts(distBefore, hcp);
        let ea = 0;
        if(s.lie !== 'HOLED' && s.distanceAfter) ea = getExpectedPutts(s.distanceAfter, hcp);
        putt += eb - ea - 1;
      } else if(s.lie === 'HOLED'){
        let eb = 0;
        if(isTeeShotPar45){ eb = getExpectedStrokes(h.yards, 'TEE', hcp); ott += eb - 1; }
        else if(isTeeShotPar3){ eb = getExpectedStrokes(h.yards, 'TEE', hcp); app += eb - 1; }
        else if(isShortGame){ const pl = idx>0 ? holeShots[idx-1].lie : 'FAIRWAY'; eb = getExpectedStrokes(distBefore, pl, hcp); arg += eb - 1; }
        else { const pl = idx>0 ? holeShots[idx-1].lie : 'FAIRWAY'; eb = getExpectedStrokes(distBefore, pl, hcp); app += eb - 1; }
      } else if(isTeeShotPar45){
        const eb = getExpectedStrokes(h.yards, 'TEE', hcp);
        const ea = s.lie==='GREEN' ? getExpectedPutts(distAfter, hcp) : (distAfter>0 ? getExpectedStrokes(distAfter, s.lie, hcp) : 2.5);
        ott += eb - ea - 1;
      } else if(isTeeShotPar3){
        const eb = getExpectedStrokes(h.yards, 'TEE', hcp);
        const ea = s.lie==='GREEN' ? getExpectedPutts(distAfter, hcp) : (distAfter>0 ? getExpectedStrokes(distAfter, s.lie, hcp) : 2.5);
        app += eb - ea - 1;
      } else if(isShortGame){
        const pl = idx>0 ? holeShots[idx-1].lie : 'FAIRWAY';
        const eb = getExpectedStrokes(distBefore, pl, hcp);
        const ea = s.lie==='GREEN' ? getExpectedPutts(distAfter, hcp) : (distAfter>0 ? getExpectedStrokes(distAfter, s.lie, hcp) : 2.5);
        arg += eb - ea - 1;
      } else {
        const pl = idx>0 ? holeShots[idx-1].lie : 'FAIRWAY';
        const eb = getExpectedStrokes(distBefore, pl, hcp);
        const ea = s.lie==='GREEN' ? getExpectedPutts(distAfter, hcp) : (distAfter>0 ? getExpectedStrokes(distAfter, s.lie, hcp) : 2.5);
        app += eb - ea - 1;
      }
    });
  });
  const total = ott + app + arg + putt;
  return {total, ott, app, arg, putt};
}

// Recalculate all strokes gained data for a new handicap comparison
export function recalculateAllSG(hcp){
  S.sgOTTTotal = 0; S.sgAPPTotal = 0; S.sgARGTotal = 0; S.sgPuttingTotal = 0;
  
  S.allHoles.forEach(h => {
    let holeSgOTT = 0, holeSgAPP = 0, holeSgARG = 0, holeSgPutt = 0;
    const holePar = h.par;
    const holeShots = h.shots || [];
    
    holeShots.forEach((s, idx) => {
      s.sg = 0;
      if(!s.lie || s.lie === 'PENALTY') return;
      
      const distBefore = s.distanceBefore || 0;
      const distAfter = s.distanceAfter || 0;
      const shotNum = s.shotNum;
      const isTeeShotPar45 = shotNum === 1 && (holePar === 4 || holePar === 5);
      const isTeeShotPar3 = shotNum === 1 && holePar === 3;
      const isPutt = s.isPutt;
      const isShortGame = !isPutt && distBefore <= 30 && !isTeeShotPar45;
      
      if(isPutt){
        // Putting SG - now handicap-aware
        const puttDist = distBefore;
        const expectedBefore = getExpectedPutts(puttDist, hcp);
        let expectedAfter = 0;
        if(s.lie === 'HOLED' || s.distanceAfter === 0){
          expectedAfter = 0;
        } else if(s.distanceAfter){
          expectedAfter = getExpectedPutts(s.distanceAfter, hcp);
        }
        const sg = expectedBefore - expectedAfter - 1;
        s.sg = sg;
        holeSgPutt += sg;
      } else if(s.lie === 'HOLED'){
        let expectedBefore = 0, sg = 0;
        if(isTeeShotPar45){
          expectedBefore = getExpectedStrokes(h.yards, 'TEE', hcp);
          sg = expectedBefore - 1;
          holeSgOTT += sg;
        } else if(isTeeShotPar3){
          expectedBefore = getExpectedStrokes(h.yards, 'TEE', hcp);
          sg = expectedBefore - 1;
          holeSgAPP += sg;
        } else if(isShortGame){
          const prevShot = holeShots[idx - 1];
          const prevLie = prevShot ? prevShot.lie : 'FAIRWAY';
          expectedBefore = getExpectedStrokes(distBefore, prevLie, hcp);
          sg = expectedBefore - 1;
          holeSgARG += sg;
        } else {
          const prevShot = holeShots[idx - 1];
          const prevLie = prevShot ? prevShot.lie : 'FAIRWAY';
          expectedBefore = getExpectedStrokes(distBefore, prevLie, hcp);
          sg = expectedBefore - 1;
          holeSgAPP += sg;
        }
        s.sg = sg;
      } else if(isTeeShotPar45){
        const expectedBefore = getExpectedStrokes(h.yards, 'TEE', hcp);
        let expectedAfter;
        if(s.lie === 'GREEN'){
          expectedAfter = getExpectedPutts(distAfter, hcp);
        } else {
          expectedAfter = distAfter > 0 ? getExpectedStrokes(distAfter, s.lie, hcp) : 2.5;
        }
        const sg = expectedBefore - expectedAfter - 1;
        s.sg = sg;
        holeSgOTT += sg;
      } else if(isTeeShotPar3){
        const expectedBefore = getExpectedStrokes(h.yards, 'TEE', hcp);
        let expectedAfter;
        if(s.lie === 'GREEN'){
          expectedAfter = getExpectedPutts(distAfter, hcp);
        } else {
          expectedAfter = distAfter > 0 ? getExpectedStrokes(distAfter, s.lie, hcp) : 2.5;
        }
        const sg = expectedBefore - expectedAfter - 1;
        s.sg = sg;
        holeSgAPP += sg;
      } else if(isShortGame){
        const prevShot = holeShots[idx - 1];
        const prevLie = prevShot ? prevShot.lie : 'FAIRWAY';
        const expectedBefore = getExpectedStrokes(distBefore, prevLie, hcp);
        let expectedAfter;
        if(s.lie === 'GREEN'){
          expectedAfter = getExpectedPutts(distAfter, hcp);
        } else {
          expectedAfter = distAfter > 0 ? getExpectedStrokes(distAfter, s.lie, hcp) : 2.5;
        }
        const sg = expectedBefore - expectedAfter - 1;
        s.sg = sg;
        holeSgARG += sg;
      } else {
        // Approach
        const prevShot = holeShots[idx - 1];
        const prevLie = prevShot ? prevShot.lie : 'FAIRWAY';
        const expectedBefore = getExpectedStrokes(distBefore, prevLie, hcp);
        let expectedAfter;
        if(s.lie === 'GREEN'){
          expectedAfter = getExpectedPutts(distAfter, hcp);
        } else {
          expectedAfter = distAfter > 0 ? getExpectedStrokes(distAfter, s.lie, hcp) : 2.5;
        }
        const sg = expectedBefore - expectedAfter - 1;
        s.sg = sg;
        holeSgAPP += sg;
      }
    });
    
    h.sgOTT = holeSgOTT;
    h.sgAPP = holeSgAPP;
    h.sgARG = holeSgARG;
    h.sgPutting = holeSgPutt;
    
    S.sgOTTTotal += holeSgOTT;
    S.sgAPPTotal += holeSgAPP;
    S.sgARGTotal += holeSgARG;
    S.sgPuttingTotal += holeSgPutt;
  });
  
  // Update display
  updateSGDisplay(hcp);
}

export function updateSGDisplay(hcp){
  function formatSG(val){ return val >= 0 ? '+' + val.toFixed(2) : val.toFixed(2); }
  function colorSG(el, val){ el.style.color = val >= 0 ? '#00b87a' : '#d4706e'; }
  
  const sgTotal = S.sgOTTTotal + S.sgAPPTotal + S.sgARGTotal + S.sgPuttingTotal;
  
  const sgTotalEl = document.getElementById('sgTotal');
  sgTotalEl.innerText = formatSG(sgTotal);
  colorSG(sgTotalEl, sgTotal);
  
  const sgOTTEl = document.getElementById('sgOTT');
  sgOTTEl.innerText = formatSG(S.sgOTTTotal);
  colorSG(sgOTTEl, S.sgOTTTotal);
  
  const sgAPPEl = document.getElementById('sgAPP');
  sgAPPEl.innerText = formatSG(S.sgAPPTotal);
  colorSG(sgAPPEl, S.sgAPPTotal);
  
  const sgARGEl = document.getElementById('sgARG');
  sgARGEl.innerText = formatSG(S.sgARGTotal);
  colorSG(sgARGEl, S.sgARGTotal);
  
  const sgPuttingEl = document.getElementById('sgPuttingDisplay');
  sgPuttingEl.innerText = formatSG(S.sgPuttingTotal);
  colorSG(sgPuttingEl, S.sgPuttingTotal);
}

function onSummaryHandicapChange(hcp){
  // Sync the start-page dropdown so exports use the selected handicap
  document.getElementById('playerHandicap').value = hcp;
  recalculateAllSG(hcp);
  // Update radar chart
  setTimeout(function() { renderSGRadarSummary(); }, 50);
}

// Functions called from inline HTML handlers
expose({ onSummaryHandicapChange });
