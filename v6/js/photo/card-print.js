// Draws the printable scan card (scorecard.html) from the shared layout.
import { BOX, CARD_LIES, MARKERS, MARKER_SIZE, ORIENTATION_MARKER, PAGE, SHOT_COLUMNS, HOLE_W, cardLayout } from './card-layout.js';

function square(c, size) {
  return '<rect x="' + (c.x - size / 2) + '" y="' + (c.y - size / 2) + '" width="' + size + '" height="' + size + '" fill="#000"/>';
}
function text(x, y, str, size, opts) {
  opts = opts || {};
  return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" text-anchor="' + (opts.anchor || 'start')
    + '" font-weight="' + (opts.bold ? 700 : 400) + '" fill="' + (opts.fill || '#000') + '">' + str + '</text>';
}
function line(x1, y1, x2, y2, width) {
  return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#000" stroke-width="' + (width || 0.6) + '"/>';
}

export function cardSvg() {
  var layout = cardLayout();
  var out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + PAGE.width + ' ' + PAGE.height
    + '" font-family="Arial, Helvetica, sans-serif">'];
  out.push('<rect width="' + PAGE.width + '" height="' + PAGE.height + '" fill="#fff"/>');
  MARKERS.forEach(function(m) { out.push(square(m, MARKER_SIZE)); });
  out.push(square(ORIENTATION_MARKER, MARKER_SIZE));

  // Header: write-in lines for the player and how to fill the card in
  out.push(text(120, 46, 'Golf Stat Tracker scan card', 17, { bold: true }));
  var fields = [['Name', 120, 150], ['Date', 312, 100], ['Course', 454, 210], ['Round type', 716, 100]];
  fields.forEach(function(f) {
    out.push(text(f[1], 74, f[0], 10));
    var start = f[1] + f[0].length * 5.4 + 6;
    out.push(line(start, 76, start + f[2], 76));
  });
  out.push(text(120, 96, 'Each hole, top to bottom: check the par, write your score, then check where each shot finished (one box per shot column, left to right).', 9.5));
  out.push(text(120, 109, 'On the green, check how many putts you took. Water and out of bounds add the penalty stroke for you. Use a dark pen and fill or cross the box.', 9.5));

  layout.blocks.forEach(function(blk) {
    var r = blk.rows, h = blk.rowHeights, gridLeft = blk.left + blk.labelW;
    // Horizontal rules
    [r.hole, r.par, r.score, r.shotHeader, r.lies, r.putts, r.bottom].forEach(function(y, i) {
      out.push(line(blk.left, y, blk.right, y, i === 0 || i === 6 ? 1.2 : 0.6));
    });
    for (var k = 1; k < CARD_LIES.length; k++) {
      out.push('<line x1="' + blk.left + '" y1="' + (r.lies + k * h.lie) + '" x2="' + blk.right + '" y2="' + (r.lies + k * h.lie) + '" stroke="#bbb" stroke-width="0.4"/>');
    }
    // Vertical rules
    out.push(line(blk.left, r.hole, blk.left, r.bottom, 1.2));
    out.push(line(blk.right, r.hole, blk.right, r.bottom, 1.2));
    blk.holes.forEach(function(hole) { out.push(line(hole.x, r.hole, hole.x, r.bottom, 1)); });
    // Row labels
    out.push(text(blk.left + 4, r.hole + 13, 'Hole', 10, { bold: true }));
    out.push(text(blk.left + 4, r.par + 13, 'Par', 10, { bold: true }));
    out.push(text(blk.left + 4, r.score + 16, 'Score', 10, { bold: true }));
    out.push(text(blk.left + 4, r.shotHeader + 10, 'Shot', 8.5));
    CARD_LIES.forEach(function(row, i) { out.push(text(blk.left + 4, r.lies + i * h.lie + 12, row.label, 9.5)); });
    out.push(text(blk.left + 4, r.putts + 13, 'Putts', 10, { bold: true }));
    // Per-hole headings
    var pitch = (HOLE_W - 6) / SHOT_COLUMNS;
    blk.holes.forEach(function(hole) {
      out.push(text(hole.x + HOLE_W / 2, r.hole + 13.5, hole.hole, 11, { bold: true, anchor: 'middle' }));
      for (var s = 0; s < SHOT_COLUMNS; s++) {
        out.push(text(hole.x + 3 + s * pitch + pitch / 2, r.shotHeader + 10, s + 1, 8, { anchor: 'middle', fill: '#555' }));
      }
    });
  });

  // Checkboxes, with the number beside the par and putts boxes
  layout.boxes.forEach(function(b) {
    out.push('<rect x="' + b.x + '" y="' + b.y + '" width="' + BOX + '" height="' + BOX + '" fill="#fff" stroke="#000" stroke-width="0.8"/>');
    if (b.type !== 'lie') out.push(text(b.x - 3, b.y + BOX - 2, b.value, 9, { anchor: 'end' }));
  });
  out.push(text(PAGE.width / 2, PAGE.height - 34, 'To enter this round: New Round, Entry Mode Photo, Scan Card, then take a photo with all four corner squares showing.', 9.5, { anchor: 'middle' }));
  out.push('</svg>');
  return out.join('');
}

