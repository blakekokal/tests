import { S } from './state.js';
import { expose } from './expose.js';
import { onEnter, show } from './router.js';
import { _sb } from './supabase.js';

// ─── STUDENT IMPERSONATION (Coach viewing as student) ──────────────
export var _viewingAsStudent = null; // { id, name, email } when coach is viewing as a student

export function activeUserId() {
  return _viewingAsStudent ? _viewingAsStudent.id : S.currentUser.id;
}

function exitStudentView() {
  _viewingAsStudent = null;
  // Reset bag student view variables
  S.bagViewingStudentId = null;
  S.bagViewingStudentName = null;
  S.bagStudentClubs = null;
  if (typeof S.bagStudentWgSessions !== 'undefined') S.bagStudentWgSessions = null;
  if (typeof S.bagStudentSpeedSessions !== 'undefined') S.bagStudentSpeedSessions = null;
  updateViewingAsBanner();
  show('homePage');
}

export function enterStudentView(studentId, name, email) {
  _viewingAsStudent = { id: studentId, name: name, email: email || '' };
  updateViewingAsBanner();
  show('homePage');
}

export function updateViewingAsBanner() {
  var banner = document.getElementById('viewingAsBanner');
  if (!banner) return;
  if (_viewingAsStudent) {
    banner.style.display = 'flex';
    document.getElementById('viewingAsName').textContent = _viewingAsStudent.name;
    document.body.classList.add('viewing-as');
    // Hide settings and coaching buttons on home page
    var settingsBtn = document.querySelector('#homePage button[onclick="goToSettings()"]');
    if (settingsBtn) settingsBtn.style.visibility = 'hidden';
    var coachingBtn = document.getElementById('homeCoachingBtn');
    if (coachingBtn) coachingBtn.style.display = 'none';
    // Update home auth status to show student name
    var homeAuth = document.getElementById('homeAuthStatus');
    if (homeAuth) homeAuth.textContent = '👤 ' + _viewingAsStudent.name;
  } else {
    banner.style.display = 'none';
    document.body.classList.remove('viewing-as');
    // Restore settings button
    var settingsBtn = document.querySelector('#homePage button[onclick="goToSettings()"]');
    if (settingsBtn) settingsBtn.style.visibility = 'visible';
    // Restore coaching button
    var coachingBtn = document.getElementById('homeCoachingBtn');
    if (coachingBtn) coachingBtn.style.display = 'flex';
    // Restore home auth status
    var homeAuth = document.getElementById('homeAuthStatus');
    if (homeAuth && S.currentUser) {
      var name = S.currentUser.user_metadata?.display_name || S.currentUser.email;
      homeAuth.textContent = '👤 ' + name;
    }
  }
}

async function showStudentPicker() {
  show('studentPickerPage');
  var list = document.getElementById('studentPickerList');
  var msg = document.getElementById('studentPickerMsg');
  list.innerHTML = '';
  msg.textContent = 'Loading students...';

  var { data, error } = await _sb.from('coach_students')
    .select('student_id, student_name, student_email')
    .eq('coach_id', S.currentUser.id)
    .order('student_name', { ascending: true });

  if (error) { msg.textContent = 'Error: ' + error.message; return; }
  if (!data || data.length === 0) { msg.textContent = 'No students yet. Add students from the Coaching page.'; return; }
  msg.textContent = data.length + ' student(s)';

  data.forEach(function(s) {
    var card = document.createElement('div');
    card.style.cssText = 'background:#282828;border-radius:10px;padding:14px;margin:6px 0;cursor:pointer;';
    card.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;">'
      + '<div><div style="font-weight:700;font-size:15px;">' + (s.student_name || 'Student') + '</div>'
      + '<div style="font-size:12px;color:#9a9a9a;">' + (s.student_email || '') + '</div></div>'
      + '<span style="font-size:20px;opacity:0.4;">→</span>'
      + '</div>';
    card.onclick = function() {
      enterStudentView(s.student_id, s.student_name || 'Student', s.student_email || '');
    };
    list.appendChild(card);
  });
}

onEnter('homePage', updateViewingAsBanner);

// Functions called from inline HTML handlers
expose({ activeUserId, exitStudentView });
