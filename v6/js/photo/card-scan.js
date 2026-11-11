// Reads a photo of a printed stat card: finds the corner squares, straightens the card
// and checks which bubbles are colored in. No text recognition is involved, so it runs
// on the device. Handwriting on the card (yardage, score, distances) is not read here.
import { BUBBLE_R, CARD_LIES, CODE_BITS, CODE_SIZE, COVER_CODE, HOLES_PER_CARD, MARKERS, MARKER_SIZE,
  ORIENTATION_MARKER, PAR_VALUES, SHOT_ROWS, bubbleCentre, parCentre } from './card-layout.js';

var WORK_SIZE = 1400;          // longest side of the image we analyse
var MIN_MARK = 0.3;            // a bubble this much darker than paper (0..1) counts as colored in
var MIN_RING = 0.07;           // pen ring around a par number, relative to the other two

function toGray(image) {
  var scale = Math.min(1, WORK_SIZE / Math.max(image.width, image.height));
  var w = Math.round(image.width * scale), h = Math.round(image.height * scale);
  var canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  var ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, h);
  var rgba = ctx.getImageData(0, 0, w, h).data;
  var gray = new Uint8Array(w * h);
  for (var i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = (rgba[p] * 299 + rgba[p + 1] * 587 + rgba[p + 2] * 114) / 1000;
  }
  return { gray: gray, w: w, h: h };
}

/** Otsu's threshold: the gray level that best separates ink from paper. */
function inkThreshold(gray) {
  var hist = new Array(256).fill(0);
  for (var i = 0; i < gray.length; i++) hist[gray[i]]++;
  var total = gray.length, sum = 0;
  for (var t = 0; t < 256; t++) sum += t * hist[t];
  var sumB = 0, wB = 0, best = 0, threshold = 128;
  for (t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    var wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    var diff = sumB / wB - (sum - sumB) / wF;
    var between = wB * wF * diff * diff;
    if (between > best) { best = between; threshold = t; }
  }
  return threshold;
}

/** Solid dark squares of roughly marker size: {x, y} centres. */
function findSquares(img, threshold) {
  var w = img.w, h = img.h, gray = img.gray;
  var seen = new Uint8Array(w * h);
  var minSide = Math.max(6, Math.max(w, h) * 0.008), maxSide = Math.max(w, h) * 0.07;
  var squares = [], stack = [];
  for (var start = 0; start < gray.length; start++) {
    if (seen[start] || gray[start] > threshold) continue;
    var minX = w, maxX = 0, minY = h, maxY = 0, area = 0, sumX = 0, sumY = 0;
    stack.push(start); seen[start] = 1;
    while (stack.length) {
      var p = stack.pop(), x = p % w, y = (p - x) / w;
      area++; sumX += x; sumY += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x > 0 && !seen[p - 1] && gray[p - 1] <= threshold) { seen[p - 1] = 1; stack.push(p - 1); }
      if (x < w - 1 && !seen[p + 1] && gray[p + 1] <= threshold) { seen[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && !seen[p - w] && gray[p - w] <= threshold) { seen[p - w] = 1; stack.push(p - w); }
      if (y < h - 1 && !seen[p + w] && gray[p + w] <= threshold) { seen[p + w] = 1; stack.push(p + w); }
    }
    var bw = maxX - minX + 1, bh = maxY - minY + 1;
    if (bw < minSide || bh < minSide || bw > maxSide || bh > maxSide) continue;
    var aspect = bw / bh;
    if (aspect < 0.55 || aspect > 1.8) continue;
    if (area / (bw * bh) < 0.6) continue;     // a rotated solid square still fills over half its bounding box
    squares.push({ x: sumX / area, y: sumY / area, size: Math.sqrt(area) });
  }
  return squares;
}

/** The square nearest each corner of the photo, in top-left, top-right, bottom-right, bottom-left order. */
function cornerSquares(squares, w, h) {
  var corners = [[0, 0], [w, 0], [w, h], [0, h]];
  return corners.map(function(c) {
    var best = null, bestD = Infinity;
    squares.forEach(function(s) {
      var d = (s.x - c[0]) * (s.x - c[0]) + (s.y - c[1]) * (s.y - c[1]);
      if (d < bestD) { bestD = d; best = s; }
    });
    return best;
  });
}

/** Projective transform taking page points to photo points (from four point pairs). */
function homography(from, to) {
  var A = [], b = [];
  for (var i = 0; i < 4; i++) {
    var x = from[i].x, y = from[i].y, u = to[i].x, v = to[i].y;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  // Gaussian elimination with partial pivoting
  for (var col = 0; col < 8; col++) {
    var pivot = col;
    for (var r = col + 1; r < 8; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    if (Math.abs(A[pivot][col]) < 1e-9) return null;
    var tmp = A[col]; A[col] = A[pivot]; A[pivot] = tmp;
    var tb = b[col]; b[col] = b[pivot]; b[pivot] = tb;
    for (r = col + 1; r < 8; r++) {
      var f = A[r][col] / A[col][col];
      for (var c = col; c < 8; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }
  var hm = new Array(8);
  for (var row = 7; row >= 0; row--) {
    var s = b[row];
    for (var k = row + 1; k < 8; k++) s -= A[row][k] * hm[k];
    hm[row] = s / A[row][row];
  }
  return function(px, py) {
    var d = hm[6] * px + hm[7] * py + 1;
    return { x: (hm[0] * px + hm[1] * py + hm[2]) / d, y: (hm[3] * px + hm[4] * py + hm[5]) / d };
  };
}

/** Average gray (0 black .. 255 white) of a page-space square centred on (cx, cy). */
function sampleGray(img, toPhoto, cx, cy, half) {
  var sum = 0, n = 0;
  for (var dy = -half; dy <= half; dy += half / 3) {
    for (var dx = -half; dx <= half; dx += half / 3) {
      var p = toPhoto(cx + dx, cy + dy);
      var x = Math.round(p.x), y = Math.round(p.y);
      if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
      sum += img.gray[y * img.w + x]; n++;
    }
  }
  return n ? sum / n : 255;
}


var NOT_FOUND = 'Could not find the black corner squares. Lay the card flat, keep the whole card in the photo and try again.';

/**
 * @param {HTMLImageElement|HTMLCanvasElement} image  photo of one card
 * @returns {{firstHole:number, holes:{hole:number, par:number|null, shots:string[]}[], warnings:string[]}|null}
 *   null for the cover card. shots = the lie marked on each used row, top to bottom.
 * @throws if the corner squares cannot be found
 */
export function readStatCard(image) {
  var img = toGray(image);
  var threshold = inkThreshold(img.gray);
  var corners = cornerSquares(findSquares(img, threshold), img.w, img.h);
  if (corners.some(function(c) { return !c; }) || new Set(corners).size < 4) throw new Error(NOT_FOUND);

  // The photo may be sideways or upside down: try each rotation and keep the one
  // where the orientation square sits where the card says it should.
  var toPhoto = null, bestDark = 255;
  for (var rot = 0; rot < 4; rot++) {
    var H = homography(MARKERS, corners.slice(rot).concat(corners.slice(0, rot)));
    if (!H) continue;
    var dark = sampleGray(img, H, ORIENTATION_MARKER.x, ORIENTATION_MARKER.y, MARKER_SIZE * 0.3);
    if (dark < bestDark) { bestDark = dark; toPhoto = H; }
  }
  if (!toPhoto || bestDark > threshold) throw new Error(NOT_FOUND);

  // Which card is it?
  var code = 0;
  CODE_BITS.forEach(function(b, i) {
    if (sampleGray(img, toPhoto, b.x, b.y, CODE_SIZE * 0.3) <= threshold) code |= (4 >> i);
  });
  if (code === COVER_CODE) return null;
  var firstHole = code * HOLES_PER_CARD + 1;

  // Darkness of a spot, 0 = blank paper next to it .. 1 = as black as the corner squares
  var black = sampleGray(img, toPhoto, MARKERS[0].x, MARKERS[0].y, MARKER_SIZE * 0.3);
  var darkness = function(gray, paper) { return (paper - gray) / Math.max(40, paper - black); };

  var holes = [], warnings = [];
  for (var slot = 0; slot < HOLES_PER_CARD; slot++) {
    var holeNum = firstHole + slot;
    // Paper level for this hole: the brightest quarter of its bubbles (most are empty)
    var grays = [];
    for (var r = 0; r < SHOT_ROWS; r++) {
      grays.push(CARD_LIES.map(function(col, i) {
        var c = bubbleCentre(slot, r, i);
        return sampleGray(img, toPhoto, c.x, c.y, BUBBLE_R * 0.55);
      }));
    }
    var flat = [].concat.apply([], grays).sort(function(a, b) { return b - a; });
    var paper = flat[Math.floor(flat.length * 0.25)];

    var shots = [];
    for (r = 0; r < SHOT_ROWS; r++) {
      var best = -1, bestLevel = MIN_MARK, marked = 0;
      grays[r].forEach(function(g, i) {
        var level = darkness(g, paper);
        if (level > MIN_MARK) marked++;
        if (level > bestLevel) { bestLevel = level; best = i; }
      });
      if (best < 0) continue;
      if (marked > 1) warnings.push('Hole ' + holeNum + ', shot ' + (r + 1) + ': more than one bubble is colored');
      shots.push(CARD_LIES[best].lie);
    }
    if (shots.length === 0) continue;

    // Par: a pen ring drawn around one of the three numbers
    var rings = PAR_VALUES.map(function(par, k) {
      var c = parCentre(slot, k), sum = 0, n = 16;
      for (var a = 0; a < n; a++) {
        var ang = a * 2 * Math.PI / n;
        sum += sampleGray(img, toPhoto, c.x + Math.cos(ang) * 9.6, c.y + Math.sin(ang) * 9.6, 1);
      }
      return darkness(sum / n, paper);
    });
    var order = [0, 1, 2].sort(function(a, b) { return rings[b] - rings[a]; });
    var par = rings[order[0]] - rings[order[1]] > MIN_RING ? PAR_VALUES[order[0]] : null;
    if (par === null) warnings.push('Hole ' + holeNum + ': could not tell which par is circled');

    holes.push({ hole: holeNum, par: par, shots: shots });
  }
  return { firstHole: firstHole, holes: holes, warnings: warnings };
}

/**
 * Scanned holes -> the Hole-by-Hole form's shape. Distances are left blank for the
 * player to type in. Water and out of bounds add their penalty stroke.
 * @returns {{holes:{hole:number, par:number, yards:number, shots:{lie:string, dist:string}[]}[], warnings:string[]}}
 */
export function cardHolesToForm(scannedHoles) {
  var warnings = [];
  var holes = scannedHoles.slice().sort(function(a, b) { return a.hole - b.hole; }).map(function(h) {
    var shots = [];
    h.shots.forEach(function(lie) {
      shots.push({ lie: lie, dist: '' });
      if (lie === 'WATER' || lie === 'OB') shots.push({ lie: 'PENALTY', dist: '' });
    });
    if (h.shots[h.shots.length - 1] !== 'HOLE') warnings.push('Hole ' + h.hole + ': no shot is marked In the Hole');
    return { hole: h.hole, par: h.par || 4, yards: 0, shots: shots };
  });
  return { holes: holes, warnings: warnings };
}
