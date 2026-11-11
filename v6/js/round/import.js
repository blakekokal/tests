import { expose } from '../core/expose.js';
import { loadStudentRounds } from '../coaching/student-view.js';
import { activeUserId } from '../core/session.js';
import { _sb } from '../core/supabase.js';
import { getTodayCentral } from '../core/util.js';
import { loadMyRounds } from './history.js';

async function handleRoundUpload(input, targetUserId) {
  var file = input.files[0];
  if (!file) return;
  
  // Determine which message element to use
  var isStudent = (targetUserId !== activeUserId());
  var msgEl = document.getElementById(isStudent ? 'uploadStudentRoundMsg' : 'uploadRoundMsg');
  msgEl.style.color = '#606060';
  msgEl.textContent = 'Parsing file...';
  
  try {
    var data = await readFileAsArrayBuffer(file);
    var wb = XLSX.read(data, { type: 'array' });
    
    // Parse the round from all sheets
    var parsed = parseExcelRound(wb);
    
    if (!parsed) {
      msgEl.style.color = '#d4706e';
      msgEl.textContent = 'Could not parse round data. Check file format.';
      input.value = '';
      return;
    }
    
    msgEl.textContent = 'Saving ' + parsed.courseName + ' (' + parsed.holes + ' holes, score ' + parsed.score + ')...';
    
    // Build round_data blob from parsed scorecard
    var roundBlob = {
      allHoles: parsed.allHoles,
      stats: parsed.stats || {}
    };
    
    var { error } = await _sb.from('rounds').insert({
      user_id: targetUserId,
      player_name: parsed.playerName,
      course_name: parsed.courseName,
      round_date: parsed.roundDate,
      round_type: parsed.roundType,
      handicap: parsed.handicap,
      holes: parsed.holes,
      score: parsed.score,
      par: parsed.totalPar,
      to_par: parsed.score - parsed.totalPar,
      round_data: roundBlob
    });
    
    if (error) {
      msgEl.style.color = '#d4706e';
      msgEl.textContent = 'Error: ' + error.message;
    } else {
      msgEl.style.color = '#00b87a';
      msgEl.textContent = '✓ Imported ' + parsed.courseName + ' (' + parsed.score + ')';
      // Refresh the round list
      if (isStudent) {
        loadStudentRounds();
      } else {
        loadMyRounds();
      }
    }
  } catch(e) {
    msgEl.style.color = '#d4706e';
    msgEl.textContent = 'Error reading file: ' + e.message;
  }
  
  input.value = '';
}

function readFileAsArrayBuffer(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) { resolve(new Uint8Array(e.target.result)); };
    reader.onerror = function() { reject(new Error('File read failed')); };
    reader.readAsArrayBuffer(file);
  });
}

function parseExcelRound(wb) {
  // Helper to get rows from a sheet by name (case-insensitive partial match)
  function getSheetRows(name) {
    for (var i = 0; i < wb.SheetNames.length; i++) {
      if (wb.SheetNames[i].toLowerCase().indexOf(name.toLowerCase()) !== -1) {
        return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[i]], { header: 1, defval: '' });
      }
    }
    return null;
  }
  
  // ===== PARSE SCORING SHEET =====
  var rows = getSheetRows('scor') || XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  
  var playerName = '', courseName = '', roundDate = '', handicap = 'pro', roundType = 'Casual';
  var sections = [];
  
  for (var i = 0; i < rows.length && i < 60; i++) {
    var r = rows[i];
    if (!r || r.length === 0) continue;
    var first = String(r[0] || '').trim().toLowerCase();
    
    if (first === 'name:' || first === 'name') playerName = String(r[1] || '').trim();
    if (first.indexOf('player') === 0) playerName = String(r[1] || '').trim();
    if (first.indexOf('course') === 0) courseName = String(r[1] || '').trim();
    if (first.indexOf('handicap') === 0) handicap = String(r[1] || 'pro').trim();
    if (first.indexOf('round type') === 0) roundType = String(r[1] || 'Casual').trim();
    if (first.indexOf('date') === 0 && r[1]) roundDate = parseImportDate(r[1]);
    
    if (first === 'hole') {
      var sec = { holeRow: i, yardRow: null, parRow: null, scoreRow: null, puttRow: null };
      for (var k = i + 1; k < Math.min(i + 6, rows.length); k++) {
        var label = String((rows[k] || [])[0] || '').trim().toLowerCase();
        if (label === 'yards' || label === 'yds' || label === 'yardage') sec.yardRow = k;
        if (label === 'par') sec.parRow = k;
        if (label === 'score') sec.scoreRow = k;
        if (label === 'putts') sec.puttRow = k;
      }
      if (sec.parRow !== null && sec.scoreRow !== null) sections.push(sec);
    }
  }
  
  if (sections.length === 0) return null;
  
  var allHoles = [];
  var totalScore = 0, totalPar = 0;
  
  sections.forEach(function(sec) {
    var pars = rows[sec.parRow], scores = rows[sec.scoreRow];
    var yards = sec.yardRow !== null ? rows[sec.yardRow] : null;
    var putts = sec.puttRow !== null ? rows[sec.puttRow] : null;
    for (var col = 1; col < pars.length; col++) {
      var p = parseInt(pars[col]), s = parseInt(scores[col]);
      if (isNaN(p) || isNaN(s) || p < 2 || p > 6) continue;
      allHoles.push({
        hole: allHoles.length + 1, par: p,
        yards: yards ? parseInt(yards[col]) || 0 : 0,
        score: s, putts: putts ? parseInt(putts[col]) || 0 : 0,
        firstPuttDist: 0, expectedPutts: 0,
        sgOTT: 0, sgAPP: 0, sgARG: 0, sgPutting: 0,
        shots: []
      });
      totalScore += s; totalPar += p;
    }
  });
  
  if (allHoles.length === 0) return null;
  
  // ===== PARSE STROKES GAINED SHEET (shot-by-shot) =====
  var sgRows = getSheetRows('strokes');
  if (sgRows) {
    var shotHeaderRow = -1;
    for (var si = 0; si < sgRows.length; si++) {
      if (String(sgRows[si][0] || '').toLowerCase() === 'hole' && String(sgRows[si][2] || '').toLowerCase().indexOf('shot') !== -1) {
        shotHeaderRow = si; break;
      }
    }
    if (shotHeaderRow >= 0) {
      for (var sr = shotHeaderRow + 1; sr < sgRows.length; sr++) {
        var srow = sgRows[sr];
        if (!srow || srow[0] === '' || srow[0] === null) continue;
        var hNum = parseInt(srow[0]), shotNum = parseInt(srow[2]);
        if (isNaN(hNum) || isNaN(shotNum)) continue;
        var hole = allHoles.find(function(h){ return h.hole === hNum; });
        if (!hole) continue;
        
        var startLie = String(srow[4] || '').toUpperCase();
        var endLie = String(srow[5] || '').toUpperCase();
        var isPutt = (startLie === 'GREEN');
        var distBefore = parseInt(srow[3]) || 0;
        var endDistStr = String(srow[6] || '');
        var distAfter = (endLie === 'HOLED') ? 0 : (parseInt(endDistStr) || 0);
        
        var lieMapped = endLie;
        if (endLie === 'HOLED') lieMapped = 'GREEN';
        else if (endLie.indexOf('ROUGH') !== -1) lieMapped = 'ROUGH';
        else if (endLie.indexOf('BUNKER') !== -1) lieMapped = 'BUNKER';
        
        hole.shots.push({
          shotNum: shotNum, lie: lieMapped,
          distanceBefore: distBefore, distanceAfter: distAfter, isPutt: isPutt
        });
      }
    }
  }
  
  // Parse shot data from scorecard-style template (multi-hole columns)
  parseScorecardShotData(rows, allHoles);

  // Fill in minimal shots for holes without shot data
  allHoles.forEach(function(h) {
    if (h.shots.length === 0) h.shots = buildMinimalShots(h.par, h.score, h.putts, h.yards);
    // Sync putts count from parsed shots if shots were filled in
    if (h.shots.length > 0 && h.putts === 0) {
      h.putts = h.shots.filter(function(s){ return s.isPutt; }).length;
    }
  });
  
  // ===== PARSE PUTTING SHEET (firstPuttDist, expectedPutts per hole) =====
  var puttRows = getSheetRows('putt');
  var totalPutts = 0, onePutts = 0, threePutts = 0, girPuttsPerGIR = 0;
  if (puttRows) {
    for (var pi = 0; pi < puttRows.length; pi++) {
      var pr = puttRows[pi];
      var psLabel = String(pr[0] || '').toLowerCase();
      if (psLabel === 'total putts') totalPutts = parseInt(pr[1]) || 0;
      if (psLabel.indexOf('one-putt') !== -1) onePutts = parseInt(pr[1]) || 0;
      if (psLabel.indexOf('three-putt') !== -1) threePutts = parseInt(pr[1]) || 0;
      if (psLabel.indexOf('putts per gir') !== -1) girPuttsPerGIR = parseFloat(pr[1]) || 0;
      // Hole-by-hole putting
      var holeNum = parseInt(pr[0]);
      if (!isNaN(holeNum) && holeNum >= 1 && String(pr[1] || '').indexOf('ft') !== -1) {
        var h2 = allHoles.find(function(h){ return h.hole === holeNum; });
        if (h2) {
          h2.firstPuttDist = parseInt(pr[1]) || 0;
          h2.expectedPutts = parseFloat(pr[3]) || 0;
          h2.sgPutting = parseFloat(pr[4]) || 0;
        }
      }
    }
  }
  
  // ===== PARSE OFF THE TEE SHEET =====
  var ottRows = getSheetRows('off the tee');
  var fwHit = 0, fwOpp = 0, fwLeft = 0, fwRight = 0, avgDrive = 0;
  if (ottRows) {
    for (var oi = 0; oi < ottRows.length; oi++) {
      var oLabel = String(ottRows[oi][0] || '').toLowerCase();
      if (oLabel.indexOf('fairways hit') !== -1) {
        var fwParts = String(ottRows[oi][1] || '').split('/');
        if (fwParts.length === 2) { fwHit = parseInt(fwParts[0]) || 0; fwOpp = parseInt(fwParts[1]) || 0; }
      }
      if (oLabel.indexOf('missed left') !== -1) fwLeft = parseInt(ottRows[oi][1]) || 0;
      if (oLabel.indexOf('missed right') !== -1) fwRight = parseInt(ottRows[oi][1]) || 0;
      if (oLabel === 'average') avgDrive = parseInt(ottRows[oi][1]) || 0;
    }
  }
  
  // ===== PARSE APPROACH SHEET =====
  var appRows = getSheetRows('approach');
  var girHit = 0, girOpp = allHoles.length, girProx = 0;
  var missShort = 0, missLong = 0, missLeft2 = 0, missRight2 = 0;
  if (appRows) {
    for (var ai = 0; ai < appRows.length; ai++) {
      var aLabel = String(appRows[ai][0] || '').toLowerCase();
      if (aLabel === 'gir') {
        var girParts = String(appRows[ai][1] || '').split('/');
        if (girParts.length === 2) { girHit = parseInt(girParts[0]) || 0; girOpp = parseInt(girParts[1]) || girOpp; }
      }
      if (aLabel.indexOf('proximity when gir') !== -1) girProx = parseInt(appRows[ai][1]) || 0;
      if (aLabel === 'short') missShort = parseInt(appRows[ai][1]) || 0;
      if (aLabel === 'long') missLong = parseInt(appRows[ai][1]) || 0;
      if (aLabel === 'left') missLeft2 = parseInt(appRows[ai][1]) || 0;
      if (aLabel === 'right') missRight2 = parseInt(appRows[ai][1]) || 0;
    }
  }
  
  // ===== PARSE AROUND THE GREEN SHEET =====
  var argRows = getSheetRows('around');
  var scrMade = 0, scrOpp = 0, bunMade = 0, bunOpp = 0;
  if (argRows) {
    for (var gi = 0; gi < argRows.length; gi++) {
      var gLabel = String(argRows[gi][0] || '').toLowerCase();
      if (gLabel.indexOf('scrambling') !== -1) {
        var scrParts = String(argRows[gi][1] || '').split('/');
        if (scrParts.length === 2) { scrMade = parseInt(scrParts[0]) || 0; scrOpp = parseInt(scrParts[1]) || 0; }
      }
      if (gLabel.indexOf('up') !== -1 && gLabel.indexOf('bunker') !== -1) {
        var bunParts = String(argRows[gi][1] || '').split('/');
        if (bunParts.length === 2) { bunMade = parseInt(bunParts[0]) || 0; bunOpp = parseInt(bunParts[1]) || 0; }
      }
    }
  }
  
  var stats = {
    fwHit: fwHit, fwOpp: fwOpp, fwLeft: fwLeft, fwRight: fwRight,
    girHit: girHit, girOpp: girOpp,
    girFirstPuttDist: girProx * girHit,
    girPutts: girHit > 0 ? Math.round(girPuttsPerGIR * girHit) : 0,
    scrMade: scrMade, scrOpp: scrOpp,
    bunMade: bunMade, bunOpp: bunOpp,
    totalPutts: totalPutts || allHoles.reduce(function(s,h){return s+h.putts;},0),
    onePutts: onePutts, threePutts: threePutts,
    missShort: missShort, missLong: missLong,
    missLeft: missLeft2, missRight: missRight2,
    avgDrive: avgDrive
  };
  
  if (!roundDate) roundDate = getTodayCentral();
  if (!playerName) playerName = 'Player';
  if (!courseName) courseName = 'Imported Round';
  
  return {
    playerName: playerName, courseName: courseName, roundDate: roundDate,
    roundType: roundType, handicap: handicap,
    holes: allHoles.length, score: totalScore, totalPar: totalPar,
    allHoles: allHoles, stats: stats
  };
}

// ── Scorecard-format shot parser ──────────────────────────────────────────────
// Detects multi-hole-column layout (Hole|1||Hole|2||...) and rebuilds shots.
function parseScorecardShotData(rows, allHoles) {
  for (var i = 0; i < rows.length; i++) {
    var r0 = String(rows[i][0] || '').trim().toLowerCase();
    var r3 = String(rows[i][3] || '').trim().toLowerCase();
    if (r0 !== 'hole' || r3 !== 'hole') continue;

    // Find first "Shot 1" row in this section
    var shotStart = -1;
    for (var k = i + 1; k < Math.min(i + 8, rows.length); k++) {
      if (String(rows[k][0] || '').trim().toLowerCase() === 'shot 1') { shotStart = k; break; }
    }
    if (shotStart < 0) continue;

    // Collect contiguous shot rows ("Shot 1" … "Shot N")
    var shotRows = [];
    for (var k = shotStart; k < rows.length; k++) {
      if (String(rows[k][0] || '').trim().toLowerCase().indexOf('shot') === 0) {
        shotRows.push(rows[k]);
      } else { break; }
    }

    // Process each of the 9 holes in this section (base col = hi*3)
    var holeHeaderRow = rows[i];
    for (var hi = 0; hi < 9; hi++) {
      var b = hi * 3;
      var holeNum = parseInt(holeHeaderRow[b + 1]);
      if (isNaN(holeNum)) continue;
      var hole = allHoles.find(function(h){ return h.hole === holeNum; });
      if (!hole) continue;
      var built = rebuildScorecardShots(hole.yards, shotRows, b);
      if (built.length > 0) hole.shots = built;
    }
  }
}

function rebuildScorecardShots(yards, shotRows, baseCol) {
  var shots = [], shotNum = 1, distBefore = yards || 200, prevLie = '';
  for (var si = 0; si < shotRows.length; si++) {
    var endLieRaw = String(shotRows[si][baseCol + 1] || '').trim();
    var distRaw   = String(shotRows[si][baseCol + 2] || '').trim();
    if (!endLieRaw) break;
    var ell = endLieRaw.toLowerCase();

    // "2 putts" / "3 putts" — expand into N putts finishing holed
    var mp = ell.match(/^(\d+)\s*putts?$/);
    if (mp) {
      var n = parseInt(mp[1]), d = distBefore;
      for (var p = 0; p < n; p++) {
        var last = (p === n - 1);
        shots.push({ shotNum: shotNum++, lie: last ? 'HOLED' : 'GREEN',
          distanceBefore: d, distanceAfter: last ? 0 : 3, isPutt: true });
        d = 3;
      }
      break;
    }

    var isPutt = (prevLie === 'GREEN' || ell.indexOf('putt') !== -1);
    var mappedLie = mapScorecardLie(ell);
    var distAfter = (mappedLie === 'HOLED') ? 0 : parseScorecardDist(distRaw);

    shots.push({ shotNum: shotNum++, lie: mappedLie,
      distanceBefore: distBefore, distanceAfter: distAfter, isPutt: isPutt });

    if (mappedLie === 'HOLED') break;
    distBefore = distAfter;
    prevLie = mappedLie;
  }
  return shots;
}

function mapScorecardLie(ell) {
  if (ell === 'hole' || ell === 'holed' || ell === 'in' || ell === 'made') return 'HOLED';
  if (ell.indexOf('putt') !== -1) return 'GREEN';
  if (ell.indexOf('green') !== -1) return 'GREEN';
  if (ell.indexOf('fairway') !== -1 || ell === 'fw') return 'FAIRWAY';
  if (ell.indexOf('rough') !== -1) return 'ROUGH';
  if (ell.indexOf('bunker') !== -1 || ell.indexOf('sand') !== -1) return 'BUNKER';
  if (ell.indexOf('water') !== -1 || ell === 'ob' || ell === 'oob' ||
      ell.indexOf('penalty') !== -1 || ell.indexOf('hazard') !== -1) return 'PENALTY';
  if (ell.indexOf('tree') !== -1) return 'ROUGH';
  return 'FAIRWAY';
}

function parseScorecardDist(s) {
  s = String(s).trim().toLowerCase();
  if (!s || s === 'hole' || s === 'holed') return 0;
  return parseInt(s) || 0;
}
// ──────────────────────────────────────────────────────────────────────────────

function parseImportDate(val) {
  // Handle Excel date serial number
  if (typeof val === 'number') {
    // Excel serial date to YYYY-MM-DD without timezone issues
    var d = new Date((val - 25569) * 86400 * 1000 + 43200000); // Add 12 hours to avoid timezone shift
    var yr = d.getUTCFullYear();
    var mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    var dy = String(d.getUTCDate()).padStart(2, '0');
    return yr + '-' + mo + '-' + dy;
  }
  // Handle string dates
  var s = String(val).trim();
  // Try ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  // Try MM/DD/YYYY
  var parts = s.split('/');
  if (parts.length === 3) {
    var yr = parts[2].length === 2 ? '20' + parts[2] : parts[2];
    return yr + '-' + parts[0].padStart(2,'0') + '-' + parts[1].padStart(2,'0');
  }
  return getTodayCentral();
}

function buildMinimalShots(par, score, putts, yards) {
  // Build minimal shot array for compatibility with the rest of the app
  var shots = [];
  var nonPuttShots = score - putts;
  if (nonPuttShots < 1) nonPuttShots = 1;
  
  // Estimate distances for each non-putt shot
  var remaining = yards;
  var firstPuttDist = 20; // default estimate in feet
  
  for (var i = 1; i <= nonPuttShots; i++) {
    var isLastNonPutt = (i === nonPuttShots);
    var distBefore = remaining;
    var distAfter;
    
    if (i === 1 && par >= 4) {
      // Tee shot on par 4/5: estimate drive ~250 or remaining/nonPuttShots
      var driveEst = Math.min(250, Math.round(remaining * 0.6));
      distAfter = Math.max(20, remaining - driveEst);
    } else if (isLastNonPutt) {
      // Last non-putt shot reaches green
      distAfter = firstPuttDist;
    } else {
      // Middle shots: distribute remaining evenly
      var shotsLeft = nonPuttShots - i;
      distAfter = Math.max(20, Math.round(remaining / (shotsLeft + 1)));
    }
    
    shots.push({
      shotNum: i,
      lie: isLastNonPutt ? 'GREEN' : (i === 1 && par >= 4 ? 'FAIRWAY' : 'FAIRWAY'),
      distanceBefore: distBefore,
      distanceAfter: isLastNonPutt ? firstPuttDist : distAfter,
      isPutt: false
    });
    
    remaining = isLastNonPutt ? 0 : distAfter;
  }
  
  // Putts
  for (var j = 0; j < putts; j++) {
    shots.push({
      shotNum: nonPuttShots + j + 1,
      lie: 'GREEN',
      distanceBefore: j === 0 ? firstPuttDist : 3,
      distanceAfter: j === putts - 1 ? 0 : 3,
      isPutt: true
    });
  }
  
  return shots;
}

function downloadRoundTemplate() {
  var wb = XLSX.utils.book_new();

  // ---- style shortcuts ----
  var TN  = {top:{style:'thin',color:{rgb:'BBBBBB'}},bottom:{style:'thin',color:{rgb:'BBBBBB'}},left:{style:'thin',color:{rgb:'BBBBBB'}},right:{style:'thin',color:{rgb:'BBBBBB'}}};
  var TN2 = {top:{style:'thin',color:{rgb:'444444'}},bottom:{style:'thin',color:{rgb:'444444'}},left:{style:'thin',color:{rgb:'444444'}},right:{style:'thin',color:{rgb:'444444'}}};
  var HDR  = {fill:{fgColor:{rgb:'1A5C32'}}, font:{bold:true,color:{rgb:'FFFFFF'}}, border:TN2, alignment:{horizontal:'center',vertical:'center'}};
  var HDR2 = {fill:{fgColor:{rgb:'2E7D32'}}, font:{bold:true,color:{rgb:'FFFFFF'}}, border:TN2, alignment:{horizontal:'center',vertical:'center'}};
  var INP  = {fill:{fgColor:{rgb:'FFFDE7'}}, border:TN, alignment:{horizontal:'center',vertical:'center'}};
  var SINP = {fill:{fgColor:{rgb:'FFF8E1'}}, border:TN, alignment:{horizontal:'center',vertical:'center'}};
  var TTL  = {fill:{fgColor:{rgb:'E8F5E9'}}, font:{bold:true}, border:TN2, alignment:{horizontal:'center',vertical:'center'}};
  var LBL  = {font:{bold:true}, alignment:{horizontal:'right',vertical:'center'}};
  var INFL = {fill:{fgColor:{rgb:'FFFDE7'}}, border:TN, alignment:{horizontal:'left',vertical:'center'}};
  var SHT  = {fill:{fgColor:{rgb:'EEEEEE'}}, font:{bold:true,color:{rgb:'444444'}}, border:TN, alignment:{horizontal:'center',vertical:'center'}};
  var BRD  = {border:TN};
  var NOTS = {font:{italic:true,sz:10,color:{rgb:'555555'}}};
  var REFL = {fill:{fgColor:{rgb:'F1F8E9'}}, font:{bold:true,sz:11,color:{rgb:'1A5C32'}}};

  function sc(ws, r, c, style) {
    var addr = XLSX.utils.encode_cell({r:r, c:c});
    if (!ws[addr]) ws[addr] = {t:'s', v:''};
    ws[addr].s = style;
  }

  // 9 holes x 3 cols each + 3 Total cols = 30 cols total
  function makeHoleRow(holeNums) {
    var row = [];
    for (var i = 0; i < holeNums.length; i++) { row.push('Hole'); row.push(holeNums[i]); row.push(''); }
    row.push('Total'); row.push(''); row.push('');
    return row;
  }
  function makeLabelRow(label, totalLabel) {
    var row = [];
    for (var i = 0; i < 9; i++) { row.push(label); row.push(''); row.push(''); }
    row.push(totalLabel || ''); row.push(''); row.push('');
    return row;
  }
  function makeShotHdrRow() {
    var row = [];
    for (var i = 0; i < 9; i++) { row.push('Shot #'); row.push('End Lie/Putts'); row.push('Distance left'); }
    row.push(''); row.push(''); row.push('');
    return row;
  }
  function makeShotRow(n) {
    var row = [];
    for (var i = 0; i < 9; i++) { row.push('Shot ' + n); row.push(''); row.push(''); }
    row.push(''); row.push(''); row.push('');
    return row;
  }

  // Build all rows
  var allRows = [
    // Rows 0-5: info
    ['name:',       ''],
    ['date',        ''],
    ['course name', ''],
    ['round type',  'Casual'],
    ['# of holes',  18],
    ['handicap',    'pro'],
    // Row 6: blank
    [],
    // Row 7: front 9 hole header
    makeHoleRow([1,2,3,4,5,6,7,8,9]),
    makeLabelRow('Par',     'Par'),
    makeLabelRow('Score',   'Score'),
    makeLabelRow('Yardage', ''),
    makeShotHdrRow()
  ];
  for (var s = 1; s <= 9; s++) allRows.push(makeShotRow(s));
  // Rows 21-22: blank
  allRows.push([]); allRows.push([]);
  // Row 23: back 9 hole header
  allRows.push(makeHoleRow([10,11,12,13,14,15,16,17,18]));
  allRows.push(makeLabelRow('Par',     'Par'));
  allRows.push(makeLabelRow('Score',   'Score'));
  allRows.push(makeLabelRow('Yardage', ''));
  allRows.push(makeShotHdrRow());
  for (var s = 1; s <= 9; s++) allRows.push(makeShotRow(s));
  // Row 37: blank
  allRows.push([]);
  // Rows 38+: lie reference guide (3 columns, merged groups of 3 cols each)
  allRows.push(['LIE / END POSITION REFERENCE']);
  allRows.push(['What happened', '', '', 'What to write in  End Lie/Putts', '', '', 'What to write in  Distance left']);
  allRows.push(['Ball in fairway',               '', '', 'fairway  /  fw',                '', '', 'yards remaining  e.g.  140']);
  allRows.push(['Ball in rough (left / right)',  '', '', 'rough  /  l rough  /  r rough', '', '', 'yards remaining  e.g.  95']);
  allRows.push(['Ball in bunker / sand',         '', '', 'bunker  /  sand  /  gs bunker', '', '', 'yards remaining  e.g.  30']);
  allRows.push(['Ball on the green',             '', '', 'green',                         '', '', 'feet from hole  e.g.  22 ft']);
  allRows.push(['Penalty — water / OB',          '', '', 'water  /  penalty  /  OB',      '', '', 'yards after drop  e.g.  180']);
  allRows.push(['Last shot — made the putt',     '', '', 'hole  /  holed',                '', '', '(leave blank)']);
  allRows.push(['One putt, feet still left',     '', '', 'putt',                          '', '', 'feet remaining  e.g.  4ft']);
  allRows.push(['Two putts remaining',           '', '', '2 putts',                       '', '', '(leave blank)']);
  allRows.push(['Three putts remaining',         '', '', '3 putts',                       '', '', '(leave blank)']);
  allRows.push([]);
  allRows.push(['9-hole rounds: fill Front 9 only. Leave Back 9 blank.']);
  allRows.push(['Date format: MM/DD/YYYY  e.g.  03/15/2026']);
  allRows.push(['Handicap options: pro  0  5  10  15  20  25  30']);

  var ws = XLSX.utils.aoa_to_sheet(allRows);

  // Column widths: 9 holes × 3 cols + 3 Total = 30 cols
  var cols = [];
  for (var hi = 0; hi < 9; hi++) { cols.push({wch:9}); cols.push({wch:16}); cols.push({wch:14}); }
  cols.push({wch:8}); cols.push({wch:10}); cols.push({wch:8});
  ws['!cols'] = cols;

  // ---- Apply styles ----

  // Info rows 0-5
  for (var r = 0; r < 6; r++) { sc(ws, r, 0, LBL); sc(ws, r, 1, INFL); }

  // Front 9 (F9_START=7) and Back 9 (B9_START=23)
  var F9 = 7, B9 = 23;
  [F9, B9].forEach(function(secStart) {
    var hRow  = secStart,     pRow  = secStart + 1,
        sRow  = secStart + 2, yRow  = secStart + 3,
        shRow = secStart + 4;

    for (var hi = 0; hi < 9; hi++) {
      var b = hi * 3;
      // Hole header
      sc(ws, hRow, b, HDR); sc(ws, hRow, b+1, HDR); sc(ws, hRow, b+2, HDR);
      // Par
      sc(ws, pRow, b, HDR2); sc(ws, pRow, b+1, INP); sc(ws, pRow, b+2, BRD);
      // Score
      sc(ws, sRow, b, HDR2); sc(ws, sRow, b+1, INP); sc(ws, sRow, b+2, BRD);
      // Yardage
      sc(ws, yRow, b, HDR2); sc(ws, yRow, b+1, INP); sc(ws, yRow, b+2, BRD);
      // Shot column headers
      sc(ws, shRow, b, HDR2); sc(ws, shRow, b+1, HDR2); sc(ws, shRow, b+2, HDR2);
      // Shot data rows
      for (var sr = 0; sr < 9; sr++) {
        sc(ws, secStart+5+sr, b,   SHT);
        sc(ws, secStart+5+sr, b+1, SINP);
        sc(ws, secStart+5+sr, b+2, SINP);
      }
    }
    // Total col (27)
    sc(ws, hRow, 27, HDR);
    sc(ws, pRow, 27, HDR2); sc(ws, pRow, 28, TTL);
    sc(ws, sRow, 27, HDR2); sc(ws, sRow, 28, TTL);
    sc(ws, yRow, 27, BRD);
    sc(ws, shRow, 27, BRD);
  });

  // ---- Reference guide: merge cols 0-2, 3-5, 6-8 per row ----
  ws['!merges'] = [];
  ws['!merges'].push({s:{r:38,c:0}, e:{r:38,c:29}}); // title spans full width
  for (var refRow = 39; refRow <= 48; refRow++) {
    ws['!merges'].push({s:{r:refRow,c:0}, e:{r:refRow,c:2}});  // "What happened"
    ws['!merges'].push({s:{r:refRow,c:3}, e:{r:refRow,c:5}});  // "End Lie" value
    ws['!merges'].push({s:{r:refRow,c:6}, e:{r:refRow,c:8}});  // "Distance" value
  }

  var REFT = {fill:{fgColor:{rgb:'F1F8E9'}}, font:{bold:true,sz:12,color:{rgb:'1A5C32'}}, alignment:{horizontal:'left',vertical:'center'}};
  var REFH = {fill:{fgColor:{rgb:'E8F5E9'}}, font:{bold:true,color:{rgb:'1A5C32'}}, border:TN2, alignment:{horizontal:'center',vertical:'center',wrapText:true}};
  var REFD = {border:TN, alignment:{horizontal:'left',vertical:'center',wrapText:true}};
  var REFV = {fill:{fgColor:{rgb:'F0FFF0'}}, font:{bold:true,color:{rgb:'1A5C32'}}, border:TN, alignment:{horizontal:'left',vertical:'center',wrapText:true}};
  sc(ws, 38, 0, REFT);
  sc(ws, 39, 0, REFH); sc(ws, 39, 3, REFH); sc(ws, 39, 6, REFH);
  for (var r = 40; r <= 48; r++) {
    sc(ws, r, 0, REFD);   // "What happened" — plain
    sc(ws, r, 3, REFV);   // "End Lie value" — green bold
    sc(ws, r, 6, REFD);   // "Distance" — plain
  }

  // Row heights for reference section
  ws['!rows'] = [];
  ws['!rows'][38] = {hpt:22}; ws['!rows'][39] = {hpt:28};
  for (var r = 40; r <= 48; r++) ws['!rows'][r] = {hpt:22};

  // ---- Dropdowns for End Lie/Putts cells ----
  // Lie column for hole hi is at col hi*3+1
  // Front 9 shot rows: 12-20 (0-indexed) = Excel rows 13-21
  // Back 9 shot rows:  28-36 (0-indexed) = Excel rows 29-37
  var lieList = '"fairway,fw,l rough,r rough,rough,bunker,sand,gs bunker,green,water,penalty,OB,putt,2 putts,3 putts,hole,holed"';
  var lieLetters = ['B','E','H','K','N','Q','T','W','Z'];
  var sqrefParts = [];
  for (var hi = 0; hi < 9; hi++) sqrefParts.push(lieLetters[hi] + '13:' + lieLetters[hi] + '21');
  for (var hi = 0; hi < 9; hi++) sqrefParts.push(lieLetters[hi] + '29:' + lieLetters[hi] + '37');
  ws['!dataValidation'] = [{
    type: 'list',
    sqref: sqrefParts.join(' '),
    formula1: lieList,
    showDropDown: false,
    showErrorMessage: false
  }];

  XLSX.utils.book_append_sheet(wb, ws, 'Scorecard');
  XLSX.writeFile(wb, 'Round_Template.xlsx');
}

// Functions called from inline HTML handlers
expose({ handleRoundUpload, downloadRoundTemplate });
