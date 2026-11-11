import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { activeUserId } from '../core/session.js';
import { _sb } from '../core/supabase.js';
import { getGoals, renderGoals, saveGoals, syncGoalsFromProfile } from '../stats/goals.js';
import { calcHandicapIndex, loadHandicapIndex } from '../stats/handicap-index.js';

/* ── Load handicap + goals on profile Account tab ── */

/* ── Student Viewer: Load Goals & Handicap ── */
/* ── Coaching Section: Student Goals & Handicap Tab ── */
function toggleCstAddGoal() {
  var form = document.getElementById('cstAddGoalForm');
  var btn = document.getElementById('cstAddGoalBtn');
  if (form.style.display === 'none') {
    form.style.display = 'block';
    btn.style.display = 'none';
    document.getElementById('cstGoalFormMsg').textContent = '';
    var d = new Date(); d.setMonth(d.getMonth() + 3);
    document.getElementById('cstGoalDeadline').value = d.toISOString().split('T')[0];
  } else {
    form.style.display = 'none';
    btn.style.display = '';
  }
}

function saveCstGoal() {
  var cat = document.getElementById('cstGoalCategory').value;
  var target = document.getElementById('cstGoalTarget').value.trim();
  var deadline = document.getElementById('cstGoalDeadline').value;
  var note = document.getElementById('cstGoalNote').value.trim();
  var msg = document.getElementById('cstGoalFormMsg');

  if (!target) { msg.style.color = '#d4706e'; msg.textContent = 'Enter a target value.'; return; }

  var goals = getGoals();
  goals.push({
    id: Date.now().toString(),
    category: cat,
    target: target,
    deadline: deadline || null,
    note: note || null,
    created: new Date().toISOString().split('T')[0],
    completed: false
  });
  saveGoals(goals);

  document.getElementById('cstGoalTarget').value = '';
  document.getElementById('cstGoalNote').value = '';
  document.getElementById('cstAddGoalForm').style.display = 'none';
  document.getElementById('cstAddGoalBtn').style.display = '';

  renderGoals(document.getElementById('cstGoalsList'));
}

export async function loadCstGoalsAndHandicap() {
  if (!S.currentUser) return;
  loadHandicapIndex(activeUserId(), 'cstHandicapDisplay', 'cstHandicapInfo', 'cstHandicapTrend');
  await syncGoalsFromProfile();
  renderGoals(document.getElementById('cstGoalsList'));
}

/* ── Coach Roster: Handicap badges ── */
export async function loadRosterHandicaps(students) {
  if (!students || students.length === 0) return;
  students.forEach(async function(s) {
    try {
      var resp = await _sb.from('rounds').select('score, par, holes, round_data')
        .eq('user_id', s.student_id)
        .order('round_date', { ascending: false })
        .limit(20);
      if (resp.data && resp.data.length >= 3) {
        var result = calcHandicapIndex(resp.data);
        var badge = document.getElementById('rosterHcp_' + s.student_id);
        if (badge && result.index !== null) {
          badge.textContent = 'HCP ' + result.index.toFixed(1);
          badge.style.color = result.index <= 5 ? '#00b87a' : result.index <= 15 ? '#f0c830' : '#d4706e';
          badge.style.background = result.index <= 5 ? '#0a3020' : result.index <= 15 ? '#3a3010' : '#3a1515';
        }
      }
    } catch(e) { /* ignore per-student errors */ }
  });
}

/* ── Student Viewer: Load Goals & Handicap ── */
export async function loadStudentGoalsAndHandicap() {
  if (!S.currentStudentId) return;

  // Load handicap
  loadHandicapIndex(S.currentStudentId, 'svHandicapDisplay', 'svHandicapInfo', null);

  // Load goals from profile
  try {
    var { data } = await _sb.from('profiles').select('goals').eq('id', S.currentStudentId).single();
    var goals = (data && data.goals && Array.isArray(data.goals)) ? data.goals : [];
    var container = document.getElementById('svGoalsList');
    if (goals.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px;">This student hasn\'t set any goals yet.</div>';
    } else {
      renderGoals(container, goals, true);
    }
  } catch(e) {
    var container = document.getElementById('svGoalsList');
    if (container) container.innerHTML = '<div style="text-align:center;color:#2e2e2e;font-size:12px;padding:12px;">Unable to load goals.</div>';
  }
}

// Functions called from inline HTML handlers
expose({ toggleCstAddGoal, saveCstGoal });
