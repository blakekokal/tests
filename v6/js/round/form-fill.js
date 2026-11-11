// Fill the Simple and Hole-by-Hole entry forms from saved data.
// Used when resuming an unfinished round and when a photo has been read.
import { hbhAddShot, hbhLieChanged, hbhSetPar } from './hole-entry.js';
import { simpleSetStat } from './simple-entry.js';

/**
 * @param {{hole:number, par:number, score:number, yards:number,
 *   fairway?:'hit'|'miss'|'', gir?:'hit'|'miss'|'', putts?:number|null, penalties?:number}[]} simpleFormData
 *   The stats fields only apply when the form was built with its stats row.
 */
export function fillSimpleForm(simpleFormData) {
  simpleFormData.forEach(function(hd) {
    var card = document.getElementById('simple_hole_' + hd.hole);
    if (card) {
      card.dataset.par = hd.par;
      var parBtns = card.querySelectorAll('button[onclick^="simpleSetPar"]');
      parBtns.forEach(function(b) {
        var match = b.getAttribute('onclick').match(/simpleSetPar\(\d+,(\d+)/);
        if (match && parseInt(match[1]) === hd.par) { b.style.background = '#3d96ee'; b.style.color = '#ffffff'; }
        else { b.style.background = '#333333'; b.style.color = '#606060'; }
      });
    }
    var scoreEl = document.getElementById('simple_score_' + hd.hole);
    if (scoreEl && hd.score) scoreEl.value = hd.score;
    var yardsEl = document.getElementById('simple_yards_' + hd.hole);
    if (yardsEl && hd.yards) yardsEl.value = hd.yards;
    if (document.getElementById('simple_stats_' + hd.hole)) {
      var fwWrap = document.getElementById('simple_fwwrap_' + hd.hole);
      fwWrap.style.visibility = hd.par === 3 ? 'hidden' : 'visible';
      if (hd.fairway && hd.par !== 3) simpleSetStat(hd.hole, 'fw', hd.fairway);
      if (hd.gir) simpleSetStat(hd.hole, 'gir', hd.gir);
      if (hd.putts !== null && hd.putts !== undefined) document.getElementById('simple_putts_' + hd.hole).value = hd.putts;
      if (hd.penalties) document.getElementById('simple_pen_' + hd.hole).value = hd.penalties;
    }
  });
}

/** @param {{hole:number, par:number, yards:number, shots:{lie:string, dist:string}[]}[]} hbhFormData */
export function fillHoleByHoleForm(hbhFormData) {
  hbhFormData.forEach(function(hd) {
    var h = hd.hole;
    // Set par by clicking the appropriate par button
    var card = document.getElementById('hbh_hole_' + h);
    if (card) {
      card.dataset.par = hd.par;
      // Find the par buttons (3 buttons in the par selector div)
      var parBtns = card.querySelectorAll('button[onclick^="hbhSetPar"]');
      parBtns.forEach(function(b) {
        var onclickStr = b.getAttribute('onclick') || '';
        var match = onclickStr.match(/hbhSetPar\(\d+,(\d+)/);
        if (match && parseInt(match[1]) === hd.par) {
          hbhSetPar(h, hd.par, b);
        }
      });
    }
    // Set yards
    var yardsEl = document.getElementById('hbh_yards_' + h);
    if (yardsEl && hd.yards) yardsEl.value = hd.yards;
    // Set shots
    if (hd.shots && hd.shots.length > 0) {
      // Ensure enough shot rows exist
      var shotsContainer = document.getElementById('hbh_shots_' + h);
      if (shotsContainer) {
        var existing = shotsContainer.querySelectorAll('[id^="hbh_shot_' + h + '_"]');
        for (var s = existing.length; s < hd.shots.length; s++) {
          hbhAddShot(h);
        }
      }
      hd.shots.forEach(function(shotData, idx) {
        var sNum = idx + 1;
        var lieEl = document.getElementById('hbh_lie_' + h + '_' + sNum);
        var distEl = document.getElementById('hbh_dist_' + h + '_' + sNum);
        if (lieEl && shotData.lie) { lieEl.value = shotData.lie; hbhLieChanged(h, sNum, lieEl); }
        if (distEl && shotData.dist) distEl.value = shotData.dist;
      });
    }
  });
}
