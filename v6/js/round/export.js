import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { _sb } from '../core/supabase.js';
import { formatDateForDisplay, formatDateForFilename } from '../core/util.js';
import { calculateSGForHandicap, recalculateAllSG } from './sg-recalc.js';

function exportToCSV(){
  if(!S.allHoles || S.allHoles.length===0){
    alert('No round data to export. Please complete at least one hole.');
    return;
  }
  
  const csv = generateCSV();
  
  // Create filename from player name, date, course name
  const pName = (playerName.value||'Player').replace(/[^a-zA-Z0-9]/g, '');
  const cName = (courseName.value||'Course').replace(/[^a-zA-Z0-9]/g, '');
  const rDate = formatDateForFilename(roundDate.value);
  const filename = `${pName}_${rDate}_${cName}.csv`;
  
  const blob=new Blob([csv],{type:'text/csv'});
  const url=window.URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

function categorizeLie(lie, isPutt, isFromTee){
  if(isFromTee) return 'Tee';
  if(isPutt || lie === 'GREEN' || lie === 'PUTT') return 'Green';
  if(lie === 'FAIRWAY') return 'Fairway';
  if(lie === 'LEFT ROUGH' || lie === 'RIGHT ROUGH') return 'Rough';
  if(lie === 'MISS LEFT' || lie === 'MISS RIGHT' || lie === 'MISS SHORT' || lie === 'MISS LONG') return 'Rough';
  if(lie === 'GS BUNKER' || lie === 'FW BUNKER') return 'Sand';
  if(lie === 'RECOVERY' || lie === 'PENALTY' || lie === 'OB' || lie === 'WATER') return 'Recovery';
  return 'Rough';
}

export function generateExcelWorkbook(){
  const wb = XLSX.utils.book_new();
  
  // Calculate common stats
  let eagles=0,birdies=0,pars=0,bogeys=0,doubleOrWorse=0;
  S.allHoles.forEach(h=>{
    const diff=h.score-h.par;
    if(diff<=-2) eagles++;
    else if(diff===-1) birdies++;
    else if(diff===0) pars++;
    else if(diff===1) bogeys++;
    else doubleOrWorse++;
  });
  
  let totalYards=0;
  S.allHoles.forEach(h=>totalYards+=h.yards);
  const THIN_BORDER={top:{style:'thin',color:{rgb:'000000'}},bottom:{style:'thin',color:{rgb:'000000'}},left:{style:'thin',color:{rgb:'000000'}},right:{style:'thin',color:{rgb:'000000'}}};

  // Calculate penalties
  let par3TeePenalties=0, par45TeePenalties=0, approachPenalties=0, shortGamePenalties=0;
  S.allHoles.forEach(h=>{
    h.shots.forEach((s,idx)=>{
      if(s.lie==='PENALTY'){
        const prevShot=h.shots[idx-1];
        if(prevShot){
          // Tee shot penalty (shot 1)
          if(prevShot.shotNum===1){
            if(h.par===3) par3TeePenalties++;
            else par45TeePenalties++;
          }
          // Approach penalty (over 30 yards)
          else if(prevShot.distanceBefore>30){
            approachPenalties++;
          }
          // Short game penalty (30 yards or less)
          else{
            shortGamePenalties++;
          }
        }
      }
    });
  });
  
  // ============ SHEET 1: SCORING ============
  // Split holes into front 9 and back 9
  const front9 = S.allHoles.slice(0, Math.min(9, S.allHoles.length));
  const back9 = S.allHoles.slice(9);
  
  let front9Yards=0, front9Par=0, front9Score=0, front9Putts=0;
  front9.forEach(h=>{front9Yards+=h.yards;front9Par+=h.par;front9Score+=h.score;front9Putts+=h.putts;});
  
  let back9Yards=0, back9Par=0, back9Score=0, back9Putts=0;
  back9.forEach(h=>{back9Yards+=h.yards;back9Par+=h.par;back9Score+=h.score;back9Putts+=h.putts;});
  
  let scoringData = [
    ['SCORING', '', '', '', '', 'AVERAGES', '', '', 'SCORE DISTRIBUTION'],
    [],
    ['Player:', playerName.value||'Player', '', '', '', 'Avg Par 3', S.c3?(S.p3/S.c3).toFixed(2):'N/A', '', 'Eagles', eagles],
    ['Handicap:', document.getElementById('playerHandicap').value||'N/A', '', '', '', 'Avg Par 4', S.c4?(S.p4/S.c4).toFixed(2):'N/A', '', 'Birdies', birdies],
    ['Course:', courseName.value||'Course', '', '', '', 'Avg Par 5', S.c5?(S.p5/S.c5).toFixed(2):'N/A', '', 'Pars', pars],
    ['Date:', formatDateForDisplay(roundDate.value), '', '', '', '', '', '', 'Bogeys', bogeys],
    ['Round Type:', document.getElementById('roundType').value||'Casual', '', '', '', '', '', '', 'Double+', doubleOrWorse],
    [],
    // Front 9
    ['Hole', ...front9.map(h=>h.hole), 'OUT'],
    ['Yards', ...front9.map(h=>h.yards), front9Yards],
    ['Par', ...front9.map(h=>h.par), front9Par],
    ['Score', ...front9.map(h=>h.score), front9Score],
    ['Putts', ...front9.map(h=>h.putts), front9Putts]
  ];
  
  // Add back 9 if exists
  if(back9.length>0){
    scoringData.push([]);
    scoringData.push(['Hole', ...back9.map(h=>h.hole), 'IN', 'TOTAL']);
    scoringData.push(['Yards', ...back9.map(h=>h.yards), back9Yards, totalYards]);
    scoringData.push(['Par', ...back9.map(h=>h.par), back9Par, S.totalPar]);
    scoringData.push(['Score', ...back9.map(h=>h.score), back9Score, S.totalStrokes]);
    scoringData.push(['Putts', ...back9.map(h=>h.putts), back9Putts, S.totalPutts]);
  }
  
  
  const ws1 = XLSX.utils.aoa_to_sheet(scoringData);
  
  // Merge cells for Player, Course, Date values (columns B-D)
  ws1['!merges'] = ws1['!merges'] || [];
  ws1['!merges'].push({ s: { r: 2, c: 1 }, e: { r: 2, c: 3 } }); // Player value
  ws1['!merges'].push({ s: { r: 3, c: 1 }, e: { r: 3, c: 3 } }); // Handicap value
  ws1['!merges'].push({ s: { r: 4, c: 1 }, e: { r: 4, c: 3 } }); // Course value
  ws1['!merges'].push({ s: { r: 5, c: 1 }, e: { r: 5, c: 3 } }); // Date value
  ws1['!merges'].push({ s: { r: 6, c: 1 }, e: { r: 6, c: 3 } }); // Round Type value
  
  XLSX.utils.book_append_sheet(wb, ws1, 'Scoring');
  
  // ============ SHEET 2: STROKES GAINED ============
  const sgTotal = S.sgOTTTotal + S.sgAPPTotal + S.sgARGTotal + S.sgPuttingTotal;
  
  // Helper function to categorize lies for strokes gained
  let sgSummaryData = [
    ['STROKES GAINED'],
    [],
    ['Comparison:', document.getElementById('playerHandicap').value || 'pro'],
    ['SG: Total', sgTotal.toFixed(2)],
    ['SG: Off The Tee', S.sgOTTTotal.toFixed(2)],
    ['SG: Approach', S.sgAPPTotal.toFixed(2)],
    ['SG: Around the Green', S.sgARGTotal.toFixed(2)],
    ['SG: Putting', S.sgPuttingTotal.toFixed(2)],
    [],
    ['SG BY HANDICAP COMPARISON'],
    ['Handicap', 'SG Total', 'SG OTT', 'SG APP', 'SG ARG', 'SG Putt']
  ];
  
  // Calculate SG for each handicap level
  const hcpLevels = [
    {key: 'pro', label: 'Tour Pro'},
    {key: '0', label: 'Scratch (0)'},
    {key: '5', label: '5 Handicap'},
    {key: '10', label: '10 Handicap'},
    {key: '15', label: '15 Handicap'},
    {key: '20', label: '20 Handicap'},
    {key: '25', label: '25 Handicap'},
    {key: '30', label: '30 Handicap'}
  ];
  
  hcpLevels.forEach(h => {
    const sg = calculateSGForHandicap(h.key);
    sgSummaryData.push([h.label, sg.total.toFixed(2), sg.ott.toFixed(2), sg.app.toFixed(2), sg.arg.toFixed(2), sg.putt.toFixed(2)]);
  });
  
  sgSummaryData.push([]);
  sgSummaryData.push(['SHOT BY SHOT BREAKDOWN']);
  sgSummaryData.push(['Hole', 'Par', 'Shot #', 'Start Distance', 'Start Lie', 'End Lie', 'End Distance', 'Strokes Gained']);
  
  // Add shot-by-shot data
  S.allHoles.forEach(h=>{
    h.shots.forEach((s, idx)=>{
      const nextShot = h.shots[idx+1];
      const prevShot = idx > 0 ? h.shots[idx-1] : null;
      
      // Start lie category
      let startLieCat = '';
      if(s.shotNum === 1){
        startLieCat = 'Tee';
      } else if(s.isPutt){
        startLieCat = 'Green';
      } else if(prevShot && prevShot.lie){
        startLieCat = categorizeLie(prevShot.lie, false, false);
      } else {
        startLieCat = 'Unknown';
      }
      
      // Start distance
      let startDist = s.distanceBefore || 0;
      let startDistDisplay = '';
      if(s.isPutt){
        startDistDisplay = startDist + ' ft';
      } else {
        startDistDisplay = startDist + ' yds';
      }
      
      // End lie category
      let endLieCat = '';
      if(s.lie === 'HOLED'){
        endLieCat = 'Holed';
      } else {
        endLieCat = categorizeLie(s.lie, s.isPutt, false);
      }
      
      // End distance
      let endDistDisplay = '0';
      if(s.lie === 'HOLED'){
        endDistDisplay = '0';
      } else if(s.distanceAfter != null){
        if(nextShot && nextShot.isPutt){
          endDistDisplay = s.distanceAfter + ' ft';
        } else if(s.isPutt){
          endDistDisplay = s.distanceAfter + ' ft';
        } else {
          endDistDisplay = s.distanceAfter + ' yds';
        }
      } else if(nextShot){
        if(nextShot.isPutt){
          endDistDisplay = nextShot.distanceBefore != null ? nextShot.distanceBefore + ' ft' : '';
        } else {
          endDistDisplay = nextShot.distanceBefore != null ? nextShot.distanceBefore + ' yds' : '';
        }
      }
      
      // Format SG for display
      let sgDisplay = '';
      if(s.sg != null){
        if(s.sg >= 0){
          sgDisplay = '+' + s.sg.toFixed(2);
        } else {
          sgDisplay = s.sg.toFixed(2);
        }
      }
      
      sgSummaryData.push([
        h.hole,
        h.par,
        s.shotNum,
        startDistDisplay,
        startLieCat,
        endLieCat,
        endDistDisplay,
        sgDisplay
      ]);
    });
  });
  
  const wsSG = XLSX.utils.aoa_to_sheet(sgSummaryData);
  
  // Merge cells for "SHOT BY SHOT BREAKDOWN" header (row 8, columns A-H)
  wsSG['!merges'] = wsSG['!merges'] || [];
  wsSG['!merges'].push({ s: { r: 20, c: 0 }, e: { r: 20, c: 7 } }); // Shot by shot header
  
  // Set column widths - narrower for Hole, Par, Shot#
  wsSG['!cols'] = [
    { wch: 6 },  // Hole
    { wch: 5 },  // Par
    { wch: 7 },  // Shot #
    { wch: 14 }, // Start Distance
    { wch: 10 }, // Start Lie
    { wch: 10 }, // End Lie
    { wch: 14 }, // End Distance
    { wch: 14 }  // Strokes Gained
  ];
  
  // ============ SHEET 3: OFF THE TEE ============
  let drivingDistances=[];
  let driveDetails=[];
  let longestDrive = 0;
  let shortestDrive = 999;
  S.allHoles.forEach(h=>{
    if((h.par===4||h.par===5)&&h.shots.length>0){
      const teeShot = h.shots[0];
      let driveDistance = null;
      
      if(teeShot.lie==='WATER'||teeShot.lie==='OB'){
        // For water/OB, find the re-hit shot after penalty
        for(let j=1; j<h.shots.length; j++){
          const s = h.shots[j];
          if(s.lie!=='PENALTY'&&s.lie!=='WATER'&&s.lie!=='OB'&&s.lie!=='RECOVERY'&&s.distanceAfter!=null){
            driveDistance = s.distanceBefore - s.distanceAfter;
            break;
          }
        }
      } else if(teeShot.lie==='RECOVERY'){
        // For recovery, use the tee shot's own distanceAfter
        if(teeShot.distanceAfter!=null){
          driveDistance = h.yards - teeShot.distanceAfter;
        }
      } else if(teeShot.distanceAfter!=null&&teeShot.lie!=='PENALTY'){
        driveDistance = h.yards - teeShot.distanceAfter;
      }
      
      if(driveDistance !== null){
        drivingDistances.push(driveDistance);
        driveDetails.push({hole: h.hole, distance: driveDistance, par: h.par, yards: h.yards});
        if(driveDistance > longestDrive) longestDrive = driveDistance;
        if(driveDistance < shortestDrive) shortestDrive = driveDistance;
      }
    }
  });
  const avgDrive=drivingDistances.length?Math.round(drivingDistances.reduce((a,b)=>a+b,0)/drivingDistances.length):0;
  if(drivingDistances.length === 0) shortestDrive = 0;
  
  let teeData = [
    ['OFF THE TEE'],
    [],
    ['SG: Off The Tee', S.sgOTTTotal.toFixed(2)],
    [],
    ['FAIRWAY ACCURACY'],
    ['Fairways Hit', `${S.fwHit}/${S.fwOpp}`, S.fwOpp?Math.round(S.fwHit/S.fwOpp*100)+'%':'0%'],
    ['Missed Left', S.fwLeft, S.fwOpp?Math.round(S.fwLeft/S.fwOpp*100)+'%':'0%'],
    ['Missed Right', S.fwRight, S.fwOpp?Math.round(S.fwRight/S.fwOpp*100)+'%':'0%'],
    [],
    ['DRIVING DISTANCE'],
    ['Average', avgDrive+' yards'],
    ['Longest', longestDrive+' yards'],
    ['Shortest', shortestDrive+' yards'],
    [],
    ['DRIVE BY HOLE'],
    ['Hole', 'Par', 'Drive Distance']
  ];
  
  driveDetails.forEach(d=>{
    teeData.push([d.hole, d.par, d.distance+' yds']);
  });
  
  teeData.push([]);
  teeData.push(['PENALTIES OFF THE TEE']);
  teeData.push(['Par 3 Tee Penalties', par3TeePenalties]);
  teeData.push(['Par 4/5 Tee Penalties', par45TeePenalties]);
  
  const ws2 = XLSX.utils.aoa_to_sheet(teeData);
  XLSX.utils.book_append_sheet(wb, ws2, 'Off The Tee');
  
  // ============ SHEET 3: APPROACH ============
  // Get actual proximity: prefer next putt's distanceBefore over approach distanceAfter
  function getProxXls(shots,idx,s){
    if(s.lie==='HOLED')return 0;
    const next=shots[idx+1];
    if(next&&next.isPutt&&next.distanceBefore>0)return next.distanceBefore;
    return s.distanceAfter||0;
  }
  let par3ApproachDist=[],par4ApproachDist=[],par5ApproachDist=[];
  let par3Approaches=[],par4Approaches=[],par5Approaches=[];

  S.allHoles.forEach(h=>{
    const shots=h.shots||[];
    // For par 4/5, get the 2nd shot distance (approach shot distance)
    if(h.par === 4 && shots.length >= 2){
      const secondShot = shots[1];
      if(secondShot && secondShot.distanceBefore && !secondShot.isPutt){
        par4ApproachDist.push(secondShot.distanceBefore);
        if(secondShot.lie === 'GREEN'){
          par4Approaches.push(getProxXls(shots,1,secondShot));
        }
      }
    } else if(h.par === 5 && shots.length >= 2){
      const secondShot = shots[1];
      if(secondShot && secondShot.distanceBefore && !secondShot.isPutt){
        par5ApproachDist.push(secondShot.distanceBefore);
        if(secondShot.lie === 'GREEN'){
          par5Approaches.push(getProxXls(shots,1,secondShot));
        }
      }
    }

    // For par 3, the tee shot is the approach
    if(h.par === 3 && shots.length >= 1){
      const teeShot = shots[0];
      if(teeShot){
        par3ApproachDist.push(h.yards);
        if(teeShot.lie === 'GREEN'){
          par3Approaches.push(getProxXls(shots,0,teeShot));
        }
      }
    }
  });
  
  const avgPar3Dist=par3ApproachDist.length?Math.round(par3ApproachDist.reduce((a,b)=>a+b,0)/par3ApproachDist.length):0;
  const avgPar3=par3Approaches.length?Math.round(par3Approaches.reduce((a,b)=>a+b,0)/par3Approaches.length):0;
  const avgPar4Dist=par4ApproachDist.length?Math.round(par4ApproachDist.reduce((a,b)=>a+b,0)/par4ApproachDist.length):0;
  const avgPar4=par4Approaches.length?Math.round(par4Approaches.reduce((a,b)=>a+b,0)/par4Approaches.length):0;
  const avgPar5Dist=par5ApproachDist.length?Math.round(par5ApproachDist.reduce((a,b)=>a+b,0)/par5ApproachDist.length):0;
  const avgPar5=par5Approaches.length?Math.round(par5Approaches.reduce((a,b)=>a+b,0)/par5Approaches.length):0;
  
  const approachRanges=[
    {min:101,max:125,shots:[],total:0,label:'101-125 yards'},
    {min:126,max:150,shots:[],total:0,label:'126-150 yards'},
    {min:151,max:175,shots:[],total:0,label:'151-175 yards'},
    {min:176,max:200,shots:[],total:0,label:'176-200 yards'},
    {min:201,max:225,shots:[],total:0,label:'201-225 yards'},
    {min:226,max:250,shots:[],total:0,label:'226-250 yards'},
    {min:251,max:275,shots:[],total:0,label:'251-275 yards'},
    {min:276,max:999,shots:[],total:0,label:'276+ yards'}
  ];

  S.allHoles.forEach(h=>{
    const shots=h.shots||[];
    shots.forEach((s,idx)=>{
      const distBefore=s.distanceBefore||0;
      const isPar45Tee=s.shotNum===1&&(h.par===4||h.par===5);
      const isAppAttempt=!s.isPutt&&distBefore>100&&!isPar45Tee&&s.lie!=='PENALTY';
      if(isAppAttempt){
        approachRanges.forEach(r=>{
          if(distBefore>=r.min&&distBefore<=r.max){
            r.total++;
            if(s.lie==='GREEN'||s.lie==='HOLED') r.shots.push(getProxXls(shots,idx,s));
          }
        });
      }
    });
  });

  let approachData = [
    ['APPROACH'],
    [],
    ['SG: Approach', S.sgAPPTotal.toFixed(2)],
    [],
    ['GIR', `${S.gir}/${S.totalHoles}`, S.totalHoles?Math.round(S.gir/S.totalHoles*100)+'%':'0%'],
    ['Proximity when GIR', (S.gir?Math.round(S.girFirstPuttDist/S.gir):0)+' ft'],
    [],
    ['MISSED GREENS'],
    ['Short', S.missShort, S.girOpp?Math.round(S.missShort/S.girOpp*100)+'%':'0%'],
    ['Long', S.missLong, S.girOpp?Math.round(S.missLong/S.girOpp*100)+'%':'0%'],
    ['Left', S.missLeft, S.girOpp?Math.round(S.missLeft/S.girOpp*100)+'%':'0%'],
    ['Right', S.missRight, S.girOpp?Math.round(S.missRight/S.girOpp*100)+'%':'0%'],
    [],
    ['Approach by Distance', '# of Shots', 'Avg Proximity']
  ];
  
  approachRanges.forEach(r=>{
    const avg=r.shots.length?Math.round(r.shots.reduce((a,b)=>a+b,0)/r.shots.length):0;
    approachData.push([r.label, r.total, r.shots.length>0?avg+' ft':'–']);
  });
  
  approachData.push([]);
  approachData.push(['Avg Par 3 Tee Shot Distance', avgPar3Dist+' yds', par3ApproachDist.length+' shots']);
  approachData.push(['Avg Par 3 Tee Shot Proximity', avgPar3+' ft']);
  approachData.push([]);
  approachData.push(['Avg Par 4 Approach Distance', avgPar4Dist+' yds', par4ApproachDist.length+' shots']);
  approachData.push(['Avg Par 4 Approach Proximity', avgPar4+' ft']);
  approachData.push([]);
  approachData.push(['Avg Par 5 Approach Distance', avgPar5Dist+' yds', par5ApproachDist.length+' shots']);
  approachData.push(['Avg Par 5 Approach Proximity', avgPar5+' ft']);
  approachData.push([]);
  approachData.push(['PENALTIES ON APPROACH']);
  approachData.push(['Approach Shot Penalties', approachPenalties]);
  
  const ws3 = XLSX.utils.aoa_to_sheet(approachData);
  XLSX.utils.book_append_sheet(wb, ws3, 'Approach');
  
  // ============ SHEET 4: AROUND THE GREEN ============
  let bunkerShots=[];
  S.allHoles.forEach(h=>{
    h.shots.forEach((s,idx)=>{
      if(s.lie&&s.lie.includes('BUNKER')&&h.shots[idx+1]){
        const nextShot=h.shots[idx+1];
        if(nextShot.lie==='GREEN'){
          bunkerShots.push(nextShot.distanceAfter||0);
        }
      }
    });
  });
  const avgBunkerProx=bunkerShots.length?Math.round(bunkerShots.reduce((a,b)=>a+b,0)/bunkerShots.length):0;
  
  const shortRanges=[
    {min:0,max:25,shots:[],label:'0-25 yards'},
    {min:26,max:50,shots:[],label:'26-50 yards'},
    {min:51,max:75,shots:[],label:'51-75 yards'},
    {min:76,max:100,shots:[],label:'76-100 yards'}
  ];
  
  S.allHoles.forEach(h=>{
    h.shots.forEach((s,idx)=>{
      const distBefore=s.distanceBefore||0;
      if(!s.isPutt&&distBefore>0&&distBefore<=100&&s.lie==='GREEN'){
        shortRanges.forEach(r=>{
          if(distBefore>=r.min&&distBefore<=r.max){
            r.shots.push(s.distanceAfter||0);
          }
        });
      }
    });
  });
  
  let shortGameData = [
    ['AROUND THE GREEN'],
    [],
    ['SG: Around the Green', S.sgARGTotal.toFixed(2)],
    [],
    ['Scrambling', `${S.scr}/${S.scrOpp}`, S.scrOpp?Math.round(S.scr/S.scrOpp*100)+'%':'0%'],
    ['Up & Down from Bunkers', `${S.bun}/${S.bunOpp}`, S.bunOpp?Math.round(S.bun/S.bunOpp*100)+'%':'0%'],
    ['Avg Proximity from Bunkers', avgBunkerProx+' ft', bunkerShots.length+' shots'],
    [],
    ['Around the Green by Distance', '# of Shots', 'Avg Proximity']
  ];
  
  shortRanges.forEach(r=>{
    const avg=r.shots.length?Math.round(r.shots.reduce((a,b)=>a+b,0)/r.shots.length):0;
    shortGameData.push([r.label, r.shots.length, avg+' ft']);
  });
  
  shortGameData.push([]);
  shortGameData.push(['PENALTIES AROUND THE GREEN']);
  shortGameData.push(['Around the Green Penalties', shortGamePenalties]);
  
  const ws4 = XLSX.utils.aoa_to_sheet(shortGameData);
  XLSX.utils.book_append_sheet(wb, ws4, 'Around the Green');
  
  // ============ SHEET 5: PUTTING ============
  // Calculate additional putting stats
  let puttDistances = [];
  let madePuttDistances = [];
  let longestMadePutt = 0;
  let avgFirstPuttDist = 0;
  let firstPuttCount = 0;
  
  S.allHoles.forEach(h=>{
    if(h.firstPuttDist){
      puttDistances.push(h.firstPuttDist);
      avgFirstPuttDist += h.firstPuttDist;
      firstPuttCount++;
    }
    // Check for made putts (one-putts)
    if(h.putts === 1 && h.firstPuttDist){
      madePuttDistances.push(h.firstPuttDist);
      if(h.firstPuttDist > longestMadePutt) longestMadePutt = h.firstPuttDist;
    }
  });
  avgFirstPuttDist = firstPuttCount > 0 ? Math.round(avgFirstPuttDist / firstPuttCount) : 0;
  
  // Putting by distance ranges - track ALL putts, not just first putts
  const puttRanges = [
    {min: 0, max: 3, made: 0, total: 0, label: '0-3 ft'},
    {min: 4, max: 7, made: 0, total: 0, label: '4-7 ft'},
    {min: 8, max: 11, made: 0, total: 0, label: '8-11 ft'},
    {min: 12, max: 15, made: 0, total: 0, label: '12-15 ft'},
    {min: 16, max: 20, made: 0, total: 0, label: '16-20 ft'},
    {min: 21, max: 30, made: 0, total: 0, label: '21-30 ft'},
    {min: 31, max: 40, made: 0, total: 0, label: '31-40 ft'},
    {min: 41, max: 50, made: 0, total: 0, label: '41-50 ft'},
    {min: 51, max: 999, made: 0, total: 0, label: '50+ ft'}
  ];
  
  S.allHoles.forEach(h=>{
    (h.shots||[]).forEach(s=>{
      if(s.isPutt && s.distanceBefore > 0){
        puttRanges.forEach(r=>{
          if(s.distanceBefore >= r.min && s.distanceBefore <= r.max){
            r.total++;
            if(s.lie === 'HOLED' || s.distanceAfter === 0) r.made++;
          }
        });
      }
    });
  });
  
  let puttingData = [
    ['PUTTING'],
    [],
    ['SG: Putting', S.sgPuttingTotal.toFixed(2)],
    [],
    ['PUTTING SUMMARY'],
    ['Total Putts', S.totalPutts],
    ['Putts per Hole', (S.totalPutts/S.totalHoles).toFixed(1)],
    ['Putts per GIR', S.gir?(S.girPutts/S.gir).toFixed(1):'N/A'],
    ['Avg First Putt Distance', avgFirstPuttDist + ' ft'],
    [],
    ['PUTTING PERFORMANCE'],
    ['One-Putts', S.onePuttMade, (S.onePuttOpp?Math.round(S.onePuttMade/S.onePuttOpp*100):0)+'%'],
    ['Two-Putts', S.totalHoles - S.onePuttMade - S.threePlusPutts],
    ['Three-Putts', S.threePlusPutts],
    ['Longest Made Putt', longestMadePutt + ' ft'],
    [],
    ['MAKE % BY DISTANCE'],
    ['Distance', 'Made/Total', 'Make %']
  ];
  
  puttRanges.forEach(r=>{
    if(r.total > 0){
      puttingData.push([r.label, `${r.made}/${r.total}`, Math.round(r.made/r.total*100)+'%']);
    } else {
      puttingData.push([r.label, '0/0', '-']);
    }
  });
  
  puttingData.push([]);
  puttingData.push(['HOLE BY HOLE PUTTING']);
  puttingData.push(['Hole', 'First Putt Dist', 'Putts', 'Expected Putts', 'SG Putting']);
  
  S.allHoles.forEach(h=>{
    if(h.firstPuttDist){
      puttingData.push([
        h.hole,
        h.firstPuttDist + ' ft',
        h.putts,
        h.expectedPutts ? h.expectedPutts.toFixed(2) : 'N/A',
        h.sgPutting ? h.sgPutting.toFixed(2) : 'N/A'
      ]);
    }
  });
  
  const ws5 = XLSX.utils.aoa_to_sheet(puttingData);
  XLSX.utils.book_append_sheet(wb, ws5, 'Putting');
  
  // ============ SHEET 7: PLAY BY PLAY ============
  let playByPlayData = [
    ['PLAY BY PLAY'],
    []
  ];
  
  S.allHoles.forEach(h=>{
    playByPlayData.push([`Hole ${h.hole}`, `Par ${h.par}`, `${h.yards} yards`]);
    
    h.shots.forEach((s, idx)=>{
      const nextShot = h.shots[idx+1];
      let shotDesc = '';
      
      // Special handling for PENALTY shots
      if(s.lie === 'PENALTY'){
        shotDesc = `Shot ${s.shotNum} - Penalty stroke`;
        playByPlayData.push(['', shotDesc, '']);
        return;
      }
      
      let endLie = s.lie || 'Unknown';
      if(endLie === 'HOLED') endLie = 'in the hole';
      else if(endLie === 'WATER') endLie = 'water';
      else if(endLie === 'OB') endLie = 'out of bounds';
      else if(endLie === 'PUTT') endLie = 'green';
      else if(endLie === 'LEFT ROUGH' || endLie === 'RIGHT ROUGH') endLie = endLie.toLowerCase();
      else if(endLie === 'GS BUNKER' || endLie === 'FW BUNKER') endLie = endLie.toLowerCase().replace('gs ', 'greenside ').replace('fw ', 'fairway ');
      else if(endLie === 'MISS LEFT') endLie = 'left of green';
      else if(endLie === 'MISS RIGHT') endLie = 'right of green';
      else if(endLie === 'MISS SHORT') endLie = 'short of green';
      else if(endLie === 'MISS LONG') endLie = 'long of green';
      else endLie = endLie.toLowerCase();
      
      let shotDist = '';
      if(s.isPutt){
        if(s.distanceBefore != null) shotDist = s.distanceBefore + ' ft';
      } else if(s.shotNum === 1 && (h.par === 4 || h.par === 5) && s.distanceAfter != null && s.lie !== 'WATER' && s.lie !== 'OB' && s.lie !== 'RECOVERY'){
        const driveDist = h.yards - s.distanceAfter;
        shotDist = driveDist + ' yds';
      } else if(s.shotNum === 1 && (h.par === 4 || h.par === 5) && (s.lie === 'WATER' || s.lie === 'OB' || s.lie === 'RECOVERY')){
        // For water/OB/recovery tee shots, find the next non-penalty shot to calculate drive distance
        let nextRealShot = null;
        for(let j = idx + 1; j < h.shots.length; j++){
          if(h.shots[j].lie !== 'PENALTY' && h.shots[j].lie !== 'WATER' && h.shots[j].lie !== 'OB' && h.shots[j].lie !== 'RECOVERY'){
            nextRealShot = h.shots[j];
            break;
          }
        }
        if(nextRealShot && nextRealShot.distanceAfter != null){
          const driveDist = h.yards - nextRealShot.distanceAfter;
          shotDist = driveDist + ' yds';
        } else {
          shotDist = h.yards + ' yds';
        }
      } else if(s.shotNum === 1){
        shotDist = h.yards + ' yds';
      } else if(s.distanceBefore != null){
        shotDist = s.distanceBefore + ' yds';
      }
      
      if(s.lie === 'HOLED'){
        shotDesc = `Shot ${s.shotNum} - ${shotDist} putt, in the hole`;
      } else {
        let remaining = '';
        // For water/OB/recovery tee shots, get remaining from next real shot
        if(s.shotNum === 1 && (s.lie === 'WATER' || s.lie === 'OB' || s.lie === 'RECOVERY')){
          let nextRealShot = null;
          for(let j = idx + 1; j < h.shots.length; j++){
            if(h.shots[j].lie !== 'PENALTY' && h.shots[j].lie !== 'WATER' && h.shots[j].lie !== 'OB' && h.shots[j].lie !== 'RECOVERY'){
              nextRealShot = h.shots[j];
              break;
            }
          }
          if(nextRealShot && nextRealShot.distanceAfter != null){
            remaining = nextRealShot.distanceAfter + ' yds';
          }
        } else if(s.distanceAfter != null){
          if(nextShot && nextShot.isPutt) remaining = s.distanceAfter + ' ft';
          else if(s.isPutt) remaining = s.distanceAfter + ' ft';
          else remaining = s.distanceAfter + ' yds';
        } else if(nextShot){
          if(nextShot.isPutt) remaining = nextShot.distanceBefore != null ? nextShot.distanceBefore + ' ft' : '';
          else remaining = nextShot.distanceBefore != null ? nextShot.distanceBefore + ' yds' : '';
        }
        
        if(s.isPutt){
          shotDesc = `Shot ${s.shotNum} - ${shotDist} putt to ${remaining} from hole`;
        } else {
          shotDesc = `Shot ${s.shotNum} - ${shotDist} to ${endLie}, ${remaining} to hole`;
        }
      }
      
      let sgDisplay = '';
      if(s.sg != null){
        sgDisplay = s.sg >= 0 ? '+' + s.sg.toFixed(2) : s.sg.toFixed(2);
      }
      
      playByPlayData.push(['', shotDesc, sgDisplay]);
    });
    
    const scoreToPar = h.score - h.par;
    let scoreLabel = '';
    if(scoreToPar <= -2) scoreLabel = 'Eagle';
    else if(scoreToPar === -1) scoreLabel = 'Birdie';
    else if(scoreToPar === 0) scoreLabel = 'Par';
    else if(scoreToPar === 1) scoreLabel = 'Bogey';
    else if(scoreToPar === 2) scoreLabel = 'Double Bogey';
    else if(scoreToPar > 2) scoreLabel = `+${scoreToPar}`;
    else scoreLabel = `${scoreToPar}`;
    
    playByPlayData.push(['', `Score: ${h.score} (${scoreLabel})`]);
    playByPlayData.push([]);
  });
  
  const ws7 = XLSX.utils.aoa_to_sheet(playByPlayData);
  XLSX.utils.book_append_sheet(wb, ws7, 'Play by Play');
  XLSX.utils.book_append_sheet(wb, wsSG, 'Strokes Gained');
  
  // Helper function to set column widths based on content
  function autoFitColumns(ws, data){
    const colWidths = [];
    data.forEach(row => {
      if(Array.isArray(row)){
        row.forEach((cell, colIdx) => {
          const cellLen = cell ? String(cell).length : 0;
          if(!colWidths[colIdx] || cellLen > colWidths[colIdx]){
            colWidths[colIdx] = cellLen;
          }
        });
      }
    });
    ws['!cols'] = colWidths.map(w => ({ wch: Math.min(Math.max(w + 2, 8), 50) }));
  }
  
  // Set uniform column widths for scorecard
  function setUniformScorecard(ws, numCols){
    const cols = [];
    cols.push({ wch: 8 }); // First column (labels)
    for(let i = 1; i <= numCols; i++){
      cols.push({ wch: 6 }); // Uniform width for hole columns
    }
    ws['!cols'] = cols;
  }
  
  // Helper function to color code SG cells (green for positive, red for negative) with black border
  function colorSGCells(ws, data, sgColIndex, skipParCol = false){
    data.forEach((row, rowIdx) => {
      if(Array.isArray(row) && row[sgColIndex] != null){
        const cellVal = String(row[sgColIndex]);
        // Skip if it's a par value (1-5) and skipParCol is true
        if(skipParCol && ['1','2','3','4','5'].includes(cellVal)) return;
        
        const val = parseFloat(row[sgColIndex]);
        if(!isNaN(val)){
          const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: sgColIndex });
          if(ws[cellRef]){
            if(val > 0){
              ws[cellRef].s = {
                font: { color: { rgb: "008000" } },
                fill: { fgColor: { rgb: "E8F5E9" } },
                border: THIN_BORDER
              };
            } else if(val < 0){
              ws[cellRef].s = {
                font: { color: { rgb: "CC0000" } },
                fill: { fgColor: { rgb: "FFEBEE" } },
                border: THIN_BORDER
              };
            } else {
              ws[cellRef].s = { border: THIN_BORDER };
            }
          }
        }
      }
    });
  }
  
  // Helper to add borders to a range of cells
  function addBorders(ws, startRow, endRow, startCol, endCol){
    for(let r = startRow; r <= endRow; r++){
      for(let c = startCol; c <= endCol; c++){
        const cellRef = XLSX.utils.encode_cell({ r: r, c: c });
        if(ws[cellRef]){
          ws[cellRef].s = ws[cellRef].s || {};
          ws[cellRef].s.border = THIN_BORDER;
        }
      }
    }
  }
  
  // Helper to bold cells in a row
  function boldRow(ws, rowIdx, startCol, endCol){
    for(let c = startCol; c <= endCol; c++){
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: c });
      if(ws[cellRef]){
        ws[cellRef].s = ws[cellRef].s || {};
        ws[cellRef].s.font = ws[cellRef].s.font || {};
        ws[cellRef].s.font.bold = true;
      }
    }
  }
  
  // Helper to color score cells relative to par
  function colorScoreVsPar(ws, scoreRowIdx, parRowIdx, startCol, endCol){
    for(let c = startCol; c <= endCol; c++){
      const scoreRef = XLSX.utils.encode_cell({ r: scoreRowIdx, c: c });
      const parRef = XLSX.utils.encode_cell({ r: parRowIdx, c: c });
      if(ws[scoreRef] && ws[parRef]){
        const score = parseInt(ws[scoreRef].v);
        const par = parseInt(ws[parRef].v);
        if(!isNaN(score) && !isNaN(par)){
          const diff = score - par;
          ws[scoreRef].s = ws[scoreRef].s || {};
          ws[scoreRef].s.border = THIN_BORDER;
          if(diff <= -2){ // Eagle or better
            ws[scoreRef].s.font = { color: { rgb: "FFD700" }, bold: true }; // Gold
            ws[scoreRef].s.fill = { fgColor: { rgb: "FFFDE7" } };
          } else if(diff === -1){ // Birdie
            ws[scoreRef].s.font = { color: { rgb: "008000" } }; // Green
            ws[scoreRef].s.fill = { fgColor: { rgb: "E8F5E9" } };
          } else if(diff === 0){ // Par
            ws[scoreRef].s.font = { color: { rgb: "000000" } };
          } else if(diff === 1){ // Bogey
            ws[scoreRef].s.font = { color: { rgb: "CC0000" } }; // Red
            ws[scoreRef].s.fill = { fgColor: { rgb: "FFEBEE" } };
          } else { // Double+
            ws[scoreRef].s.font = { color: { rgb: "990000" }, bold: true }; // Dark red
            ws[scoreRef].s.fill = { fgColor: { rgb: "FFCDD2" } };
          }
        }
      }
    }
  }
  
  // Apply column widths to all sheets
  autoFitColumns(ws1, scoringData);
  autoFitColumns(wsSG, sgSummaryData);
  autoFitColumns(ws2, teeData);
  autoFitColumns(ws3, approachData);
  autoFitColumns(ws4, shortGameData);
  autoFitColumns(ws5, puttingData);
  autoFitColumns(ws7, playByPlayData);
  // Tighten play by play columns for mobile readability
  ws7['!cols'] = [{ wch: 7 }, { wch: 38 }, { wch: 8 }];
  
  // Set uniform scorecard column widths
  setUniformScorecard(ws1, Math.max(front9.length + 1, back9.length + 2));
  
  // Apply borders to scorecard on Scoring sheet (rows 8-12 for front 9)
  addBorders(ws1, 8, 12, 0, front9.length + 1);
  // Bold the Par row (row 10) and Header row (row 8)
  boldRow(ws1, 8, 0, front9.length + 1);
  boldRow(ws1, 10, 0, front9.length + 1);
  // Color score cells vs par (score is row 11, par is row 10)
  colorScoreVsPar(ws1, 11, 10, 1, front9.length);
  
  if(back9.length > 0){
    addBorders(ws1, 14, 18, 0, back9.length + 2);
    boldRow(ws1, 14, 0, back9.length + 2);
    boldRow(ws1, 16, 0, back9.length + 2);
    colorScoreVsPar(ws1, 17, 16, 1, back9.length);
  }
  
  // Color code SG summary values at top of Strokes Gained sheet (rows 2-6, column 1)
  colorSGCells(wsSG, sgSummaryData, 1);
  
  // Color code shot-by-shot SG column (column 7) - skip par column coloring
  colorSGCells(wsSG, sgSummaryData, 7, false);
  
  // Bold par values in SG sheet (column 1 starting from row 9)
  sgSummaryData.forEach((row, rowIdx) => {
    if(rowIdx >= 9 && Array.isArray(row) && [3,4,5].includes(row[1])){
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: 1 });
      if(wsSG[cellRef]){
        wsSG[cellRef].s = wsSG[cellRef].s || {};
        wsSG[cellRef].s.font = { bold: true };
        wsSG[cellRef].s.border = THIN_BORDER;
      }
    }
  });
  
  // Add borders to SG sheet sections
  addBorders(wsSG, 2, 6, 0, 1); // SG summary at top
  addBorders(wsSG, 9, sgSummaryData.length - 1, 0, 7); // Shot data table
  
  // Play by Play - column 2 (SG) - only color SG values, not yardage
  playByPlayData.forEach((row, rowIdx) => {
    if(Array.isArray(row)){
      const cellRef2 = XLSX.utils.encode_cell({ r: rowIdx, c: 2 });
      if(ws7[cellRef2]){
        const val = parseFloat(row[2]);
        if(!isNaN(val)){
          if(val > 0){
            ws7[cellRef2].s = {
              font: { color: { rgb: "008000" } },
              fill: { fgColor: { rgb: "E8F5E9" } },
              border: THIN_BORDER
            };
          } else if(val < 0){
            ws7[cellRef2].s = {
              font: { color: { rgb: "CC0000" } },
              fill: { fgColor: { rgb: "FFEBEE" } },
              border: THIN_BORDER
            };
          } else {
            ws7[cellRef2].s = { border: border };
          }
        } else {
          // Non-SG cells in column 2 - just border, no color
          ws7[cellRef2].s = { border: THIN_BORDER };
        }
      }
    }
  });
  
  // Add borders to Off The Tee sheet
  addBorders(ws2, 2, 2, 0, 1); // SG row
  addBorders(ws2, 4, 7, 0, 2); // Fairways section with header
  addBorders(ws2, 9, 12, 0, 1); // Driving distance section
  addBorders(ws2, 14, 15 + driveDetails.length, 0, 2); // Driving by hole table
  const penaltyStartRow = 17 + driveDetails.length;
  addBorders(ws2, penaltyStartRow, penaltyStartRow + 2, 0, 1); // Penalties section
  
  // Add borders to Approach sheet
  addBorders(ws3, 2, 2, 0, 1); // SG row
  addBorders(ws3, 4, 5, 0, 2); // GIR section
  addBorders(ws3, 7, 11, 0, 2); // Missed greens
  
  // Add borders to Around the Green sheet
  addBorders(ws4, 2, 2, 0, 1); // SG row
  addBorders(ws4, 4, 5, 0, 2); // Scrambling/Bunkers
  
  // Add borders to Putting sheet - updated for new layout
  addBorders(ws5, 2, 2, 0, 1); // SG row
  addBorders(ws5, 4, 8, 0, 1); // Summary section
  addBorders(ws5, 10, 14, 0, 2); // Performance section
  addBorders(ws5, 16, 17 + puttRanges.length, 0, 2); // Make % by distance
  
  // Color SG values in putting hole-by-hole table
  colorSGCells(ws5, puttingData, 4);
  
  return wb;
}

export function exportToExcel(){
  if(!S.allHoles || S.allHoles.length===0){
    alert('No round data to export. Please complete at least one hole.');
    return;
  }
  
  const wb = generateExcelWorkbook();
  const pName = (playerName.value||'Player').replace(/[^a-zA-Z0-9]/g, '');
  const cName = (courseName.value||'Course').replace(/[^a-zA-Z0-9]/g, '');
  const rDate = formatDateForFilename(roundDate.value);
  const filename = `${pName}_${rDate}_${cName}.xlsx`;
  XLSX.writeFile(wb, filename);
}

async function downloadSavedRound(roundId, btn) {
  var origText = btn.innerHTML;
  btn.innerHTML = '⏳';
  btn.disabled = true;
  try {
    var { data, error } = await _sb.from('rounds').select('*').eq('id', roundId).single();
    if (error || !data || !data.round_data || !data.round_data.allHoles || data.round_data.allHoles.length === 0) {
      alert('Could not load round data.');
      return;
    }
    var rd = data.round_data;

    // Save current globals
    var prevAllHoles = S.allHoles, prevTotalHoles = S.totalHoles, prevTotalStrokes = S.totalStrokes, prevTotalPar = S.totalPar, prevTotalPutts = S.totalPutts;
    var prevFwHit = S.fwHit, prevFwOpp = S.fwOpp, prevFwLeft = S.fwLeft, prevFwRight = S.fwRight;
    var prevGir = S.gir, prevGirOpp = S.girOpp, prevScr = S.scr, prevScrOpp = S.scrOpp, prevBun = S.bun, prevBunOpp = S.bunOpp;
    var prevOnePuttMade = S.onePuttMade, prevOnePuttOpp = S.onePuttOpp, prevThreePlusPutts = S.threePlusPutts;
    var prevP3 = S.p3, prevC3 = S.c3, prevP4 = S.p4, prevC4 = S.c4, prevP5 = S.p5, prevC5 = S.c5;
    var prevMissLeft = S.missLeft, prevMissRight = S.missRight, prevMissShort = S.missShort, prevMissLong = S.missLong;
    var prevGirFirstPuttDist = S.girFirstPuttDist, prevGirPutts = S.girPutts;
    var prevPlayerName = playerName.value, prevCourseName = courseName.value, prevRoundDate = roundDate.value;
    var prevRoundType = document.getElementById('roundType').value;
    var prevHandicap = document.getElementById('playerHandicap').value;

    // Restore round data into globals
    playerName.value = data.player_name;
    courseName.value = data.course_name;
    roundDate.value = data.round_date;
    document.getElementById('roundType').value = data.round_type || 'Casual';
    document.getElementById('playerHandicap').value = data.handicap || 'pro';
    S.allHoles = rd.allHoles;
    S.totalHoles = data.holes;
    S.totalStrokes = 0; S.totalPar = 0; S.totalPutts = 0;
    S.fwHit = 0; S.fwOpp = 0; S.fwLeft = 0; S.fwRight = 0;
    S.gir = 0; S.girOpp = 0; S.girFirstPuttDist = 0; S.girPutts = 0;
    S.scr = 0; S.scrOpp = 0; S.bun = 0; S.bunOpp = 0;
    S.onePuttMade = 0; S.onePuttOpp = 0; S.threePlusPutts = 0;
    S.p3 = 0; S.c3 = 0; S.p4 = 0; S.c4 = 0; S.p5 = 0; S.c5 = 0;
    S.missLeft = 0; S.missRight = 0; S.missShort = 0; S.missLong = 0;

    S.allHoles.forEach(function(h) {
      S.totalStrokes += h.score;
      S.totalPar += h.par;
      S.totalPutts += h.putts || 0;
      S.onePuttOpp += 1;
      if (h.par === 3) { S.c3++; S.p3 += h.score; }
      if (h.par === 4) { S.c4++; S.p4 += h.score; }
      if (h.par === 5) { S.c5++; S.p5 += h.score; }
      if ((h.putts || 0) === 1) S.onePuttMade++;
      if ((h.putts || 0) >= 3) S.threePlusPutts++;
      var shotsToGreen = 0;
      for (var si = 0; si < (h.shots || []).length; si++) {
        if (h.shots[si].isPutt) break;
        shotsToGreen++;
      }
      if (shotsToGreen <= (h.par - 2) && h.firstPuttDist > 0) {
        S.girFirstPuttDist += h.firstPuttDist;
        S.girPutts += h.putts || 0;
      }
    });
    if (rd.stats) {
      S.fwHit = rd.stats.fwHit || 0; S.fwOpp = rd.stats.fwOpp || 0;
      S.fwLeft = rd.stats.fwLeft || 0; S.fwRight = rd.stats.fwRight || 0;
      S.gir = rd.stats.girHit || 0; S.girOpp = rd.stats.girOpp || 0;
      S.scr = rd.stats.scrMade || 0; S.scrOpp = rd.stats.scrOpp || 0;
      S.bun = rd.stats.bunMade || 0; S.bunOpp = rd.stats.bunOpp || 0;
      if (rd.stats.onePutts !== undefined) S.onePuttMade = rd.stats.onePutts;
      if (rd.stats.threePutts !== undefined) S.threePlusPutts = rd.stats.threePutts;
    }
    S.allHoles.forEach(function(h) {
      (h.shots || []).forEach(function(s) {
        if (s.lie && s.lie.startsWith('MISS ')) {
          S.girOpp++;
          if (s.lie === 'MISS LEFT') S.missLeft++;
          if (s.lie === 'MISS RIGHT') S.missRight++;
          if (s.lie === 'MISS SHORT') S.missShort++;
          if (s.lie === 'MISS LONG') S.missLong++;
        }
      });
    });

    var hcp = document.getElementById('playerHandicap').value || 'pro';
    recalculateAllSG(hcp);

    // Generate and download
    var wb = generateExcelWorkbook();
    var pName = (data.player_name || 'Player').replace(/[^a-zA-Z0-9]/g, '');
    var cName = (data.course_name || 'Course').replace(/[^a-zA-Z0-9]/g, '');
    var rDate = formatDateForFilename(data.round_date);
    XLSX.writeFile(wb, pName + '_' + rDate + '_' + cName + '.xlsx');

    // Restore previous globals
    S.allHoles = prevAllHoles; S.totalHoles = prevTotalHoles; S.totalStrokes = prevTotalStrokes; S.totalPar = prevTotalPar; S.totalPutts = prevTotalPutts;
    S.fwHit = prevFwHit; S.fwOpp = prevFwOpp; S.fwLeft = prevFwLeft; S.fwRight = prevFwRight;
    S.gir = prevGir; S.girOpp = prevGirOpp; S.scr = prevScr; S.scrOpp = prevScrOpp; S.bun = prevBun; S.bunOpp = prevBunOpp;
    S.onePuttMade = prevOnePuttMade; S.onePuttOpp = prevOnePuttOpp; S.threePlusPutts = prevThreePlusPutts;
    S.p3 = prevP3; S.c3 = prevC3; S.p4 = prevP4; S.c4 = prevC4; S.p5 = prevP5; S.c5 = prevC5;
    S.missLeft = prevMissLeft; S.missRight = prevMissRight; S.missShort = prevMissShort; S.missLong = prevMissLong;
    S.girFirstPuttDist = prevGirFirstPuttDist; S.girPutts = prevGirPutts;
    playerName.value = prevPlayerName; courseName.value = prevCourseName; roundDate.value = prevRoundDate;
    document.getElementById('roundType').value = prevRoundType;
    document.getElementById('playerHandicap').value = prevHandicap;
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
  }
}

function generateCSV(){
  let csv='';
  
  // SCORING
  csv+='SCORING\n';
  csv+=`Player:,${playerName.value||'Player'}\n`;
  csv+=`Handicap:,${document.getElementById('playerHandicap').value||'N/A'}\n`;
  csv+=`Course:,${courseName.value||'Course'}\n`;
  csv+=`Date:,${formatDateForDisplay(roundDate.value)}\n`;
  csv+=`Round Type:,${document.getElementById('roundType').value||'Casual'}\n`;
  csv+='\n';
  
  csv+='Hole,';
  S.allHoles.forEach(h=>csv+=`${h.hole},`);
  csv+='TOTAL\n';
  
  csv+='Yards,';
  let totalYards=0;
  S.allHoles.forEach(h=>{
    csv+=`${h.yards},`;
    totalYards+=h.yards;
  });
  csv+=`${totalYards}\n`;
  
  csv+='Par,';
  S.allHoles.forEach(h=>csv+=`${h.par},`);
  csv+=`${S.totalPar}\n`;
  
  csv+='Score,';
  S.allHoles.forEach(h=>csv+=`${h.score},`);
  csv+=`${S.totalStrokes}\n`;
  
  csv+='Putts,';
  S.allHoles.forEach(h=>csv+=`${h.putts},`);
  csv+=`${S.totalPutts}\n`;
  
  csv+='\n';
  
  csv+=`Avg Par 3 Score,${S.c3?(S.p3/S.c3).toFixed(2):'N/A'}\n`;
  csv+=`Avg Par 4 Score,${S.c4?(S.p4/S.c4).toFixed(2):'N/A'}\n`;
  csv+=`Avg Par 5 Score,${S.c5?(S.p5/S.c5).toFixed(2):'N/A'}\n`;
  csv+='\n';
  
  let eagles=0,birdies=0,pars=0,bogeys=0,doubleOrWorse=0;
  S.allHoles.forEach(h=>{
    const diff=h.score-h.par;
    if(diff<=-2) eagles++;
    else if(diff===-1) birdies++;
    else if(diff===0) pars++;
    else if(diff===1) bogeys++;
    else doubleOrWorse++;
  });
  csv+=`Eagles,${eagles}\n`;
  csv+=`Birdies,${birdies}\n`;
  csv+=`Pars,${pars}\n`;
  csv+=`Bogeys,${bogeys}\n`;
  csv+=`Double or Worse,${doubleOrWorse}\n`;
  
  // OFF THE TEE
  csv+='\nOFF THE TEE\n';
  csv+=`Fairways Hit,${S.fwHit}/${S.fwOpp},${S.fwOpp?Math.round(S.fwHit/S.fwOpp*100):0}%\n`;
  csv+=`Missed Left,${S.fwLeft},${S.fwOpp?Math.round(S.fwLeft/S.fwOpp*100):0}%\n`;
  csv+=`Missed Right,${S.fwRight},${S.fwOpp?Math.round(S.fwRight/S.fwOpp*100):0}%\n`;
  
  let drivingDistances=[];
  let driveDetailsCSV=[];
  S.allHoles.forEach(h=>{
    if((h.par===4||h.par===5)&&h.shots.length>0){
      const teeShot = h.shots[0];
      let driveDistance = null;
      
      if(teeShot.lie==='WATER'||teeShot.lie==='OB'){
        for(let j=1; j<h.shots.length; j++){
          const s = h.shots[j];
          if(s.lie!=='PENALTY'&&s.lie!=='WATER'&&s.lie!=='OB'&&s.lie!=='RECOVERY'&&s.distanceAfter!=null){
            driveDistance = s.distanceBefore - s.distanceAfter;
            break;
          }
        }
      } else if(teeShot.lie==='RECOVERY'){
        if(teeShot.distanceAfter!=null){
          driveDistance = h.yards - teeShot.distanceAfter;
        }
      } else if(teeShot.distanceAfter!=null&&teeShot.lie!=='PENALTY'){
        driveDistance = h.yards - teeShot.distanceAfter;
      }
      
      if(driveDistance !== null){
        drivingDistances.push(driveDistance);
        driveDetailsCSV.push({hole: h.hole, distance: driveDistance, par: h.par, yards: h.yards});
      }
    }
  });
  const avgDrive=drivingDistances.length?Math.round(drivingDistances.reduce((a,b)=>a+b,0)/drivingDistances.length):0;
  csv+=`Avg Driving Distance,${avgDrive} yards\n`;
  csv+='\n';
  csv+='DRIVING DISTANCES\n';
  csv+='Hole,Par,Drive Distance\n';
  driveDetailsCSV.forEach(d=>{
    csv+=`${d.hole},${d.par},${d.distance} yds\n`;
  });
  
  // APPROACH
  csv+='\nAPPROACH\n';
  csv+=`GIR,${S.gir}/${S.totalHoles},${S.totalHoles?Math.round(S.gir/S.totalHoles*100):0}%\n`;
  csv+=`Proximity when GIR,${S.gir?Math.round(S.girFirstPuttDist/S.gir):0} ft\n`;
  csv+='\n';
  csv+='MISSED GREENS\n';
  csv+=`Short,${S.missShort},${S.girOpp?Math.round(S.missShort/S.girOpp*100):0}%\n`;
  csv+=`Long,${S.missLong},${S.girOpp?Math.round(S.missLong/S.girOpp*100):0}%\n`;
  csv+=`Left,${S.missLeft},${S.girOpp?Math.round(S.missLeft/S.girOpp*100):0}%\n`;
  csv+=`Right,${S.missRight},${S.girOpp?Math.round(S.missRight/S.girOpp*100):0}%\n`;
  csv+='\n';
  
  // Get actual proximity: prefer next putt's distanceBefore over approach distanceAfter
  function getProxCsv(shots,idx,s){
    if(s.lie==='HOLED')return 0;
    const next=shots[idx+1];
    if(next&&next.isPutt&&next.distanceBefore>0)return next.distanceBefore;
    return s.distanceAfter||0;
  }
  let par3ApproachDist=[],par4ApproachDist=[],par5ApproachDist=[];
  let par3Approaches=[],par4Approaches=[],par5Approaches=[];

  S.allHoles.forEach(h=>{
    const shots=h.shots||[];
    // For par 4/5, get the 2nd shot distance (approach shot distance)
    if(h.par === 4 && shots.length >= 2){
      const secondShot = shots[1];
      if(secondShot && secondShot.distanceBefore && !secondShot.isPutt){
        par4ApproachDist.push(secondShot.distanceBefore);
        if(secondShot.lie === 'GREEN'){
          par4Approaches.push(getProxCsv(shots,1,secondShot));
        }
      }
    } else if(h.par === 5 && shots.length >= 2){
      const secondShot = shots[1];
      if(secondShot && secondShot.distanceBefore && !secondShot.isPutt){
        par5ApproachDist.push(secondShot.distanceBefore);
        if(secondShot.lie === 'GREEN'){
          par5Approaches.push(getProxCsv(shots,1,secondShot));
        }
      }
    }

    // For par 3, the tee shot is the approach
    if(h.par === 3 && shots.length >= 1){
      const teeShot = shots[0];
      if(teeShot){
        par3ApproachDist.push(h.yards);
        if(teeShot.lie === 'GREEN'){
          par3Approaches.push(getProxCsv(shots,0,teeShot));
        }
      }
    }
  });
  
  const avgPar3Dist=par3ApproachDist.length?Math.round(par3ApproachDist.reduce((a,b)=>a+b,0)/par3ApproachDist.length):0;
  const avgPar3=par3Approaches.length?Math.round(par3Approaches.reduce((a,b)=>a+b,0)/par3Approaches.length):0;
  const avgPar4Dist=par4ApproachDist.length?Math.round(par4ApproachDist.reduce((a,b)=>a+b,0)/par4ApproachDist.length):0;
  const avgPar4=par4Approaches.length?Math.round(par4Approaches.reduce((a,b)=>a+b,0)/par4Approaches.length):0;
  const avgPar5Dist=par5ApproachDist.length?Math.round(par5ApproachDist.reduce((a,b)=>a+b,0)/par5ApproachDist.length):0;
  const avgPar5=par5Approaches.length?Math.round(par5Approaches.reduce((a,b)=>a+b,0)/par5Approaches.length):0;
  
  csv+='Approach by Distance,# of Shots,Avg Proximity\n';

  const approachRanges=[
    {min:101,max:125,shots:[],total:0,label:'101-125 yards'},
    {min:126,max:150,shots:[],total:0,label:'126-150 yards'},
    {min:151,max:175,shots:[],total:0,label:'151-175 yards'},
    {min:176,max:200,shots:[],total:0,label:'176-200 yards'},
    {min:201,max:225,shots:[],total:0,label:'201-225 yards'},
    {min:226,max:250,shots:[],total:0,label:'226-250 yards'},
    {min:251,max:275,shots:[],total:0,label:'251-275 yards'},
    {min:276,max:999,shots:[],total:0,label:'276+ yards'}
  ];

  S.allHoles.forEach(h=>{
    const shots=h.shots||[];
    shots.forEach((s,idx)=>{
      const distBefore=s.distanceBefore||0;
      const isPar45Tee=s.shotNum===1&&(h.par===4||h.par===5);
      const isAppAttempt=!s.isPutt&&distBefore>100&&!isPar45Tee&&s.lie!=='PENALTY';
      if(isAppAttempt){
        approachRanges.forEach(r=>{
          if(distBefore>=r.min&&distBefore<=r.max){
            r.total++;
            if(s.lie==='GREEN'||s.lie==='HOLED') r.shots.push(getProxCsv(shots,idx,s));
          }
        });
      }
    });
  });

  approachRanges.forEach(r=>{
    const avg=r.shots.length?Math.round(r.shots.reduce((a,b)=>a+b,0)/r.shots.length):0;
    csv+=`${r.label},${r.total},${r.shots.length>0?avg+' ft':'–'}\n`;
  });
  
  csv+='\n';
  csv+=`Avg Par 3 Tee Shot Distance,${avgPar3Dist} yds,${par3ApproachDist.length} shots\n`;
  csv+=`Avg Par 3 Tee Shot Proximity,${avgPar3} ft\n`;
  csv+='\n';
  csv+=`Avg Par 4 Approach Distance,${avgPar4Dist} yds,${par4ApproachDist.length} shots\n`;
  csv+=`Avg Par 4 Approach Proximity,${avgPar4} ft\n`;
  csv+='\n';
  csv+=`Avg Par 5 Approach Distance,${avgPar5Dist} yds,${par5ApproachDist.length} shots\n`;
  csv+=`Avg Par 5 Approach Proximity,${avgPar5} ft\n`;
  
  // AROUND THE GREEN
  csv+='\nAROUND THE GREEN\n';
  csv+=`Scrambling,${S.scr}/${S.scrOpp},${S.scrOpp?Math.round(S.scr/S.scrOpp*100):0}%\n`;
  csv+=`Up & Down from Bunkers,${S.bun}/${S.bunOpp},${S.bunOpp?Math.round(S.bun/S.bunOpp*100):0}%\n`;
  
  let bunkerShots=[];
  S.allHoles.forEach(h=>{
    h.shots.forEach((s,idx)=>{
      if(s.lie&&s.lie.includes('BUNKER')&&h.shots[idx+1]){
        const nextShot=h.shots[idx+1];
        if(nextShot.lie==='GREEN'){
          bunkerShots.push(nextShot.distanceAfter||0);
        }
      }
    });
  });
  const avgBunkerProx=bunkerShots.length?Math.round(bunkerShots.reduce((a,b)=>a+b,0)/bunkerShots.length):0;
  csv+=`Avg Proximity from Bunkers,${avgBunkerProx} ft,${bunkerShots.length} shots\n`;
  csv+='\n';
  csv+='Around the Green by Distance,# of Shots,Avg Proximity\n';
  
  const shortRanges=[
    {min:0,max:25,shots:[],label:'0-25 yards'},
    {min:26,max:50,shots:[],label:'26-50 yards'},
    {min:51,max:75,shots:[],label:'51-75 yards'},
    {min:76,max:100,shots:[],label:'76-100 yards'}
  ];
  
  S.allHoles.forEach(h=>{
    h.shots.forEach((s,idx)=>{
      const distBefore=s.distanceBefore||0;
      if(!s.isPutt&&distBefore>0&&distBefore<=100&&s.lie==='GREEN'){
        shortRanges.forEach(r=>{
          if(distBefore>=r.min&&distBefore<=r.max){
            r.shots.push(s.distanceAfter||0);
          }
        });
      }
    });
  });
  
  shortRanges.forEach(r=>{
    const avg=r.shots.length?Math.round(r.shots.reduce((a,b)=>a+b,0)/r.shots.length):0;
    csv+=`${r.label},${r.shots.length},${avg} ft\n`;
  });
  
  // PUTTING
  csv+='\nPUTTING\n';
  csv+=`Total Putts,${S.totalPutts}\n`;
  csv+=`Putts per Hole,${(S.totalPutts/S.totalHoles).toFixed(1)}\n`;
  csv+=`Putts per GIR,${S.gir?(S.girPutts/S.gir).toFixed(1):'N/A'}\n`;
  csv+=`Three-Putts,${S.threePlusPutts}\n`;
  csv+=`One-Putt %,${S.onePuttOpp?Math.round(S.onePuttMade/S.onePuttOpp*100):0}%\n`;
  csv+='\n';
  
  // Make % by distance in CSV
  csv+='MAKE % BY DISTANCE\n';
  csv+='Distance,Made/Total,Make %\n';
  const csvPuttRanges = [
    {min:0,max:3,label:'0-3 ft'},{min:4,max:7,label:'4-7 ft'},{min:8,max:11,label:'8-11 ft'},
    {min:12,max:15,label:'12-15 ft'},{min:16,max:20,label:'16-20 ft'},{min:21,max:30,label:'21-30 ft'},
    {min:31,max:40,label:'31-40 ft'},{min:41,max:50,label:'41-50 ft'},
    {min:51,max:999,label:'50+ ft'}
  ];
  csvPuttRanges.forEach(r=>{
    let made=0,total=0;
    S.allHoles.forEach(h=>{
      (h.shots||[]).forEach(s=>{
        if(s.isPutt && s.distanceBefore >= r.min && s.distanceBefore <= r.max){
          total++;
          if(s.lie === 'HOLED' || s.distanceAfter === 0) made++;
        }
      });
    });
    if(total>0) csv+=`${r.label},${made}/${total},${Math.round(made/total*100)}%\n`;
    else csv+=`${r.label},0/0,-\n`;
  });
  csv+='\n';
  
  csv+='STROKES GAINED PUTTING\n';
  csv+=`Total SG Putting,${S.sgPuttingTotal.toFixed(2)}\n`;
  csv+=`SG Putting per Hole,${(S.sgPuttingTotal/S.totalHoles).toFixed(2)}\n`;
  csv+='\n';
  csv+='Hole,First Putt Dist,Putts,Expected Putts,SG Putting\n';
  S.allHoles.forEach(h=>{
    if(h.firstPuttDist){
      csv+=`${h.hole},${h.firstPuttDist} ft,${h.putts},${h.expectedPutts?h.expectedPutts.toFixed(2):'N/A'},${h.sgPutting?h.sgPutting.toFixed(2):'N/A'}\n`;
    }
  });
  
  // PLAY BY PLAY
  csv+='\nPLAY BY PLAY\n';
  S.allHoles.forEach(h=>{
    csv+=`\nHole ${h.hole},Par ${h.par},${h.yards} yards\n`;
    
    h.shots.forEach((s, idx)=>{
      const nextShot = h.shots[idx+1];
      let shotDesc = '';
      
      let endLie = s.lie || 'Unknown';
      if(endLie === 'HOLED') endLie = 'in the hole';
      else if(endLie === 'PUTT') endLie = 'green';
      else if(endLie === 'LEFT ROUGH' || endLie === 'RIGHT ROUGH') endLie = endLie.toLowerCase();
      else if(endLie === 'GS BUNKER' || endLie === 'FW BUNKER') endLie = endLie.toLowerCase().replace('gs ', 'greenside ').replace('fw ', 'fairway ');
      else if(endLie === 'MISS LEFT') endLie = 'left of green';
      else if(endLie === 'MISS RIGHT') endLie = 'right of green';
      else if(endLie === 'MISS SHORT') endLie = 'short of green';
      else if(endLie === 'MISS LONG') endLie = 'long of green';
      else endLie = endLie.toLowerCase();
      
      let shotDist = '';
      if(s.isPutt){
        if(s.distanceBefore != null) shotDist = s.distanceBefore + ' ft';
      } else if(s.shotNum === 1 && (h.par === 4 || h.par === 5) && (s.lie === 'WATER' || s.lie === 'OB' || s.lie === 'RECOVERY')){
        // For water/OB/recovery tee shots, find next real shot to calc drive distance
        let nextRealShot = null;
        for(let j = idx + 1; j < h.shots.length; j++){
          if(h.shots[j].lie !== 'PENALTY' && h.shots[j].lie !== 'WATER' && h.shots[j].lie !== 'OB' && h.shots[j].lie !== 'RECOVERY'){
            nextRealShot = h.shots[j]; break;
          }
        }
        if(nextRealShot && nextRealShot.distanceAfter != null){
          shotDist = (h.yards - nextRealShot.distanceAfter) + ' yds';
        } else {
          shotDist = h.yards + ' yds';
        }
      } else if(s.shotNum === 1 && (h.par === 4 || h.par === 5) && s.distanceAfter != null){
        const driveDist = h.yards - s.distanceAfter;
        shotDist = driveDist + ' yds';
      } else if(s.shotNum === 1){
        shotDist = h.yards + ' yds';
      } else if(s.distanceBefore != null){
        shotDist = s.distanceBefore + ' yds';
      }
      
      if(s.lie === 'HOLED'){
        shotDesc = `Shot ${s.shotNum} - ${shotDist} putt in the hole`;
      } else {
        let remaining = '';
        // For water/OB/recovery, get remaining from next real shot
        if(s.lie === 'WATER' || s.lie === 'OB' || s.lie === 'RECOVERY'){
          let nextRealShot = null;
          for(let j = idx + 1; j < h.shots.length; j++){
            if(h.shots[j].lie !== 'PENALTY' && h.shots[j].lie !== 'WATER' && h.shots[j].lie !== 'OB' && h.shots[j].lie !== 'RECOVERY'){
              nextRealShot = h.shots[j]; break;
            }
          }
          if(nextRealShot && nextRealShot.distanceAfter != null){
            remaining = nextRealShot.distanceAfter + ' yds';
          }
        } else if(s.distanceAfter != null){
          if(nextShot && nextShot.isPutt) remaining = s.distanceAfter + ' ft';
          else if(s.isPutt) remaining = s.distanceAfter + ' ft';
          else remaining = s.distanceAfter + ' yds';
        } else if(nextShot){
          if(nextShot.isPutt) remaining = nextShot.distanceBefore != null ? nextShot.distanceBefore + ' ft' : '';
          else remaining = nextShot.distanceBefore != null ? nextShot.distanceBefore + ' yds' : '';
        }
        
        if(s.isPutt){
          shotDesc = `Shot ${s.shotNum} - ${shotDist} putt to ${remaining} from hole`;
        } else {
          shotDesc = `Shot ${s.shotNum} - ${shotDist} to ${endLie}, ${remaining} to hole`;
        }
      }
      
      let sgDisplay = '';
      if(s.sg != null){
        sgDisplay = s.sg >= 0 ? '+' + s.sg.toFixed(2) : s.sg.toFixed(2);
      }
      
      csv+=`,${shotDesc},${sgDisplay}\n`;
    });
    
    const scoreToPar = h.score - h.par;
    let scoreLabel = '';
    if(scoreToPar <= -2) scoreLabel = 'Eagle';
    else if(scoreToPar === -1) scoreLabel = 'Birdie';
    else if(scoreToPar === 0) scoreLabel = 'Par';
    else if(scoreToPar === 1) scoreLabel = 'Bogey';
    else if(scoreToPar === 2) scoreLabel = 'Double Bogey';
    else if(scoreToPar > 2) scoreLabel = '+' + scoreToPar;
    else scoreLabel = scoreToPar.toString();
    
    csv+=`,Score: ${h.score} (${scoreLabel})\n`;
  });
  
  // STROKES GAINED DATA
  csv+='\n\nSTROKES GAINED DATA\n';
  csv+='Hole,Par,Shot #,Start Distance,Start Lie,End Lie,End Distance\n';
  
  S.allHoles.forEach(h=>{
    h.shots.forEach((s, idx)=>{
      const nextShot = h.shots[idx+1];
      const prevShot = idx > 0 ? h.shots[idx-1] : null;
      
      // Start lie category
      let startLieCat = '';
      if(s.shotNum === 1){
        startLieCat = 'Tee';
      } else if(s.isPutt){
        startLieCat = 'Green';
      } else if(prevShot && prevShot.lie){
        startLieCat = categorizeLie(prevShot.lie, false, false);
      } else {
        startLieCat = 'Unknown';
      }
      
      // Start distance - yards off green, feet on green
      let startDist = s.distanceBefore || 0;
      let startDistDisplay = '';
      if(s.isPutt){
        startDistDisplay = startDist + ' ft';
      } else {
        startDistDisplay = startDist + ' yds';
      }
      
      // End lie category
      let endLieCat = '';
      if(s.lie === 'HOLED'){
        endLieCat = 'Holed';
      } else {
        endLieCat = categorizeLie(s.lie, s.isPutt, false);
      }
      
      // End distance - yards off green, feet on green
      let endDistDisplay = '0';
      if(s.lie === 'HOLED'){
        endDistDisplay = '0';
      } else if(s.distanceAfter != null){
        if(nextShot && nextShot.isPutt){
          endDistDisplay = s.distanceAfter + ' ft';
        } else if(s.isPutt){
          endDistDisplay = s.distanceAfter + ' ft';
        } else {
          endDistDisplay = s.distanceAfter + ' yds';
        }
      } else if(nextShot){
        if(nextShot.isPutt){
          endDistDisplay = (nextShot.distanceBefore || 0) + ' ft';
        } else {
          endDistDisplay = (nextShot.distanceBefore || 0) + ' yds';
        }
      }
      
      csv+=`${h.hole},${h.par},${s.shotNum},${startDistDisplay},${startLieCat},${endLieCat},${endDistDisplay}\n`;
    });
  });
  
  return csv;
}

// Functions called from inline HTML handlers
expose({ exportToExcel, downloadSavedRound });
