import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { show } from '../core/router.js';
import { refreshFullStats } from '../round/edit-hole.js';
import { calculateSGForHandicap, recalculateAllSG } from '../round/sg-recalc.js';
import { getExpectedPutts } from '../sg/calc.js';
import { hcpLabels } from '../sg/tables.js';
import { renderFullStatsARGRadar, renderFullStatsApproachRadar, renderFullStatsDrivingRadar, renderFullStatsPuttingRadar, renderSGRadarChartFull } from './radar.js';

// ===== FULL STATS VIEWER =====
export function showFullStats() {
  var hcp = document.getElementById('summaryHandicapSelect').value || 'pro';
  var hcpLabel = hcpLabels[hcp] || hcp;
  
  var player = document.getElementById('playerName').value || 'Player';
  var course = document.getElementById('courseName').value || 'Course';
  var dt = new Date(document.getElementById('roundDate').value + 'T12:00:00');
  var dateStr = (dt.getMonth()+1)+'/'+dt.getDate()+'/'+dt.getFullYear();
  var d = S.totalStrokes - S.totalPar;
  var toParStr = d===0?'E':(d>0?'+':'')+d;
  var toParColor = d>0?'#d4706e':d<0?'#00a06d':'#9a9a9a';
  var roundType = document.getElementById('roundType').value || 'Casual';
  
  // Compact header with score prominent
  var headerHtml = '<div style="text-align:center;margin-bottom:4px;">';
  headerHtml += '<div style="font-size:28px;font-weight:800;color:#ffffff;">'+S.totalStrokes+' <span style="font-size:18px;">('+toParStr+')</span></div>';
  headerHtml += '<div style="font-size:11px;color:#606060;">'+player+' · '+course+' · '+dateStr+' · '+roundType+'</div>';
  headerHtml += '</div>';
  document.getElementById('fullStatsSubject').innerHTML = headerHtml;
  
  // Build tab buttons with handicap selector
  var tabNames = ['Scoring','Strokes Gained','Off The Tee','Approach','Around the Green','Putting','Play by Play'];
  var tabsHtml = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;">';
  tabsHtml += '<span style="font-size:12px;color:#9a9a9a;">View:</span>';
  tabsHtml += '<select id="fstSelect" onchange="showFullStatTab(parseInt(this.value))" style="background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:6px;padding:4px 10px;font-size:13px;max-width:none;width:auto;">';
  for (var i = 0; i < tabNames.length; i++) {
    tabsHtml += '<option value="'+i+'">'+tabNames[i]+'</option>';
  }
  tabsHtml += '</select>';
  tabsHtml += '<span style="font-size:12px;color:#9a9a9a;">vs:</span>';
  tabsHtml += '<select id="fstHandicapSelect" onchange="changeFullStatsHandicap(this.value)" style="background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:6px;padding:4px 10px;font-size:13px;max-width:none;width:auto;">';
  tabsHtml += '<option value="pro"'+(hcp==='pro'?' selected':'')+'>Tour Pro</option>';
  tabsHtml += '<option value="0"'+(hcp==='0'?' selected':'')+'>Scratch</option>';
  tabsHtml += '<option value="5"'+(hcp==='5'?' selected':'')+'>5 HCP</option>';
  tabsHtml += '<option value="10"'+(hcp==='10'?' selected':'')+'>10 HCP</option>';
  tabsHtml += '<option value="15"'+(hcp==='15'?' selected':'')+'>15 HCP</option>';
  tabsHtml += '<option value="20"'+(hcp==='20'?' selected':'')+'>20 HCP</option>';
  tabsHtml += '<option value="25"'+(hcp==='25'?' selected':'')+'>25 HCP</option>';
  tabsHtml += '<option value="30"'+(hcp==='30'?' selected':'')+'>30 HCP</option>';
  tabsHtml += '</select>';
  tabsHtml += '</div>';
  document.getElementById('fullStatsTabs').innerHTML = tabsHtml;
  
  // Helpers
  function sgFmt(v) { return v >= 0 ? '+' + v.toFixed(2) : v.toFixed(2); }
  function sgC(v) { return v >= 0 ? '#00a06d' : '#d4706e'; }
  function hdr(t) { return '<div style="font-size:14px;font-weight:800;color:#00b87a;margin:14px 0 4px;border-bottom:2px solid #007a52;padding-bottom:2px;">'+t+'</div>'; }
  function row(l,v,s) { return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #282828;"><span style="color:#9a9a9a;">'+l+'</span><span style="font-weight:700;">'+v+(s?' <span style="font-size:11px;color:#606060;">'+s+'</span>':'')+'</span></div>'; }
  function sgRow(l,v,s) { return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #282828;"><span style="color:#9a9a9a;">'+l+'</span><span style="font-weight:700;color:'+sgC(v)+';">'+sgFmt(v)+(s?' <span style="font-size:11px;color:#606060;">'+s+'</span>':'')+'</span></div>'; }
  function tbl(headers,rows) { var h='<div style="overflow-x:auto;margin:4px 0;"><table style="width:100%;font-size:12px;border-collapse:collapse;"><tr>';headers.forEach(function(c){h+='<td style="padding:4px 6px;font-weight:700;color:#9a9a9a;border-bottom:1px solid #3d3d3d;">'+c+'</td>';});h+='</tr>';rows.forEach(function(r){h+='<tr>';r.forEach(function(c){h+='<td style="padding:3px 6px;border-bottom:1px solid #282828;">'+c+'</td>';});h+='</tr>';});return h+'</table></div>';}
  
  // Pre-calculate all stats from allHoles
  var eagles=0,birdies=0,pars2=0,bogeys=0,dblPlus=0;
  S.allHoles.forEach(function(h){ var diff=h.score-h.par; if(diff<=-2)eagles++;else if(diff===-1)birdies++;else if(diff===0)pars2++;else if(diff===1)bogeys++;else dblPlus++; });
  
  // Drives
  var driveDetails=[], longestDr=0, shortestDr=999;
  S.allHoles.forEach(function(h){
    if((h.par===4||h.par===5)&&h.shots.length>0){
      var teeShot=h.shots[0];
      var dd=null;
      if(teeShot.lie==='WATER'||teeShot.lie==='OB'){
        for(var j=1;j<h.shots.length;j++){
          var s=h.shots[j];
          if(s.lie!=='PENALTY'&&s.lie!=='WATER'&&s.lie!=='OB'&&s.lie!=='RECOVERY'&&s.distanceAfter!=null){
            dd=s.distanceBefore-s.distanceAfter;break;
          }
        }
      }else if(teeShot.lie==='RECOVERY'){
        if(teeShot.distanceAfter!=null){
          dd=h.yards-teeShot.distanceAfter;
        }
      }else if(teeShot.distanceAfter!=null&&teeShot.lie!=='PENALTY'){
        dd=h.yards-teeShot.distanceAfter;
      }
      if(dd!==null){
        driveDetails.push({hole:h.hole,par:h.par,dist:dd});
        if(dd>longestDr)longestDr=dd;if(dd<shortestDr)shortestDr=dd;
      }
    }
  });
  if(driveDetails.length===0)shortestDr=0;
  var avgDriveF=driveDetails.length>0?Math.round(driveDetails.reduce(function(a,b){return a+b.dist;},0)/driveDetails.length):0;
  
  // Penalties
  var par3TeePen=0,par45TeePen=0,appPenF=0,sgPenF=0;
  S.allHoles.forEach(function(h){ h.shots.forEach(function(s,idx){ if(s.lie==='PENALTY'){ var prev=h.shots[idx-1]; if(prev){ if(prev.shotNum===1){if(h.par===3)par3TeePen++;else par45TeePen++;}else if(prev.distanceBefore>100)appPenF++;else sgPenF++;} } }); });
  
  // Approach ranges
  var appRangesF=[{min:101,max:125,s:[],total:0,l:'101-125'},{min:126,max:150,s:[],total:0,l:'126-150'},{min:151,max:175,s:[],total:0,l:'151-175'},{min:176,max:200,s:[],total:0,l:'176-200'},{min:201,max:225,s:[],total:0,l:'201-225'},{min:226,max:250,s:[],total:0,l:'226-250'},{min:251,max:275,s:[],total:0,l:'251-275'},{min:276,max:999,s:[],total:0,l:'276+'}];
  var shortRangesF=[{min:0,max:25,s:[],l:'0-25'},{min:26,max:50,s:[],l:'26-50'},{min:51,max:75,s:[],l:'51-75'},{min:76,max:100,s:[],l:'76-100'}];
  var bunkerProxF=[];
  var par3AppD=[],par4AppD=[],par5AppD=[],par3AppP=[],par4AppP=[],par5AppP=[];
  var puttRangesF=[{min:0,max:3,m:0,t:0,l:'0-3 ft'},{min:4,max:7,m:0,t:0,l:'4-7 ft'},{min:8,max:11,m:0,t:0,l:'8-11 ft'},{min:12,max:15,m:0,t:0,l:'12-15 ft'},{min:16,max:20,m:0,t:0,l:'16-20 ft'},{min:21,max:30,m:0,t:0,l:'21-30 ft'},{min:31,max:40,m:0,t:0,l:'31-40 ft'},{min:41,max:50,m:0,t:0,l:'41-50 ft'},{min:51,max:999,m:0,t:0,l:'50+ ft'}];
  var longestMadeP=0, avgFirstPuttF=0, firstPuttCntF=0;
  
  // Get actual proximity: prefer next putt's distanceBefore over approach distanceAfter
  // (approach distanceAfter may be a stale smart default, but the putt distance is user-entered)
  function getProx(shots,idx,s){
    if(s.lie==='HOLED')return 0;
    var next=shots[idx+1];
    if(next&&next.isPutt&&next.distanceBefore>0)return next.distanceBefore;
    return s.distanceAfter||0;
  }
  S.allHoles.forEach(function(h){
    var shots=h.shots||[];
    shots.forEach(function(s,idx){
      var db=s.distanceBefore||0;
      var isPar45Tee=s.shotNum===1&&(h.par===4||h.par===5);
      var isAppAttempt=!s.isPutt&&db>100&&!isPar45Tee&&s.lie!=='PENALTY';
      if(isAppAttempt){appRangesF.forEach(function(r){if(db>=r.min&&db<=r.max){r.total++;if(s.lie==='GREEN'||s.lie==='HOLED')r.s.push(getProx(shots,idx,s));}});}
      if(!s.isPutt&&db>0&&db<=100&&s.lie==='GREEN'){shortRangesF.forEach(function(r){if(db>=r.min&&db<=r.max)r.s.push(getProx(shots,idx,s));});}
      if(s.lie&&s.lie.includes('BUNKER')&&shots[idx+1]&&shots[idx+1].lie==='GREEN'){bunkerProxF.push(getProx(shots,idx+1,shots[idx+1]));}
      if(s.isPutt&&db>0){puttRangesF.forEach(function(r){if(db>=r.min&&db<=r.max){r.t++;if(s.lie==='HOLED'||s.distanceAfter===0)r.m++;}});}
    });
    if(h.firstPuttDist>0){avgFirstPuttF+=h.firstPuttDist;firstPuttCntF++;}
    if((h.putts||0)===1&&h.firstPuttDist>0&&h.firstPuttDist>longestMadeP)longestMadeP=h.firstPuttDist;
    if(h.par===3&&shots.length>=1){par3AppD.push(h.yards);if(shots[0].lie==='GREEN')par3AppP.push(getProx(shots,0,shots[0]));}
    if(h.par===4&&shots.length>=2&&!shots[1].isPutt){par4AppD.push(shots[1].distanceBefore||0);if(shots[1].lie==='GREEN')par4AppP.push(getProx(shots,1,shots[1]));}
    if(h.par===5&&shots.length>=2&&!shots[1].isPutt){par5AppD.push(shots[1].distanceBefore||0);if(shots[1].lie==='GREEN')par5AppP.push(getProx(shots,1,shots[1]));}
  });
  avgFirstPuttF=firstPuttCntF>0?Math.round(avgFirstPuttF/firstPuttCntF):0;
  function davg(arr){return arr.length>0?Math.round(arr.reduce(function(a,b){return a+b;},0)/arr.length):0;}
  function pct(nn,dd){return dd>0?Math.round(nn/dd*100)+'%':'\u2013';}
  
  // SG totals (already calculated)
  var sgT=S.sgOTTTotal+S.sgAPPTotal+S.sgARGTotal+S.sgPuttingTotal;
  var twoPuttsF=S.totalHoles-S.onePuttMade-S.threePlusPutts;
  
  // ===== BUILD ALL TAB CONTENT =====
  var tabs = [];
  
  // TAB 0: SCORING
  var t0='';
  
  // SCORECARD - with yardages and totals
  t0+=hdr('SCORECARD');
  var front9=S.allHoles.slice(0,Math.min(9,S.allHoles.length));
  var back9h=S.allHoles.slice(9);
  
  // Calculate totals first for summary row at top
  var f9Par=0,f9Score=0,f9Putts=0,f9Yds=0;
  front9.forEach(function(h){f9Par+=h.par;f9Score+=h.score;f9Putts+=(h.putts||0);f9Yds+=h.yards;});
  var b9Par=0,b9Score=0,b9Putts=0,b9Yds=0;
  if(back9h.length>0){
    back9h.forEach(function(h){b9Par+=h.par;b9Score+=h.score;b9Putts+=(h.putts||0);b9Yds+=h.yards;});
  }
  
  // Totals row at TOP
  var totYds = f9Yds + b9Yds;
  var totPar2 = f9Par + b9Par;
  var totScore = f9Score + b9Score;
  var totPutts = f9Putts + b9Putts;
  var totDiff = totScore - totPar2;
  t0+='<div style="display:flex;justify-content:space-around;padding:6px 0;font-size:12px;font-weight:700;border-bottom:2px solid #3d3d3d;margin-bottom:6px;">';
  t0+='<span>'+totYds+' yds</span>';
  t0+='<span>Par '+totPar2+'</span>';
  t0+='<span style="color:#ffffff;">'+totScore+' ('+(totDiff>0?'+':'')+totDiff+')</span>';
  t0+='<span>'+totPutts+' putts</span>';
  t0+='</div>';
  
  function scColor(h){var diff=h.score-h.par;return diff<=-2?'#2d7abc':diff===-1?'#007a52':diff===0?'transparent':diff===1?'#d4706e':'#351a1a';}
  function scSpan(h){return'<span style="background:'+scColor(h)+';padding:1px 4px;border-radius:3px;">'+h.score+'</span>';}
  
  // Front 9
  var fHeaders=[''].concat(front9.map(function(h){return''+h.hole;})).concat(['Out']);
  var fYds=['Yds'].concat(front9.map(function(h){return''+h.yards;})).concat([''+f9Yds]);
  var fPar=['Par'].concat(front9.map(function(h){return''+h.par;})).concat([''+f9Par]);
  var fScr=['Scr'].concat(front9.map(function(h){return scSpan(h);})).concat(['<b>'+f9Score+'</b>']);
  var fPtt=['Ptt'].concat(front9.map(function(h){return''+(h.putts||0);})).concat([''+f9Putts]);
  t0+=tbl(fHeaders,[fYds,fPar,fScr,fPtt]);
  
  // Back 9
  if(back9h.length>0){
    var bHeaders=[''].concat(back9h.map(function(h){return''+h.hole;})).concat(['In']);
    var bYds=['Yds'].concat(back9h.map(function(h){return''+h.yards;})).concat([''+b9Yds]);
    var bPar=['Par'].concat(back9h.map(function(h){return''+h.par;})).concat([''+b9Par]);
    var bScr=['Scr'].concat(back9h.map(function(h){return scSpan(h);})).concat(['<b>'+b9Score+'</b>']);
    var bPtt=['Ptt'].concat(back9h.map(function(h){return''+(h.putts||0);})).concat([''+b9Putts]);
    t0+=tbl(bHeaders,[bYds,bPar,bScr,bPtt]);
  }
  
  t0+=hdr('AVERAGES');
  t0+=row('Avg Par 3',S.c3?(S.p3/S.c3).toFixed(2):'N/A');
  t0+=row('Avg Par 4',S.c4?(S.p4/S.c4).toFixed(2):'N/A');
  t0+=row('Avg Par 5',S.c5?(S.p5/S.c5).toFixed(2):'N/A');
  
  // Store scoring radar data for full stats
  S.fullStatsRadarData = {
    // Scoring
    birdieAvg: birdies,
    scoringAvg: S.totalStrokes,
    par5Avg: S.c5 ? S.p5/S.c5 : 5,
    par4Avg: S.c4 ? S.p4/S.c4 : 4,
    par3Avg: S.c3 ? S.p3/S.c3 : 3,
    // Driving
    sgOTT: S.sgOTTTotal,
    missRight: S.fwOpp > 0 ? Math.round(S.fwRight/S.fwOpp*100) : 0,
    accuracy: S.fwOpp > 0 ? Math.round(S.fwHit/S.fwOpp*100) : 0,
    avgDistance: avgDriveF,
    missLeft: S.fwOpp > 0 ? Math.round(S.fwLeft/S.fwOpp*100) : 0,
    // Approach
    girPct: S.totalHoles > 0 ? Math.round(S.gir/S.totalHoles*100) : 0,
    sgAPP: S.sgAPPTotal,
    proxOutside100: appRangesF.reduce(function(a,r){return a.concat(r.s);},[]).length > 0 ? davg(appRangesF.reduce(function(a,r){return a.concat(r.s);},[])) : 30,
    proxInside100: shortRangesF.reduce(function(a,r){return a.concat(r.s);},[]).length > 0 ? davg(shortRangesF.reduce(function(a,r){return a.concat(r.s);},[])) : 20,
    proximity: S.gir > 0 ? Math.round(S.girFirstPuttDist/S.gir) : 30,
    // ARG
    scrambling: S.scrOpp > 0 ? Math.round(S.scr/S.scrOpp*100) : 0,
    sgARG: S.sgARGTotal,
    scrFromRough: S.scrOpp > 0 ? Math.round(S.scr/S.scrOpp*100) : 0,
    sandSave: S.bunOpp > 0 ? Math.round(S.bun/S.bunOpp*100) : 0,
    scr30In: S.scrOpp > 0 ? Math.round(S.scr/S.scrOpp*100) : 0,
    // Putting
    puttsPerRound: S.totalPutts,
    make9ft: (puttRangesF[0].t + puttRangesF[1].t + puttRangesF[2].t) > 0 ? Math.round((puttRangesF[0].m + puttRangesF[1].m + puttRangesF[2].m) / (puttRangesF[0].t + puttRangesF[1].t + puttRangesF[2].t) * 100) : 70,
    sgPutt: S.sgPuttingTotal,
    avgMadeDist: longestMadeP > 0 ? Math.min(longestMadeP/2, 15) : 5,
    threePuttAvoid: S.totalHoles > 0 ? Math.round((1 - S.threePlusPutts/S.totalHoles) * 100) : 90,
    onePuttPct: S.totalHoles > 0 ? Math.round(S.onePuttMade/S.totalHoles*100) : 30
  };
  
  t0+=hdr('SCORE DISTRIBUTION');
  t0+=row('Eagles',''+eagles);t0+=row('Birdies',''+birdies);t0+=row('Pars',''+pars2);t0+=row('Bogeys',''+bogeys);t0+=row('Double+',''+dblPlus);
  tabs.push(t0);
  
  // TAB 1: STROKES GAINED
  var t1='';
  t1+='<div style="background:#222222; border-radius:12px; padding:10px; margin-bottom:12px; display:flex; justify-content:center; align-items:center;">'
    + '<canvas id="sgRadarChartFull" style="display:block; margin:0 auto;"></canvas>'
    + '</div>';
  t1+=hdr('SG SUMMARY vs '+hcpLabel);
  t1+=sgRow('SG: Total',sgT);
  t1+=sgRow('SG: Off The Tee',S.sgOTTTotal);
  t1+=sgRow('SG: Approach',S.sgAPPTotal);
  t1+=sgRow('SG: Around Green',S.sgARGTotal);
  t1+=sgRow('SG: Putting',S.sgPuttingTotal);
  t1+=hdr('SG BY HANDICAP');
  var hcpLevels=[{k:'pro',l:'Tour Pro'},{k:'0',l:'Scratch'},{k:'5',l:'5 HCP'},{k:'10',l:'10 HCP'},{k:'15',l:'15 HCP'},{k:'20',l:'20 HCP'},{k:'25',l:'25 HCP'},{k:'30',l:'30 HCP'}];
  var sgHcpRows=[];
  hcpLevels.forEach(function(h2){var sg2=calculateSGForHandicap(h2.k);sgHcpRows.push([h2.l,'<span style="color:'+sgC(sg2.total)+'">'+sgFmt(sg2.total)+'</span>','<span style="color:'+sgC(sg2.ott)+'">'+sgFmt(sg2.ott)+'</span>','<span style="color:'+sgC(sg2.app)+'">'+sgFmt(sg2.app)+'</span>','<span style="color:'+sgC(sg2.arg)+'">'+sgFmt(sg2.arg)+'</span>','<span style="color:'+sgC(sg2.putt)+'">'+sgFmt(sg2.putt)+'</span>']);});
  t1+=tbl(['HCP','Tot','OTT','APP','ARG','Putt'],sgHcpRows);
  t1+=hdr('SG BY HOLE');
  var sgHoleRows=[];S.allHoles.forEach(function(h3){var ht=((h3.sgOTT||0)+(h3.sgAPP||0)+(h3.sgARG||0)+(h3.sgPutting||0));sgHoleRows.push([''+h3.hole,'Par '+h3.par,'<span style="color:'+sgC(ht)+'">'+sgFmt(ht)+'</span>','<span style="color:'+sgC(h3.sgOTT||0)+'">'+sgFmt(h3.sgOTT||0)+'</span>','<span style="color:'+sgC(h3.sgAPP||0)+'">'+sgFmt(h3.sgAPP||0)+'</span>','<span style="color:'+sgC(h3.sgARG||0)+'">'+sgFmt(h3.sgARG||0)+'</span>','<span style="color:'+sgC(h3.sgPutting||0)+'">'+sgFmt(h3.sgPutting||0)+'</span>']);});
  t1+=tbl(['#','Par','Tot','OTT','APP','ARG','Putt'],sgHoleRows);
  tabs.push(t1);
  
  // TAB 2: OFF THE TEE
  var t2='';
  t2+='<div style="background:#222222; border-radius:12px; padding:10px; margin-bottom:12px; display:flex; justify-content:center; align-items:center;">'
    + '<canvas id="drivingRadarFull" style="display:block; margin:0 auto;"></canvas>'
    + '</div>';
  t2+=hdr('SG: OFF THE TEE vs '+hcpLabel);
  t2+=sgRow('SG: Off The Tee',S.sgOTTTotal);
  t2+=hdr('FAIRWAY ACCURACY');
  t2+=row('Fairways Hit',S.fwHit+'/'+S.fwOpp,S.fwOpp?Math.round(S.fwHit/S.fwOpp*100)+'%':'0%');
  t2+=row('Missed Left',''+S.fwLeft,S.fwOpp?Math.round(S.fwLeft/S.fwOpp*100)+'%':'');
  t2+=row('Missed Right',''+S.fwRight,S.fwOpp?Math.round(S.fwRight/S.fwOpp*100)+'%':'');
  t2+=hdr('DRIVING DISTANCE');
  t2+=row('Average',avgDriveF+' yds',driveDetails.length+' drives');
  t2+=row('Longest',longestDr+' yds');
  t2+=row('Shortest',shortestDr+' yds');
  t2+=hdr('DRIVE BY HOLE');
  var drRows=[];driveDetails.forEach(function(dd2){drRows.push(['Hole '+dd2.hole,'Par '+dd2.par,dd2.dist+' yds']);});
  t2+=tbl(['Hole','Par','Distance'],drRows);
  t2+=hdr('PENALTIES');
  t2+=row('Par 3 Tee Penalties',''+par3TeePen);
  t2+=row('Par 4/5 Tee Penalties',''+par45TeePen);
  tabs.push(t2);
  
  // TAB 3: APPROACH
  var t3='';
  t3+='<div style="background:#222222; border-radius:12px; padding:10px; margin-bottom:12px; display:flex; justify-content:center; align-items:center;">'
    + '<canvas id="approachRadarFull" style="display:block; margin:0 auto;"></canvas>'
    + '</div>';
  t3+=hdr('SG: APPROACH vs '+hcpLabel);
  t3+=sgRow('SG: Approach',S.sgAPPTotal);
  t3+=hdr('GREENS IN REGULATION');
  t3+=row('GIR',S.gir+'/'+S.totalHoles,S.totalHoles?Math.round(S.gir/S.totalHoles*100)+'%':'0%');
  t3+=row('Proximity when GIR',S.gir?Math.round(S.girFirstPuttDist/S.gir)+' ft':'N/A');
  t3+=hdr('MISSED GREENS');
  t3+=row('Short',''+S.missShort);t3+=row('Long',''+S.missLong);t3+=row('Left',''+S.missLeft);t3+=row('Right',''+S.missRight);
  t3+=hdr('APPROACH BY DISTANCE');
  var apR=[];appRangesF.forEach(function(r){if(r.total>0)apR.push([r.l+' yds',r.total+' shots',r.s.length>0?davg(r.s)+' ft':'\u2013']);});
  t3+=tbl(['Distance','Shots','Avg Prox'],apR);
  t3+=hdr('APPROACH BY PAR');
  t3+=row('Par 3 Avg Distance',davg(par3AppD)+' yds',par3AppD.length+' shots');
  t3+=row('Par 3 Avg Proximity',par3AppP.length>0?davg(par3AppP)+' ft':'N/A');
  t3+=row('Par 4 Avg Distance',davg(par4AppD)+' yds',par4AppD.length+' shots');
  t3+=row('Par 4 Avg Proximity',par4AppP.length>0?davg(par4AppP)+' ft':'N/A');
  t3+=row('Par 5 Avg Distance',davg(par5AppD)+' yds',par5AppD.length+' shots');
  t3+=row('Par 5 Avg Proximity',par5AppP.length>0?davg(par5AppP)+' ft':'N/A');
  t3+=hdr('PENALTIES');
  t3+=row('Approach Penalties',''+appPenF);
  tabs.push(t3);
  
  // TAB 4: SHORT GAME
  var t4='';
  t4+='<div style="background:#222222; border-radius:12px; padding:10px; margin-bottom:12px; display:flex; justify-content:center; align-items:center;">'
    + '<canvas id="argRadarFull" style="display:block; margin:0 auto;"></canvas>'
    + '</div>';
  t4+=hdr('SG: AROUND THE GREEN vs '+hcpLabel);
  t4+=sgRow('SG: Around Green',S.sgARGTotal);
  t4+=hdr('SCRAMBLING');
  t4+=row('Scrambling',S.scr+'/'+S.scrOpp,S.scrOpp?Math.round(S.scr/S.scrOpp*100)+'%':'0%');
  t4+=row('Bunker Saves',S.bun+'/'+S.bunOpp,S.bunOpp?Math.round(S.bun/S.bunOpp*100)+'%':'0%');
  t4+=row('Avg Bunker Proximity',bunkerProxF.length>0?davg(bunkerProxF)+' ft':'N/A',bunkerProxF.length+' shots');
  t4+=hdr('SHORT GAME BY DISTANCE');
  var sgR2=[];shortRangesF.forEach(function(r){if(r.s.length>0)sgR2.push([r.l+' yds',r.s.length+' shots',davg(r.s)+' ft']);});
  t4+=tbl(['Distance','Shots','Avg Prox'],sgR2);
  t4+=hdr('PENALTIES');
  t4+=row('Short Game Penalties',''+sgPenF);
  tabs.push(t4);
  
  // TAB 5: PUTTING
  var t5='';
  t5+='<div style="background:#222222; border-radius:12px; padding:10px; margin-bottom:12px; display:flex; justify-content:center; align-items:center;">'
    + '<canvas id="puttingRadarFull" style="display:block; margin:0 auto;"></canvas>'
    + '</div>';
  t5+=hdr('SG: PUTTING vs '+hcpLabel);
  t5+=sgRow('SG: Putting',S.sgPuttingTotal);
  t5+=hdr('PUTTING SUMMARY');
  t5+=row('Total Putts',''+S.totalPutts,(S.totalPutts/S.totalHoles).toFixed(1)+'/hole');
  t5+=row('Putts per GIR',S.gir?(S.girPutts/S.gir).toFixed(1):'N/A');
  t5+=row('Avg First Putt Dist',avgFirstPuttF+' ft');
  t5+=hdr('PERFORMANCE');
  t5+=row('One-Putts',''+S.onePuttMade,pct(S.onePuttMade,S.totalHoles));
  t5+=row('Two-Putts',''+twoPuttsF,pct(twoPuttsF,S.totalHoles));
  t5+=row('Three-Putts',''+S.threePlusPutts,pct(S.threePlusPutts,S.totalHoles));
  t5+=row('Longest Made',''+longestMadeP+' ft');
  t5+=hdr('MAKE % BY DISTANCE');
  var pR=[];puttRangesF.forEach(function(r){pR.push([r.l,r.t>0?r.m+'/'+r.t:'0/0',r.t>0?Math.round(r.m/r.t*100)+'%':'\u2013']);});
  t5+=tbl(['Distance','Made/Total','Make %'],pR);
  t5+=hdr('HOLE BY HOLE');
  var phRows=[];S.allHoles.forEach(function(h4){if(h4.firstPuttDist){var expPutts=getExpectedPutts(h4.firstPuttDist,hcp);phRows.push([''+h4.hole,h4.firstPuttDist+' ft',''+(h4.putts||0),expPutts.toFixed(2),'<span style="color:'+sgC(h4.sgPutting||0)+'">'+sgFmt(h4.sgPutting||0)+'</span>']);}});
  t5+=tbl(['#','1st Putt','Putts','Exp','SG'],phRows);
  tabs.push(t5);
  
  // TAB 6: PLAY BY PLAY
  var t6='';
  S.allHoles.forEach(function(h5, holeIdx){
    var diff=h5.score-h5.par;
    var scoreLabel=diff<=-2?'Eagle':diff===-1?'Birdie':diff===0?'Par':diff===1?'Bogey':diff===2?'Double':'+'+diff;
    var scoreBg=diff<=-2?'#2d7abc':diff===-1?'#007a52':diff===0?'#333333':diff===1?'#d4706e':'#351a1a';
    t6+='<div style="background:#222222;padding:6px 10px;border-bottom:1px solid #333333;margin-bottom:2px;">';
    t6+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">';
    t6+='<span style="font-weight:700;font-size:13px;">Hole '+h5.hole+' \u00b7 Par '+h5.par+' \u00b7 '+h5.yards+' yds</span>';
    t6+='<div style="display:flex;align-items:center;gap:6px;">';
    t6+='<span style="font-size:12px;font-weight:700;background:'+scoreBg+';padding:2px 8px;border-radius:4px;">'+h5.score+' ('+scoreLabel+')</span>';
    t6+='<button onclick="editHole('+holeIdx+')" style="width:50px;height:24px;font-size:11px;background:#2d7abc;border:none;border-radius:4px;color:#ffffff;cursor:pointer;">Edit</button>';
    t6+='</div></div>';
    (h5.shots||[]).forEach(function(s,idx){
      var nextShot=(h5.shots||[])[idx+1];
      
      // Special handling for PENALTY shots
      if(s.lie==='PENALTY'){
        t6+='<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:12px;color:#9a9a9a;">';
        t6+='<span style="flex:1;">Shot '+s.shotNum+' - Penalty stroke</span>';
        t6+='<span style="width:50px;text-align:right;font-weight:700;color:#606060;">+0.00</span>';
        t6+='</div>';
        return;
      }
      
      // Determine if this is actually a putt - must have isPutt=true
      // A shot that lands ON green (lie=GREEN) but isPutt=false is a chip/approach, not a putt
      var isActualPutt = (s.isPutt === true);
      // If lie is PUTT it's definitely a putt
      if(s.lie === 'PUTT') isActualPutt = true;
      
      var endLie=s.lie||'Unknown';
      if(endLie==='HOLED')endLie='in the hole';
      else if(endLie==='WATER')endLie='water';
      else if(endLie==='OB')endLie='out of bounds';
      else if(endLie==='LEFT ROUGH'||endLie==='RIGHT ROUGH')endLie=endLie.toLowerCase();
      else if(endLie==='GS BUNKER'||endLie==='FW BUNKER')endLie=endLie.toLowerCase().replace('gs ','greenside ').replace('fw ','fairway ');
      else if(endLie==='MISS LEFT')endLie='left of green';
      else if(endLie==='MISS RIGHT')endLie='right of green';
      else if(endLie==='MISS SHORT')endLie='short of green';
      else if(endLie==='MISS LONG')endLie='long of green';
      else if(endLie==='PUTT')endLie='on green';
      else endLie=endLie.toLowerCase();
      
      var shotDist='';
      // Check if this is a re-hit after penalty (previous shot was PENALTY and distanceBefore equals hole yards)
      var prevShot=idx>0?(h5.shots||[])[idx-1]:null;
      var isRehit=prevShot&&prevShot.lie==='PENALTY'&&s.distanceBefore===h5.yards;
      
      // Determine distance display - putts use feet, everything else uses yards
      if(isActualPutt){
        if(s.distanceBefore!=null)shotDist=s.distanceBefore+' ft';
      }else if((s.shotNum===1||isRehit)&&(h5.par===4||h5.par===5)){
        if(s.lie==='WATER'||s.lie==='OB'||s.lie==='RECOVERY'){
          var nxR=null;for(var ni=idx+1;ni<(h5.shots||[]).length;ni++){var ns=(h5.shots||[])[ni];if(ns.lie!=='PENALTY'&&ns.lie!=='WATER'&&ns.lie!=='OB'&&ns.lie!=='RECOVERY'){nxR=ns;break;}}
          if(nxR&&nxR.distanceAfter!=null)shotDist=(h5.yards-nxR.distanceAfter)+' yds';
          else shotDist=h5.yards+' yds';
        }else if(s.distanceAfter!=null){shotDist=(h5.yards-s.distanceAfter)+' yds';}
        else{shotDist=h5.yards+' yds';}
      }
      else if(s.shotNum===1){shotDist=h5.yards+' yds';}
      else if(s.distanceBefore!=null){shotDist=s.distanceBefore+' yds';}
      
      var desc='';
      if(s.lie==='HOLED'){
        desc='Shot '+s.shotNum+' - '+shotDist+(isActualPutt?' putt':'')+', in the hole';
      }else{
        var rem='';
        if(s.lie==='WATER'||s.lie==='OB'||s.lie==='RECOVERY'){
          var nxR2=null;for(var ni2=idx+1;ni2<(h5.shots||[]).length;ni2++){var ns2=(h5.shots||[])[ni2];if(ns2.lie!=='PENALTY'&&ns2.lie!=='WATER'&&ns2.lie!=='OB'&&ns2.lie!=='RECOVERY'){nxR2=ns2;break;}}
          if(nxR2&&nxR2.distanceAfter!=null)rem=nxR2.distanceAfter+' yds';
        }else if(s.lie==='GREEN'&&!isActualPutt&&nextShot&&(nextShot.isPutt||nextShot.lie==='PUTT'||nextShot.lie==='HOLED')){
          // Non-putt shot landed ON green and next shot is a putt - show remaining distance in feet
          rem=nextShot.distanceBefore!=null?nextShot.distanceBefore+' ft':'';
        }else if(isActualPutt&&s.distanceAfter!=null){
          // Putt that didn't go in - show remaining in feet
          rem=s.distanceAfter+' ft';
        }else if(s.distanceAfter!=null){
          // Non-putt shot - show remaining in yards
          rem=s.distanceAfter+' yds';
        }else if(nextShot){
          // Use next shot's distanceBefore
          if(nextShot.isPutt===true||nextShot.lie==='PUTT'||nextShot.lie==='HOLED'){
            rem=nextShot.distanceBefore!=null?nextShot.distanceBefore+' ft':'';
          }else{
            rem=nextShot.distanceBefore!=null?nextShot.distanceBefore+' yds':'';
          }
        }
        
        if(isActualPutt){
          desc='Shot '+s.shotNum+' - '+shotDist+' putt to '+rem+' from hole';
        }else{
          desc='Shot '+s.shotNum+' - '+shotDist+' to '+endLie+', '+rem+' to hole';
        }
      }
      var sgVal=s.sg||0;
      t6+='<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;font-size:12px;color:#9a9a9a;">';
      t6+='<span style="flex:1;">'+desc+'</span>';
      t6+='<span style="width:50px;text-align:right;font-weight:700;color:'+sgC(sgVal)+';">'+sgFmt(sgVal)+'</span>';
      t6+='</div>';
    });
    t6+='</div>';
  });
  tabs.push(t6);
  
  // Store tabs and show first
  S.fullStatTabs = tabs;
  document.getElementById('fullStatsContent').innerHTML = '<div id="fstContent">'+tabs[0]+'</div>';
  show('fullStatsPage');
}


export function showFullStatTab(idx) {
  if (!S.fullStatTabs) return;
  document.getElementById('fstContent').innerHTML = S.fullStatTabs[idx];
  var sel = document.getElementById('fstSelect');
  if (sel) sel.value = idx;
  
  setTimeout(function() {
    if (idx === 1) {
      var canvas = document.getElementById('sgRadarChartFull');
      if (canvas) renderSGRadarChartFull(canvas);
    } else if (idx === 2 && S.fullStatsRadarData) {
      renderFullStatsDrivingRadar();
    } else if (idx === 3 && S.fullStatsRadarData) {
      renderFullStatsApproachRadar();
    } else if (idx === 4 && S.fullStatsRadarData) {
      renderFullStatsARGRadar();
    } else if (idx === 5 && S.fullStatsRadarData) {
      renderFullStatsPuttingRadar();
    }
  }, 50);
}

function changeFullStatsHandicap(newHcp) {
  // Update the summary handicap select to match
  document.getElementById('summaryHandicapSelect').value = newHcp;
  // Also sync the start-page dropdown
  document.getElementById('playerHandicap').value = newHcp;
  // Recalculate stats with new handicap
  recalculateAllSG(newHcp);
  // Get current tab
  var currentTab = 0;
  var sel = document.getElementById('fstSelect');
  if (sel) currentTab = parseInt(sel.value) || 0;
  // Refresh full stats keeping current tab
  refreshFullStats(currentTab);
}

// Functions called from inline HTML handlers
expose({ showFullStats, showFullStatTab, changeFullStatsHandicap });
