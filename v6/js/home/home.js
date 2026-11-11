// Home screen: search bar and the tiles that jump into each area of the app.
import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { show } from '../core/router.js';
import { showAuthPage } from '../auth/auth.js';
import { goToCoaching } from '../coaching/student-side.js';
import { goToEvalCombine } from '../combines/eval-test.js';
import { goToLineDrill } from '../combines/line-drill.js';
import { _viewingAsStudent } from '../core/session.js';
import { loadUserCustomCourses } from '../courses/custom.js';
import { toggleLearnPBV } from '../learn/putting-break.js';
import { toggleLearnSGCalc } from '../learn/sg-calculator.js';
import { drillsData } from '../data/drills.js';
import { setDrillCategory, showDrillDetail } from '../practice/drills.js';
import { toggleLearnDistanceOptimizer, toggleLearnProximityCalc } from '../practice/hub.js';
import { loadProfileInfo, showProfileTab } from '../profile/profile.js';
import { resetRoundState } from '../round/setup.js';

// ── Search bar logic ──
var _searchEntries = [
  { label:'Enter New Round', keywords:['new round','enter round','track shots','round entry'], action:function(){goToNewRound();} },
  { label:'Round History', keywords:['round history','past rounds','old rounds'], action:function(){goToRoundHistory();} },
  { label:'Stats Dashboard', keywords:['stats','dashboard','analytics','trends','statistics'], action:function(){goToDashboard();} },
  { label:'Performance Analysis', keywords:['performance','analysis','misses','miss analysis','strokes gained','sg'], action:function(){show('performanceAnalysisPage');} },
  { label:'My Bag', keywords:['my bag','clubs','club distances','yardages','bag'], action:function(){show('myBagPage');} },
  { label:'Gap Visualizer', keywords:['gap','visualizer','distance gaps','gap visualizer'], action:function(){show('gapVisualizerPage');} },
  { label:'Practice Hub', keywords:['practice','practice hub','drills','drill'], action:function(){goToPracticeHub();} },
  { label:'Combines', keywords:['combines','combine','eval combine','putting combine','short game combine','wedge combine','driver combine','line drill'], action:function(){S.currentPHTab='combines';show('practiceHubPage');} },
  { label:'Evaluation Test', keywords:['evaluation test','eval combine','evaluation','baseline','new student eval'], action:function(){goToEvalCombine();} },
  { label:'Line Drill', keywords:['line drill','line','accuracy','iron accuracy','offline','launch monitor drill'], action:function(){goToLineDrill();} },
  { label:'Drills', keywords:['drills','drill'], action:function(){S.currentPHTab='drills';show('practiceHubPage');} },
  { label:'Custom Practice', keywords:['custom practice','practice session','practice log'], action:function(){S.currentPHTab='practice';show('practiceHubPage');} },
  { label:'Learn', keywords:['learn','learning','library','educational'], action:function(){S.currentPHTab='learn';show('practiceHubPage');} },
  { label:'Distance Optimizer', keywords:['distance optimizer','driver optimizer','driver','optimize distance','swing speed'], action:function(){toggleLearnDistanceOptimizer();} },
  { label:'Proximity Calculator', keywords:['proximity','proximity calculator','approach distance'], action:function(){toggleLearnProximityCalc();} },
  { label:'Strokes Gained Calculator', keywords:['strokes gained calculator','sg calculator','sg calc'], action:function(){toggleLearnSGCalc();} },
  { label:'Putting Break Calculator', keywords:['putting break','break calculator','putt break','aim point','green reading'], action:function(){toggleLearnPBV();} },
  { label:'Coaching', keywords:['coaching','coach','student','students','connect coach'], action:function(){goToCoaching();} },
  { label:'Putting Stats', keywords:['putting','putting stats','putt','putts','putt stats','putting strokes gained','sg putting'], action:function(){show('performanceAnalysisPage');} },
  { label:'Distance Stats', keywords:['distance','distance stats','driving distance'], action:function(){show('distancePage');} },
  { label:'My Courses', keywords:['courses','my courses','course list','golf courses'], action:function(){show('myCoursesPage');} },
  { label:'Help / FAQ', keywords:['help','faq','support','contact','question'], action:function(){show('helpPage');} },
  { label:'Settings / Profile', keywords:['settings','profile','account','preferences'], action:function(){goToSettings();} },
  { label:'Guide to Golf', keywords:['guide to golf','guide','how to hit','shot guide','driver setup','chipping','bunker','sand shot','iron setup'], action:function(){show('guideToGolfPage');} },
  { label:"What's New", keywords:["what's new",'whats new','release notes','changelog','updates','new features'], action:function(){show('whatsNewPage');} }
];

function expandSearch(){
  document.getElementById('searchToggleBtn').style.display='none';
  document.getElementById('searchExpandable').style.display='block';
  var inp=document.getElementById('homeSearchInput');
  inp.focus();
  inp.onblur=function(){
    setTimeout(function(){
      if(document.activeElement!==inp){
        collapseSearch();
      }
    },180);
  };
}
function collapseSearch(){
  document.getElementById('homeSearchInput').value='';
  document.getElementById('searchResults').style.display='none';
  document.getElementById('searchExpandable').style.display='none';
  document.getElementById('searchToggleBtn').style.display='flex';
}

function onSearchInput(){
  var input=document.getElementById('homeSearchInput');
  var box=document.getElementById('searchResults');
  var q=input.value.trim().toLowerCase();
  if(!q){ box.style.display='none'; return; }
  var matches=_searchEntries.filter(function(e){
    if(e.label.toLowerCase().indexOf(q)!==-1) return true;
    return e.keywords.some(function(k){ return k.indexOf(q)!==-1; });
  });
  // Search individual drills from drillsData
  var catLabels = { putting: 'Putting', shortgame: 'Short Game', fullswing: 'Full Swing' };
  var catColors = { putting: '#2d7abc', shortgame: '#007a52', fullswing: '#d49a10' };
  Object.keys(drillsData).forEach(function(cat){
    (drillsData[cat]||[]).forEach(function(drill){
      var titleMatch = drill.title.toLowerCase().indexOf(q) !== -1;
      var tagMatch = (drill.tags||[]).some(function(t){ return t.toLowerCase().indexOf(q)!==-1; });
      var subMatch = (drill.subcategories||[]).some(function(s){ return s.toLowerCase().indexOf(q)!==-1; });
      if(titleMatch || tagMatch || subMatch){
        matches.push({
          label: drill.title,
          isDrill: true,
          drillCat: cat,
          drillCatLabel: catLabels[cat],
          drillCatColor: catColors[cat],
          action: function(){ showDrillDetail(drill.id, cat); }
        });
      }
    });
  });
  if(!matches.length){ box.style.display='none'; return; }
  box.innerHTML=matches.map(function(m,i){
    var badge = '';
    if(m.isDrill){
      badge = '<span style="font-size:10px;font-weight:700;color:'+m.drillCatColor+';background:rgba(255,255,255,0.08);padding:1px 6px;border-radius:4px;margin-left:8px;">'+m.drillCatLabel+'</span>';
    }
    var icon = m.isDrill ? '<span style="font-size:11px;color:#888;margin-right:6px;">&#9654;</span>' : '';
    return '<div class="search-result-item" data-idx="'+i+'" onmousedown="execSearch('+i+',\''+q+'\')" style="padding:10px 14px;font-size:14px;font-weight:600;color:#ddd;cursor:pointer;border-bottom:1px solid #2a2a2a;display:flex;align-items:center;">'+icon+'<span>'+m.label+'</span>'+badge+'</div>';
  }).join('');
  box.style.display='block';
  box._matches=matches;
}

function onSearchKeydown(e){
  if(e.key==='Enter'){
    var box=document.getElementById('searchResults');
    if(box._matches&&box._matches.length){
      box._matches[0].action();
      collapseSearch();
    }
  }
  if(e.key==='Escape'){
    collapseSearch();
  }
}

function execSearch(idx,q){
  var box=document.getElementById('searchResults');
  if(box._matches&&box._matches[idx]){
    box._matches[idx].action();
    collapseSearch();
  }
}

export function goToNewRound() {
  resetRoundState();
  show('roundPage');
  if (S.currentUser) {
    var dname = _viewingAsStudent ? _viewingAsStudent.name : S.currentUser.user_metadata?.display_name;
    var nameField = document.getElementById('playerName');
    if (dname) nameField.value = dname;
    loadUserCustomCourses();
  }
}

export function goToDashboard() {
  if (!S.currentUser) { showAuthPage(); return; }
  loadProfileInfo();
  show('profilePage');
  showProfileTab('dashboard');
}

export function goToRoundHistory() {
  if (!S.currentUser) { showAuthPage(); return; }
  loadProfileInfo();
  show('profilePage');
  showProfileTab('rounds');
}

function goToSettings() {
  if (!S.currentUser) { showAuthPage(); return; }
  if (_viewingAsStudent) return; // No settings access when viewing as student
  loadProfileInfo();
  show('profilePage');
  showProfileTab('account');
}

function goToDrills() {
  S.drillsOnPracticeHub = false;
  show('drillsPage');
  setDrillCategory('putting');
}

function goToPracticeHub() {
  S.currentPHTab = 'combines';
  show('practiceHubPage');
}

export function init() {
  // Handle mobile keyboard - scroll focused input into view
  document.addEventListener('focusin', function(e) {
    if(e.target.tagName === 'INPUT') {
      setTimeout(() => {
        e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  });
}

// Functions called from inline HTML handlers
expose({ expandSearch, onSearchInput, onSearchKeydown, execSearch, goToNewRound, goToDashboard, goToRoundHistory, goToSettings, goToPracticeHub });
