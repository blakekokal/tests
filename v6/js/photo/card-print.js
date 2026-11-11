// Draws the printable stat cards (stat-card.html) from the shared layout.
import { BLOCK, BUBBLE_R, CARD, CARD_LIES, CODE_BITS, CODE_SIZE, COVER_CODE, HOLES_PER_CARD, MARKERS, MARKER_SIZE,
  ORIENTATION_MARKER, PAR_R, PAR_VALUES, SHOT_ROWS, blockTop, bubbleCentre, parCentre } from './card-layout.js';

var SHEET = { width: 1056, height: 816 };   // US Letter, landscape
var HAND = 'font-family="Segoe Print, Bradley Hand, Comic Sans MS, cursive" font-style="italic"';

function text(x, y, str, size, o) {
  o = o || {};
  return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" text-anchor="' + (o.anchor || 'start')
    + '" font-weight="' + (o.bold ? 700 : 400) + '" fill="' + (o.fill || '#000') + '" ' + (o.hand ? HAND : '') + '>' + str + '</text>';
}
function square(c, size) {
  return '<rect x="' + (c.x - size / 2) + '" y="' + (c.y - size / 2) + '" width="' + size + '" height="' + size + '"/>';
}

/** Cut line, corner squares and the card's code squares. */
function frame(code) {
  var s = '<rect width="' + CARD.width + '" height="' + CARD.height + '" fill="#fff" stroke="#888" stroke-width=".8" stroke-dasharray="5 4"/>';
  MARKERS.forEach(function(m) { s += square(m, MARKER_SIZE); });
  s += square(ORIENTATION_MARKER, MARKER_SIZE);
  CODE_BITS.forEach(function(b, i) { if (code & (4 >> i)) s += square(b, CODE_SIZE); });
  return s;
}

/** One hole. example = {par, yards, score, shots:[[lieIndex, 'distance'], ...]} draws it filled in. */
function holeBlock(slot, holeNumber, example) {
  var x = BLOCK.left, y = blockTop(slot), s = '';
  s += '<rect x="' + x + '" y="' + y + '" width="' + BLOCK.width + '" height="' + BLOCK.height + '" fill="none" stroke="#000" stroke-width="1.1"/>';
  s += '<rect x="' + x + '" y="' + y + '" width="' + BLOCK.width + '" height="' + BLOCK.header + '" fill="#ececec" stroke="#000" stroke-width="1.1"/>';
  s += text(x + 7, y + 18, 'HOLE ' + holeNumber, 13, { bold: true });
  s += text(x + 82, y + 17, 'Par', 9.5);
  PAR_VALUES.forEach(function(par, k) {
    var c = parCentre(slot, k);
    s += '<circle cx="' + c.x + '" cy="' + c.y + '" r="' + PAR_R + '" fill="#fff" stroke="#999" stroke-width=".6"/>' + text(c.x, c.y + 3.6, par, 10.5, { anchor: 'middle', bold: true });
    if (example && example.par === par) s += '<ellipse cx="' + c.x + '" cy="' + c.y + '" rx="9.5" ry="10" fill="none" stroke="#1a3a8a" stroke-width="1.7" transform="rotate(-14 ' + c.x + ' ' + c.y + ')"/>';
  });
  s += text(x + 176, y + 17, 'Yards', 9.5) + '<rect x="' + (x + 205) + '" y="' + (y + 4) + '" width="46" height="18" fill="#fff" stroke="#000" stroke-width=".7"/>';
  s += text(x + 262, y + 17, 'Score', 9.5) + '<rect x="' + (x + 292) + '" y="' + (y + 4) + '" width="34" height="18" fill="#fff" stroke="#000" stroke-width=".7"/>';
  if (example) {
    s += text(x + 228, y + 18, example.yards, 13, { anchor: 'middle', hand: true, fill: '#1a3a8a' });
    s += text(x + 309, y + 18, example.score, 13, { anchor: 'middle', hand: true, fill: '#1a3a8a' });
  }
  var ly = y + BLOCK.header, gridH = BLOCK.labels + SHOT_ROWS * BLOCK.row;
  CARD_LIES.forEach(function(col, i) {
    var cx = bubbleCentre(slot, 0, i).x;
    if (i % 2 === 0) s += '<rect x="' + (cx - BLOCK.liePitch / 2) + '" y="' + ly + '" width="' + BLOCK.liePitch + '" height="' + gridH + '" fill="#f3f3f3"/>';
    col.label.forEach(function(lineText, k) {
      s += text(cx, ly + (col.label.length === 1 ? 11.5 : 7.5) + k * 7, lineText, 5.6, { anchor: 'middle', bold: true });
    });
  });
  s += text(x + 8, ly + 11.5, 'Shot', 5.6, { anchor: 'middle', fill: '#555' });
  var dx = x + BLOCK.distX;
  s += text(dx + BLOCK.distW / 2, ly + 7.5, 'Distance', 5.6, { anchor: 'middle', bold: true }) + text(dx + BLOCK.distW / 2, ly + 14.5, 'left', 5.6, { anchor: 'middle', bold: true });
  s += '<line x1="' + x + '" y1="' + (ly + BLOCK.labels) + '" x2="' + (x + BLOCK.width) + '" y2="' + (ly + BLOCK.labels) + '" stroke="#000" stroke-width=".6"/>';
  for (var r = 0; r < SHOT_ROWS; r++) {
    var cy = bubbleCentre(slot, r, 0).y, shot = example && example.shots[r];
    s += text(x + 8, cy + 3.2, r + 1, 9, { anchor: 'middle', bold: true });
    CARD_LIES.forEach(function(col, i) {
      var c = bubbleCentre(slot, r, i);
      s += '<circle cx="' + c.x + '" cy="' + c.y + '" r="' + BUBBLE_R + '" fill="' + (shot && shot[0] === i ? '#111' : '#fff') + '" stroke="#000" stroke-width="0.8"/>';
    });
    s += '<rect x="' + dx + '" y="' + (cy - 7) + '" width="' + BLOCK.distW + '" height="14" fill="#fff" stroke="#000" stroke-width=".6"/>';
    if (shot && shot[1]) s += text(dx + BLOCK.distW / 2, cy + 4.5, shot[1], 11.5, { anchor: 'middle', hand: true, fill: '#1a3a8a' });
    if (r < SHOT_ROWS - 1) s += '<line x1="' + x + '" y1="' + (cy + BLOCK.row / 2) + '" x2="' + (x + BLOCK.width) + '" y2="' + (cy + BLOCK.row / 2) + '" stroke="#bbb" stroke-width=".4"/>';
  }
  return s;
}

function holesCard(firstHole) {
  var s = frame((firstHole - 1) / HOLES_PER_CARD);
  s += text(CARD.width / 2, 19, 'Holes ' + firstHole + ' to ' + (firstHole + HOLES_PER_CARD - 1), 10, { anchor: 'middle', bold: true });
  for (var k = 0; k < HOLES_PER_CARD; k++) s += holeBlock(k, firstHole + k);
  return s;
}

function coverCard(holes) {
  var W = CARD.width, s = frame(COVER_CODE);
  var field = function(label, y, x1, x2) {
    return text(16, y, label, 9.5) + '<line x1="' + x1 + '" y1="' + (y + 2) + '" x2="' + x2 + '" y2="' + (y + 2) + '" stroke="#000" stroke-width=".6"/>';
  };
  s += text(W / 2, 19, 'Round card', 10, { anchor: 'middle', bold: true });
  s += field('Name', 48, 46, W - 16) + field('Date', 70, 42, 170) + field('Course', 92, 52, W - 16);
  s += text(182, 70, 'Tees', 9.5) + '<line x1="208" y1="72" x2="' + (W - 16) + '" y2="72" stroke="#000" stroke-width=".6"/>';
  s += text(16, 118, 'How to fill in each hole', 10.5, { bold: true });
  ['1.  Circle the par, write the yardage and your score.',
    '2.  One row per shot. Color the bubble for where the',
    '     ball finished.',
    '3.  Write how far you had left to the hole: yards, or',
    '     feet once you are on the green.',
    '4.  When the ball goes in, color In the Hole. Nothing',
    '     to write for that shot.',
    'Water and Out of Bounds add the penalty stroke for',
    'you. Do not use a row for it.'].forEach(function(l, i) { s += text(16, 134 + i * 12.5, l, 8.6); });
  s += text(16, 262, 'Example', 10.5, { bold: true }) + text(62, 262, 'par 4, 405 yards, score 5', 8.6, { fill: '#1a3a8a' });
  // The example sits where a card's second hole would be drawn, moved up to fit
  s += '<g transform="translate(0,' + (270 - blockTop(0)) + ')">' + holeBlock(0, 1, { par: 4, yards: 405, score: 5, shots: [[1, '125'], [9, '20'], [9, '6'], [9, '1'], [10, '']] }) + '</g>';
  ['Drive into the left rough, 125 yards left.', 'Second shot on the green, 20 feet left.',
    'First putt to 6 feet, second putt to 1 foot.', 'Third putt in the hole.'].forEach(function(l, i) { s += text(16, 466 + i * 12, l, 8.4, { fill: '#1a3a8a' }); });
  s += text(16, 530, 'Totals', 10.5, { bold: true });
  ['Score', 'Fairways', 'Greens', 'Putts'].forEach(function(l, i) {
    var bx = 16 + i * 88;
    s += text(bx, 548, l, 8.6) + '<rect x="' + bx + '" y="553" width="74" height="24" fill="#fff" stroke="#000" stroke-width=".7"/>';
  });
  s += text(W / 2, CARD.height - 12, holes + ' holes  ·  cut along the dashed lines  ·  fits a yardage book cover', 7, { anchor: 'middle', fill: '#666' });
  return s;
}

/** One SVG per Letter sheet (two cards each) for a 9- or 18-hole round. */
export function statCardSheets(holes) {
  var cards = [coverCard(holes)];
  for (var h = 1; h <= holes; h += HOLES_PER_CARD) cards.push(holesCard(h));
  var xs = [SHEET.width / 2 - CARD.width - 12, SHEET.width / 2 + 12], y = (SHEET.height - CARD.height) / 2;
  var sheets = [];
  for (var i = 0; i < cards.length; i += 2) {
    var body = cards.slice(i, i + 2).map(function(card, k) { return '<g transform="translate(' + xs[k] + ',' + y + ')">' + card + '</g>'; }).join('');
    sheets.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + SHEET.width + ' ' + SHEET.height + '" font-family="Arial, Helvetica, sans-serif">'
      + '<rect width="' + SHEET.width + '" height="' + SHEET.height + '" fill="#fff"/>'
      + text(SHEET.width / 2, y - 22, 'Print at 100% (actual size) on Letter paper, landscape. Cut along the dashed lines. Each card is 4 x 6.5 inches.', 10, { anchor: 'middle', fill: '#666' })
      + body + '</svg>');
  }
  return sheets;
}
