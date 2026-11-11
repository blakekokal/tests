import { activeUserId } from '../core/session.js';
import { _sb } from '../core/supabase.js';

/* ══════════════════════════════════════════════════════════════
   HANDICAP INDEX CALCULATION (USGA/WHS simplified)
   ══════════════════════════════════════════════════════════════ */

function calcHandicapDifferential(score, rating, slope) {
  // Standard formula: (Score - Rating) * 113 / Slope
  if (!rating || !slope) return null;
  return Math.round(((score - rating) * 113 / slope) * 10) / 10;
}

export function calcHandicapIndex(rounds) {
  // Get 18-hole rounds with scores, sorted by date desc
  var eligible = rounds.filter(function(r) {
    var holes = r.round_data && r.round_data.allHoles ? r.round_data.allHoles.length : r.holes;
    return holes >= 14 && r.score > 0;
  });

  if (eligible.length < 3) return { index: null, differentials: [], msg: 'Need at least 3 rounds (have ' + eligible.length + ')' };

  // Calculate differentials
  var diffs = eligible.slice(0, 20).map(function(r) {
    var rd = r.round_data || {};
    var tee = rd._selectedTee;
    var rating = tee ? tee.rm : null;
    var slope = tee ? tee.sm : null;
    var diff = calcHandicapDifferential(r.score, rating, slope);
    // Fallback: use par-based estimate if no rating/slope
    if (diff === null) {
      // Approximate: rating ~ par, slope ~ 113 (standard)
      diff = Math.round((r.score - r.par) * 10) / 10;
    }
    return { diff: diff, date: r.round_date, course: r.course_name, score: r.score };
  });

  // How many best differentials to use based on USGA table
  var n = diffs.length;
  var useCount;
  if (n <= 3) useCount = 1;
  else if (n <= 5) useCount = 1;
  else if (n <= 6) useCount = 2;
  else if (n <= 8) useCount = 2;
  else if (n <= 11) useCount = 3;
  else if (n <= 14) useCount = 4;
  else if (n <= 16) useCount = 5;
  else if (n <= 18) useCount = 6;
  else if (n <= 19) useCount = 7;
  else useCount = 8;

  // Sort differentials ascending to pick best
  var sorted = diffs.slice().sort(function(a, b) { return a.diff - b.diff; });
  var best = sorted.slice(0, useCount);
  var avg = best.reduce(function(s, d) { return s + d.diff; }, 0) / useCount;

  // Apply adjustment for small sample
  var adjustment = 0;
  if (n <= 3) adjustment = -2;
  else if (n <= 5) adjustment = -1;
  else if (n <= 6) adjustment = -0.5;

  var index = Math.round((avg + adjustment) * 10) / 10;
  if (index < 0) index = 0; // Floor at 0

  return { index: index, differentials: diffs, useCount: useCount, best: best, msg: 'Best ' + useCount + ' of ' + n + ' rounds' };
}

export async function loadHandicapIndex(userId, displayId, infoId, trendId) {
  var displayEl = document.getElementById(displayId || 'handicapIndexDisplay');
  var infoEl = document.getElementById(infoId || 'handicapIndexInfo');
  var trendEl = document.getElementById(trendId || 'handicapTrendChart');

  if (!displayEl) return null;
  displayEl.textContent = '--';
  if (infoEl) infoEl.textContent = 'Loading...';
  if (trendEl) trendEl.innerHTML = '';

  var resp = await _sb.from('rounds').select('*')
    .eq('user_id', userId || activeUserId())
    .order('round_date', { ascending: false })
    .limit(20);

  if (resp.error || !resp.data || resp.data.length === 0) {
    if (infoEl) infoEl.textContent = 'No rounds to calculate handicap.';
    return null;
  }

  var result = calcHandicapIndex(resp.data);
  if (result.index === null) {
    displayEl.textContent = '--';
    if (infoEl) infoEl.textContent = result.msg;
    return null;
  }

  displayEl.textContent = result.index.toFixed(1);
  displayEl.style.color = result.index <= 5 ? '#00b87a' : result.index <= 15 ? '#f0c830' : '#d4706e';
  if (infoEl) infoEl.textContent = result.msg;

  // Mini trend chart
  if (trendEl && result.differentials.length > 1) {
    var vals = result.differentials.slice().reverse();
    var max = Math.max.apply(null, vals.map(function(d) { return d.diff; }));
    var min = Math.min.apply(null, vals.map(function(d) { return d.diff; }));
    var range = max - min || 1;
    trendEl.innerHTML = vals.map(function(d) {
      var h = Math.max(6, Math.round(((d.diff - min) / range) * 40 + 10));
      var isBest = result.best.some(function(b) { return b.date === d.date && b.score === d.score; });
      return '<div title="' + d.course + ': ' + d.diff + '" style="width:' + Math.max(6, Math.floor(260 / vals.length)) + 'px;height:' + h + 'px;background:' + (isBest ? '#00b87a' : '#3d3d3d') + ';border-radius:2px;cursor:help;"></div>';
    }).join('');
  }

  return result;
}