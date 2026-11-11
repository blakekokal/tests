import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { show } from '../core/nav.js';
import { activeUserId } from '../core/session.js';
import { _sb } from '../core/supabase.js';
import { pickCourse } from './search.js';

// Load user's custom courses from Supabase
// Supabase SQL to create custom_courses table:
// CREATE TABLE custom_courses (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
//   display_name TEXT NOT NULL,
//   club_name TEXT,
//   course_name TEXT,
//   city TEXT DEFAULT '',
//   state TEXT DEFAULT '',
//   tees JSONB DEFAULT '[]',
//   created_at TIMESTAMPTZ DEFAULT now()
// );
// ALTER TABLE custom_courses ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Users can manage own courses" ON custom_courses FOR ALL USING (auth.uid() = user_id);
export async function loadUserCustomCourses() {
  if (!S.currentUser) return;
  var { data, error } = await _sb.from('custom_courses').select('*').eq('user_id', activeUserId());
  if (error) { console.log('No custom_courses table or error:', error.message); return; }
  S.userCustomCourses = (data || []).map(function(row) {
    return { dn: row.display_name, cn: row.club_name || row.display_name, co: row.course_name || row.display_name, ci: row.city || '', st: row.state || '', t: row.tees || [], _id: row.id };
  });
}

async function saveCustomCourse(courseObj) {
  if (!S.currentUser) { alert('Please log in to save custom courses.'); return null; }
  var { data, error } = await _sb.from('custom_courses').insert({
    user_id: activeUserId(),
    display_name: courseObj.dn,
    club_name: courseObj.cn,
    course_name: courseObj.co,
    city: courseObj.ci || '',
    state: courseObj.st || '',
    tees: courseObj.t
  }).select();
  if (error) {
    console.error('Save custom course error:', error);
    alert('Could not save course. The custom_courses table may need to be created in Supabase.');
    return null;
  }
  courseObj._id = data[0].id;
  S.userCustomCourses.push(courseObj);
  return data[0];
}

async function deleteCustomCourse(courseId) {
  if (!S.currentUser) return;
  var { error } = await _sb.from('custom_courses').delete().eq('id', courseId).eq('user_id', activeUserId());
  if (!error) {
    S.userCustomCourses = S.userCustomCourses.filter(function(c) { return c._id !== courseId; });
  }
}

// ─── MY COURSES (MANAGE/EDIT/DELETE) ──────────────────────
var _editingCourseId = null;
var _ecHoleCount = 18;

function showMyCoursesPage() {
  if (!S.currentUser) { alert('Please log in to manage courses.'); return; }
  renderMyCoursesPage();
  show('myCoursesPage');
}

function renderMyCoursesPage() {
  var container = document.getElementById('myCoursesListContainer');
  if (S.userCustomCourses.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px 0;">No custom courses yet.<br>Create one from the round setup screen.</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < S.userCustomCourses.length; i++) {
    var c = S.userCustomCourses[i];
    var teeInfo = c.t && c.t[0] ? c.t[0].n + ' · ' + c.t[0].y + ' yds · Par ' + c.t[0].p : '';
    html += '<div style="background:#222222;border-radius:12px;padding:14px 16px;">'
      + '<div style="font-weight:700;font-size:14px;color:#ffffff;">' + c.dn + '</div>';
    if (c.ci) html += '<div style="font-size:11px;color:#606060;margin-top:2px;">' + c.ci + ', ' + c.st + '</div>';
    if (teeInfo) html += '<div style="font-size:11px;color:#2e2e2e;margin-top:2px;">' + teeInfo + '</div>';
    html += '<div style="display:flex;gap:8px;margin-top:10px;">'
      + '<button onclick="editCustomCourse(\'' + c._id + '\')" style="flex:1;height:34px;border:none;border-radius:8px;background:#2d7abc;color:#ffffff;font-weight:700;font-size:12px;cursor:pointer;">Edit</button>'
      + '<button onclick="confirmDeleteCourse(\'' + c._id + '\',this)" style="flex:1;height:34px;border:none;border-radius:8px;background:#333333;color:#d4706e;font-weight:700;font-size:12px;cursor:pointer;">Delete</button>'
      + '</div></div>';
  }
  container.innerHTML = html;
}

function confirmDeleteCourse(courseId, btn) {
  if (btn.dataset.confirm) {
    deleteCustomCourse(courseId).then(function() { renderMyCoursesPage(); });
    return;
  }
  btn.dataset.confirm = '1';
  btn.innerText = 'Tap Again to Delete';
  btn.style.background = '#351a1a';
  btn.style.color = '#ffffff';
  setTimeout(function() { btn.dataset.confirm = ''; btn.innerText = 'Delete'; btn.style.background = '#333333'; btn.style.color = '#d4706e'; }, 3000);
}

function editCustomCourse(courseId) {
  var course = S.userCustomCourses.find(function(c) { return c._id === courseId; });
  if (!course) return;
  _editingCourseId = courseId;
  document.getElementById('ec_name').value = course.dn || '';
  document.getElementById('ec_city').value = course.ci || '';
  document.getElementById('ec_state').value = course.st || '';
  var tee = course.t && course.t[0] ? course.t[0] : {};
  document.getElementById('ec_tee_name').value = tee.n || '';
  document.getElementById('ec_rating').value = tee.rm || '';
  document.getElementById('ec_slope').value = tee.sm || '';
  var holes = tee.h || [];
  _ecHoleCount = holes.length || 18;
  setECHoles(_ecHoleCount);
  // After building, populate the hole values
  for (var i = 0; i < holes.length; i++) {
    var h = holes[i];
    var hNum = i + 1;
    setCCParOnPage('ec', hNum, h[0]);
    var yInput = document.getElementById('ec_yards_' + hNum);
    if (yInput) { yInput.value = h[1]; yInput.dataset.userEdited = '1'; }
    var hcpInput = document.getElementById('ec_hcp_' + hNum);
    if (hcpInput) hcpInput.value = h[2];
  }
  show('editCoursePage');
}

function setCCParOnPage(prefix, holeNum, parVal) {
  [3,4,5].forEach(function(p) {
    var btn = document.getElementById(prefix + '_par_' + holeNum + '_' + p);
    if (!btn) return;
    if (p === parVal) {
      btn.style.background = p === 3 ? '#3d96ee' : p === 4 ? '#00a06d' : '#f0c830';
      btn.style.color = '#000';
    } else {
      btn.style.background = '#282828'; btn.style.color = '#9a9a9a';
    }
  });
}

function setECHoles(n) {
  _ecHoleCount = n;
  document.getElementById('ec_9btn').style.background = n === 9 ? '#007a52' : '#282828';
  document.getElementById('ec_9btn').style.color = n === 9 ? '#ffffff' : '#9a9a9a';
  document.getElementById('ec_18btn').style.background = n === 18 ? '#007a52' : '#282828';
  document.getElementById('ec_18btn').style.color = n === 18 ? '#ffffff' : '#9a9a9a';
  buildECHoles();
}

function buildECHoles() {
  var container = document.getElementById('ec_holes_container');
  container.innerHTML = '';
  for (var h = 1; h <= _ecHoleCount; h++) {
    container.innerHTML += '<div style="display:flex;gap:6px;align-items:center;background:#222222;border-radius:10px;padding:8px 10px;">'
      + '<div style="font-size:12px;font-weight:700;color:#ffffff;width:24px;text-align:center;">' + h + '</div>'
      + '<div style="display:flex;gap:4px;flex:1;">'
      + '<button id="ec_par_' + h + '_3" onclick="setECPar(' + h + ',3)" style="flex:1;height:30px;border:none;border-radius:6px;background:#333333;color:#9a9a9a;font-weight:700;font-size:12px;cursor:pointer;">3</button>'
      + '<button id="ec_par_' + h + '_4" onclick="setECPar(' + h + ',4)" style="flex:1;height:30px;border:none;border-radius:6px;background:#00a06d;color:#000;font-weight:700;font-size:12px;cursor:pointer;">4</button>'
      + '<button id="ec_par_' + h + '_5" onclick="setECPar(' + h + ',5)" style="flex:1;height:30px;border:none;border-radius:6px;background:#333333;color:#9a9a9a;font-weight:700;font-size:12px;cursor:pointer;">5</button>'
      + '</div>'
      + '<input id="ec_yards_' + h + '" type="number" inputmode="numeric" placeholder="Yds" value="400" style="width:70px;height:30px;background:#282828;color:#ffffff;border:none;border-radius:6px;text-align:center;font-size:12px;box-sizing:border-box;">'
      + '<input id="ec_hcp_' + h + '" type="number" inputmode="numeric" placeholder="HCP" value="' + h + '" style="width:46px;height:30px;background:#282828;color:#ffffff;border:none;border-radius:6px;text-align:center;font-size:12px;box-sizing:border-box;">'
      + '</div>';
  }
}

function setECPar(holeNum, parVal) {
  setCCParOnPage('ec', holeNum, parVal);
  var yardsInput = document.getElementById('ec_yards_' + holeNum);
  if (yardsInput && !yardsInput.dataset.userEdited) {
    yardsInput.value = parVal === 3 ? 170 : parVal === 4 ? 400 : 520;
  }
}

async function saveEditedCourse() {
  var name = document.getElementById('ec_name').value.trim();
  if (!name) { alert('Please enter a course name.'); return; }
  var teeName = document.getElementById('ec_tee_name').value.trim() || 'Default';
  var rating = parseFloat(document.getElementById('ec_rating').value) || null;
  var slope = parseInt(document.getElementById('ec_slope').value) || null;

  var holes = [];
  var totalYards = 0, totalPar = 0;
  for (var h = 1; h <= _ecHoleCount; h++) {
    var p = 4;
    if (document.getElementById('ec_par_' + h + '_3').style.background.indexOf('4fc3f7') !== -1) p = 3;
    else if (document.getElementById('ec_par_' + h + '_5').style.background.indexOf('ffb74d') !== -1) p = 5;
    var y = parseInt(document.getElementById('ec_yards_' + h).value) || 0;
    var hcp = parseInt(document.getElementById('ec_hcp_' + h).value) || h;
    holes.push([p, y, hcp]);
    totalYards += y;
    totalPar += p;
  }

  var { error } = await _sb.from('custom_courses').update({
    display_name: name,
    club_name: name,
    course_name: name,
    city: document.getElementById('ec_city').value.trim(),
    state: document.getElementById('ec_state').value.trim(),
    tees: [{ n: teeName, y: totalYards, p: totalPar, rm: rating, sm: slope, rf: null, sf: null, h: holes }]
  }).eq('id', _editingCourseId).eq('user_id', activeUserId());

  if (error) { alert('Could not update course: ' + error.message); return; }

  // Update local cache
  var idx = S.userCustomCourses.findIndex(function(c) { return c._id === _editingCourseId; });
  if (idx !== -1) {
    S.userCustomCourses[idx] = {
      dn: name, cn: name, co: name,
      ci: document.getElementById('ec_city').value.trim(),
      st: document.getElementById('ec_state').value.trim(),
      t: [{ n: teeName, y: totalYards, p: totalPar, rm: rating, sm: slope, rf: null, sf: null, h: holes }],
      _id: _editingCourseId
    };
  }
  show('myCoursesPage');
  renderMyCoursesPage();
}

// ─── CREATE CUSTOM COURSE ─────────────────────────────────
var _ccHoleCount = 18;

function showCreateCourse() {
  if (!S.currentUser) { alert('Please log in to create custom courses.'); return; }
  show('createCoursePage');
  document.getElementById('cc_name').value = '';
  document.getElementById('cc_city').value = '';
  document.getElementById('cc_state').value = '';
  document.getElementById('cc_tee_name').value = '';
  document.getElementById('cc_rating').value = '';
  document.getElementById('cc_slope').value = '';
  _ccHoleCount = 18;
  buildCCHoles();
}

function setCCHoles(n) {
  _ccHoleCount = n;
  document.getElementById('cc_9btn').style.background = n === 9 ? '#007a52' : '#282828';
  document.getElementById('cc_9btn').style.color = n === 9 ? '#ffffff' : '#9a9a9a';
  document.getElementById('cc_18btn').style.background = n === 18 ? '#007a52' : '#282828';
  document.getElementById('cc_18btn').style.color = n === 18 ? '#ffffff' : '#9a9a9a';
  buildCCHoles();
}

function buildCCHoles() {
  var container = document.getElementById('cc_holes_container');
  container.innerHTML = '';
  for (var h = 1; h <= _ccHoleCount; h++) {
    container.innerHTML += '<div style="display:flex;gap:6px;align-items:center;background:#222222;border-radius:10px;padding:8px 10px;">'
      + '<div style="font-size:12px;font-weight:700;color:#ffffff;width:24px;text-align:center;">' + h + '</div>'
      + '<div style="display:flex;gap:4px;flex:1;">'
      + '<button id="cc_par_' + h + '_3" onclick="setCCPar(' + h + ',3)" style="flex:1;height:30px;border:none;border-radius:6px;background:#333333;color:#9a9a9a;font-weight:700;font-size:12px;cursor:pointer;">3</button>'
      + '<button id="cc_par_' + h + '_4" onclick="setCCPar(' + h + ',4)" style="flex:1;height:30px;border:none;border-radius:6px;background:#00a06d;color:#000;font-weight:700;font-size:12px;cursor:pointer;">4</button>'
      + '<button id="cc_par_' + h + '_5" onclick="setCCPar(' + h + ',5)" style="flex:1;height:30px;border:none;border-radius:6px;background:#333333;color:#9a9a9a;font-weight:700;font-size:12px;cursor:pointer;">5</button>'
      + '</div>'
      + '<input id="cc_yards_' + h + '" type="number" inputmode="numeric" placeholder="Yds" value="400" style="width:70px;height:30px;background:#282828;color:#ffffff;border:none;border-radius:6px;text-align:center;font-size:12px;box-sizing:border-box;">'
      + '<input id="cc_hcp_' + h + '" type="number" inputmode="numeric" placeholder="HCP" value="' + h + '" style="width:46px;height:30px;background:#282828;color:#ffffff;border:none;border-radius:6px;text-align:center;font-size:12px;box-sizing:border-box;">'
      + '</div>';
  }
}

function setCCPar(holeNum, parVal) {
  [3,4,5].forEach(function(p) {
    var btn = document.getElementById('cc_par_' + holeNum + '_' + p);
    if (p === parVal) {
      btn.style.background = p === 3 ? '#3d96ee' : p === 4 ? '#00a06d' : '#f0c830';
      btn.style.color = '#000';
    } else {
      btn.style.background = '#282828'; btn.style.color = '#9a9a9a';
    }
  });
  // Update yardage default
  var yardsInput = document.getElementById('cc_yards_' + holeNum);
  if (!yardsInput.dataset.userEdited) {
    yardsInput.value = parVal === 3 ? 170 : parVal === 4 ? 400 : 520;
  }
}

async function saveNewCustomCourse() {
  var name = document.getElementById('cc_name').value.trim();
  if (!name) { alert('Please enter a course name.'); return; }
  var teeName = document.getElementById('cc_tee_name').value.trim() || 'Default';
  var rating = parseFloat(document.getElementById('cc_rating').value) || null;
  var slope = parseInt(document.getElementById('cc_slope').value) || null;

  var holes = [];
  var totalYards = 0, totalPar = 0;
  for (var h = 1; h <= _ccHoleCount; h++) {
    var p = 4;
    if (document.getElementById('cc_par_' + h + '_3').style.background.indexOf('4fc3f7') !== -1) p = 3;
    else if (document.getElementById('cc_par_' + h + '_5').style.background.indexOf('ffb74d') !== -1) p = 5;
    var y = parseInt(document.getElementById('cc_yards_' + h).value) || 0;
    var hcp = parseInt(document.getElementById('cc_hcp_' + h).value) || h;
    holes.push([p, y, hcp]);
    totalYards += y;
    totalPar += p;
  }

  var courseObj = {
    dn: name,
    cn: name,
    co: name,
    ci: document.getElementById('cc_city').value.trim(),
    st: document.getElementById('cc_state').value.trim(),
    t: [{
      n: teeName,
      y: totalYards,
      p: totalPar,
      rm: rating,
      sm: slope,
      rf: null,
      sf: null,
      h: holes
    }]
  };

  var result = await saveCustomCourse(courseObj);
  if (result) {
    // Auto-select this course
    pickCourse('custom', S.userCustomCourses.length - 1);
    show('roundPage');
  }
}

// Functions called from inline HTML handlers
expose({ showMyCoursesPage, confirmDeleteCourse, editCustomCourse, setECHoles, setECPar, saveEditedCourse, showCreateCourse, setCCHoles, setCCPar, saveNewCustomCourse });
