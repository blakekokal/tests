// Reads a photo of the printed scan card: finds the corner squares, straightens the
// page and checks which boxes are marked. No text recognition involved, so it works
// on the device and does not depend on handwriting.
import { BOX, MARKERS, MARKER_SIZE, ORIENTATION_MARKER, SHOT_COLUMNS, cardLayout } from './card-layout.js';

var WORK_SIZE = 1400;          // longest side of the image we analyse
var MIN_MARK = 0.07;           // a box this much darker than paper (0..1) counts as marked

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

/**
 * @param {HTMLImageElement|HTMLCanvasElement} image  photo of the card
 * @returns {{marks: object[], warnings: string[]}} the boxes that are marked (entries of cardLayout().boxes)
 * @throws if the four corner squares cannot be found
 */
export function readCardMarks(image) {
  var img = toGray(image);
  var threshold = inkThreshold(img.gray);
  var corners = cornerSquares(findSquares(img, threshold), img.w, img.h);
  var notFound = new Error('Could not find the four black corner squares. Lay the card flat, keep the whole page in the photo and try again.');
  if (corners.some(function(c) { return !c; }) || new Set(corners).size < 4) throw notFound;

  // The photo may be sideways or upside down: try each rotation and keep the one
  // where the orientation square sits where the page says it should.
  var toPhoto = null, bestDark = 255;
  for (var rot = 0; rot < 4; rot++) {
    var rotated = corners.slice(rot).concat(corners.slice(0, rot));
    var H = homography(MARKERS, rotated);
    if (!H) continue;
    var dark = sampleGray(img, H, ORIENTATION_MARKER.x, ORIENTATION_MARKER.y, MARKER_SIZE * 0.3);
    if (dark < bestDark) { bestDark = dark; toPhoto = H; }
  }
  if (!toPhoto || bestDark > threshold) throw notFound;

  // Paper white near each box varies with lighting, so compare each box with the
  // blank paper just around it rather than with one page-wide level.
  var layout = cardLayout();
  var black = sampleGray(img, toPhoto, MARKERS[0].x, MARKERS[0].y, MARKER_SIZE * 0.3);
  var scored = layout.boxes.map(function(box) {
    var cx = box.x + BOX / 2, cy = box.y + BOX / 2;
    var inside = sampleGray(img, toPhoto, cx, cy, BOX * 0.28);
    return { box: box, gray: inside };
  });
  var sorted = scored.map(function(s) { return s.gray; }).sort(function(a, b) { return a - b; });
  var paper = sorted[Math.floor(sorted.length * 0.9)];
  var range = Math.max(40, paper - black);
  scored.forEach(function(s) { s.darkness = (paper - s.gray) / range; });
  var levels = scored.map(function(s) { return s.darkness; }).sort(function(a, b) { return a - b; });
  var median = levels[Math.floor(levels.length / 2)];
  var cutoff = Math.max(MIN_MARK, median + 0.06);

  return scored.filter(function(s) { return s.darkness > cutoff; })
    .map(function(s) { return Object.assign({ darkness: s.darkness }, s.box); });
}

/**
 * Marked boxes -> holes in the Hole-by-Hole form's shape.
 * One mark per shot column gives that shot's end lie; the putts box adds the putts.
 * Water and out of bounds add their penalty stroke automatically.
 * @returns {{holes: {hole:number, par:number, yards:number, score:number, shots:{lie:string, dist:string}[]}[], warnings: string[]}}
 */
export function marksToHoles(marks) {
  var byHole = {};
  marks.forEach(function(m) { (byHole[m.hole] = byHole[m.hole] || []).push(m); });
  var holes = [], warnings = [];
  var darkest = function(list) { return list.slice().sort(function(a, b) { return b.darkness - a.darkness; })[0]; };

  Object.keys(byHole).map(Number).sort(function(a, b) { return a - b; }).forEach(function(holeNum) {
    var m = byHole[holeNum];
    var lieMarks = m.filter(function(x) { return x.type === 'lie'; });
    if (lieMarks.length === 0) return;   // a stray par or putts mark on an unplayed hole
    var parMarks = m.filter(function(x) { return x.type === 'par'; });
    var puttMarks = m.filter(function(x) { return x.type === 'putts'; });
    if (parMarks.length > 1) warnings.push('Hole ' + holeNum + ': more than one par is checked');
    if (puttMarks.length > 1) warnings.push('Hole ' + holeNum + ': more than one putts box is checked');

    var shots = [];
    for (var s = 1; s <= SHOT_COLUMNS; s++) {
      var inColumn = lieMarks.filter(function(x) { return x.shot === s; });
      if (inColumn.length === 0) continue;
      if (inColumn.length > 1) warnings.push('Hole ' + holeNum + ', shot ' + s + ': more than one box is checked');
      var lie = darkest(inColumn).lie;
      shots.push({ lie: lie, dist: '' });
      if (lie === 'WATER' || lie === 'OB') shots.push({ lie: 'PENALTY', dist: '' });
    }
    var last = shots[shots.length - 1].lie;
    var putts = puttMarks.length ? darkest(puttMarks).value : 0;
    if (last === 'GREEN' && putts === 0) warnings.push('Hole ' + holeNum + ': on the green but no putts box is checked');
    if (last !== 'GREEN' && last !== 'HOLE') warnings.push('Hole ' + holeNum + ': the last shot is not on the green or holed');
    if (last !== 'HOLE') {
      for (var p = 1; p <= putts; p++) shots.push({ lie: p === putts ? 'HOLE' : 'GREEN', dist: '' });
    }
    holes.push({
      hole: holeNum,
      par: parMarks.length ? darkest(parMarks).value : 4,
      yards: 0,
      score: shots.length,
      shots: shots
    });
  });
  return { holes: holes, warnings: warnings };
}

