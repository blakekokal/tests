import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { showAuthPage } from '../auth/auth.js';
import { showStudentTab } from '../coaching/student-view.js';
import { onBack, show } from '../core/router.js';
import { goToRoundHistory } from '../home/home.js';
import { _viewingAsStudent, activeUserId, enterStudentView } from '../core/session.js';
import { _sb } from '../core/supabase.js';
import { ordinalSuffix } from '../core/util.js';
import { isRoundIncomplete } from './save.js';
import { recalculateAllSG } from './sg-recalc.js';
import { renderSummary } from './summary.js';
import { showFullStats } from '../stats/full-stats.js';

function goBackFromRoundView() {
  var btrBtn = document.getElementById('backToRoundsBtn');
  if (btrBtn && btrBtn.style.display !== 'none') {
    goBackFromRound();
  } else {
    var activePage = document.querySelector('.page.active');
    var activeId = activePage ? activePage.id : '';
    if (activeId === 'fullStatsPage') {
      show('summaryPage');
    } else {
      show('homePage');
    }
  }
}

// Load My Rounds
export var _allRoundsData = null;

export async function loadMyRounds() {
  if (!S.currentUser) { showAuthPage(); return; }
  
  const msg = document.getElementById('roundsListMsg');
  const list = document.getElementById('roundsList');
  msg.textContent = 'Loading...';
  list.innerHTML = '';
  
  var { data, error } = await _sb
    .from('rounds')
    .select('*')
    .eq('user_id', activeUserId())
    .order('round_date', { ascending: false });

  // Fallback if is_incomplete column doesn't exist
  if (error && error.message && error.message.indexOf('is_incomplete') !== -1) {
    var resp2 = await _sb.from('rounds')
      .select('*')
      .eq('user_id', activeUserId())
      .order('round_date', { ascending: false });
    data = resp2.data;
    error = resp2.error;
  }

  if (error) {
    msg.textContent = 'Error: ' + error.message;
    return;
  }

  _allRoundsData = data || [];
  
  if (_allRoundsData.length === 0) {
    msg.textContent = 'No saved rounds yet. Complete a round and tap "Save to Account".';
    return;
  }
  
  // Reset filters
  document.getElementById('roundSearchInput').value = '';
  document.getElementById('roundFilterType').value = 'all';
  document.getElementById('roundFilterHoles').value = 'all';
  document.getElementById('roundFilterTime').value = 'all';
  document.getElementById('roundSortBy').value = 'date-desc';
  if (document.getElementById('roundFilterStatus')) document.getElementById('roundFilterStatus').value = 'all';

  filterRoundsList();
}

function filterRoundsList() {
  if (!_allRoundsData) return;
  
  var search = (document.getElementById('roundSearchInput').value || '').toLowerCase().trim();
  var typeFilter = document.getElementById('roundFilterType').value;
  var holesFilter = document.getElementById('roundFilterHoles').value;
  var timeFilter = document.getElementById('roundFilterTime').value;
  var statusFilter = document.getElementById('roundFilterStatus') ? document.getElementById('roundFilterStatus').value : 'all';
  var sortBy = document.getElementById('roundSortBy').value;
  
  var cutoff = null;
  if (timeFilter !== 'all') {
    cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - parseInt(timeFilter));
  }
  
  var filtered = _allRoundsData.filter(function(r) {
    // Search by course name or date
    if (search) {
      var courseLower = (r.course_name || '').toLowerCase();
      var dateLower = (r.round_date || '').toLowerCase();
      if (courseLower.indexOf(search) === -1 && dateLower.indexOf(search) === -1) return false;
    }
    // Type filter
    if (typeFilter !== 'all' && r.round_type !== typeFilter) return false;
    // Holes filter
    if (holesFilter !== 'all' && r.holes !== parseInt(holesFilter)) return false;
    // Status filter
    if (statusFilter === 'complete' && isRoundIncomplete(r)) return false;
    if (statusFilter === 'incomplete' && !isRoundIncomplete(r)) return false;
    // Time filter
    if (cutoff) {
      var rd = new Date(r.round_date + 'T12:00:00');
      if (rd < cutoff) return false;
    }
    return true;
  });
  
  // Sort the filtered results
  filtered.sort(function(a, b) {
    if (sortBy === 'date-desc') {
      return new Date(b.round_date) - new Date(a.round_date);
    } else if (sortBy === 'date-asc') {
      return new Date(a.round_date) - new Date(b.round_date);
    } else if (sortBy === 'score-asc') {
      return a.score - b.score;
    } else if (sortBy === 'score-desc') {
      return b.score - a.score;
    }
    return 0;
  });
  
  var msg = document.getElementById('roundsListMsg');
  var list = document.getElementById('roundsList');
  var filtMsg = document.getElementById('roundsFilteredMsg');
  list.innerHTML = '';
  
  msg.textContent = filtered.length + ' of ' + _allRoundsData.length + ' round(s)';
  filtMsg.textContent = filtered.length < _allRoundsData.length ? 'Filters active' : '';
  
  if (filtered.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:#2e2e2e;padding:16px;font-size:13px;">No rounds match your filters</div>';
    return;
  }
  
  filtered.forEach(function(r) {
    var incomplete = isRoundIncomplete(r);
    var tp = r.to_par > 0 ? '+' + r.to_par : r.to_par === 0 ? 'E' : r.to_par;
    var d = new Date(r.round_date + 'T12:00:00');
    var dateStr = (d.getMonth()+1) + '/' + d.getDate() + '/' + d.getFullYear();
    var placeStr = (r.round_type === 'Tournament' && r.tournament_place) ? ' — ' + ordinalSuffix(r.tournament_place) + ' Place' : '';
    var typeTag = r.round_type === 'Tournament' ? '<div style="color:#f0c830;font-size:11px;font-weight:700;margin-top:2px;">★ Tournament' + placeStr + '</div>' : '';
    var incompleteTag = incomplete ? '<span style="color:#f0c830;font-size:10px;font-weight:700;"> ⏸ In Progress</span>' : '';

    // For incomplete rounds, show holes completed info
    var holesCompleted = 0;
    if (incomplete && r.round_data) {
      holesCompleted = r.round_data.holesCompleted || (r.round_data.allHoles ? r.round_data.allHoles.length : 0);
    }
    var holesInfo = incomplete ? holesCompleted + '/' + r.holes + ' holes' : r.holes + ' holes';

    var card = document.createElement('div');
    card.style.cssText = 'background:#282828;border-radius:10px;padding:12px;margin:6px 0;cursor:pointer;' + (incomplete ? 'border-left:3px solid #d4706e;' : '');
    card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;">'
      + '<div style="text-align:left;">'
      + '<div style="font-weight:700;font-size:15px;">' + r.course_name + incompleteTag + '</div>'
      + typeTag
      + '<div style="font-size:12px;color:#9a9a9a;">' + dateStr + ' · ' + holesInfo + ' · ' + r.player_name + '</div>'
      + '</div>'
      + '<div style="text-align:right;">'
      + (incomplete ? '<div style="font-size:14px;font-weight:700;color:#f0c830;">In Progress</div>' : '<div style="font-size:20px;font-weight:800;">' + r.score + '</div>')
      + (incomplete ? '' : '<div style="font-size:13px;color:' + (r.to_par>0?'#d4706e':r.to_par<0?'#00a06d':'#9a9a9a') + '">' + tp + '</div>')
      + '</div></div>'
      + '<div style="display:flex;gap:6px;margin-top:8px;">'
      + (incomplete
        ? '<button onclick="event.stopPropagation();resumeIncompleteRound(\'' + r.id + '\')" style="flex:2;height:34px;font-size:13px;font-weight:700;background:#d4706e;border:none;border-radius:6px;color:#ffffff;cursor:pointer;">▶ Resume Round</button>'
          + '<button onclick="event.stopPropagation();deleteSavedRound(\'' + r.id + '\',this)" style="width:60px;height:34px;font-size:12px;background:#e06060;border:none;border-radius:6px;color:#ffffff;cursor:pointer;">Del</button>'
        : '<button onclick=\"event.stopPropagation();openEditRoundInfo(\'' + r.id + '\', event)\" style=\"flex:1;height:30px;font-size:12px;background:#007a52;border-radius:6px;font-weight:700;margin-right:4px;\">Edit</button>'
          + '<button onclick="event.stopPropagation();viewSavedRound(\'' + r.id + '\')" style="flex:1;height:30px;font-size:12px;background:#2d7abc;border-radius:6px;">Stats</button>'
          + '<button onclick="event.stopPropagation();downloadSavedRound(\'' + r.id + '\',this)" style="width:50px;height:30px;font-size:12px;background:#00402c;border-radius:6px;">📥</button>'
          + '<button onclick="event.stopPropagation();deleteSavedRound(\'' + r.id + '\',this)" style="width:50px;height:30px;font-size:12px;background:#e06060;border-radius:6px;">Del</button>'
      )
      + '</div>';
    list.appendChild(card);
  });
}

async function viewSavedRound(roundId) {
  const msg = document.getElementById('roundsListMsg');
  msg.textContent = 'Loading round...';
  
  const { data, error } = await _sb
    .from('rounds')
    .select('*')
    .eq('id', roundId)
    .single();
  
  if (error || !data) {
    msg.textContent = 'Error loading round';
    return;
  }
  
  // Restore the round into the app
  const rd = data.round_data;
  if (!rd || !rd.allHoles || rd.allHoles.length === 0) {
    msg.textContent = 'Round data is empty';
    return;
  }
  
  // Set metadata
  document.getElementById('playerName').value = data.player_name;
  document.getElementById('courseName').value = data.course_name;
  document.getElementById('roundDate').value = data.round_date;
  document.getElementById('roundType').value = data.round_type || 'Casual';
  // Use user's saved handicap preference, not the round's saved handicap
  var userHcp = S.currentUser?.user_metadata?.hcp_preference || 'pro';
  if (_viewingAsStudent) {
    try {
      var { data: _hp } = await _sb.from('profiles').select('hcp_preference').eq('id', _viewingAsStudent.id).single();
      if (_hp && _hp.hcp_preference) userHcp = _hp.hcp_preference;
    } catch(e) {}
  }
  document.getElementById('playerHandicap').value = userHcp;

  // Restore hole data
  S.allHoles = rd.allHoles;
  S.totalHoles = data.holes;
  
  // Recalculate ALL aggregates from hole data
  S.totalStrokes = 0; S.totalPar = 0; S.totalPutts = 0;
  S.fwHit = 0; S.fwOpp = 0; S.fwLeft = 0; S.fwRight = 0;
  S.gir = 0; S.girOpp = 0; S.girFirstPuttDist = 0; S.girPutts = 0;
  S.scr = 0; S.scrOpp = 0;
  S.bun = 0; S.bunOpp = 0;
  S.onePuttMade = 0; S.onePuttOpp = 0; S.threePlusPutts = 0;
  S.p3 = 0; S.c3 = 0; S.p4 = 0; S.c4 = 0; S.p5 = 0; S.c5 = 0;
  S.missLeft = 0; S.missRight = 0; S.missShort = 0; S.missLong = 0;
  
  S.allHoles.forEach(h => {
    S.totalStrokes += h.score;
    S.totalPar += h.par;
    S.totalPutts += h.putts || 0;
    S.onePuttOpp += 1;
    
    // Par averages
    if (h.par === 3) { S.c3++; S.p3 += h.score; }
    if (h.par === 4) { S.c4++; S.p4 += h.score; }
    if (h.par === 5) { S.c5++; S.p5 += h.score; }
    
    // Putting
    if ((h.putts || 0) === 1) S.onePuttMade++;
    if ((h.putts || 0) >= 3) S.threePlusPutts++;
    
    // GIR + first putt distance - only count if this was actually a GIR
    // GIR = hit green in par - 2 shots or fewer
    var shotsToGreen = 0;
    for (var si = 0; si < (h.shots || []).length; si++) {
      var shot = h.shots[si];
      if (shot.isPutt) break;
      shotsToGreen++;
    }
    var isGIR = shotsToGreen <= (h.par - 2);
    
    if (isGIR && h.firstPuttDist > 0) {
      S.girFirstPuttDist += h.firstPuttDist;
      S.girPutts += h.putts || 0;
    }
  });
  
  // Restore stats that can't be recalculated from holes alone
  if (rd.stats) {
    S.fwHit = rd.stats.fwHit || 0; S.fwOpp = rd.stats.fwOpp || 0;
    S.fwLeft = rd.stats.fwLeft || 0; S.fwRight = rd.stats.fwRight || 0;
    S.gir = rd.stats.girHit || 0; S.girOpp = rd.stats.girOpp || 0;
    S.scr = rd.stats.scrMade || 0; S.scrOpp = rd.stats.scrOpp || 0;
    S.bun = rd.stats.bunMade || 0; S.bunOpp = rd.stats.bunOpp || 0;
    if (rd.stats.onePutts !== undefined) S.onePuttMade = rd.stats.onePutts;
    if (rd.stats.threePutts !== undefined) S.threePlusPutts = rd.stats.threePutts;
  }

  // Recalculate missed green directions from shot data
  S.allHoles.forEach(h => {
    (h.shots || []).forEach(s => {
      if (s.lie && s.lie.startsWith('MISS ')) {
        S.girOpp++;
        if (s.lie === 'MISS LEFT') S.missLeft++;
        if (s.lie === 'MISS RIGHT') S.missRight++;
        if (s.lie === 'MISS SHORT') S.missShort++;
        if (s.lie === 'MISS LONG') S.missLong++;
      }
    });
  });

  S.currentHole = S.allHoles.length + 1;
  scoreBar.style.display = 'none';
  
  // Recalculate SG for the selected handicap so display shows correct values
  const hcp = document.getElementById('playerHandicap').value || 'pro';
  recalculateAllSG(hcp);
  
  // Go directly to full stats page (not summary)
  renderSummary(); // Still need to render summary data for full stats to work
  showFullStats();
  document.getElementById('saveStatus').textContent = '(viewing saved round)';
  document.getElementById('backToRoundsBtn').style.display = '';
  // Track if this is a student's round (coach viewing)
  S.viewingStudentRound = (data.user_id !== activeUserId());
  S.currentRoundId = data.id; // Track for updates
  document.getElementById('backToRoundsBtn').textContent = S.viewingStudentRound ? '← BACK TO STUDENT' : '← BACK TO ROUND HISTORY';
  var saveBtn2 = document.getElementById('saveToAccountBtn');
  if (saveBtn2) {
    saveBtn2.style.display = '';
    saveBtn2.textContent = '💾 UPDATE ROUND';
  }
}

// Coach: jump straight from an activity-feed notification to the student's posted round.
// Enters the student view (same as "View Profile") then opens the specific round's stats.
async function viewStudentRound(studentId, name, roundId) {
  enterStudentView(studentId, name || 'Student', '');
  await viewSavedRound(roundId);
}

async function deleteSavedRound(roundId, btn) {
  if (!confirm('Delete this round? This cannot be undone.')) return;
  
  btn.textContent = '...';
  const { error } = await _sb.from('rounds').delete().eq('id', roundId);
  
  if (error) {
    alert('Error: ' + error.message);
    btn.textContent = 'Delete';
  } else {
    // Remove from cached data and re-filter
    if (_allRoundsData) {
      _allRoundsData = _allRoundsData.filter(function(r){ return r.id !== roundId; });
    }
    filterRoundsList();
    if (_allRoundsData && _allRoundsData.length === 0) {
      document.getElementById('roundsListMsg').textContent = 'No saved rounds.';
    }
  }
}

export function goBackFromRound() {
  if (S.viewingStudentRound && S.currentStudentId) {
    // Go back to student viewer rounds tab
    show('studentViewPage');
    showStudentTab('rounds');
  } else {
    goToRoundHistory();
  }
}

// When viewing a saved round, Back returns to the round list instead of home
function backFromSavedRound() {
  var btrBtn = document.getElementById('backToRoundsBtn');
  if (btrBtn && btrBtn.style.display !== 'none') { goBackFromRound(); return; }
  return false;
}
onBack('fullStatsPage', backFromSavedRound);
onBack('summaryPage', backFromSavedRound);

// Functions called from inline HTML handlers
expose({ goBackFromRoundView, filterRoundsList, viewSavedRound, viewStudentRound, deleteSavedRound, goBackFromRound });
