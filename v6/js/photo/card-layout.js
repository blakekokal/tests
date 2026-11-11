// Geometry of the printable stat card. The printed card (card-print.js) and the scanner
// (card-scan.js) both read this, so a bubble is always scanned where it was printed.
// Units: CSS pixels (96 per inch). One card is 4in x 6.5in and holds three holes.

export var CARD = { width: 384, height: 624 };

// Black squares the scanner uses to find and straighten the card.
export var MARKER_SIZE = 10;
var M = 14;
export var MARKERS = [
  { x: M, y: M },                               // top-left
  { x: CARD.width - M, y: M },                  // top-right
  { x: CARD.width - M, y: CARD.height - M },    // bottom-right
  { x: M, y: CARD.height - M }                  // bottom-left
];
// A fifth square beside the top-left one tells the scanner which way up the card is.
export var ORIENTATION_MARKER = { x: M + 16, y: M };

// Three small squares near the top-right say which card this is (binary, left = highest bit):
// 0-5 = the card whose first hole is 1, 4, 7, 10, 13, 16; 7 = the cover card (no holes).
export var CODE_SIZE = 8;
export var CODE_BITS = [{ x: CARD.width - 62, y: M }, { x: CARD.width - 48, y: M }, { x: CARD.width - 34, y: M }];
export var COVER_CODE = 7;

// Columns of the shot grid, left to right: printed label (one or two lines) + the lie the app records.
export var CARD_LIES = [
  { label: ['Fairway'], lie: 'FAIRWAY' },
  { label: ['Left', 'Rough'], lie: 'LEFT ROUGH' },
  { label: ['Right', 'Rough'], lie: 'RIGHT ROUGH' },
  { label: ['Fairway', 'Bunker'], lie: 'FW BUNKER' },
  { label: ['Green', 'Bunker'], lie: 'GS BUNKER' },
  { label: ['Missed', 'Green'], lie: 'MISSED GREEN' },
  { label: ['Recovery'], lie: 'RECOVERY' },
  { label: ['Water'], lie: 'WATER' },
  { label: ['Out of', 'Bounds'], lie: 'OB' },
  { label: ['On', 'Green'], lie: 'GREEN' },
  { label: ['In the', 'Hole'], lie: 'HOLE' }
];
export var PAR_VALUES = [3, 4, 5];
export var SHOT_ROWS = 8;
export var HOLES_PER_CARD = 3;
export var BUBBLE_R = 5.6;
export var PAR_R = 7.5;

export var BLOCK = {
  left: 12, width: CARD.width - 24, top: 30, pitch: 190,
  header: 26, labels: 18, row: 17,
  firstLieX: 30, liePitch: 25.6
};
BLOCK.height = BLOCK.header + BLOCK.labels + SHOT_ROWS * BLOCK.row;
// Distance-left write-in box, relative to the block's left edge
BLOCK.distX = BLOCK.firstLieX + CARD_LIES.length * BLOCK.liePitch - BLOCK.liePitch / 2 + 7;
BLOCK.distW = 42;

export function blockTop(slot) { return BLOCK.top + slot * BLOCK.pitch; }
export function parCentre(slot, parIndex) {
  return { x: BLOCK.left + 111 + parIndex * 19, y: blockTop(slot) + 13 };
}
export function bubbleCentre(slot, row, lieIndex) {
  return {
    x: BLOCK.left + BLOCK.firstLieX + lieIndex * BLOCK.liePitch,
    y: blockTop(slot) + BLOCK.header + BLOCK.labels + row * BLOCK.row + BLOCK.row / 2
  };
}
