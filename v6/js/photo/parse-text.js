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

/**
 * Scorecard text -> [{hole, par, yards, score}].
 * Works on rows such as "Par 4 3 5 ...", "Blue 385 160 ...", "Sam 5 3 6 ...".
 * With several players on the card, the first score row is used.
 * @returns {{hole:number, par:number, yards:number, score:number}[]|null}
 */
export function parseScorecardText(text) {
  var pars = [], yards = [], scores = [];
  // A card is usually two tables (front nine, back nine); each "Hole" row starts a new one.
  var seg = { par: false, yards: false, score: false };

  String(text || '').split(/\r?\n/).forEach(function(rawLine) {
    var line = rawLine.trim();
    if (!line) return;
    var label = (line.match(/^[^\d]*/)[0] || '').toLowerCase();
    var all = integersIn(line);
    if (all.length < 3) return;

    if (/hole/.test(label) || isHoleNumberRow(all)) {
      seg = { par: false, yards: false, score: false };
      return;
    }
    if (/h(an)?d?i?ca?p|index|hdcp|s\.?i\.?/.test(label)) return;
    if (/putt/.test(label)) return;

    var nums = stripTotals(all);
    if (/\bpar\b/.test(label) || (!label && !seg.par && allBetween(nums, 3, 5) && seg.yards)) {
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
  return scores.map(function(score, i) {
    return { hole: i + 1, par: pars[i] >= 3 && pars[i] <= 5 ? pars[i] : 4, yards: yards[i] || 0, score: score };
  });
}

// Shot notes: where each shot finished + how far was left.
// Longer names first so "fairway bunker" wins over "fairway".
var LIE_WORDS = [
  ['left rough', 'LEFT ROUGH'], ['right rough', 'RIGHT ROUGH'],
  ['fairway bunker', 'FW BUNKER'], ['fw bunker', 'FW BUNKER'],
  ['greenside bunker', 'GS BUNKER'], ['gs bunker', 'GS BUNKER'],
  ['missed green', 'MISSED GREEN'], ['out of bounds', 'OB'],
  ['fairway', 'FAIRWAY'], ['bunker', 'GS BUNKER'], ['recovery', 'RECOVERY'],
  ['holed', 'HOLE'], ['water', 'WATER'], ['green', 'GREEN'], ['rough', 'LEFT ROUGH'],
  ['hole', 'HOLE'], ['miss', 'MISSED GREEN'], ['sand', 'GS BUNKER'], ['putt', 'GREEN'],
  ['rec', 'RECOVERY'], ['lr', 'LEFT ROUGH'], ['rr', 'RIGHT ROUGH'], ['fb', 'FW BUNKER'],
  ['gb', 'GS BUNKER'], ['mg', 'MISSED GREEN'], ['fw', 'FAIRWAY'], ['ob', 'OB'], ['in', 'HOLE'],
  ['f', 'FAIRWAY'], ['g', 'GREEN'], ['b', 'GS BUNKER'], ['r', 'RECOVERY'], ['w', 'WATER'],
  ['h', 'HOLE'], ['p', 'GREEN']
];
var LIE_LOOKUP = {};
LIE_WORDS.forEach(function(pair) { LIE_LOOKUP[pair[0]] = pair[1]; });
var SHOT_RE = new RegExp(
  '(?:^|[^a-z])(' + LIE_WORDS.map(function(p) { return p[0]; }).join('|') + ')\\s*[-:=]?\\s*(\\d{1,3})?(?![a-z\\d])', 'gi');
var HOLE_HEADER_RE = /^\s*(?:hole|h|#)?\s*(\d{1,2})\s*[:.)\-]?\s*(?:par|p)\s*([345])(?:\s*[,\/\-]?\s*(\d{2,3})\s*(?:y(?:ar)?ds?|y)?)?/i;

/**
 * Shot notes text -> [{hole, par, yards, shots:[{lie, dist}]}], the Hole-by-Hole form's own shape.
 * Each hole starts with "<hole> par <par> <yards>" followed by one entry per shot:
 * where it finished and how far was left (yards, or feet once on the green), e.g.
 *   1 P4 385: F 150, G 20, G 3, H
 * @returns {{hole:number, par:number, yards:number, shots:{lie:string, dist:string}[]}[]|null}
 */
export function parseShotNotesText(text) {
  var holes = [], current = null;
  String(text || '').split(/\r?\n/).forEach(function(rawLine) {
    var line = rawLine.trim();
    if (!line) return;
    var header = line.match(HOLE_HEADER_RE);
    if (header) {
      current = { hole: Number(header[1]), par: Number(header[2]), yards: Number(header[3]) || 0, shots: [] };
      holes.push(current);
      line = line.slice(header[0].length);
    }
    if (!current) return;
    var m;
    SHOT_RE.lastIndex = 0;
    while ((m = SHOT_RE.exec(line)) !== null) {
      var lie = LIE_LOOKUP[m[1].toLowerCase()];
      current.shots.push({ lie: lie, dist: lie === 'HOLE' ? '' : (m[2] || '') });
    }
  });

  holes = holes.filter(function(h) { return h.hole >= 1 && h.hole <= MAX_HOLES && h.shots.length > 0; });
  if (holes.length === 0) return null;
  holes.sort(function(a, b) { return a.hole - b.hole; });
  return holes.slice(0, MAX_HOLES);
}
