import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { loadStudentRounds, showStudentTab } from '../coaching/student-view.js';
import { onBack, show } from '../core/router.js';
import { _sb } from '../core/supabase.js';
import { showProfileTab } from '../profile/profile.js';
import { _allRoundsData, loadMyRounds } from './history.js';

// --- EDIT ROUND INFO LOGIC ---
var _eriRoundId = null;
var _eriIsStudentRound = false;

function openEditRoundInfo(id, ev) {
  if (ev) ev.stopPropagation();
  var r = null;
  _eriIsStudentRound = false;
  
  if (_allRoundsData) r = _allRoundsData.find(x => x.id === id);
  
  if (!r && typeof S.svAllRounds !== 'undefined' && S.svAllRounds) {
      r = S.svAllRounds.find(x => x.id === id);
      if (r) _eriIsStudentRound = true;
  }
  
  if (!r) {
     alert("Could not load round data for editing.");
     return;
  }
  
  _eriRoundId = id;
  document.getElementById('eriCourseName').value = r.course_name || '';
  document.getElementById('eriRoundDate').value = r.round_date || '';
  document.getElementById('eriPlayerName').value = r.player_name || '';
  
  var rt = document.getElementById('eriRoundType');
  if (rt) {
    rt.value = r.round_type === 'Tournament' ? 'Tournament' : 'Casual';
  }
  document.getElementById('eriPlaceWrap').style.display = r.round_type === 'Tournament' ? '' : 'none';
  document.getElementById('eriPlace').value = r.tournament_place || '';

  show('editRoundInfoPage');
}

export function goBackFromEditRound() {
    if (_eriIsStudentRound) {
        show('studentViewPage');
        if(typeof showStudentTab === 'function') showStudentTab('rounds');
    } else {
        show('profilePage');
        if(typeof showProfileTab === 'function') showProfileTab('rounds');
    }
}

async function saveEditRoundInfo(ev) {
  if (!_eriRoundId) return;
  var btn = ev.target;
  var oldText = btn.innerText;
  btn.innerText = 'Saving...';
  
  var cName = document.getElementById('eriCourseName').value;
  var rDate = document.getElementById('eriRoundDate').value;
  var pName = document.getElementById('eriPlayerName').value;
  var rType = document.getElementById('eriRoundType').value;
  var rPlace = rType === 'Tournament' ? (parseInt(document.getElementById('eriPlace').value) || null) : null;

  var updatePayload = { course_name: cName, round_date: rDate, player_name: pName, round_type: rType, tournament_place: rPlace };
  var { error } = await _sb.from('rounds').update(updatePayload).eq('id', _eriRoundId);

  // If tournament_place column doesn't exist yet, retry without it
  if (error && error.message && error.message.indexOf('tournament_place') !== -1) {
    delete updatePayload.tournament_place;
    var resp2 = await _sb.from('rounds').update(updatePayload).eq('id', _eriRoundId);
    error = resp2.error;
  }

  btn.innerText = oldText;

  if (error) {
    alert('Error updating round: ' + error.message);
  } else {
    if (_eriIsStudentRound && S.currentStudentId) {
        loadStudentRounds();
        show('studentViewPage');
        if(typeof showStudentTab === 'function') showStudentTab('rounds');
    } else {
        loadMyRounds();
        show('profilePage');
        if(typeof showProfileTab === 'function') showProfileTab('rounds');
    }
  }
}

onBack('editRoundInfoPage', goBackFromEditRound);

// Functions called from inline HTML handlers
expose({ openEditRoundInfo, goBackFromEditRound, saveEditRoundInfo });
