import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { _sgCalcShots, sgCalcReset } from '../learn/sg-calculator.js';
import { renderSGExplainer } from '../learn/sg-explainer.js';

// Init SG calc when navigating to help page

// ── HELP PAGE ──
function showHelpTab(tab) {
  ['start','sg','faq','contact'].forEach(function(t) {
    document.getElementById('helpContent_' + t).style.display = t === tab ? 'block' : 'none';
    var btn = document.getElementById('helpTab_' + t);
    btn.style.background = t === tab ? '#2d7abc' : '#222222';
    btn.style.color = t === tab ? '#ffffff' : '#606060';
  });
  if (tab === 'sg') renderSGExplainer();
}

function showSgSubTab(sub) {
  ['explained','calc'].forEach(function(t) {
    var el = document.getElementById('sgSubContent_' + t);
    if (el) el.style.display = t === sub ? 'block' : 'none';
    var btn = document.getElementById('sgSubTab_' + t);
    if (btn) {
      btn.style.background = t === sub ? '#2d7abc' : '#1e1e1e';
      btn.style.color = t === sub ? '#ffffff' : '#606060';
    }
  });
  if (sub === 'explained') renderSGExplainer();
  if (sub === 'calc' && _sgCalcShots.length === 0) {
    var userHcp = (S.currentUser && S.currentUser.user_metadata && S.currentUser.user_metadata.hcp_preference) || '10';
    var hcpMap = { 'pro': 'Tour Pro', '0': 'Scratch', '5': '5', '10': '10', '15': '15', '20': '20', '25': '25', '30': '30' };
    var hcpVal = hcpMap[userHcp] || '10';
    var sel = document.getElementById('sgCalcHcp');
    if (sel) sel.value = hcpVal;
    sgCalcReset();
  }
}

// Functions called from inline HTML handlers
expose({ showHelpTab, showSgSubTab });
