// Turns text read from a photo into hole data for the entry forms.
// Pure functions (no DOM, no network) so they can be unit-tested.

var MAX_HOLES = 18;

function integersIn(line) {
  return (line.match(/\d+/g) || []).map(Number);
}

/** Drop the Out / In / Total columns from a scorecard row. */
function stripTotals(nums) {
  if (nums.length >= 19) return nums.slice(0, 9).concat(nums.slice(10, 19));
  if (nums.length === 18) return nums;
  if (nums.length >= 10) return nums.slice(0, 9);
  return nums;
}

function allBetween(nums, lo, hi) {
  return nums.length > 0 && nums.every(function(n) { return n >= lo && n <= hi; });
}

function isHoleNumberRow(nums) {
  if (nums.length < 3) return false;
  var first = nums[0];
  if (first !== 1 && first !== 10) return false;
  var run = Math.min(nums.length, 9);
  for (var i = 1; i < run; i++) if (nums[i] !== first + i) return false;
  return true;
}

/** "✓ x ✓ ..." cells -> ['hit','miss',...]; null when the row cannot be lined up with the holes. */
function marksIn(line, label, count) {
  var cells = line.slice(label.length).split(/[\s|:]+/).filter(Boolean);
  var marks = cells.map(function(c) {
    if (/^[x✗✘×]$/i.test(c)) return 'miss';
    if (/^[✓✔√vy\/]$/i.test(c)) return 'hit';
    if (/^[-–—.]$/.test(c)) return '';
    return null;
  });
  if (marks.some(function(m) { return m === null; })) return null;
  return count && marks.length !== count ? null : marks;
}

/**
 * Scorecard text -> one entry per hole.
 * Reads the printed rows (Hole, yardage, Par) and the player's rows:
 *   score          strokes per hole
 *   F              fairway: check = hit, x = missed (blank on par 3s)
 *   G              green in regulation: check = hit, x = missed
 *   Putts          putts per hole
 *   Pen            penalty strokes (blank = none)
 * With several players on the card, the first score row is used.
 * @returns {{hole:number, par:number, yards:number, score:number,
 *   fairway:'hit'|'miss'|'', gir:'hit'|'miss'|'', putts:number|null, penalties:number}[]|null}
 */
export function parseScorecardText(text) {
  var pars = [], yards = [], scores = [], putts = [], pens = [], fairways = [], greens = [];
  // A card is usually two tables (front nine, back nine); each "Hole" row starts a new one.
  var seg = { par: false, yards: false, score: false, holes: 0 };

  String(text || '').split(/\r?\n/).forEach(function(rawLine) {
    var line = rawLine.trim();
    if (!line) return;
    var label = (line.match(/^[^\d✓✔√✗✘×|]*/)[0] || '');
    var name = label.toLowerCase().replace(/[^a-z]/g, '');
    var all = integersIn(line);

    if (/hole/.test(name) || isHoleNumberRow(all)) {
      seg = { par: false, yards: false, score: false, holes: Math.min(9, stripTotals(all).length) };
      return;
    }
    // Check / x rows: F (fairways) and G (greens)
    var firstWord = line.split(/[\s|:]+/)[0];
    var rowName = firstWord.toLowerCase().replace(/[^a-z]/g, '');
    if (/^(f|fw|fir|fairways?)$/.test(rowName) || /^(g|gir|greens?)$/.test(rowName)) {
      var marks = marksIn(line, firstWord, seg.holes);
      if (marks) {
        if (rowName.charAt(0) === 'f') fairways = fairways.concat(marks); else greens = greens.concat(marks);
      }
      return;
    }
    if (all.length < 3) return;
    if (/h(an)?d?i?ca?p|index|hdcp/.test(name)) return;

    var nums = stripTotals(all);
    if (/putt/.test(name)) { putts = putts.concat(nums); return; }
    if (/^pen/.test(name)) { pens = pens.concat(nums); return; }
    if (/^par$/.test(name) || (!name && !seg.par && allBetween(nums, 3, 5) && seg.yards)) {
      if (!seg.par && allBetween(nums, 3, 6)) { pars = pars.concat(nums); seg.par = true; }
      return;
    }
    var mostlyYardages = nums.filter(function(n) { return n >= 60 && n <= 700; }).length >= nums.length * 0.7;
    if (mostlyYardages) {
      if (!seg.yards) { yards = yards.concat(nums); seg.yards = true; }
      return;
    }
    if (allBetween(nums, 1, 15)) {
      if (!seg.score) { scores = scores.concat(nums); seg.score = true; }
    }
  });

  scores = scores.slice(0, MAX_HOLES);
  if (scores.length < 3) return null;
  // A stats row is only trusted when it has one value per hole
  var whole = function(list) { return list.length === scores.length ? list : []; };
  putts = whole(putts); pens = whole(pens); fairways = whole(fairways); greens = whole(greens);
  return scores.map(function(score, i) {
    var par = pars[i] >= 3 && pars[i] <= 5 ? pars[i] : 4;
    return {
      hole: i + 1, par: par, yards: yards[i] || 0, score: score,
      fairway: par === 3 ? '' : (fairways[i] || ''),
      gir: greens[i] || '',
      putts: putts.length ? putts[i] : null,
      penalties: pens[i] || 0
    };
  });
}
