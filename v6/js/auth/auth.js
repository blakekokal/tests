import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { _BAG_KEY, syncBagFromSupabase } from '../bag/clubs.js';
import { _SPEED_KEY } from '../bag/speed.js';
import { _WG_KEY } from '../bag/wedge-gapping.js';
import { loadUserRole } from '../coaching/roles.js';
import { show } from '../core/nav.js';
import { _sb } from '../core/supabase.js';
import { showProfileTab, updateLaunchMonitorUI } from '../profile/profile.js';

async function checkAuth() {
  const { data: { session } } = await _sb.auth.getSession();
  if (session) {
    // Get fresh user data to ensure we have latest metadata
    const { data: { user } } = await _sb.auth.getUser();
    S.currentUser = user || session.user;
    updateAuthUI(true);
    loadUserRole();
  } else {
    S.currentUser = null;
    updateAuthUI(false);
  }
}

export function updateAuthUI(loggedIn) {
  const authBtn = document.getElementById('authBtn');
  const authUser = document.getElementById('authUser');
  const profileBtn = document.getElementById('profileBtn');
  const saveBtn = document.getElementById('saveToAccountBtn');
  const homeAuth = document.getElementById('homeAuthStatus');
  const homeLoginBtn = document.getElementById('homeLoginBtn');
  
  if (loggedIn && S.currentUser) {
    const name = S.currentUser.user_metadata?.display_name || S.currentUser.email;
    authUser.textContent = name;
    authBtn.textContent = 'Logout';
    authBtn.onclick = doLogout;
    profileBtn.style.display = '';
    if (saveBtn) saveBtn.style.display = '';
    if (homeAuth) homeAuth.textContent = '👤 ' + name;
    if (homeLoginBtn) homeLoginBtn.style.display = 'none';
    
    // Load handicap preference
    const savedHcp = S.currentUser.user_metadata?.hcp_preference || 'pro';
    document.getElementById('playerHandicap').value = savedHcp;
    var settingsHcp = document.getElementById('settingsHcpSelect');
    if (settingsHcp) settingsHcp.value = savedHcp;
    var dashHcpF = document.getElementById('dashHcpFilter');
    if (dashHcpF) dashHcpF.value = savedHcp;

    // Load launch monitor preference
    if (S.currentUser.user_metadata?.has_launch_monitor != null) {
      localStorage.setItem('hasLaunchMonitor', S.currentUser.user_metadata.has_launch_monitor ? 'true' : 'false');
    }
    updateLaunchMonitorUI();
  } else {
    authUser.textContent = '';
    authBtn.textContent = 'Login';
    authBtn.onclick = function(){ showAuthPage(); };
    profileBtn.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'none';
    if (homeAuth) homeAuth.textContent = '';
    if (homeLoginBtn) homeLoginBtn.style.display = '';
  }
}

export function showAuthPage() {
  resetAuthMode();
  show('authPage');
}

var _authSignupMode = false;

function handleSignupClick() {
  if (!_authSignupMode) {
    // First click - show signup fields
    _authSignupMode = true;
    document.getElementById('signupFields').style.display = 'flex';
    document.getElementById('authSignupBtn').textContent = 'CREATE ACCOUNT';
    document.getElementById('authLoginBtn').textContent = '← BACK TO LOGIN';
    document.getElementById('authLoginBtn').onclick = function() { resetAuthMode(); };
    document.getElementById('authMsg').textContent = '';
  } else {
    // Second click - actually sign up
    doSignUp();
  }
}

function resetAuthMode() {
  _authSignupMode = false;
  document.getElementById('signupFields').style.display = 'none';
  document.getElementById('authSignupBtn').textContent = 'SIGN UP';
  document.getElementById('authLoginBtn').textContent = 'LOG IN';
  document.getElementById('authLoginBtn').onclick = function() { doLogin(); };
  document.getElementById('authMsg').textContent = '';
  document.getElementById('authPassConfirm').value = '';
  document.getElementById('authName').value = '';
}

async function doSignUp() {
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPass').value;
  const passConfirm = document.getElementById('authPassConfirm').value;
  const name = document.getElementById('authName').value.trim();
  const msg = document.getElementById('authMsg');
  
  if (!email || !pass) { msg.textContent = 'Email and password required'; msg.style.color = '#d4706e'; return; }
  if (pass.length < 6) { msg.textContent = 'Password must be at least 6 characters'; msg.style.color = '#d4706e'; return; }
  if (pass !== passConfirm) { msg.textContent = 'Passwords do not match'; msg.style.color = '#d4706e'; return; }
  
  msg.textContent = 'Creating account...';
  msg.style.color = '#606060';
  
  const { data, error } = await _sb.auth.signUp({
    email,
    password: pass,
    options: { data: { display_name: name || email.split('@')[0] } }
  });
  
  if (error) {
    msg.style.color = '#d4706e';
    msg.textContent = error.message;
    return;
  }
  
  if (data.user && !data.session) {
    msg.style.color = '#00b87a';
    msg.textContent = 'Check your email to confirm, then log in!';
  } else {
    S.currentUser = data.user;
    updateAuthUI(true);
    // Auto-fill player name
    if (name) document.getElementById('playerName').value = name;
    show('homePage');
  }

  // Notify admin(s) of new signup
  if (data.user) {
    notifyAdminOfNewSignup(data.user, name || email.split('@')[0]);
  }
}

async function notifyAdminOfNewSignup(newUser, displayName) {
  try {
    // Find admin users
    var { data: admins } = await _sb.from('profiles').select('id').eq('is_admin', true);
    if (!admins || admins.length === 0) return;
    for (var i = 0; i < admins.length; i++) {
      await _sb.from('notifications').insert({
        user_id: admins[i].id,
        type: 'new_signup',
        title: 'New Student Signed Up',
        message: (displayName || 'Someone') + ' (' + (newUser.email || '') + ') just created an account',
        read: false,
        created_at: new Date().toISOString()
      });
    }
  } catch(e) { /* silent */ }
}

async function doLogin() {
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPass').value;
  const msg = document.getElementById('authMsg');
  
  if (!email || !pass) { msg.textContent = 'Email and password required'; return; }
  
  msg.textContent = 'Logging in...';
  msg.style.color = '#606060';
  
  const { data, error } = await _sb.auth.signInWithPassword({ email, password: pass });
  
  if (error) {
    msg.style.color = '#d4706e';
    msg.textContent = error.message;
    return;
  }
  
  S.currentUser = data.user;
  updateAuthUI(true);
  // Auto-fill player name
  const dname = S.currentUser.user_metadata?.display_name;
  if (dname) document.getElementById('playerName').value = dname;
  show('homePage');
}

async function doLogout() {
  await _sb.auth.signOut();
  S.currentUser = null;
  // Clear bag/wedge/speed data from localStorage so it doesn't persist when logged out
  localStorage.removeItem(_BAG_KEY);
  localStorage.removeItem(_WG_KEY);
  localStorage.removeItem(_SPEED_KEY);
  updateAuthUI(false);
}

async function doResetPassword() {
  const email = document.getElementById('authEmail').value.trim();
  const msg = document.getElementById('authMsg');
  
  if (!email) {
    msg.style.color = '#d4706e';
    msg.textContent = 'Enter your email above, then tap Forgot Password';
    return;
  }
  
  msg.textContent = 'Sending reset link...';
  msg.style.color = '#606060';
  
  const { error } = await _sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });
  
  if (error) {
    msg.style.color = '#d4706e';
    msg.textContent = error.message;
  } else {
    msg.style.color = '#00b87a';
    msg.textContent = '\u2713 Password reset email sent! Check your inbox.';
  }
}

export function init() {

// Listen for auth changes
_sb.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    S.currentUser = session.user;
    updateAuthUI(true);
    show('profilePage');
    showProfileTab('account');
    const pwMsg = document.getElementById('pwMsg');
    if (pwMsg) {
      pwMsg.style.color = '#44b8f0';
      pwMsg.textContent = 'Enter and confirm your new password below.';
    }
    return;
  }
  if (session) {
    S.currentUser = session.user;
    updateAuthUI(true);
    // Fire-and-forget: sync email to profiles (no await, won't block auth)
    _sb.from('profiles').update({ email: S.currentUser.email }).eq('id', S.currentUser.id).then(function(){}).catch(function(){});
    // Sync bag/wedge/speed data from profile
    syncBagFromSupabase().catch(function(){});
  } else {
    S.currentUser = null;
    // Clear bag/wedge/speed data from localStorage on logout
    localStorage.removeItem('myBag_v1');
    localStorage.removeItem('wedgeGap_v1');
    localStorage.removeItem('speedSessions_v1');
    updateAuthUI(false);
  }
});

// Check auth on load
checkAuth();
}

// Functions called from inline HTML handlers
expose({ showAuthPage, handleSignupClick, doLogin, doLogout, doResetPassword });
