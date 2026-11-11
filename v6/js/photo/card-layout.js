// Geometry of the printable scan card. The printed page (card-print.js) and the
// scanner (card-scan.js) both read this, so a box is always scanned where it was printed.
// Units: CSS pixels on a US Letter landscape page (11in x 8.5in at 96 per inch).

export var PAGE = { width: 1056, height: 816 };

// Black squares the scanner uses to find and straighten the page.
export var MARKER_SIZE = 22;
var M = 40;
export var MARKERS = [
  { x: M, y: M },                              // top-left
  { x: PAGE.width - M, y: M },                 // top-right
  { x: PAGE.width - M, y: PAGE.height - M },   // bottom-right
  { x: M, y: PAGE.height - M }                 // bottom-left
];
// A fifth square beside the top-left one tells the scanner which way up the page is.
export var ORIENTATION_MARKER = { x: M + 44, y: M };

// Rows of the shot grid, top to bottom: printed label + the lie the app records.
export var CARD_LIES = [
  { label: 'Fairway', lie: 'FAIRWAY' },
  { label: 'Left rough', lie: 'LEFT ROUGH' },
  { label: 'Right rough', lie: 'RIGHT ROUGH' },
  { label: 'Fwy bunker', lie: 'FW BUNKER' },
  { label: 'Green bunker', lie: 'GS BUNKER' },
  { label: 'Recovery', lie: 'RECOVERY' },
  { label: 'Water', lie: 'WATER' },
  { label: 'Out of bounds', lie: 'OB' },
  { label: 'Missed green', lie: 'MISSED GREEN' },
  { label: 'Green', lie: 'GREEN' },
  { label: 'Holed out', lie: 'HOLE' }
];
export var PAR_VALUES = [3, 4, 5];
export var PUTT_VALUES = [1, 2, 3, 4];
export var SHOT_COLUMNS = 6;
export var BOX = 12;

var LEFT = 50, RIGHT = PAGE.width - 50;
var LABEL_W = 80;
export var HOLE_W = (RIGHT - LEFT - LABEL_W) / 9;
var ROW = { hole: 18, par: 18, score: 24, shotHeader: 13, lie: 17, putts: 19 };
var BLOCK_H = ROW.hole + ROW.par + ROW.score + ROW.shotHeader + CARD_LIES.length * ROW.lie + ROW.putts;
var BLOCK_TOPS = [128, 128 + BLOCK_H + 14];

/**
 * Everything on the card, positioned.
 * boxes: the checkboxes the scanner reads  {hole, type:'par'|'lie'|'putts', value|shot+lie, x, y}
 *        (x, y = top-left corner; every box is BOX wide and tall)
 * blocks: the two nine-hole tables, for drawing lines and labels
 */
export function cardLayout() {
  var boxes = [], blocks = [];
  BLOCK_TOPS.forEach(function(top, b) {
    var y = { hole: top };
    y.par = y.hole + ROW.hole;
    y.score = y.par + ROW.par;
    y.shotHeader = y.score + ROW.score;
    y.lies = y.shotHeader + ROW.shotHeader;
    y.putts = y.lies + CARD_LIES.length * ROW.lie;
    y.bottom = y.putts + ROW.putts;
    var holes = [];
    for (var i = 0; i < 9; i++) {
      var hole = b * 9 + i + 1;
      var x0 = LEFT + LABEL_W + i * HOLE_W;
      holes.push({ hole: hole, x: x0 });
      PAR_VALUES.forEach(function(par, k) {
        boxes.push({ hole: hole, type: 'par', value: par, x: x0 + 14 + k * 29, y: y.par + (ROW.par - BOX) / 2 });
      });
      var pitch = (HOLE_W - 6) / SHOT_COLUMNS;
      CARD_LIES.forEach(function(row, r) {
        for (var s = 0; s < SHOT_COLUMNS; s++) {
          boxes.push({ hole: hole, type: 'lie', shot: s + 1, lie: row.lie,
            x: x0 + 3 + s * pitch + (pitch - BOX) / 2, y: y.lies + r * ROW.lie + (ROW.lie - BOX) / 2 });
        }
      });
      PUTT_VALUES.forEach(function(n, k) {
        boxes.push({ hole: hole, type: 'putts', value: n, x: x0 + 13 + k * 23, y: y.putts + (ROW.putts - BOX) / 2 });
      });
    }
    blocks.push({ left: LEFT, right: RIGHT, labelW: LABEL_W, rows: y, rowHeights: ROW, holes: holes });
  });
  return { boxes: boxes, blocks: blocks };
}
