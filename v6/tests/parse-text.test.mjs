import { parseScorecardText, parseShotNotesText } from '../js/photo/parse-text.js';
import assert from 'node:assert/strict';
const card=`Pine Valley GC
Hole 1 2 3 4 5 6 7 8 9 Out
Blue 385 160 520 410 175 390 540 365 420 3365
White 360 145 495 385 150 370 510 340 395 3150
Handicap 5 17 1 9 15 7 3 13 11
Par 4 3 5 4 3 4 5 4 4 36
Sam 5 3 6 4 4 5 5 4 6 42
Putts 2 2 3 1 2 2 2 1 3 18
Hole 10 11 12 13 14 15 16 17 18 In Tot
Blue 400 150 530 380 190 410 500 370 430 3360 6725
Par 4 3 5 4 3 4 5 4 4 36 72
Sam 4 4 5 5 3 4 6 4 5 40 82`;
const r=parseScorecardText(card);
assert.equal(r.length,18);
assert.deepEqual(r.map(h=>h.score),[5,3,6,4,4,5,5,4,6,4,4,5,5,3,4,6,4,5]);
assert.deepEqual(r.map(h=>h.par),[4,3,5,4,3,4,5,4,4,4,3,5,4,3,4,5,4,4]);
assert.equal(r[0].yards,385);assert.equal(r[9].yards,400);
// single-line 18 with totals
const one=parseScorecardText('Hole 1 2 3 4 5 6 7 8 9 Out 10 11 12 13 14 15 16 17 18 In Tot\nPar 4 3 5 4 3 4 5 4 4 36 4 3 5 4 3 4 5 4 4 36 72\nScore 5 3 6 4 4 5 5 4 6 42 4 4 5 5 3 4 6 4 5 40 82');
assert.deepEqual(one.map(h=>h.score),[5,3,6,4,4,5,5,4,6,4,4,5,5,3,4,6,4,5]);
assert.equal(parseScorecardText('hello world'),null);
const notes=`1 P4 385: F 150, G 20, G 3, H
2 par 3 160  green 25  putt 2  in
Hole 3 par 5 520
LR 260
fairway 95
GB 12, G 8, H
4 P4 400 - FB 170, MG 20, G 4, H`;
const n=parseShotNotesText(notes);
assert.equal(n.length,4);
assert.deepEqual(n[0],{hole:1,par:4,yards:385,shots:[{lie:'FAIRWAY',dist:'150'},{lie:'GREEN',dist:'20'},{lie:'GREEN',dist:'3'},{lie:'HOLE',dist:''}]});
assert.deepEqual(n[1].shots.map(s=>s.lie),['GREEN','GREEN','HOLE']);
assert.deepEqual(n[2].shots,[{lie:'LEFT ROUGH',dist:'260'},{lie:'FAIRWAY',dist:'95'},{lie:'GS BUNKER',dist:'12'},{lie:'GREEN',dist:'8'},{lie:'HOLE',dist:''}]);
assert.deepEqual(n[3].shots.map(s=>s.lie),['FW BUNKER','MISSED GREEN','GREEN','HOLE']);
assert.equal(parseShotNotesText('nothing here'),null);
console.log('parse tests ok');
