import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { showAuthPage, updateAuthUI } from '../auth/auth.js';
import { loadUserRole } from '../coaching/roles.js';
import { loadMyCombines } from '../combines/history.js';
import { goToDashboard } from '../home/home.js';
import { _viewingAsStudent, activeUserId } from '../core/session.js';
import { _sb } from '../core/supabase.js';
import { loadMyRounds } from '../round/history.js';
import { loadDashboard } from '../stats/dashboard.js';

export function loadProfileInfo() {
  document.getElementById('profileEmail').textContent = S.currentUser.email;
  document.getElementById('profileName').value = S.currentUser.user_metadata?.display_name || '';
  const joined = S.currentUser.created_at ? new Date(S.currentUser.created_at) : null;
  document.getElementById('profileJoined').textContent = joined ? 'Joined ' + (joined.getMonth()+1) + '/' + joined.getDate() + '/' + joined.getFullYear() : '';
  document.getElementById('profileMsg').textContent = '';
  document.getElementById('pwMsg').textContent = '';
  loadUserRole();
  updateLaunchMonitorUI();
}

function showProfile() {
  if (!S.currentUser) { showAuthPage(); return; }
  goToDashboard();
}

export function showProfileTab(tab) {
  // Handle combines tab
  document.getElementById('profileCombinesTab').style.display = tab==='combines' ? 'block' : 'none';
  // Update tab bar buttons
  var tabs = ['dashboard','rounds','combines','account'];
  var ids  = ['ptabDash','ptabRounds','ptabCombines','ptabAccount'];
  tabs.forEach(function(t,i){
    var btn = document.getElementById(ids[i]);
    if(!btn) return;
    btn.style.background = t===tab ? '#2d7abc' : '#282828';
    btn.style.color      = t===tab ? '#ffffff' : '#606060';
    btn.style.fontWeight = t===tab ? '700' : '600';
  });
  if(tab==='combines'){ loadMyCombines(); return; }
  document.getElementById('profileAccountTab').style.display = tab === 'account' ? 'flex' : 'none';
  document.getElementById('profileDashboardTab').style.display = tab === 'dashboard' ? 'block' : 'none';
  document.getElementById('profileRoundsTab').style.display = tab === 'rounds' ? 'block' : 'none';
  
  var scrollArea = document.getElementById('profileScrollArea');
  if (scrollArea) scrollArea.scrollTop = 0;
  
  if (tab === 'dashboard') loadDashboard();
  if (tab === 'rounds') loadMyRounds();
}

async function updateProfile() {
  const name = document.getElementById('profileName').value.trim();
  const msg = document.getElementById('profileMsg');
  if (!name) { msg.textContent = 'Name cannot be empty'; msg.style.color = '#d4706e'; return; }
  
  msg.textContent = 'Saving...'; msg.style.color = '#606060';
  const { error } = await _sb.auth.updateUser({ data: { display_name: name } });
  if (error) {
    msg.style.color = '#d4706e'; msg.textContent = error.message;
  } else {
    msg.style.color = '#00b87a'; msg.textContent = '✓ Name updated!';
    S.currentUser.user_metadata.display_name = name;
    updateAuthUI(true);
    document.getElementById('playerName').value = name;
  }
}

async function saveHcpPreference(hcp) {
  const msg = document.getElementById('hcpPrefMsg');
  await _sb.from('profiles').update({ hcp_preference: hcp }).eq('id', activeUserId());
  const { error } = _viewingAsStudent ? {} : await _sb.auth.updateUser({ data: { hcp_preference: hcp } });
  if (error) {
    msg.textContent = 'Error saving'; msg.style.color = '#d4706e';
  } else {
    msg.textContent = '✓ Saved'; msg.style.color = '#00b87a';
    if (!_viewingAsStudent) S.currentUser.user_metadata.hcp_preference = hcp;
    document.getElementById('playerHandicap').value = hcp;
    setTimeout(function() { msg.textContent = ''; }, 2000);
  }
}

export function hasLaunchMonitor() {
  if (S.currentUser && S.currentUser.user_metadata && S.currentUser.user_metadata.has_launch_monitor != null) {
    return S.currentUser.user_metadata.has_launch_monitor === true;
  }
  try { return localStorage.getItem('hasLaunchMonitor') === 'true'; } catch(e) { return false; }
}

async function saveLaunchMonitor(val) {
  localStorage.setItem('hasLaunchMonitor', val ? 'true' : 'false');
  updateLaunchMonitorUI();
  var msg = document.getElementById('lmSaveMsg');
  if (S.currentUser) {
    await _sb.from('profiles').update({ has_launch_monitor: val }).eq('id', activeUserId());
    if (!_viewingAsStudent) {
      await _sb.auth.updateUser({ data: { has_launch_monitor: val } });
      S.currentUser.user_metadata.has_launch_monitor = val;
    }
  }
  if (msg) { msg.textContent = 'Saved'; setTimeout(function() { msg.textContent = ''; }, 2000); }
}

export function updateLaunchMonitorUI() {
  var has = hasLaunchMonitor();
  var yesBtn = document.getElementById('lmYesBtn');
  var noBtn = document.getElementById('lmNoBtn');
  if (yesBtn) { yesBtn.style.background = has ? '#007a52' : '#333333'; yesBtn.style.color = has ? '#fff' : '#606060'; }
  if (noBtn) { noBtn.style.background = has ? '#333333' : '#007a52'; noBtn.style.color = has ? '#606060' : '#fff'; }
}

async function changePassword() {
  const pw = document.getElementById('newPassword').value;
  const pwConfirm = document.getElementById('newPasswordConfirm').value;
  const msg = document.getElementById('pwMsg');
  if (!pw || pw.length < 6) { msg.textContent = 'Password must be at least 6 characters'; msg.style.color = '#d4706e'; return; }
  if (pw !== pwConfirm) { msg.textContent = 'Passwords do not match'; msg.style.color = '#d4706e'; return; }
  
  msg.textContent = 'Updating...'; msg.style.color = '#606060';
  const { error } = await _sb.auth.updateUser({ password: pw });
  if (error) {
    msg.style.color = '#d4706e'; msg.textContent = error.message;
  } else {
    msg.style.color = '#00b87a'; msg.textContent = '✓ Password updated!';
    document.getElementById('newPassword').value = '';
    document.getElementById('newPasswordConfirm').value = '';
  }
}

// Functions called from inline HTML handlers
expose({ showProfile, updateProfile, saveHcpPreference, saveLaunchMonitor, changePassword });
