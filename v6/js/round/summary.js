import { S } from '../core/state.js';
import { updateSGDisplay } from './sg-recalc.js';
import { renderSGRadarSummary } from '../stats/radar.js';

export function renderSummary(){
  sumScore.innerText=S.totalStrokes;
  sumPar.innerText=S.totalPar;
  const d=S.totalStrokes-S.totalPar;
  sumToPar.innerText=d===0?'E':`${d>0?'+':''}${d}`;
  const dt=new Date(roundDate.value + 'T12:00:00');
  roundMeta.innerText=`${playerName.value||'Player'} · ${courseName.value||'Course'} · ${dt.getMonth()+1}/${dt.getDate()}/${dt.getFullYear()} · ${document.getElementById('roundType').value}`;

  fwHitS.innerText=S.fwHit;fwOppS.innerText=S.fwOpp;fwPctS.innerText=S.fwOpp?Math.round(S.fwHit/S.fwOpp*100):0;
  fwLeftS.innerText=S.fwLeft;fwRightS.innerText=S.fwRight;
  fwLeftPctS.innerText=S.fwOpp?Math.round(S.fwLeft/S.fwOpp*100):0;
  fwRightPctS.innerText=S.fwOpp?Math.round(S.fwRight/S.fwOpp*100):0;

  girS.innerText=S.gir;girTotS.innerText=S.totalHoles;girPctS.innerText=S.totalHoles?Math.round(S.gir/S.totalHoles*100):0;
  proxGirS.innerText=S.gir?Math.round(S.girFirstPuttDist/S.gir):0;

  scrS.innerText=S.scr;scrOppS.innerText=S.scrOpp;scrPctS.innerText=S.scrOpp?Math.round(S.scr/S.scrOpp*100):0;
  bunS.innerText=S.bun;bunOppS.innerText=S.bunOpp;bunPctS.innerText=S.bunOpp?Math.round(S.bun/S.bunOpp*100):0;

  avgP3.innerText=S.c3?(S.p3/S.c3).toFixed(1):'–';
  avgP4.innerText=S.c4?(S.p4/S.c4).toFixed(1):'–';
  avgP5.innerText=S.c5?(S.p5/S.c5).toFixed(1):'–';

  pph.innerText=`Putts per Hole- ${(S.totalPutts/S.totalHoles).toFixed(1)}`;
  ppg.innerText=`Putts per GIR- ${S.gir?(S.girPutts/S.gir).toFixed(1):'–'}`;

  threePutts.innerText=`Three or more putts- ${S.threePlusPutts}`;
  onePuttPct.innerText=`One-Putt %- ${S.onePuttOpp?Math.round(S.onePuttMade/S.onePuttOpp*100):0}%`;
  
  // Color coding helper functions
  // green = good, white = average, red = below average
  function colorStat(el, val, goodThreshold, avgThreshold, higherIsBetter=true){
    if(val === '–' || val === 'N/A') return;
    const numVal = parseFloat(val);
    if(isNaN(numVal)) return;
    if(higherIsBetter){
      if(numVal >= goodThreshold) el.style.color = '#00b87a'; // green
      else if(numVal >= avgThreshold) el.style.color = '#ffffff'; // white
      else el.style.color = '#d4706e'; // red
    } else {
      if(numVal <= goodThreshold) el.style.color = '#00b87a'; // green
      else if(numVal <= avgThreshold) el.style.color = '#ffffff'; // white
      else el.style.color = '#d4706e'; // red
    }
  }
  
  // Avg Par scores - lower is better. Par is avg, -0.2 is good
  if(S.c3) colorStat(avgP3, avgP3.innerText, 2.9, 3.1, false);
  if(S.c4) colorStat(avgP4, avgP4.innerText, 3.9, 4.1, false);
  if(S.c5) colorStat(avgP5, avgP5.innerText, 4.9, 5.1, false);
  
  // Fairway % - higher is better. 60% good, 50% avg
  const fwPct = S.fwOpp ? Math.round(S.fwHit/S.fwOpp*100) : 0;
  colorStat(fwPctS, fwPct, 60, 50, true);
  
  // GIR % - higher is better. 50% good, 33% avg
  const girPct = S.totalHoles ? Math.round(S.gir/S.totalHoles*100) : 0;
  colorStat(girPctS, girPct, 50, 33, true);
  
  // Proximity when GIR - lower is better. 25ft good, 35ft avg
  const proxGir = S.gir ? Math.round(S.girFirstPuttDist/S.gir) : 0;
  colorStat(proxGirS, proxGir, 25, 35, false);
  
  // Scrambling % - higher is better. 50% good, 33% avg. White if 0 opportunities
  const scrPct = S.scrOpp ? Math.round(S.scr/S.scrOpp*100) : 0;
  if(S.scrOpp > 0) colorStat(scrPctS, scrPct, 50, 33, true);
  else scrPctS.style.color = '#ffffff';
  
  // Bunker save % - higher is better. 40% good, 25% avg. White if 0 opportunities
  const bunPct = S.bunOpp ? Math.round(S.bun/S.bunOpp*100) : 0;
  if(S.bunOpp > 0) colorStat(bunPctS, bunPct, 40, 25, true);
  else bunPctS.style.color = '#ffffff';
  
  // Putts per hole - lower is better. 1.8 good, 2.0 avg
  const pphVal = (S.totalPutts/S.totalHoles).toFixed(1);
  const pphSpan = document.createElement('span');
  pph.innerHTML = `Putts per Hole- <span class="num" id="pphVal">${pphVal}</span>`;
  colorStat(document.getElementById('pphVal'), pphVal, 1.8, 2.0, false);
  
  // Putts per GIR - lower is better. 1.8 good, 2.0 avg
  const ppgVal = S.gir ? (S.girPutts/S.gir).toFixed(1) : '–';
  ppg.innerHTML = `Putts per GIR- <span class="num" id="ppgVal">${ppgVal}</span>`;
  if(ppgVal !== '–') colorStat(document.getElementById('ppgVal'), ppgVal, 1.8, 2.0, false);
  
  // Three putts - lower is better. 0 good, 2 avg
  threePutts.innerHTML = `Three or more putts- <span class="num" id="threePuttsVal">${S.threePlusPutts}</span>`;
  colorStat(document.getElementById('threePuttsVal'), S.threePlusPutts, 0, 2, false);
  
  // One putt % - higher is better. 40% good, 30% avg
  const onePuttPctVal = S.onePuttOpp ? Math.round(S.onePuttMade/S.onePuttOpp*100) : 0;
  onePuttPct.innerHTML = `One-Putt %- <span class="num" id="onePuttPctVal">${onePuttPctVal}%</span>`;
  colorStat(document.getElementById('onePuttPctVal'), onePuttPctVal, 40, 30, true);
  
  // Display Strokes Gained stats - use actual calculated values
  // Sync the summary dropdown with the start-page selection
  const handicapVal = document.getElementById('playerHandicap').value;
  document.getElementById('summaryHandicapSelect').value = handicapVal;
  updateSGDisplay(handicapVal);
  
  // Render SG radar chart
  setTimeout(function() { renderSGRadarSummary(); }, 50);
}