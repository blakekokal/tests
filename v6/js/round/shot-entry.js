import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { show } from '../core/nav.js';
import { ordinal } from '../core/util.js';
import { finishEditedHole } from './edit-hole.js';
import { autoSaveRound, updateParPageRoundActions } from './save.js';
import { renderSummary } from './summary.js';
import { getExpectedPutts, getExpectedStrokes } from '../sg/calc.js';

export function undoLastHole(){
  // Get the last completed hole from allHoles
  const lastHole=S.allHoles[S.allHoles.length-1];
  if(!lastHole) return;
  
  // Remove it from allHoles
  S.currentHole--;
  S.allHoles.pop();
  
  const lastScore=lastHole.score;
  
  // Reverse all stats
  S.totalStrokes-=lastScore;
  S.totalPar-=lastHole.par;
  S.totalPutts-=lastHole.putts;
  
  if(lastHole.par===3){S.c3--;S.p3-=lastScore;}
  if(lastHole.par===4){S.c4--;S.p4-=lastScore;}
  if(lastHole.par===5){S.c5--;S.p5-=lastScore;}
  
  // Reverse GIR
  let hadGIR=false;
  let firstPuttDist=0;
  lastHole.shots.forEach(s=>{
    if(s.lie==='GREEN'&&s.shotNum<=(lastHole.par-2)){
      hadGIR=true;
      S.gir--;
      firstPuttDist=s.distanceAfter||0;
    }
  });
  if(hadGIR&&firstPuttDist>0){
    S.girFirstPuttDist-=firstPuttDist;
    S.girPutts-=lastHole.putts;
  }
  
  // Reverse scrambling - check if there was a scrambling opportunity on this hole
  let hadScrambleOpp=false;
  if(!hadGIR){
    // Check if there was a GS bunker or missed GIR situation
    lastHole.shots.forEach(s=>{
      if(s.lie==='GS BUNKER') hadScrambleOpp=true;
    });
    // If they hit green after missing in regulation, that's also a scramble opp
    if(!hadScrambleOpp){
      lastHole.shots.forEach(s=>{
        if(s.lie==='GREEN'&&s.shotNum>(lastHole.par-2)) hadScrambleOpp=true;
      });
    }
    if(hadScrambleOpp){
      S.scrOpp--;
      if(lastHole.putts===1) S.scr--;
    }
  }
  
  // Reverse fairway stats
  if(lastHole.par===4||lastHole.par===5){
    const teeShot=lastHole.shots[0];
    if(teeShot){
      S.fwOpp--;
      if(teeShot.lie==='FAIRWAY') S.fwHit--;
      if(teeShot.lie==='LEFT ROUGH') S.fwLeft--;
      if(teeShot.lie==='RIGHT ROUGH') S.fwRight--;
    }
  }
  
  // Reverse bunker stats (only GS BUNKER counts)
  let hadBunker=false;
  lastHole.shots.forEach(s=>{
    if(s.lie==='GS BUNKER'){
      hadBunker=true;
      S.bunOpp--;
    }
  });
  if(hadBunker&&lastHole.putts===1) S.bun--;
  
  // Reverse one-putt stats
  if(lastHole.putts>0){
    S.onePuttOpp--;
    if(lastHole.putts===1) S.onePuttMade--;
  }
  
  // Reverse three-putt stats
  if(lastHole.putts>=3) S.threePlusPutts--;
  
  // Restore hole state
  S.par=lastHole.par;
  S.currentHoleData=JSON.parse(JSON.stringify(lastHole));
  S.currentHoleShots=JSON.parse(JSON.stringify(lastHole.shots));
  
  S.girThisHole=false; 
  S.scrCountedThisHole=false;
  S.firstPuttThisHole=null;
  
  // Remove the holed putt
  S.currentHoleShots.pop();
  
  let remainingShots = 0;
  let remainingPutts = 0;
  if (S.currentHoleShots.length > 0) {
      remainingShots = S.currentHoleShots[S.currentHoleShots.length - 1].shotNum;
      remainingPutts = S.currentHoleShots.filter(s => s.isPutt).length;
  }
  
  S.shots = remainingShots;
  S.putts = remainingPutts;
  
  puttTitle.innerText=`Putt ${S.putts+1}`;
  const lastPutt=S.currentHoleShots[S.currentHoleShots.length-1];
  const puttInput = document.getElementById('puttDistance');
  puttInput.value = lastPutt ? (lastPutt.distanceBefore||3) : 3;
  puttInput.setAttribute('value', lastPutt ? (lastPutt.distanceBefore||3) : 3);
  holeHeader.innerText=`Hole ${S.currentHole}`;
  show('puttPage');
}

export function selectPresetHoles(n){customHoles.value='';S.totalHoles=n;}
function setPar(p){S.par=p;holeYards.value=p===3?150:p===4?400:520;}
function startHole(){
  S.shots=1;
  S.putts=0;
  S.firstPuttThisHole=null;
  S.girThisHole=false;
  S.scrCountedThisHole=false;
  lieTitle.innerText='Where did your tee shot end?';
  S.currentHoleData={hole:S.currentHole,par:S.par,yards:parseInt(holeYards.value)};
  S.currentHoleShots=[];
  S.currentHoleShots.push({shotNum:1,lie:null,distanceBefore:S.currentHoleData.yards,distanceAfter:null,isPutt:false});
  show('liePage');
}

function selectLie(lie){
  // Prevent double-clicking
  if(S.processingClick){
    return;
  }
  S.processingClick=true;
  
  const lastShot=S.currentHoleShots[S.currentHoleShots.length-1];
  
  // Prevent double-clicking - if lie is already set to this value, ignore
  if(lastShot.lie===lie){
    S.processingClick=false;
    return;
  }
  
  // v3.0.0: Just record the lie - NO stat counting here
  lastShot.lie=lie;
  
  
  if(lie==='GREEN'){
    S.putts=0;
    puttTitle.innerText='Putt 1';
    
    // Smart default putt distance based on approach distance
    const approachDist=lastShot.distanceBefore||100;
    let defaultPutt=30;
    if(approachDist<=50) defaultPutt=10;
    else if(approachDist<=75) defaultPutt=15;
    else if(approachDist<=100) defaultPutt=20;
    else if(approachDist<=150) defaultPutt=25;
    else if(approachDist<=200) defaultPutt=30;
    else defaultPutt=40;
    
    lastShot.distanceAfter=defaultPutt;
    
    // Track for SG calc but don't count aggregate stats yet
    S.girThisHole = (S.shots <= S.par - 2);
    
    S.currentHoleShots.push({shotNum:S.shots+1,lie:'PUTT',distanceBefore:defaultPutt,distanceAfter:null,isPutt:true});
    const puttInput = document.getElementById('puttDistance');
    puttInput.value = defaultPutt;
    puttInput.setAttribute('value', defaultPutt);
    puttShotNum.innerText=`Shot ${S.shots+1}`;
    show('puttPage');
    return;
  }
  if(lie==='HOLE'){finishHole();return;}
  if(lie==='WATER'){
    show('penaltyPage');
    return;
  }
  if(lie==='OB'){
    show('obPenaltyPage');
    return;
  }
  if(lie==='RECOVERY'){
    show('recoveryPage');
    return;
  }
  if(lie==='MISSED GREEN'){
    show('missedGreenPage');
    return;
  }
  // Handle green misses - just record, stats counted in finishHole
  if(lie==='MISS LEFT'||lie==='MISS RIGHT'||lie==='MISS SHORT'||lie==='MISS LONG'){
    lastShot.lie=lie;
    S.shots++;
    S.currentHoleShots.push({shotNum:S.shots,lie:null,distanceBefore:15,distanceAfter:null,isPutt:false});
    distanceTitle.innerText=`${ordinal(S.shots)} Shot Distance`;
    shotDistance.value=15;
    lieTitle.innerText=`Where did your ${ordinal(S.shots)} shot end?`;
    show('distancePage');
    return;
  }
  if(lie==='GS BUNKER'){
    lastShot.lie=lie;
    S.shots++;
    S.currentHoleShots.push({shotNum:S.shots,lie:null,distanceBefore:30,distanceAfter:null,isPutt:false});
    distanceTitle.innerText=`${ordinal(S.shots)} Shot Distance`;
    shotDistance.value=30;
    lieTitle.innerText=`Where did your ${ordinal(S.shots)} shot end?`;
    show('distancePage');
    return;
  }
  S.shots++;
  let defaultDist=100;
  if(S.shots===2&&S.par===5){
    defaultDist=250;
  }
  S.currentHoleShots.push({shotNum:S.shots,lie:null,distanceBefore:defaultDist,distanceAfter:null,isPutt:false});
  distanceTitle.innerText=`${ordinal(S.shots)} Shot Distance`;
  shotDistance.value=defaultDist;
  lieTitle.innerText=`Where did your ${ordinal(S.shots)} shot end?`;
  show('distancePage');
}

function confirmDistance(){
  const lastShot=S.currentHoleShots[S.currentHoleShots.length-1];
  const distance = parseInt(shotDistance.value||0);
  lastShot.distanceBefore = distance;
  
  // Backfill distanceAfter on previous shots, walking back through PENALTY shots
  for(var bi=S.currentHoleShots.length-2; bi>=0; bi--){
    var ps = S.currentHoleShots[bi];
    if(ps.lie === 'PENALTY'){
      ps.distanceAfter = distance; // penalty shot gets the drop distance
      continue; // keep walking back
    }
    // This is the real shot before penalties
    if(ps.distanceAfter === null || ps.distanceAfter === undefined){
      ps.distanceAfter = distance;
    }
    break;
  }
  
  show('liePage');
}

function handlePenalty(choice){
  const lastShot=S.currentHoleShots[S.currentHoleShots.length-1];
  const lastDistance=lastShot.distanceBefore||100;
  // Don't set distanceAfter yet - it will be backfilled when user enters drop distance
  lastShot.lie='WATER';
  S.currentHoleShots.push({shotNum:S.shots+1,lie:'PENALTY',distanceBefore:lastDistance,distanceAfter:null,isPutt:false});
  S.shots += 2;
  S.currentHoleShots.push({shotNum:S.shots,lie:null,distanceBefore:lastDistance,distanceAfter:null,isPutt:false});
  distanceTitle.innerText=`${ordinal(S.shots)} Shot Distance`;
  shotDistance.value=lastDistance;
  lieTitle.innerText=`Where did your ${ordinal(S.shots)} shot end?`;
  show('distancePage');
}

function handleRecovery(direction){
  const lastShot=S.currentHoleShots[S.currentHoleShots.length-1];
  lastShot.lie='RECOVERY';
  lastShot.recoveryDirection=direction; // Store for stat counting in finishHole
  
  // Move to next shot
  S.shots++;
  S.currentHoleShots.push({shotNum:S.shots,lie:null,distanceBefore:150,distanceAfter:null,isPutt:false});
  distanceTitle.innerText=`${ordinal(S.shots)} Shot Distance`;
  shotDistance.value=150;
  lieTitle.innerText=`Where did your ${ordinal(S.shots)} shot end?`;
  show('distancePage');
}

function handleMissedGreen(direction){
  const lastShot=S.currentHoleShots[S.currentHoleShots.length-1];
  lastShot.lie='MISS '+direction;
  
  // Move to next shot with default 15 yards
  S.shots++;
  S.currentHoleShots.push({shotNum:S.shots,lie:null,distanceBefore:15,distanceAfter:null,isPutt:false});
  distanceTitle.innerText=`${ordinal(S.shots)} Shot Distance`;
  shotDistance.value=15;
  lieTitle.innerText=`Where did your ${ordinal(S.shots)} shot end?`;
  show('distancePage');
}

function nextPutt(){
  S.totalPutts++;
  const distInput = document.getElementById('puttDistance');
  // The input value is the distance of THIS putt that was just taken
  const thisPuttDist = parseInt(distInput.value) || 0;
  
  const lastShot = S.currentHoleShots[S.currentHoleShots.length-1];
  
  // Update the lastShot's distanceBefore to match what user entered (in case they changed it)
  lastShot.distanceBefore = thisPuttDist;
  
  if(S.putts===0 && S.girThisHole) S.firstPuttThisHole = thisPuttDist;
  
  // Set the PREVIOUS shot's distanceAfter to this putt's distanceBefore
  // (The previous shot ended where this putt started)
  if(S.currentHoleShots.length >= 2){
    const prevShot = S.currentHoleShots[S.currentHoleShots.length - 2];
    if(prevShot.isPutt && prevShot.distanceAfter === null){
      prevShot.distanceAfter = thisPuttDist;
    } else if(!prevShot.isPutt && prevShot.lie === 'GREEN'){
      // First putt - update the approach shot's distanceAfter to actual proximity
      prevShot.distanceAfter = thisPuttDist;
    }
  }

  S.putts++;
  puttTitle.innerText = `Putt ${S.putts+1}`;
  puttShotNum.innerText = `Shot ${S.shots+S.putts+1}`;
  
  // Clear input and wait for user to enter next putt distance
  // Default to 3 as a reasonable short putt
  distInput.value = 3;
  distInput.setAttribute('value', 3);
  
  // Create placeholder for next putt
  const newShot = {shotNum:S.shots+S.putts+1, lie:'PUTT', distanceBefore:3, distanceAfter:null, isPutt:true};
  S.currentHoleShots.push(newShot);
  
}

function holeOut(){
  S.totalPutts++;
  const distInput = document.getElementById('puttDistance');
  const thisPuttDist = parseInt(distInput.value) || 0;
  
  const lastShot = S.currentHoleShots[S.currentHoleShots.length-1];
  
  // Update the lastShot's distanceBefore to match what user entered
  lastShot.distanceBefore = thisPuttDist;
  
  // Track first putt distance for GIR stats (counted in finishHole)
  if(S.putts===0 && S.girThisHole) S.firstPuttThisHole = thisPuttDist;
  
  // Ball went in the hole
  lastShot.distanceAfter = 0;
  lastShot.lie = 'HOLED';
  
  // Set the PREVIOUS shot's distanceAfter
  if(S.currentHoleShots.length >= 2){
    const prevShot = S.currentHoleShots[S.currentHoleShots.length - 2];
    if(prevShot.isPutt && prevShot.distanceAfter === null){
      prevShot.distanceAfter = thisPuttDist;
    } else if(!prevShot.isPutt && prevShot.lie === 'GREEN'){
      // First putt - update the approach shot's distanceAfter to actual proximity
      prevShot.distanceAfter = thisPuttDist;
    }
  }

  S.putts++;

  // v3.0.0: All stats counted in finishHole
  finishHole();
}

function finishHole(){
  // v2.7.0: Check if we're editing a hole
  if(S.editingHoleIndex !== null){
    finishEditedHole();
    return;
  }
  
  const holeStrokes=S.shots+S.putts;
  S.currentHoleData.score=holeStrokes;
  S.currentHoleData.putts=S.putts;
  S.currentHoleData.shots=S.currentHoleShots;
  
  // ============ v3.0.0: COUNT ALL STATS HERE ============
  
  // FAIRWAY STATS (par 4/5 only)
  if(S.par === 4 || S.par === 5){
    const teeShot = S.currentHoleShots[0];
    if(teeShot && teeShot.lie){
      S.fwOpp++;
      if(teeShot.lie === 'FAIRWAY' || teeShot.lie === 'GREEN') S.fwHit++;
      else if(teeShot.lie === 'LEFT ROUGH') S.fwLeft++;
      else if(teeShot.lie === 'RIGHT ROUGH') S.fwRight++;
      else if(teeShot.lie === 'RECOVERY' && teeShot.recoveryDirection === 'LEFT') S.fwLeft++;
      else if(teeShot.lie === 'RECOVERY' && teeShot.recoveryDirection === 'RIGHT') S.fwRight++;
    }
  }
  
  // GIR STATS
  const shotsToGreen = S.currentHoleShots.filter(s => !s.isPutt && s.lie !== 'PENALTY').length;
  const hitGIR = shotsToGreen <= S.par - 2 && S.currentHoleShots.some(s => s.lie === 'GREEN' || s.lie === 'HOLED');
  if(hitGIR){
    S.gir++;
    S.girPutts += S.putts;
    if(S.firstPuttThisHole !== null){
      S.girFirstPuttDist += S.firstPuttThisHole;
    }
  }
  
  // SCRAMBLING STATS
  let hadScrambleOpp = false;
  if(!hitGIR){
    // Check for shots from <= 30 yards that hit green
    S.currentHoleShots.forEach(s => {
      if(!s.isPutt && s.lie === 'GREEN' && s.distanceBefore <= 30){
        hadScrambleOpp = true;
      }
    });
    if(hadScrambleOpp){
      S.scrOpp++;
      if(S.putts === 1) S.scr++;
    }
  }
  
  // BUNKER STATS
  let hitFromBunker = false;
  S.currentHoleShots.forEach(s => {
    if(s.lie === 'GS BUNKER'){
      S.bunOpp++;
      hitFromBunker = true;
    }
  });
  if(hitFromBunker && S.putts === 1) S.bun++;
  
  // MISSED GREEN DIRECTION STATS
  S.currentHoleShots.forEach(s => {
    if(s.lie && s.lie.startsWith('MISS ')){
      S.girOpp++;
      if(s.lie === 'MISS LEFT') S.missLeft++;
      if(s.lie === 'MISS RIGHT') S.missRight++;
      if(s.lie === 'MISS SHORT') S.missShort++;
      if(s.lie === 'MISS LONG') S.missLong++;
    }
  });
  
  // PUTTING STATS
  if(S.putts > 0){
    S.onePuttOpp++;
    if(S.putts === 1) S.onePuttMade++;
    if(S.putts >= 3) S.threePlusPutts++;
  }
  
  // ============ END STAT COUNTING ============
  
  // Calculate Strokes Gained for each shot
  let holeSgOTT = 0, holeSgAPP = 0, holeSgARG = 0, holeSgPutt = 0;
  
  S.currentHoleShots.forEach((s, idx) => {
    s.sg = 0; // Initialize SG for this shot
    if(!s.lie || s.lie === 'PENALTY') return;
    
    const distBefore = s.distanceBefore || 0;
    const distAfter = s.distanceAfter || 0;
    
    // Determine what kind of shot this was
    const shotNum = s.shotNum;
    const isTeeShotPar45 = shotNum === 1 && (S.par === 4 || S.par === 5);
    const isTeeShotPar3 = shotNum === 1 && S.par === 3;
    const isPutt = s.isPutt;
    const isShortGame = !isPutt && distBefore <= 30 && !isTeeShotPar45;
    const isApproach = !isPutt && !isTeeShotPar45 && !isShortGame;
    
    if(isPutt){
      // Putting SG calculated separately below
    } else if(s.lie === 'HOLED'){
      // Holed from off green - huge gain
      let expectedBefore = 0;
      let sg = 0;
      if(isTeeShotPar45){
        expectedBefore = getExpectedStrokes(S.currentHoleData.yards, 'TEE');
        sg = expectedBefore - 1;
        holeSgOTT += sg;
      } else if(isTeeShotPar3){
        expectedBefore = getExpectedStrokes(S.currentHoleData.yards, 'TEE');
        sg = expectedBefore - 1;
        holeSgAPP += sg;
      } else if(isShortGame){
        const prevShot = S.currentHoleShots[idx - 1];
        const prevLie = prevShot ? prevShot.lie : 'FAIRWAY';
        expectedBefore = getExpectedStrokes(distBefore, prevLie);
        sg = expectedBefore - 1;
        holeSgARG += sg;
      } else {
        const prevShot = S.currentHoleShots[idx - 1];
        const prevLie = prevShot ? prevShot.lie : 'FAIRWAY';
        expectedBefore = getExpectedStrokes(distBefore, prevLie);
        sg = expectedBefore - 1;
        holeSgAPP += sg;
      }
      s.sg = sg;
    } else if(isTeeShotPar45){
      // Off the tee on par 4/5
      const expectedBefore = getExpectedStrokes(S.currentHoleData.yards, 'TEE');
      let expectedAfter;
      if(s.lie === 'GREEN'){
        // distAfter is already in feet for green
        expectedAfter = getExpectedPutts(distAfter);
      } else {
        expectedAfter = distAfter > 0 ? getExpectedStrokes(distAfter, s.lie) : 2.5;
      }
      const sg = expectedBefore - expectedAfter - 1;
      s.sg = sg;
      holeSgOTT += sg;
    } else if(isTeeShotPar3){
      // Par 3 tee shot counts as approach
      const expectedBefore = getExpectedStrokes(S.currentHoleData.yards, 'TEE');
      let expectedAfter;
      if(s.lie === 'GREEN'){
        // distAfter is already in feet for green
        expectedAfter = getExpectedPutts(distAfter);
      } else {
        expectedAfter = distAfter > 0 ? getExpectedStrokes(distAfter, s.lie) : 2.5;
      }
      const sg = expectedBefore - expectedAfter - 1;
      s.sg = sg;
      holeSgAPP += sg;
    } else if(isShortGame){
      // Around the green (30 yards and in, not putting)
      const prevShot = S.currentHoleShots[idx - 1];
      const prevLie = prevShot ? prevShot.lie : 'FAIRWAY';
      const expectedBefore = getExpectedStrokes(distBefore, prevLie);
      let expectedAfter;
      if(s.lie === 'GREEN'){
        // distAfter is already in feet for green
        expectedAfter = getExpectedPutts(distAfter);
      } else {
        expectedAfter = distAfter > 0 ? getExpectedStrokes(distAfter, s.lie) : 2.5;
      }
      const sg = expectedBefore - expectedAfter - 1;
      s.sg = sg;
      holeSgARG += sg;
    } else if(isApproach){
      // Approach shot (>30 yards, not tee shot on par 4/5)
      const prevShot = S.currentHoleShots[idx - 1];
      const prevLie = prevShot ? prevShot.lie : 'FAIRWAY';
      const expectedBefore = getExpectedStrokes(distBefore, prevLie);
      let expectedAfter;
      if(s.lie === 'GREEN'){
        // distAfter is already in feet for green
        expectedAfter = getExpectedPutts(distAfter);
      } else {
        expectedAfter = distAfter > 0 ? getExpectedStrokes(distAfter, s.lie) : 2.5;
      }
      const sg = expectedBefore - expectedAfter - 1;
      s.sg = sg;
      holeSgAPP += sg;
    }
  });
  
  // Calculate SG Putting for each putt
  let firstPuttDist = 0;
  let numPutts = 0;
  S.currentHoleShots.forEach((s, idx) => {
    if(s.isPutt){
      const puttDist = s.distanceBefore || 0;
      if(firstPuttDist === 0) firstPuttDist = puttDist;
      const expectedBefore = getExpectedPutts(puttDist);
      let expectedAfter = 0;
      if(s.lie === 'HOLED' || s.distanceAfter === 0){
        expectedAfter = 0; // Holed it
      } else if(s.distanceAfter){
        expectedAfter = getExpectedPutts(s.distanceAfter);
      }
      const sg = expectedBefore - expectedAfter - 1;
      s.sg = sg;
      holeSgPutt += sg;
      numPutts++;
    }
    if(s.lie === 'HOLED' && !s.isPutt){
      // Already counted above for holed shots from off green
    }
  });
  
  S.currentHoleData.firstPuttDist = firstPuttDist;
  S.currentHoleData.expectedPutts = firstPuttDist > 0 ? getExpectedPutts(firstPuttDist) : 0;
  if(numPutts > 0){
  }
  
  // Store hole SG data
  S.currentHoleData.sgOTT = holeSgOTT;
  S.currentHoleData.sgAPP = holeSgAPP;
  S.currentHoleData.sgARG = holeSgARG;
  S.currentHoleData.sgPutting = holeSgPutt;
  
  // Add to totals
  S.sgOTTTotal += holeSgOTT;
  S.sgAPPTotal += holeSgAPP;
  S.sgARGTotal += holeSgARG;
  S.sgPuttingTotal += holeSgPutt;
  
  
  S.allHoles.push(S.currentHoleData);
  
  if(S.par===3){S.c3++;S.p3+=holeStrokes;}
  if(S.par===4){S.c4++;S.p4+=holeStrokes;}
  if(S.par===5){S.c5++;S.p5+=holeStrokes;}
  S.totalStrokes+=holeStrokes;
  S.totalPar+=S.par;
  const d=S.totalStrokes-S.totalPar;
  document.getElementById('scoreBarText').innerText=d===0?`E through ${S.currentHole}`:`${d>0?'+':''}${d} through ${S.currentHole}`;
  if(S.currentHole<S.totalHoles){
    S.currentHole++;
    holeHeader.innerText=`Hole ${S.currentHole}`;
    // Auto-populate par/yardage from course data for next hole
    if (S.courseHoleData && S.courseHoleData[S.currentHole - 1]) {
      var hd = S.courseHoleData[S.currentHole - 1];
      S.par = hd.par;
      document.getElementById('holeYards').value = hd.yards;
      var parBtns = document.querySelectorAll('#parPage .par3, #parPage .par4, #parPage .par5');
      parBtns.forEach(function(b) { b.classList.remove('selected'); });
      if (hd.par === 3 && parBtns[0]) parBtns[0].classList.add('selected');
      else if (hd.par === 4 && parBtns[1]) parBtns[1].classList.add('selected');
      else if (hd.par === 5 && parBtns[2]) parBtns[2].classList.add('selected');
    }
    show('parPage');
    updateParPageRoundActions();
  }else{
    scoreBar.style.display='none';
    renderSummary();
    document.getElementById('backToRoundsBtn').style.display = 'none';
    document.getElementById('saveStatus').textContent = '';
    S.viewingStudentRound = false;
    var saveBtn = document.getElementById('saveToAccountBtn');
    if(saveBtn) saveBtn.style.display = S.currentUser ? '' : 'none';
    show('summaryPage');

    // Auto-save round if logged in
    if (S.currentUser && S.allHoles.length > 0) {
      autoSaveRound();
    }
  }
}

// Functions called from inline HTML handlers
expose({ selectPresetHoles, setPar, startHole, selectLie, confirmDistance, handlePenalty, handleRecovery, handleMissedGreen, nextPutt, holeOut });
