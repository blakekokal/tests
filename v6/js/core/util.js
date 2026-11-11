import { expose } from './expose.js';

export function highlight(btn){
  btn.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
}

// Get today's date in Central Time as YYYY-MM-DD
export function getTodayCentral() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}
export function ordinal(n){return n===1?'1st':n===2?'2nd':n===3?'3rd':`${n}th`;}

export function formatDateForDisplay(dateStr){
  if(!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;
}

export function formatDateForFilename(dateStr){
  if(!dateStr) return 'round';
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getMonth()+1}-${d.getDate()}-${d.getFullYear()}`;
}


export function ordinalSuffix(n) {
  var s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function escHtml(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Functions called from inline HTML handlers
expose({ highlight });
