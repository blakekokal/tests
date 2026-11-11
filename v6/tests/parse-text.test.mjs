import { parseScorecardText } from '../js/photo/parse-text.js';
import assert from 'node:assert/strict';

// Two nine-hole tables with the player's rows: score, F, G, Putts, Pen
const card = `Pine Valley GC
Hole 1 2 3 4 5 6 7 8 9 Out
Blue 385 160 520 410 175 390 540 365 420 3365
White 360 145 495 385 150 370 510 340 395 3150
Handicap 5 17 1 9 15 7 3 13 11
Par 4 3 5 4 3 4 5 4 4 36
Sam 5 3 6 4 4 5 5 4 6 42
F ✓ - x ✓ - x ✓ ✓ x
G x ✓ x ✓ x ✓ ✓ x x
Putts 2 2 3 1 2 2 2 1 3 18
Pen 0 0 1 0 0 0 0 0 2
Hole 10 11 12 13 14 15 16 17 18 In Tot
Blue 400 150 530 380 190 410 500 370 430 3360 6725
Par 4 3 5 4 3 4 5 4 4 36 72
Sam 4 4 5 5 3 4 6 4 5 40 82
F ✓ - ✓ x - ✓ x ✓ ✓
G ✓ x ✓ x ✓ ✓ x ✓ x
Putts 2 2 2 2 2 2 2 2 2 18 36
Pen 0 0 0 0 0 0 1 0 0`;
const r = parseScorecardText(card);
assert.equal(r.length, 18);
assert.deepEqual(r.map(h => h.score), [5,3,6,4,4,5,5,4,6,4,4,5,5,3,4,6,4,5]);
assert.deepEqual(r.map(h => h.par), [4,3,5,4,3,4,5,4,4,4,3,5,4,3,4,5,4,4]);
assert.equal(r[0].yards, 385); assert.equal(r[9].yards, 400);
assert.deepEqual(r.slice(0, 9).map(h => h.fairway), ['hit','','miss','hit','','miss','hit','hit','miss']);
assert.deepEqual(r.slice(0, 9).map(h => h.gir), ['miss','hit','miss','hit','miss','hit','hit','miss','miss']);
assert.deepEqual(r.slice(0, 9).map(h => h.putts), [2,2,3,1,2,2,2,1,3]);
assert.deepEqual(r.map(h => h.penalties), [0,0,1,0,0,0,0,0,2,0,0,0,0,0,0,1,0,0]);
assert.equal(r[15].fairway, 'miss'); assert.equal(r[17].gir, 'miss');

// Score only: the stats stay empty
const plain = parseScorecardText('Hole 1 2 3 4 5 6 7 8 9 Out\nPar 4 3 5 4 3 4 5 4 4 36\nScore 5 3 6 4 4 5 5 4 6 42');
assert.deepEqual(plain.map(h => h.score), [5,3,6,4,4,5,5,4,6]);
assert.ok(plain.every(h => h.fairway === '' && h.gir === '' && h.putts === null && h.penalties === 0));

// A stats row that does not line up with the holes is ignored rather than shifted
const ragged = parseScorecardText('Hole 1 2 3 4 5 6 7 8 9\nPar 4 3 5 4 3 4 5 4 4\nSam 5 3 6 4 4 5 5 4 6\nF ✓ x ✓\nPutts 2 2 2');
assert.ok(ragged.every(h => h.fairway === '' && h.putts === null));

assert.equal(parseScorecardText('hello world'), null);
console.log('parse tests ok');
