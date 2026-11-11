import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { highlight } from '../core/util.js';
import { COURSE_DB } from '../data/courses.js';
import { selectPresetHoles } from '../round/shot-entry.js';

// ─── COURSE DATABASE & SEARCH ─────────────────────────────


function onCourseSearch(val) {
  var dd = document.getElementById('courseDropdown');
  if (!val || val.length < 2) { dd.style.display = 'none'; return; }
  var q = val.toLowerCase();
  var matches = [];
  for (var i = 0; i < COURSE_DB.length; i++) {
    var c = COURSE_DB[i];
    if (c.dn.toLowerCase().indexOf(q) !== -1 || c.cn.toLowerCase().indexOf(q) !== -1 || c.co.toLowerCase().indexOf(q) !== -1) {
      matches.push({ src: 'db', idx: i, data: c });
    }
  }
  for (var j = 0; j < S.userCustomCourses.length; j++) {
    var uc = S.userCustomCourses[j];
    if (uc.dn.toLowerCase().indexOf(q) !== -1) {
      matches.push({ src: 'custom', idx: j, data: uc });
    }
  }
  if (matches.length === 0) { dd.style.display = 'none'; return; }
  var shown = matches.slice(0, 15);
  var html = '';
  for (var k = 0; k < shown.length; k++) {
    var m = shown[k];
    var badge = m.src === 'custom' ? '<span style="font-size:9px;background:#2d7abc;color:#ffffff;padding:1px 5px;border-radius:4px;margin-left:6px;">MY COURSE</span>' : '';
    html += '<div onclick="pickCourse(\'' + m.src + '\',' + m.idx + ')" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #282828;font-size:13px;color:#ffffff;" onmouseover="this.style.background=\'#333333\'" onmouseout="this.style.background=\'transparent\'">';
    html += '<div style="font-weight:600;">' + m.data.dn + badge + '</div>';
    if (m.data.ci) html += '<div style="font-size:11px;color:#606060;">' + m.data.ci + ', ' + m.data.st + '</div>';
    html += '</div>';
  }
  dd.innerHTML = html;
  dd.style.display = 'block';
}

export function pickCourse(src, idx) {
  var course = src === 'db' ? COURSE_DB[idx] : S.userCustomCourses[idx];
  S.selectedCourse = course;
  S.selectedTee = null;
  S.courseHoleData = null;
  document.getElementById('courseName').value = course.dn;
  document.getElementById('courseDropdown').style.display = 'none';
  // Populate tee selector
  var sel = document.getElementById('teeSelector');
  sel.innerHTML = '<option value="">Select Tee Box...</option>';
  for (var i = 0; i < course.t.length; i++) {
    var t = course.t[i];
    sel.innerHTML += '<option value="' + i + '">' + t.n + ' (' + t.y + ' yds, par ' + t.p + ')</option>';
  }
  sel.style.display = '';
  document.getElementById('teeInfo').style.display = 'none';
  // Auto-select 18 holes for DB courses
  var numHoles = course.t[0] && course.t[0].h ? course.t[0].h.length : 18;
  if (numHoles === 18) {
    selectPresetHoles(18);
    var btns = document.querySelectorAll('#roundPage .holes18');
    if (btns.length) { highlight(btns[0]); }
  } else if (numHoles === 9) {
    selectPresetHoles(9);
    var btns9 = document.querySelectorAll('#roundPage .holes9');
    if (btns9.length) { highlight(btns9[0]); }
  }
}

function onTeeSelected() {
  var sel = document.getElementById('teeSelector');
  var idx = sel.value;
  var info = document.getElementById('teeInfo');
  if (idx === '' || !S.selectedCourse) {
    S.selectedTee = null;
    S.courseHoleData = null;
    info.style.display = 'none';
    return;
  }
  var tee = S.selectedCourse.t[parseInt(idx)];
  S.selectedTee = tee;
  S.courseHoleData = tee.h.map(function(h) { return { par: h[0], yards: h[1], hcp: h[2] }; });
  info.innerHTML = (tee.rm ? 'Rating: ' + tee.rm + ' / Slope: ' + tee.sm : '') + (tee.rf ? ' &nbsp;|&nbsp; Women: ' + tee.rf + ' / ' + tee.sf : '');
  info.style.display = tee.rm ? '' : 'none';
}

export function init() {

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  var dd = document.getElementById('courseDropdown');
  var input = document.getElementById('courseName');
  if (dd && input && !dd.contains(e.target) && e.target !== input) {
    dd.style.display = 'none';
  }
});

// Clear course selection if user edits the name manually
document.addEventListener('DOMContentLoaded', function() {
  var nameInput = document.getElementById('courseName');
  if (nameInput) {
    nameInput.addEventListener('input', function() {
      if (S.selectedCourse && this.value !== S.selectedCourse.dn) {
        S.selectedCourse = null;
        S.selectedTee = null;
        S.courseHoleData = null;
        document.getElementById('teeSelector').style.display = 'none';
        document.getElementById('teeInfo').style.display = 'none';
      }
    });
  }
});
}

// Functions called from inline HTML handlers
expose({ onCourseSearch, pickCourse, onTeeSelected });
