import { fillHoleByHoleForm, fillSimpleForm } from './form-fill.js';
import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { showAuthPage } from '../auth/auth.js';
import { onEnter, show } from '../core/router.js';
import { activeUserId } from '../core/session.js';
import { _sb } from '../core/supabase.js';
import { formatDateForDisplay, getTodayCentral } from '../core/util.js';
import { buildHoleByHoleForm, hbhAddShot, hbhLieChanged, hbhSetPar } from './hole-entry.js';
import { hidePhotoNotices, resetRoundState, setEntryMode } from './setup.js';
import { buildSimpleForm } from './simple-entry.js';
import { renderSummary } from './summary.js';

function buildRoundBlob() {
  return {
    entryMode: S.entryMode || 'shot',
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
}

// Save round to Supabase
// Auto-save round when completed (if logged in)
export async function autoSaveRound() {
  if (!S.currentUser || S.allHoles.length === 0) return;
  
  const status = document.getElementById('saveStatus');
  status.textContent = 'Auto-saving...';
  status.style.color = '#606060';
  
  const roundBlob = buildRoundBlob();

  const playerName = document.getElementById('playerName').value || 'Player';
  const courseName = document.getElementById('courseName').value || 'Course';
  const roundDate = document.getElementById('roundDate').value || getTodayCentral();

  // Clear incomplete flag from round_data if present
  delete roundBlob.incomplete;
  delete roundBlob._flagIncomplete;

  var payload = {
    player_name: playerName,
    course_name: courseName,
    round_date: roundDate,
    round_type: document.getElementById('roundType').value || 'Casual',
    tournament_place: document.getElementById('roundType').value === 'Tournament' ? (parseInt(document.getElementById('tournamentPlace').value) || null) : null,
    handicap: document.getElementById('playerHandicap').value || 'pro',
    holes: S.allHoles.length,
    score: S.totalStrokes,
    par: S.totalPar,
    to_par: S.totalStrokes - S.totalPar,
    round_data: roundBlob,
    is_incomplete: false
  };

  var resp;
  if (S.currentRoundId) {
    // Completing a previously incomplete round — update it
    resp = await _sb.from('rounds').update(payload).eq('id', S.currentRoundId).select();
  } else {
    payload.user_id = activeUserId();
    resp = await _sb.from('rounds').insert(payload).select();
  }

  // If is_incomplete column doesn't exist, retry without it
  if (resp.error && resp.error.message && resp.error.message.indexOf('is_incomplete') !== -1) {
    delete payload.is_incomplete;
    if (S.currentRoundId) {
      resp = await _sb.from('rounds').update(payload).eq('id', S.currentRoundId).select();
    } else {
      payload.user_id = activeUserId();
      resp = await _sb.from('rounds').insert(payload).select();
    }
  }

  // If tournament_place column doesn't exist yet, retry without it
  if (resp.error && resp.error.message && resp.error.message.indexOf('tournament_place') !== -1) {
    delete payload.tournament_place;
    if (S.currentRoundId) {
      resp = await _sb.from('rounds').update(payload).eq('id', S.currentRoundId).select();
    } else {
      resp = await _sb.from('rounds').insert(payload).select();
    }
  }

  var data = resp.data;
  var error = resp.error;

  if (error) {
    status.style.color = '#d4706e';
    status.textContent = 'Auto-save failed';
    console.error('Auto-save error:', error);
  } else {
    if (data && data[0]) S.currentRoundId = data[0].id;
    status.style.color = '#00b87a';
    status.textContent = '✓ Round auto-saved!';
    // Hide save button since already saved
    var saveBtn = document.getElementById('saveToAccountBtn');
    if (saveBtn) saveBtn.style.display = 'none';
    // Notify coach if student
    notifyCoachOfNewRound(playerName, courseName, roundDate, S.totalStrokes, S.totalPar, S.currentRoundId);
  }
}

// ─── SAVE & FINISH LATER / END ROUND EARLY ────────────────
// Show/hide the End Round / Save & Finish Later buttons on parPage
export function updateParPageRoundActions() {
  var el = document.getElementById('parPageRoundActions');
  if (el) el.style.display = (S.allHoles.length > 0 && S.currentUser) ? 'block' : 'none';
}

// End Round Early (shot-by-shot mode) — submits only the holes completed so far
function endRoundEarly() {
  if (S.allHoles.length === 0) { alert('Complete at least one hole before ending the round.'); return; }
  if (!confirm('End round after ' + S.allHoles.length + ' hole' + (S.allHoles.length > 1 ? 's' : '') + '? This will save your round as a completed ' + S.allHoles.length + '-hole round.')) return;

  // Adjust totalHoles to match what was actually played
  S.totalHoles = S.allHoles.length;

  scoreBar.style.display = 'none';
  renderSummary();
  document.getElementById('backToRoundsBtn').style.display = 'none';
  document.getElementById('saveStatus').textContent = '';
  S.viewingStudentRound = false;
  var saveBtn = document.getElementById('saveToAccountBtn');
  if (saveBtn) saveBtn.style.display = S.currentUser ? '' : 'none';
  show('summaryPage');

  if (S.currentUser && S.allHoles.length > 0) {
    autoSaveRound();
  }
}

// Save & Finish Later (shot-by-shot mode) — saves incomplete round to DB
async function saveRoundForLater() {
  if (!S.currentUser) { alert('Please log in to save rounds.'); showAuthPage(); return; }
  if (S.allHoles.length === 0) { alert('Complete at least one hole before saving.'); return; }
  if (!confirm('Save your progress (' + S.allHoles.length + ' of ' + S.totalHoles + ' holes) and finish later?')) return;

  await saveIncompleteRound();
}

// Save & Finish Later (hole-by-hole mode) — saves partial hole-by-hole entry
async function saveHoleByHoleForLater() {
  if (!S.currentUser) { alert('Please log in to save rounds.'); showAuthPage(); return; }

  // Gather whatever holes have data entered
  var partialHoles = [];
  for (var h = 1; h <= S.totalHoles; h++) {
    var shotsContainer = document.getElementById('hbh_shots_' + h);
    if (!shotsContainer) continue;
    var shotEls = shotsContainer.querySelectorAll('[id^="hbh_shot_' + h + '_"]');
    var hasShot = false;
    for (var s = 0; s < shotEls.length; s++) {
      var lieEl = document.getElementById('hbh_lie_' + h + '_' + (s + 1));
      if (lieEl && lieEl.value) { hasShot = true; break; }
    }
    if (hasShot) partialHoles.push(h);
  }
  if (partialHoles.length === 0) { alert('Enter at least one hole before saving.'); return; }
  if (!confirm('Save your progress (' + partialHoles.length + ' of ' + S.totalHoles + ' holes entered) and finish later?')) return;

  // Build partial blob from HBH form
  var hbhFormData = [];
  for (var h = 1; h <= S.totalHoles; h++) {
    var card = document.getElementById('hbh_hole_' + h);
    if (!card) continue;
    var parVal = parseInt(card.dataset.par) || 4;
    var yardsEl = document.getElementById('hbh_yards_' + h);
    var yardsVal = yardsEl ? parseInt(yardsEl.value) || 0 : 0;
    var shotsContainer = document.getElementById('hbh_shots_' + h);
    var shotEls = shotsContainer ? shotsContainer.querySelectorAll('[id^="hbh_shot_' + h + '_"]') : [];
    var shotsArr = [];
    for (var s = 0; s < shotEls.length; s++) {
      var sNum = s + 1;
      var lieEl = document.getElementById('hbh_lie_' + h + '_' + sNum);
      var distEl = document.getElementById('hbh_dist_' + h + '_' + sNum);
      shotsArr.push({
        lie: lieEl ? lieEl.value : '',
        dist: distEl ? distEl.value : ''
      });
    }
    hbhFormData.push({ hole: h, par: parVal, yards: yardsVal, shots: shotsArr });
  }

  await saveIncompleteRound(hbhFormData);
}

// Core function to save an incomplete round to Supabase
export async function saveIncompleteRound(hbhFormData, simpleFormData) {
  var playerNameVal = document.getElementById('playerName').value || 'Player';
  var courseNameVal = document.getElementById('courseName').value || 'Course';
  var roundDateVal = document.getElementById('roundDate').value || getTodayCentral();
  var holesCompleted = S.allHoles.length;

  // Build the partial round blob
  var roundBlob;
  if (simpleFormData) {
    // Simple mode — store form state for resuming
    var enteredCount = simpleFormData.filter(function(h) { return h.score > 0; }).length;
    roundBlob = {
      allHoles: [], stats: {}, incomplete: true,
      entryMode: 'simple', totalHoles: S.totalHoles,
      holesCompleted: enteredCount,
      simpleFormData: simpleFormData
    };
    holesCompleted = enteredCount;
  } else if (hbhFormData) {
    // Hole-by-hole mode — store form state for resuming
    roundBlob = {
      allHoles: [],
      stats: {},
      incomplete: true,
      entryMode: 'hole',
      totalHoles: S.totalHoles,
      holesCompleted: 0,
      hbhFormData: hbhFormData
    };
    holesCompleted = 0; // no fully-processed holes yet in HBH save-for-later
    // Count how many holes have at least one shot entered
    var enteredCount = hbhFormData.filter(function(h) { return h.shots.some(function(s) { return s.lie; }); }).length;
    roundBlob.holesCompleted = enteredCount;
    holesCompleted = enteredCount;
  } else {
    // Shot-by-shot mode — save processed holes
    roundBlob = buildRoundBlob();
    roundBlob.incomplete = true;
    roundBlob.entryMode = 'shot';
    roundBlob.totalHoles = S.totalHoles;
    roundBlob.holesCompleted = S.allHoles.length;
    // Save course data for resuming
    if (S.selectedCourse) roundBlob._selectedCourse = S.selectedCourse;
    if (S.selectedTee) roundBlob._selectedTee = S.selectedTee;
    if (S.courseHoleData) roundBlob._courseHoleData = S.courseHoleData;
  }

  var payload = {
    user_id: activeUserId(),
    player_name: playerNameVal,
    course_name: courseNameVal,
    round_date: roundDateVal,
    round_type: document.getElementById('roundType').value || 'Casual',
    tournament_place: document.getElementById('roundType').value === 'Tournament' ? (parseInt(document.getElementById('tournamentPlace').value) || null) : null,
    handicap: document.getElementById('playerHandicap').value || 'pro',
    holes: S.totalHoles,
    score: S.totalStrokes || 0,
    par: S.totalPar || 0,
    to_par: (S.totalStrokes || 0) - (S.totalPar || 0),
    round_data: roundBlob,
    is_incomplete: true
  };

  var resp;
  if (S.currentRoundId) {
    resp = await _sb.from('rounds').update(payload).eq('id', S.currentRoundId);
  } else {
    resp = await _sb.from('rounds').insert(payload).select();
  }

  if (resp.error) {
    // If is_incomplete column doesn't exist, save without it
    delete payload.is_incomplete;
    roundBlob._flagIncomplete = true;
    payload.round_data = roundBlob;
    if (S.currentRoundId) {
      resp = await _sb.from('rounds').update(payload).eq('id', S.currentRoundId);
    } else {
      resp = await _sb.from('rounds').insert(payload).select();
    }
  }

  if (resp.error) {
    alert('Error saving: ' + resp.error.message);
  } else {
    if (resp.data && resp.data[0]) S.currentRoundId = resp.data[0].id;
    alert('Round saved! You can resume it from Round History.');
    scoreBar.style.display = 'none';
    show('homePage');
  }
}

// Resume an incomplete round from round history
async function resumeIncompleteRound(roundId) {
  var msg = document.getElementById('roundsListMsg');
  if (msg) msg.textContent = 'Loading round...';

  var { data, error } = await _sb.from('rounds').select('*').eq('id', roundId).single();
  if (error || !data) { if (msg) msg.textContent = 'Error loading round'; return; }

  var rd = data.round_data;
  if (!rd) { if (msg) msg.textContent = 'Round data is empty'; return; }

  // Reset state
  resetRoundState();
  S.currentRoundId = data.id;

  // Restore round metadata
  document.getElementById('playerName').value = data.player_name || '';
  document.getElementById('courseName').value = data.course_name || '';
  document.getElementById('roundDate').value = data.round_date || getTodayCentral();
  document.getElementById('roundType').value = data.round_type || 'Casual';
  document.getElementById('playerHandicap').value = data.handicap || 'pro';

  S.totalHoles = rd.totalHoles || data.holes || 9;

  var cLabel = document.getElementById('courseLabel');
  if (cLabel) cLabel.innerText = data.course_name || '';

  hidePhotoNotices();
  if (rd.entryMode === 'simple' && rd.simpleFormData) {
    // Resume simple mode
    S.entryMode = 'simple';
    setEntryMode('simple');
    var customHolesEl = document.getElementById('customHoles');
    if (customHolesEl) customHolesEl.value = S.totalHoles;
    buildSimpleForm();
    var sCN = document.getElementById('simplCourseName');
    if (sCN) { sCN.innerText = data.course_name || ''; sCN.style.display = data.course_name ? 'block' : 'none'; }
    fillSimpleForm(rd.simpleFormData);
    show('simpleEntryPage');
  } else if (rd.entryMode === 'hole' && rd.hbhFormData) {
    // Resume hole-by-hole mode
    S.entryMode = 'hole';
    setEntryMode('hole');
    var customHolesEl = document.getElementById('customHoles');
    if (customHolesEl) customHolesEl.value = S.totalHoles;

    // Build the form then populate it
    buildHoleByHoleForm();

    var hbhCN = document.getElementById('hbhCourseName');
    if (hbhCN) { hbhCN.innerText = data.course_name || ''; hbhCN.style.display = data.course_name ? 'block' : 'none'; }

    fillHoleByHoleForm(rd.hbhFormData);

    show('holeByHolePage');
  } else {
    // Resume shot-by-shot mode
    S.entryMode = 'shot';
    setEntryMode('shot');

    // Restore course data if available
    if (rd._selectedCourse) S.selectedCourse = rd._selectedCourse;
    if (rd._selectedTee) S.selectedTee = rd._selectedTee;
    if (rd._courseHoleData) S.courseHoleData = rd._courseHoleData;

    // Restore completed holes
    if (rd.allHoles && rd.allHoles.length > 0) {
      S.allHoles = rd.allHoles;
      // Recalculate aggregates from restored holes
      S.allHoles.forEach(function(h) {
        S.totalStrokes += h.score;
        S.totalPar += h.par;
        S.totalPutts += h.putts || 0;
        if (h.par === 3) { S.c3++; S.p3 += h.score; }
        if (h.par === 4) { S.c4++; S.p4 += h.score; }
        if (h.par === 5) { S.c5++; S.p5 += h.score; }
      });
    }

    S.currentHole = S.allHoles.length + 1;
    document.getElementById('holeHeader').innerText = 'Hole ' + S.currentHole;

    // Auto-populate par/yardage for next hole if course data available
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

    // Update score bar
    if (S.totalStrokes > 0 || S.totalPar > 0) {
      var d = S.totalStrokes - S.totalPar;
      document.getElementById('scoreBarText').innerText = d === 0 ? 'E through ' + (S.currentHole - 1) : (d > 0 ? '+' : '') + d + ' through ' + (S.currentHole - 1);
    }

    scoreBar.style.display = 'flex';
    show('parPage');
    updateParPageRoundActions();
  }
}

// Check if a round is incomplete (works with or without is_incomplete column)
export function isRoundIncomplete(round) {
  if (round.is_incomplete) return true;
  if (round.round_data && (round.round_data.incomplete || round.round_data._flagIncomplete)) return true;
  return false;
}

// Notify coach when student uploads a round
async function notifyCoachOfNewRound(playerName, courseName, roundDate, score, par, roundId) {
  // Check if user is a student with a coach
  if (!S.currentUser) return;

  try {
    var { data: profile } = await _sb
      .from('profiles')
      .select('coach_id, role')
      .eq('id', S.currentUser.id)
      .single();

    var coachId = profile && profile.coach_id ? profile.coach_id : null;

    // Fallback: check coach_students table if coach_id not on profile
    if (!coachId) {
      var { data: link } = await _sb.from('coach_students').select('coach_id').eq('student_id', S.currentUser.id).limit(1);
      if (link && link.length > 0) {
        coachId = link[0].coach_id;
        // Fix the missing coach_id on profile
        await _sb.from('profiles').update({ coach_id: coachId }).eq('id', S.currentUser.id);
      }
    }

    if (!coachId) { console.log('[notify] No coach found for round notification'); return; }

    var toPar = score - par;
    var toParStr = toPar === 0 ? 'E' : (toPar > 0 ? '+' : '') + toPar;

    // Store notification in database for coach to see
    var { error: insertErr } = await _sb.from('notifications').insert({
      user_id: coachId,
      type: 'new_round',
      title: 'New Round from ' + playerName,
      message: playerName + ' shot ' + score + ' (' + toParStr + ') at ' + courseName + ' on ' + formatDateForDisplay(roundDate),
      student_id: S.currentUser.id,
      student_name: playerName,
      round_id: roundId || null,
      read: false,
      created_at: new Date().toISOString()
    });
    if (insertErr) {
      console.warn('[notify] Round notification insert failed:', insertErr.message, '— retrying without round_id');
      // Fallback 1: drop round_id (column may not exist yet) but keep student fields so View Profile still works
      var { error: retryErr } = await _sb.from('notifications').insert({
        user_id: coachId,
        type: 'new_round',
        title: 'New Round from ' + playerName,
        message: playerName + ' shot ' + score + ' (' + toParStr + ') at ' + courseName + ' on ' + formatDateForDisplay(roundDate),
        student_id: S.currentUser.id,
        student_name: playerName,
        read: false,
        created_at: new Date().toISOString()
      });
      if (retryErr) {
        console.warn('[notify] Round notification retry failed:', retryErr.message, '— retrying without student fields');
        // Fallback 2: drop student fields too in case those columns don't exist
        var { error: retryErr2 } = await _sb.from('notifications').insert({
          user_id: coachId,
          type: 'new_round',
          title: 'New Round from ' + playerName,
          message: playerName + ' shot ' + score + ' (' + toParStr + ') at ' + courseName + ' on ' + formatDateForDisplay(roundDate),
          read: false,
          created_at: new Date().toISOString()
        });
        if (retryErr2) console.error('[notify] Round notification retry also failed:', retryErr2.message);
      }
    }
  } catch(e) { console.error('[notify] Round notification exception:', e); }
}

async function saveRoundToAccount() {
  if (!S.currentUser) {
    alert('Please log in first to save rounds.');
    showAuthPage();
    return;
  }
  
  const status = document.getElementById('saveStatus');
  status.textContent = 'Saving...';
  status.style.color = '#606060';
  
  const roundBlob = buildRoundBlob();
  // Clear incomplete flags
  delete roundBlob.incomplete;
  delete roundBlob._flagIncomplete;

  var payload = {
    player_name: document.getElementById('playerName').value || 'Player',
    course_name: document.getElementById('courseName').value || 'Course',
    round_date: document.getElementById('roundDate').value || getTodayCentral(),
    round_type: document.getElementById('roundType').value || 'Casual',
    tournament_place: document.getElementById('roundType').value === 'Tournament' ? (parseInt(document.getElementById('tournamentPlace').value) || null) : null,
    handicap: document.getElementById('playerHandicap').value || 'pro',
    holes: S.allHoles.length,
    score: S.totalStrokes,
    par: S.totalPar,
    to_par: S.totalStrokes - S.totalPar,
    round_data: roundBlob,
    is_incomplete: false
  };

  var resp;
  if (S.currentRoundId) {
    // Update existing round
    resp = await _sb.from('rounds').update(payload).eq('id', S.currentRoundId);
  } else {
    // Insert new round
    payload.user_id = activeUserId();
    resp = await _sb.from('rounds').insert(payload);
  }

  // If is_incomplete column doesn't exist, retry without it
  if (resp.error && resp.error.message && resp.error.message.indexOf('is_incomplete') !== -1) {
    delete payload.is_incomplete;
    if (S.currentRoundId) {
      resp = await _sb.from('rounds').update(payload).eq('id', S.currentRoundId);
    } else {
      resp = await _sb.from('rounds').insert(payload);
    }
  }

  if (resp.error) {
    status.style.color = '#d4706e';
    status.textContent = 'Error: ' + resp.error.message;
  } else {
    status.style.color = '#00b87a';
    status.textContent = S.currentRoundId ? '✓ Round updated!' : '✓ Round saved to your account!';
  }
}

onEnter('parPage', updateParPageRoundActions);

// Functions called from inline HTML handlers
expose({ endRoundEarly, saveRoundForLater, saveHoleByHoleForLater, resumeIncompleteRound, saveRoundToAccount });
