import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { _viewingAsStudent, activeUserId } from '../core/session.js';
import { _sb } from '../core/supabase.js';
import { getExpectedPutts, getExpectedStrokes } from '../sg/calc.js';
import { hcpLabels } from '../sg/tables.js';
import { calcHandicapIndex } from './handicap-index.js';
import { renderARGRadar, renderApproachRadar, renderDrivingRadar, renderPuttingRadar, renderSGRadarDash, renderScoringRadar } from './radar.js';

var _dashData = null; // cached round data for SG recalculation
var _dashAllData = null; // all rounds before filtering

export async function loadDashboard() {
  var loading = document.getElementById('dashLoading');
  var content = document.getElementById('dashContent');
  loading.style.display = 'block';
  content.style.display = 'none';
  
  var resp = await _sb
    .from('rounds')
    .select('*')
    .eq('user_id', activeUserId())
    .order('round_date', { ascending: false });
  
  var data = resp.data;
  var error = resp.error;
  loading.style.display = 'none';
  content.style.display = 'block';
  
  if (error || !data || data.length === 0) {
    content.innerHTML = '<div style="text-align:center;color:#606060;padding:20px;">No rounds saved yet.</div>';
    return;
  }
  
  _dashAllData = data;
  applyDashFilters();
}

async function onDashHcpChange(hcp) {
  applyDashFilters();
  // Save to user's profile
  if (S.currentUser) {
    await _sb.from('profiles').update({ hcp_preference: hcp }).eq('id', activeUserId());
    if (!_viewingAsStudent) {
      await _sb.auth.updateUser({ data: { hcp_preference: hcp } });
      S.currentUser.user_metadata.hcp_preference = hcp;
    }
    document.getElementById('playerHandicap').value = hcp;
    // Sync the settings dropdown if it exists
    var settingsHcp = document.getElementById('settingsHcpSelect');
    if (settingsHcp) settingsHcp.value = hcp;
  }
}

function applyDashFilters() {
  if (!_dashAllData) return;
  var typeFilter = document.getElementById('dashFilterType').value;
  var timeFilter = document.getElementById('dashFilterTime').value;
  
  var filtered = _dashAllData.filter(function(r) {
    // Type filter
    if (typeFilter !== 'all' && r.round_type !== typeFilter) return false;
    // Time filter
    if (timeFilter !== 'all') {
      var months = parseInt(timeFilter);
      var cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);
      var roundDate = new Date(r.round_date + 'T12:00:00');
      if (roundDate < cutoff) return false;
    }
    return true;
  });
  
  var content = document.getElementById('dashContent');
  if (filtered.length === 0) {
    content.innerHTML = '<div style="text-align:center;color:#606060;padding:20px;">No rounds match these filters.</div>';
    return;
  }
  
  _dashData = filtered;
  S.activeDashTarget = 'dashContent';
  var hcpSel = document.getElementById('dashHcpFilter');
  var savedHcp = document.getElementById('playerHandicap').value || 'pro';
  var hcp = hcpSel ? hcpSel.value : savedHcp;
  renderDashboard(filtered, hcp);
}

function recalcDashSG(hcpVal) {
  if (S.activeDashTarget === 'svDashContent' && S.svDashData) {
    renderDashboard(S.svDashData, hcpVal, 'svDashContent');
  } else if (_dashData) {
    renderDashboard(_dashData, hcpVal);
  }
  // Keep the filter dropdown in sync
  var dashHcpF = document.getElementById('dashHcpFilter');
  if (dashHcpF && dashHcpF.value !== hcpVal) dashHcpF.value = hcpVal;
  var svHcpF = document.getElementById('svDashHcpFilter');
  if (svHcpF && svHcpF.value !== hcpVal) svHcpF.value = hcpVal;
}

export function renderDashboard(data, hcp, targetId) {
  var content = document.getElementById(targetId || 'dashContent');
  
  // ===== AGGREGATE ALL DATA =====
  var A = { n: data.length, holes: 0, totScore: 0, totPar: 0, totPutts: 0,
    fwHit:0, fwOpp:0, fwLeft:0, fwRight:0,
    girHit:0, girFirstPuttDist:0, girPutts:0,
    scrMade:0, scrOpp:0, bunMade:0, bunOpp:0,
    onePutt:0, threePutt:0,
    p3:0, c3:0, p4:0, c4:0, p5:0, c5:0,
    eagles:0, birdies:0, pars:0, bogeys:0, dblPlus:0,
    r18s:[], r18tp:[], r9s:[], r9tp:[],
    drives:[], longestDrive:0, shortestDrive:999,
    par3TeePen:0, par45TeePen:0, appPen:0, sgPen:0,
    missShort:0, missLong:0, missLeft:0, missRight:0,
    allPuttRanges: [{min:0,max:3,m:0,t:0,l:'0-3 ft'},{min:4,max:7,m:0,t:0,l:'4-7 ft'},{min:8,max:11,m:0,t:0,l:'8-11 ft'},{min:12,max:15,m:0,t:0,l:'12-15 ft'},{min:16,max:20,m:0,t:0,l:'16-20 ft'},{min:21,max:30,m:0,t:0,l:'21-30 ft'},{min:31,max:40,m:0,t:0,l:'31-40 ft'},{min:41,max:50,m:0,t:0,l:'41-50 ft'},{min:51,max:999,m:0,t:0,l:'50+ ft'}],
    appRanges: [{min:101,max:125,s:[],total:0,l:'101-125'},{min:126,max:150,s:[],total:0,l:'126-150'},{min:151,max:175,s:[],total:0,l:'151-175'},{min:176,max:200,s:[],total:0,l:'176-200'},{min:201,max:225,s:[],total:0,l:'201-225'},{min:226,max:250,s:[],total:0,l:'226-250'},{min:251,max:275,s:[],total:0,l:'251-275'},{min:276,max:999,s:[],total:0,l:'276+'}],
    shortRanges: [{min:0,max:25,s:[],l:'0-25'},{min:26,max:50,s:[],l:'26-50'},{min:51,max:75,s:[],l:'51-75'},{min:76,max:100,s:[],l:'76-100'}],
    par3AppDist:[], par4AppDist:[], par5AppDist:[],
    par3AppProx:[], par4AppProx:[], par5AppProx:[],
    bunkerProx:[], firstPuttDists:[], longestMadePutt:0,
    bestRound: null, bestToPar: 999,
    sgOTT:0, sgAPP:0, sgARG:0, sgPutt:0,
    roundSGs: [], playByPlay: []
  };
  
  data.forEach(function(r) {
    var rd = r.round_data || {};
    var holes = rd.allHoles || [];
    var st = rd.stats || {};
    var isSimple = rd.entryMode === 'simple';
    // Simple rounds from a scorecard photo carry fairway / green / putt counts but no shots
    var hasStats = !isSimple || rd.basicStats === true;
    A.holes += holes.length;
    A.totScore += r.score; A.totPar += r.par;
    if (r.to_par < A.bestToPar) { A.bestToPar = r.to_par; A.bestRound = r; }
    if (holes.length >= 14) { A.r18s.push(r.score); A.r18tp.push(r.to_par); }
    else { A.r9s.push(r.score); A.r9tp.push(r.to_par); }

    // Score-only rounds: only count scoring, skip fairway / green / putt stats
    if (hasStats) {
      A.fwHit += st.fwHit||0; A.fwOpp += st.fwOpp||0; A.fwLeft += st.fwLeft||0; A.fwRight += st.fwRight||0;
      A.girHit += st.girHit||0;
      A.scrMade += st.scrMade||0; A.scrOpp += st.scrOpp||0;
      A.bunMade += st.bunMade||0; A.bunOpp += st.bunOpp||0;
      A.onePutt += st.onePutts||0; A.threePutt += st.threePutts||0;
    }

    var rOTT=0, rAPP=0, rARG=0, rPutt=0;
    var roundPBP = [];

    holes.forEach(function(h) {
      if (hasStats) A.totPutts += h.putts||0;
      var diff = h.score - h.par;
      if (diff <= -2) A.eagles++; else if (diff === -1) A.birdies++; else if (diff === 0) A.pars++; else if (diff === 1) A.bogeys++; else A.dblPlus++;
      if (h.par===3) { A.c3++; A.p3+=h.score; } if (h.par===4) { A.c4++; A.p4+=h.score; } if (h.par===5) { A.c5++; A.p5+=h.score; }

      // Simple rounds have no shot data — skip shot-level analysis
      if (isSimple) return;

      // Check if this was a GIR (hit green in par - 2 shots)
      var shotsToGreen = 0;
      for (var sti = 0; sti < (h.shots || []).length; sti++) {
        if (h.shots[sti].isPutt) break;
        shotsToGreen++;
      }
      var wasGIR = shotsToGreen <= (h.par - 2);
      
      if (wasGIR && h.firstPuttDist > 0) { A.firstPuttDists.push(h.firstPuttDist); A.girFirstPuttDist += h.firstPuttDist; A.girPutts += h.putts||0; }
      if ((h.putts||0) === 1 && h.firstPuttDist > 0) { if (h.firstPuttDist > A.longestMadePutt) A.longestMadePutt = h.firstPuttDist; }
      
      // Recalculate SG for this handicap
      var hOTT=0, hAPP=0, hARG=0, hPutt=0;
      var shots = h.shots||[];
      var holePBP = { hole: h.hole, par: h.par, yards: h.yards, score: h.score, shots: [] };
      
      shots.forEach(function(s, idx) {
        var sgVal = 0;
        if (s.lie && s.lie !== 'PENALTY') {
          var db = s.distanceBefore||0;
          var da = s.distanceAfter||0;
          var isTeePar45 = s.shotNum===1 && (h.par===4||h.par===5);
          var isTeePar3 = s.shotNum===1 && h.par===3;
          var isShort = !s.isPutt && db <= 50 && !isTeePar45;
          
          if (s.isPutt) {
            var eb = getExpectedPutts(db, hcp);
            var ea = 0;
            if (s.lie !== 'HOLED' && s.distanceAfter) ea = getExpectedPutts(s.distanceAfter, hcp);
            sgVal = eb - ea - 1;
            hPutt += sgVal;
          } else if (s.lie === 'HOLED') {
            if (isTeePar45) { sgVal = getExpectedStrokes(h.yards, 'TEE', hcp) - 1; hOTT += sgVal; }
            else if (isTeePar3) { sgVal = getExpectedStrokes(h.yards, 'TEE', hcp) - 1; hAPP += sgVal; }
            else if (isShort) { var prev = shots[idx-1]; sgVal = getExpectedStrokes(db, prev?prev.lie:'FAIRWAY', hcp) - 1; hARG += sgVal; }
            else { var prev2 = shots[idx-1]; sgVal = getExpectedStrokes(db, prev2?prev2.lie:'FAIRWAY', hcp) - 1; hAPP += sgVal; }
          } else if (isTeePar45) {
            var ebS = getExpectedStrokes(h.yards, 'TEE', hcp);
            var eaS = s.lie==='GREEN' ? getExpectedPutts(da, hcp) : (da>0 ? getExpectedStrokes(da, s.lie, hcp) : 2.5);
            sgVal = ebS - eaS - 1; hOTT += sgVal;
          } else if (isTeePar3) {
            var ebS2 = getExpectedStrokes(h.yards, 'TEE', hcp);
            var eaS2 = s.lie==='GREEN' ? getExpectedPutts(da, hcp) : (da>0 ? getExpectedStrokes(da, s.lie, hcp) : 2.5);
            sgVal = ebS2 - eaS2 - 1; hAPP += sgVal;
          } else if (isShort) {
            var prev3 = shots[idx-1]; var pLie = prev3?prev3.lie:'FAIRWAY';
            var ebS3 = getExpectedStrokes(db, pLie, hcp);
            var eaS3 = s.lie==='GREEN' ? getExpectedPutts(da, hcp) : (da>0 ? getExpectedStrokes(da, s.lie, hcp) : 2.5);
            sgVal = ebS3 - eaS3 - 1; hARG += sgVal;
          } else {
            var prev4 = shots[idx-1]; var pLie2 = prev4?prev4.lie:'FAIRWAY';
            var ebS4 = getExpectedStrokes(db, pLie2, hcp);
            var eaS4 = s.lie==='GREEN' ? getExpectedPutts(da, hcp) : (da>0 ? getExpectedStrokes(da, s.lie, hcp) : 2.5);
            sgVal = ebS4 - eaS4 - 1; hAPP += sgVal;
          }
        }
        
        // Build play-by-play description
        var nextShot = shots[idx+1];
        
        // Special handling for PENALTY shots
        if (s.lie==='PENALTY') {
          holePBP.shots.push({ desc: 'Shot '+s.shotNum+' - Penalty stroke', sg: 0 });
          return;
        }
        
        var endLie = s.lie||'Unknown';
        if (endLie==='HOLED') endLie='in the hole';
        else if (endLie==='WATER') endLie='water';
        else if (endLie==='OB') endLie='out of bounds';
        else if (endLie==='LEFT ROUGH'||endLie==='RIGHT ROUGH') endLie=endLie.toLowerCase();
        else if (endLie==='GS BUNKER'||endLie==='FW BUNKER') endLie=endLie.toLowerCase().replace('gs ','greenside ').replace('fw ','fairway ');
        else if (endLie==='MISS LEFT') endLie='left of green';
        else if (endLie==='MISS RIGHT') endLie='right of green';
        else if (endLie==='MISS SHORT') endLie='short of green';
        else if (endLie==='MISS LONG') endLie='long of green';
        else endLie=endLie.toLowerCase();
        
        var shotDist = '';
        if (s.isPutt) { if (s.distanceBefore!=null) shotDist=s.distanceBefore+' ft'; }
        else if (s.shotNum===1&&(h.par===4||h.par===5)) {
          // For water/OB tee shots, calc drive from next real shot's distance
          if (s.lie==='WATER'||s.lie==='OB') {
            var nextReal=null; for(var ni=idx+1;ni<shots.length;ni++){if(shots[ni].lie!=='PENALTY'){nextReal=shots[ni];break;}}
            if(nextReal&&nextReal.distanceBefore!=null) shotDist=(h.yards-nextReal.distanceBefore)+' yds';
            else shotDist=h.yards+' yds';
          } else if (s.distanceAfter!=null) { shotDist=(h.yards-s.distanceAfter)+' yds'; }
          else { shotDist=h.yards+' yds'; }
        }
        else if (s.shotNum===1) { shotDist=h.yards+' yds'; }
        else if (s.distanceBefore!=null) { shotDist=s.distanceBefore+' yds'; }
        
        var desc = '';
        if (s.lie==='HOLED') {
          desc = 'Shot '+s.shotNum+' - '+shotDist+(s.isPutt?' putt':'')+', in the hole';
        } else {
          var rem = '';
          // For water/OB, show remaining distance from next real shot
          if (s.lie==='WATER'||s.lie==='OB') {
            var nextReal2=null; for(var ni2=idx+1;ni2<shots.length;ni2++){if(shots[ni2].lie!=='PENALTY'){nextReal2=shots[ni2];break;}}
            if(nextReal2&&nextReal2.distanceBefore!=null) rem=nextReal2.distanceBefore+' yds';
          } else if (s.distanceAfter!=null) {
            if ((nextShot&&nextShot.isPutt)||s.isPutt) rem=s.distanceAfter+' ft';
            else rem=s.distanceAfter+' yds';
          } else if (nextShot) {
            if (nextShot.isPutt) rem=nextShot.distanceBefore!=null?nextShot.distanceBefore+' ft':'';
            else rem=nextShot.distanceBefore!=null?nextShot.distanceBefore+' yds':'';
          }
          if (s.isPutt) desc='Shot '+s.shotNum+' - '+shotDist+' putt to '+rem+' from hole';
          else desc='Shot '+s.shotNum+' - '+shotDist+' to '+endLie+', '+rem+' to hole';
        }
        
        holePBP.shots.push({ desc: desc, sg: sgVal });
        
        // Non-SG aggregations
        if ((h.par===4||h.par===5)&&s.shotNum===1&&s.distanceAfter!=null&&s.lie!=='PENALTY'&&s.lie!=='OB'&&s.lie!=='WATER'&&s.lie!=='RECOVERY') {
          var dd=h.yards-s.distanceAfter; A.drives.push(dd);
          if (dd>A.longestDrive) A.longestDrive=dd; if (dd<A.shortestDrive) A.shortestDrive=dd;
        }
        if (s.lie==='PENALTY') { var prev5=shots[idx-1]; if(prev5){ if(prev5.shotNum===1){if(h.par===3)A.par3TeePen++;else A.par45TeePen++;}else if(prev5.distanceBefore>100)A.appPen++;else A.sgPen++;} }
        var _db=s.distanceBefore||0;var _isPar45Tee=s.shotNum===1&&(h.par===4||h.par===5);var _isAppAttempt=!s.isPutt&&_db>100&&!_isPar45Tee&&s.lie!=='PENALTY';
        function _gp(sh,i,st){if(st.lie==='HOLED')return 0;var nx=sh[i+1];if(nx&&nx.isPutt&&nx.distanceBefore>0)return nx.distanceBefore;return st.distanceAfter||0;}
        if(_isAppAttempt){A.appRanges.forEach(function(rr){if(_db>=rr.min&&_db<=rr.max){rr.total++;if(s.lie==='GREEN'||s.lie==='HOLED')rr.s.push(_gp(shots,idx,s));}});}
        if (!s.isPutt&&(s.distanceBefore||0)>0&&(s.distanceBefore||0)<=100&&s.lie==='GREEN') { A.shortRanges.forEach(function(rr){if((s.distanceBefore||0)>=rr.min&&(s.distanceBefore||0)<=rr.max)rr.s.push(_gp(shots,idx,s));}); }
        if (s.lie&&s.lie.includes('BUNKER')&&shots[idx+1]&&shots[idx+1].lie==='GREEN') { A.bunkerProx.push(_gp(shots,idx+1,shots[idx+1])); }
        if (s.isPutt&&(s.distanceBefore||0)>0) { A.allPuttRanges.forEach(function(rr){if((s.distanceBefore||0)>=rr.min&&(s.distanceBefore||0)<=rr.max){rr.t++;if(s.lie==='HOLED'||s.distanceAfter===0)rr.m++;}}); }
        if (!s.isPutt&&s.shotNum>0) { if(s.lie==='MISS SHORT')A.missShort++;if(s.lie==='MISS LONG')A.missLong++;if(s.lie==='MISS LEFT')A.missLeft++;if(s.lie==='MISS RIGHT')A.missRight++; }
      });
      
      rOTT+=hOTT; rAPP+=hAPP; rARG+=hARG; rPutt+=hPutt;
      
      function _gp2(sh,i,st){if(st.lie==='HOLED')return 0;var nx=sh[i+1];if(nx&&nx.isPutt&&nx.distanceBefore>0)return nx.distanceBefore;return st.distanceAfter||0;}
      if (h.par===3&&shots.length>=1) { A.par3AppDist.push(h.yards); if(shots[0].lie==='GREEN')A.par3AppProx.push(_gp2(shots,0,shots[0])); }
      if (h.par===4&&shots.length>=2&&!shots[1].isPutt) { A.par4AppDist.push(shots[1].distanceBefore||0); if(shots[1].lie==='GREEN')A.par4AppProx.push(_gp2(shots,1,shots[1])); }
      if (h.par===5&&shots.length>=2&&!shots[1].isPutt) { A.par5AppDist.push(shots[1].distanceBefore||0); if(shots[1].lie==='GREEN')A.par5AppProx.push(_gp2(shots,1,shots[1])); }
      
      roundPBP.push(holePBP);
    });
    
    A.sgOTT+=rOTT; A.sgAPP+=rAPP; A.sgARG+=rARG; A.sgPutt+=rPutt;
    var d2 = new Date(r.round_date+'T12:00:00');
    A.roundSGs.push({ date:(d2.getMonth()+1)+'/'+d2.getDate(), course:r.course_name, score:r.score, toPar:r.to_par, ott:rOTT, app:rAPP, arg:rARG, putt:rPutt, tot:rOTT+rAPP+rARG+rPutt });
    A.playByPlay.push({ date:(d2.getMonth()+1)+'/'+d2.getDate()+'/'+d2.getFullYear(), course:r.course_name, score:r.score, toPar:r.to_par, holes:roundPBP });
  });
  if (A.drives.length===0) A.shortestDrive=0;
  
  // ===== HELPERS =====
  function ftp(v){if(v===null||v===undefined)return'\u2013';v=Math.round(v*10)/10;return v>0?'+'+v:v===0?'E':''+v;}
  function ftpC(v){return v>0?'#d4706e':v<0?'#00a06d':'#9a9a9a';}
  function pct(nn,dd){return dd>0?Math.round(nn/dd*100)+'%':'\u2013';}
  function davg(arr){return arr.length>0?Math.round(arr.reduce(function(a,b){return a+b;},0)/arr.length):0;}
  function avgF(arr){return arr.length>0?(arr.reduce(function(a,b){return a+b;},0)/arr.length).toFixed(1):'\u2013';}
  function sgFmt(v){return v>=0?'+'+v.toFixed(2):v.toFixed(2);}
  function sgC(v){return v>=0?'#00a06d':'#d4706e';}
  function row(l,v,s){return'<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #282828;"><span style="color:#9a9a9a;">'+l+'</span><span style="font-weight:700;">'+v+(s?' <span style="font-size:11px;color:#606060;">'+s+'</span>':'')+'</span></div>';}
  function hdr(t){return'<div style="font-size:14px;font-weight:800;color:#00b87a;margin:14px 0 4px;border-bottom:2px solid #007a52;padding-bottom:2px;">'+t+'</div>';}
  function tbl(headers,rows){var h='<div style="overflow-x:auto;margin:4px 0;"><table style="width:100%;font-size:12px;border-collapse:collapse;"><tr>';headers.forEach(function(c){h+='<td style="padding:4px 6px;font-weight:700;color:#9a9a9a;border-bottom:1px solid #3d3d3d;">'+c+'</td>';});h+='</tr>';rows.forEach(function(r){h+='<tr>';r.forEach(function(c){h+='<td style="padding:3px 6px;border-bottom:1px solid #282828;">'+c+'</td>';});h+='</tr>';});return h+'</table></div>';}
  function sgRow(l,v,s){return'<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #282828;"><span style="color:#9a9a9a;">'+l+'</span><span style="font-weight:700;color:'+sgC(v)+';">'+sgFmt(v)+(s?' <span style="font-size:11px;color:#606060;">'+s+'</span>':'')+'</span></div>';}
  
  var n=A.n;
  // For SG and non-scoring stats, only count detailed (non-simple) rounds
  var nDetailed = data.filter(function(r){ return !r.round_data || r.round_data.entryMode !== 'simple'; }).length || 1;
  var avg18=A.r18s.length>0?avgF(A.r18s):'\u2013';
  var avg18tp=A.r18tp.length>0?A.r18tp.reduce(function(a,b){return a+b;},0)/A.r18tp.length:null;
  var avg9=A.r9s.length>0?avgF(A.r9s):'\u2013';
  var avg9tp=A.r9tp.length>0?A.r9tp.reduce(function(a,b){return a+b;},0)/A.r9tp.length:null;
  var bestStr=A.bestRound?A.bestRound.score+' ('+ftp(A.bestRound.to_par)+') \u2014 '+A.bestRound.course_name:'\u2013';
  var avgDrv=davg(A.drives);
  var avgFirstPutt=davg(A.firstPuttDists);
  // Rounds and holes that have fairway / green / putt stats (everything except score-only rounds)
  var nWithStats = data.filter(function(r){ var rd = r.round_data; return !rd || rd.entryMode !== 'simple' || rd.basicStats === true; }).length || 1;
  var detailedHoles = data.reduce(function(sum, r) { return sum + (r.round_data && r.round_data.entryMode === 'simple' && r.round_data.basicStats !== true ? 0 : (r.round_data && r.round_data.allHoles ? r.round_data.allHoles.length : 0)); }, 0);
  var twoPutts=detailedHoles-A.onePutt-A.threePutt;
  var sgTot=A.sgOTT+A.sgAPP+A.sgARG+A.sgPutt;
  
  // Store SG data for radar chart (per round averages, exclude simple rounds)
  S.dashSGData = {
    tot: sgTot/nDetailed,
    ott: A.sgOTT/nDetailed,
    app: A.sgAPP/nDetailed,
    arg: A.sgARG/nDetailed,
    putt: A.sgPutt/nDetailed
  };
  
  // Store all radar chart data
  S.dashRadarData = {
    // Scoring
    birdieAvg: A.birdies/n,
    scoringAvg: avg18 || (A.totScore/n),
    par5Avg: A.c5 ? A.p5/A.c5 : 5,
    par4Avg: A.c4 ? A.p4/A.c4 : 4,
    par3Avg: A.c3 ? A.p3/A.c3 : 3,
    // Driving
    sgOTT: A.sgOTT/nDetailed,
    missRight: A.fwOpp > 0 ? Math.round(A.fwRight/A.fwOpp*100) : 0,
    accuracy: A.fwOpp > 0 ? Math.round(A.fwHit/A.fwOpp*100) : 0,
    avgDistance: avgDrv,
    missLeft: A.fwOpp > 0 ? Math.round(A.fwLeft/A.fwOpp*100) : 0,
    // Approach
    girPct: detailedHoles > 0 ? Math.round(A.girHit/detailedHoles*100) : 0,
    sgAPP: A.sgAPP/nDetailed,
    proxOutside100: A.appRanges.filter(function(r){return r.min>=100;}).reduce(function(sum,r){return sum.concat(r.s);},[]).length > 0 ? davg(A.appRanges.filter(function(r){return r.min>=100;}).reduce(function(sum,r){return sum.concat(r.s);},[])) : 30,
    proxInside100: A.shortRanges.reduce(function(sum,r){return sum.concat(r.s);},[]).length > 0 ? davg(A.shortRanges.reduce(function(sum,r){return sum.concat(r.s);},[])) : 20,
    proximity: A.girHit > 0 ? Math.round(A.girFirstPuttDist/A.girHit) : 30,
    // ARG
    scrambling: A.scrOpp > 0 ? Math.round(A.scrMade/A.scrOpp*100) : 0,
    sgARG: A.sgARG/nDetailed,
    scrFromRough: A.scrOpp > 0 ? Math.round(A.scrMade/A.scrOpp*100) : 0,
    sandSave: A.bunOpp > 0 ? Math.round(A.bunMade/A.bunOpp*100) : 0,
    scr30In: A.scrOpp > 0 ? Math.round(A.scrMade/A.scrOpp*100) : 0,
    // Putting
    puttsPerRound: A.totPutts/nWithStats,
    make9ft: A.allPuttRanges[0].t + A.allPuttRanges[1].t + A.allPuttRanges[2].t > 0 ? Math.round((A.allPuttRanges[0].m + A.allPuttRanges[1].m + A.allPuttRanges[2].m) / (A.allPuttRanges[0].t + A.allPuttRanges[1].t + A.allPuttRanges[2].t) * 100) : 70,
    sgPutt: A.sgPutt/nDetailed,
    avgMadeDist: A.longestMadePutt > 0 ? Math.min(A.longestMadePutt/2, 15) : 5,
    threePuttAvoid: A.holes > 0 ? Math.round((1 - A.threePutt/A.holes) * 100) : 90,
    onePuttPct: A.holes > 0 ? Math.round(A.onePutt/A.holes*100) : 30
  };
  
  // Handicap label
  var hcpLabel=hcpLabels[hcp]||hcp;

  // ===== COACHING-STYLE TABS =====
  var html='';
  var tabNames=['SG','Scoring','OTT','Approach','ARG','Putting'];
  html+='<div style="display:flex;gap:0;width:100%;flex-shrink:0;border-radius:10px;overflow:hidden;margin-bottom:12px;">';
  for(var ti=0;ti<tabNames.length;ti++){
    var isActive=ti===0;
    html+='<button onclick="showDashSub('+ti+')" id="dashTab_'+ti+'" style="flex:1;height:36px;font-size:10px;font-weight:700;background:'+(isActive?'#2d7abc':'#282828')+';border-radius:0;border:none;color:'+(isActive?'#ffffff':'#606060')+';max-width:none;width:auto;padding:0 2px;margin:0;cursor:pointer;">'+tabNames[ti]+'</button>';
  }
  html+='</div>';
  
  // ===== TAB 0: STROKES GAINED =====
  html+='<div id="dsub_0" class="dsubContent">';
  html+='<div style="background:#222222; border-radius:12px; padding:10px; margin-bottom:12px; display:flex; justify-content:center; align-items:center;">'
     + '<canvas id="sgRadarDash" style="display:block; margin:0 auto;"></canvas>'
     + '</div>';
  html+=hdr('STROKES GAINED vs '+hcpLabel);
  html+=sgRow('SG: Total', sgTot/n, '/round');
  html+=sgRow('SG: Off The Tee', A.sgOTT/n, '/round');
  html+=sgRow('SG: Approach', A.sgAPP/n, '/round');
  html+=sgRow('SG: Around Green', A.sgARG/n, '/round');
  html+=sgRow('SG: Putting', A.sgPutt/n, '/round');
  html+=hdr('TOTALS ('+n+' rounds)');
  html+=sgRow('SG: Total', sgTot);
  html+=sgRow('SG: Off The Tee', A.sgOTT);
  html+=sgRow('SG: Approach', A.sgAPP);
  html+=sgRow('SG: Around Green', A.sgARG);
  html+=sgRow('SG: Putting', A.sgPutt);
  html+=hdr('SG BY ROUND');
  var sgRR=[];
  for(var si=0;si<Math.min(A.roundSGs.length,15);si++){var sr=A.roundSGs[si];sgRR.push([sr.date,sr.course.substring(0,12),'<span style="color:'+sgC(sr.tot)+'">'+sgFmt(sr.tot)+'</span>','<span style="color:'+sgC(sr.ott)+'">'+sgFmt(sr.ott)+'</span>','<span style="color:'+sgC(sr.app)+'">'+sgFmt(sr.app)+'</span>','<span style="color:'+sgC(sr.arg)+'">'+sgFmt(sr.arg)+'</span>','<span style="color:'+sgC(sr.putt)+'">'+sgFmt(sr.putt)+'</span>']);}
  html+=tbl(['Date','Course','Tot','OTT','APP','ARG','Putt'],sgRR);
  html+='</div>';
  
  // ===== TAB 1: SCORING =====
  html+='<div id="dsub_1" class="dsubContent" style="display:none;">';
  html+='<div style="background:#222222; border-radius:12px; padding:10px; margin-bottom:12px; display:flex; justify-content:center; align-items:center;">'
     + '<canvas id="scoringRadarDash" style="display:block; margin:0 auto;"></canvas>'
     + '</div>';
  // Inline handicap calculation from the data we already have
  var hcpResult = calcHandicapIndex(data);
  var hcpDisplay = hcpResult.index !== null ? hcpResult.index.toFixed(1) : '--';
  var hcpColor = hcpResult.index === null ? '#606060' : hcpResult.index <= 5 ? '#00b87a' : hcpResult.index <= 15 ? '#f0c830' : '#d4706e';
  html+=hdr('HANDICAP INDEX');
  html+='<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #282828;"><span style="color:#9a9a9a;">Handicap Index</span><span style="font-size:22px;font-weight:800;color:'+hcpColor+';">'+hcpDisplay+'</span></div>';
  html+=row('Calculation',hcpResult.msg);
  html+=hdr('SCORING AVERAGES');
  html+=row('Avg 18-Hole Score',avg18,avg18tp!==null?'<span style="color:'+ftpC(avg18tp)+'">'+ftp(avg18tp)+'</span>':'');
  html+=row('Avg 9-Hole Score',avg9,avg9tp!==null?'<span style="color:'+ftpC(avg9tp)+'">'+ftp(avg9tp)+'</span>':'');
  html+=row('Best Round',bestStr);
  html+=row('Avg Par 3',A.c3?(A.p3/A.c3).toFixed(1):'\u2013');
  html+=row('Avg Par 4',A.c4?(A.p4/A.c4).toFixed(1):'\u2013');
  html+=row('Avg Par 5',A.c5?(A.p5/A.c5).toFixed(1):'\u2013');
  html+=hdr('SCORE DISTRIBUTION');
  html+=row('Eagles',A.eagles,(A.eagles/n).toFixed(1)+'/rd');
  html+=row('Birdies',A.birdies,(A.birdies/n).toFixed(1)+'/rd');
  html+=row('Pars',A.pars,(A.pars/n).toFixed(1)+'/rd');
  html+=row('Bogeys',A.bogeys,(A.bogeys/n).toFixed(1)+'/rd');
  html+=row('Double+',A.dblPlus,(A.dblPlus/n).toFixed(1)+'/rd');
  html+=hdr('RECENT ROUNDS');
  var recentRows=[];var recent=data.slice(0,8);
  for(var ri=0;ri<recent.length;ri++){var rr=recent[ri];var d3=new Date(rr.round_date+'T12:00:00');recentRows.push([(d3.getMonth()+1)+'/'+d3.getDate(),rr.course_name,''+rr.score,'<span style="color:'+ftpC(rr.to_par)+'">'+ftp(rr.to_par)+'</span>']);}
  html+=tbl(['Date','Course','Score','\u00b1Par'],recentRows);
  html+='</div>';
  
  // ===== TAB 2: OFF THE TEE =====
  html+='<div id="dsub_2" class="dsubContent" style="display:none;">';
  html+='<div style="background:#222222; border-radius:12px; padding:10px; margin-bottom:12px; display:flex; justify-content:center; align-items:center;">'
     + '<canvas id="drivingRadarDash" style="display:block; margin:0 auto;"></canvas>'
     + '</div>';
  html+=hdr('SG: OFF THE TEE vs '+hcpLabel);
  html+=sgRow('Total',A.sgOTT,nDetailed+' rounds');
  html+=sgRow('Per Round',A.sgOTT/nDetailed);
  html+=hdr('FAIRWAY ACCURACY');
  html+=row('Fairways Hit',pct(A.fwHit,A.fwOpp),A.fwHit+'/'+A.fwOpp);
  html+=row('Missed Left',A.fwLeft,pct(A.fwLeft,A.fwOpp));
  html+=row('Missed Right',A.fwRight,pct(A.fwRight,A.fwOpp));
  html+=hdr('DRIVING DISTANCE');
  html+=row('Average',avgDrv+' yds',A.drives.length+' drives');
  html+=row('Longest',A.longestDrive+' yds');
  html+=row('Shortest',A.shortestDrive+' yds');
  html+=hdr('PENALTIES OFF THE TEE');
  html+=row('Par 3 Tee Penalties',A.par3TeePen);
  html+=row('Par 4/5 Tee Penalties',A.par45TeePen);
  html+='</div>';
  
  // ===== TAB 3: APPROACH =====
  html+='<div id="dsub_3" class="dsubContent" style="display:none;">';
  html+='<div style="background:#222222; border-radius:12px; padding:10px; margin-bottom:12px; display:flex; justify-content:center; align-items:center;">'
     + '<canvas id="approachRadarDash" style="display:block; margin:0 auto;"></canvas>'
     + '</div>';
  html+=hdr('SG: APPROACH vs '+hcpLabel);
  html+=sgRow('Total',A.sgAPP,nDetailed+' rounds');
  html+=sgRow('Per Round',A.sgAPP/nDetailed);
  html+=hdr('GREENS IN REGULATION');
  html+=row('GIR',pct(A.girHit,detailedHoles),A.girHit+'/'+detailedHoles);
  html+=row('Proximity when GIR',A.girHit>0?Math.round(A.girFirstPuttDist/A.girHit)+' ft':'\u2013');
  html+=hdr('MISSED GREENS');
  var totalMiss=A.missShort+A.missLong+A.missLeft+A.missRight;
  html+=row('Short',A.missShort,totalMiss>0?pct(A.missShort,totalMiss):'');
  html+=row('Long',A.missLong,totalMiss>0?pct(A.missLong,totalMiss):'');
  html+=row('Left',A.missLeft,totalMiss>0?pct(A.missLeft,totalMiss):'');
  html+=row('Right',A.missRight,totalMiss>0?pct(A.missRight,totalMiss):'');
  html+=hdr('APPROACH BY DISTANCE');
  var appRows=[];A.appRanges.forEach(function(r){if(r.total>0)appRows.push([r.l+' yds',r.total+' shots',r.s.length>0?davg(r.s)+' ft':'\u2013']);});
  html+=tbl(['Distance','Shots','Avg Proximity'],appRows);
  html+=hdr('APPROACH BY PAR');
  html+=row('Par 3 Avg Distance',davg(A.par3AppDist)+' yds',A.par3AppDist.length+' holes');
  html+=row('Par 3 Avg Proximity',A.par3AppProx.length>0?davg(A.par3AppProx)+' ft':'\u2013',A.par3AppProx.length+' GIR');
  html+=row('Par 4 Avg Distance',davg(A.par4AppDist)+' yds',A.par4AppDist.length+' holes');
  html+=row('Par 4 Avg Proximity',A.par4AppProx.length>0?davg(A.par4AppProx)+' ft':'\u2013',A.par4AppProx.length+' GIR');
  html+=row('Par 5 Avg Distance',davg(A.par5AppDist)+' yds',A.par5AppDist.length+' holes');
  html+=row('Par 5 Avg Proximity',A.par5AppProx.length>0?davg(A.par5AppProx)+' ft':'\u2013',A.par5AppProx.length+' GIR');
  html+=hdr('PENALTIES ON APPROACH');
  html+=row('Approach Penalties',A.appPen);
  html+='</div>';
  
  // ===== TAB 4: SHORT GAME =====
  html+='<div id="dsub_4" class="dsubContent" style="display:none;">';
  html+='<div style="background:#222222; border-radius:12px; padding:10px; margin-bottom:12px; display:flex; justify-content:center; align-items:center;">'
     + '<canvas id="argRadarDash" style="display:block; margin:0 auto;"></canvas>'
     + '</div>';
  html+=hdr('SG: AROUND THE GREEN vs '+hcpLabel);
  html+=sgRow('Total',A.sgARG,nDetailed+' rounds');
  html+=sgRow('Per Round',A.sgARG/nDetailed);
  html+=hdr('SCRAMBLING');
  html+=row('Scrambling',pct(A.scrMade,A.scrOpp),A.scrMade+'/'+A.scrOpp);
  html+=row('Bunker Saves',pct(A.bunMade,A.bunOpp),A.bunMade+'/'+A.bunOpp);
  html+=row('Avg Bunker Proximity',A.bunkerProx.length>0?davg(A.bunkerProx)+' ft':'\u2013',A.bunkerProx.length+' shots');
  html+=hdr('SHORT GAME BY DISTANCE');
  var sgRows2=[];A.shortRanges.forEach(function(r){if(r.s.length>0)sgRows2.push([r.l+' yds',r.s.length+' shots',davg(r.s)+' ft']);});
  html+=tbl(['Distance','Shots','Avg Proximity'],sgRows2);
  html+=hdr('PENALTIES AROUND GREEN');
  html+=row('Short Game Penalties',A.sgPen);
  html+='</div>';
  
  // ===== TAB 5: PUTTING =====
  html+='<div id="dsub_5" class="dsubContent" style="display:none;">';
  html+='<div style="background:#222222; border-radius:12px; padding:10px; margin-bottom:12px; display:flex; justify-content:center; align-items:center;">'
     + '<canvas id="puttingRadarDash" style="display:block; margin:0 auto;"></canvas>'
     + '</div>';
  html+=hdr('SG: PUTTING vs '+hcpLabel);
  html+=sgRow('Total',A.sgPutt,nDetailed+' rounds');
  html+=sgRow('Per Round',A.sgPutt/nDetailed);
  html+=hdr('PUTTING SUMMARY');
  html+=row('Total Putts',A.totPutts,detailedHoles>0?(A.totPutts/detailedHoles).toFixed(1)+'/hole':'');
  html+=row('Putts per GIR',A.girHit>0?(A.girPutts/A.girHit).toFixed(1):'\u2013');
  html+=row('Avg First Putt Distance',avgFirstPutt+' ft');
  html+=hdr('PUTTING PERFORMANCE');
  html+=row('One-Putts',A.onePutt,pct(A.onePutt,detailedHoles));
  html+=row('Two-Putts',twoPutts,pct(twoPutts,detailedHoles));
  html+=row('Three-Putts',A.threePutt,pct(A.threePutt,detailedHoles));
  html+=row('Longest Made Putt',A.longestMadePutt+' ft');
  html+=hdr('MAKE % BY DISTANCE');
  var puttRows=[];A.allPuttRanges.forEach(function(r){puttRows.push([r.l,r.t>0?r.m+'/'+r.t:'0/0',r.t>0?Math.round(r.m/r.t*100)+'%':'\u2013']);});
  html+=tbl(['Distance','Made/Total','Make %'],puttRows);
  html+='</div>';
  
  content.innerHTML=html;
  
  // Render radar chart on initial load
  setTimeout(function(){
    var canvas=document.getElementById('sgRadarDash');
    if(canvas && S.dashSGData) renderSGRadarDash(canvas, S.dashSGData);
  },50);
}

function showDashSub(idx) {
  for(var i=0;i<6;i++){
    var el=document.getElementById('dsub_'+i);
    if(el)el.style.display=i===idx?'block':'none';
    var tab=document.getElementById('dashTab_'+i);
    if(tab){tab.style.background=i===idx?'#2d7abc':'#282828';tab.style.color=i===idx?'#ffffff':'#606060';}
  }
  
  setTimeout(function(){
    if(idx===0){
      var canvas=document.getElementById('sgRadarDash');
      if(canvas && S.dashSGData) renderSGRadarDash(canvas, S.dashSGData);
    } else if(idx===1 && S.dashRadarData){
      renderScoringRadar();
    } else if(idx===2 && S.dashRadarData){
      renderDrivingRadar();
    } else if(idx===3 && S.dashRadarData){
      renderApproachRadar();
    } else if(idx===4 && S.dashRadarData){
      renderARGRadar();
    } else if(idx===5 && S.dashRadarData){
      renderPuttingRadar();
    }
  },50);
}

// Functions called from inline HTML handlers
expose({ onDashHcpChange, applyDashFilters, showDashSub });
