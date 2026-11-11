import { S } from './state.js';
import { expose } from './expose.js';
import { showAuthPage } from '../auth/auth.js';
import { _currentBagTab, onBagStudentChange, populateBagStudentSelect, renderBagClubs, setBagTab, syncBagFromSupabase } from '../bag/clubs.js';
import { drillDetailBack } from '../coaching/assignments.js';
import { goToCoaching } from '../coaching/student-side.js';
import { goToEvalCombine } from '../combines/eval-test.js';
import { goToLineDrill } from '../combines/line-drill.js';
import { _viewingAsStudent, updateViewingAsBanner } from './session.js';
import { ordinal } from './util.js';
import { loadUserCustomCourses } from '../courses/custom.js';
import { drillsData } from '../data/drills.js';
import { toggleLearnPBV } from '../learn/putting-break.js';
import { toggleLearnSGCalc } from '../learn/sg-calculator.js';
import { loadPerformanceAnalysis, setPerfPage } from '../performance/rounds.js';
import { setDrillCategory, showDrillDetail } from '../practice/drills.js';
import { setPracticeHubTab, toggleLearnDistanceOptimizer, toggleLearnProximityCalc } from '../practice/hub.js';
import { loadProfileInfo, showProfileTab } from '../profile/profile.js';
import { refreshFullStats } from '../round/edit-hole.js';
import { goBackFromEditRound } from '../round/edit-info.js';
import { goBackFromRound } from '../round/history.js';
import { updateParPageRoundActions } from '../round/save.js';
import { resetRoundState } from '../round/setup.js';
import { undoLastHole } from '../round/shot-entry.js';

export function show(id){
  S.processingClick=false; // Reset processing flag when changing pages
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(id === 'homePage') {
    updateViewingAsBanner();
  }
  if(id === 'performanceAnalysisPage') {
    // Reset cache so navigating away and back re-fetches fresh data
    S.perfCachedRounds = null;
    S.perfCombineLoaded = false;
    setPerfPage('rounds');
    setTimeout(loadPerformanceAnalysis, 50);
  }
  if(id === 'practiceHubPage') {
    setPracticeHubTab(S.currentPHTab || 'combines');
  }
  if(id === 'myBagPage') {
    if (!S.currentUser) {
      alert('Please log in to access My Bag.');
      showAuthPage();
      return;
    }
    // Reset student view when entering bag page
    S.bagViewingStudentId = null;
    S.bagViewingStudentName = null;
    S.bagStudentClubs = null;
    S.bagStudentWgSessions = null;
    S.bagStudentSpeedSessions = null;
    var bss = document.getElementById('bagStudentSelect');
    if (bss) bss.value = '';

    if (_viewingAsStudent) {
      // Auto-load student's bag when viewing as student
      onBagStudentChange(_viewingAsStudent.id + '|' + _viewingAsStudent.name);
      // Hide the student selector since we're already viewing as student
      var bar = document.getElementById('bagCoachStudentBar');
      if (bar) bar.style.display = 'none';
    } else {
      populateBagStudentSelect();
      renderBagClubs(); // show local cache immediately
      // Pull latest from Supabase, then re-render
      syncBagFromSupabase().then(function() {
        renderBagClubs();
      });
    }
    setBagTab(_currentBagTab || 'myBag');
  }
  if(id === 'parPage') {
    updateParPageRoundActions();
  }
  // Hide score bar on non-scoring pages
  var scoringPages = ['parPage','shotPage','liePage','distancePage','puttPage','penaltyPage','obPenaltyPage','recoveryPage','missedGreenPage'];
  if(scoringPages.indexOf(id) === -1) { var sb=document.getElementById('scoreBar'); if(sb) sb.style.display='none'; }
  updatePersistentBack(id);
  // Reset scroll position when page changes
  const page = document.getElementById(id);
  if(page) {
    page.scrollTop = 0;
    // Also reset inner scroll containers
    var inner = page.querySelector('[id$="Scroll"]');
    if (inner) inner.scrollTop = 0;
  }
  window.scrollTo(0, 0);
}

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

// Persistent bottom back button logic
var _persistentBackTarget = 'homePage';
var _backTargetMap = {
  'profilePage': 'homePage',
  'practiceHubPage': 'homePage',
  'performanceAnalysisPage': 'homePage',
  'coachingCornerPage': 'homePage',
  'drillsPage': 'practiceHubPage',
  'drillDetailPage': 'drillsPage',
  'helpPage': 'homePage',
  'studentViewPage': 'coachingCornerPage',
  'myBagPage': 'homePage',
  'gapVisualizerPage': 'myBagPage',
  'roundPage': 'homePage',
  'holeByHolePage': 'roundPage',
  'summaryPage': 'homePage',
  'fullStatsPage': 'summaryPage',
  'editRoundInfoPage': 'summaryPage',
  'authPage': 'homePage',
  'combinesPage': 'practiceHubPage',
  'lineDrillPage': 'practiceHubPage',
  'driverDrillPage': 'practiceHubPage',
  'evalCombinePage': 'practiceHubPage',
  'whatsNewPage': 'homePage',
  'guideToGolfPage': 'practiceHubPage',
  'myCoursesPage': 'roundPage',
  'editCoursePage': 'myCoursesPage'
};
// Pages that should NOT show the persistent back button (home + scoring flow pages that use their own back-wrap)
var _noBackBtnPages = ['homePage','parPage','shotPage','liePage','distancePage','puttPage','penaltyPage','obPenaltyPage','recoveryPage','missedGreenPage'];

function updatePersistentBack(pageId) {
  var btn = document.getElementById('persistentBackBtn');
  if (!btn) return;
  if (_noBackBtnPages.indexOf(pageId) !== -1) {
    btn.style.display = 'none';
  } else {
    _persistentBackTarget = _backTargetMap[pageId] || 'homePage';
    btn.style.display = 'block';
  }
}

function persistentBack() {
  var activePage = document.querySelector('.page.active');
  var activeId = activePage ? activePage.id : '';
  // Special case: drillDetailPage uses drillDetailBack to restore context
  if (activeId === 'drillDetailPage') {
    drillDetailBack();
    return;
  }
  // Special case: editRoundInfoPage uses goBackFromEditRound
  if (activeId === 'editRoundInfoPage' && typeof goBackFromEditRound === 'function') {
    goBackFromEditRound();
    return;
  }
  // Special case: fullStatsPage or summaryPage when viewing a saved round
  if (activeId === 'fullStatsPage' || activeId === 'summaryPage') {
    var btrBtn = document.getElementById('backToRoundsBtn');
    if (btrBtn && btrBtn.style.display !== 'none') {
      goBackFromRound();
      return;
    }
  }
  show(_persistentBackTarget);
}
// v3.0.0 - Simplified goBack - stats only counted when hole finishes
function goBack(){
  const currentPage=document.querySelector('.page.active').id;
  
  // FROM PAR PAGE - Go back to round info OR undo previous hole
  if(currentPage==='parPage'){
    if(S.editingHoleIndex !== null){
      S.editingHoleIndex = null;
      scoreBar.style.display = 'none';
      refreshFullStats(6);
      show('fullStatsPage');
      return;
    }
    if(S.currentHole>1&&S.allHoles.length>0){
      undoLastHole();
    }else{
      scoreBar.style.display='none';
      show('roundPage');
    }
    return;
  }
  
  // FROM LIE PAGE
  if(currentPage==='liePage'){
    if(S.shots<=1){
      // First shot - go back to par page
      S.currentHoleShots=[];
      S.shots=1;
      if(S.editingHoleIndex !== null){
        if(confirm('Cancel editing this hole?')){
          S.editingHoleIndex = null;
          scoreBar.style.display = 'none';
          refreshFullStats(6);
          show('fullStatsPage');
        }else{
          S.currentHoleShots.push({shotNum:1,lie:null,distanceBefore:S.currentYards,distanceAfter:null,isPutt:false});
        }
      }else{
        show('parPage');
      }
    }else{
      // Later shot - remove current shot, go back to distance for previous
      S.currentHoleShots.pop();
      S.shots--;
      const prevShot=S.currentHoleShots[S.currentHoleShots.length-1];
      if(prevShot) prevShot.lie=null;
      distanceTitle.innerText=`${ordinal(S.shots)} Shot Distance`;
      shotDistance.value=prevShot?prevShot.distanceBefore||100:100;
      show('distancePage');
    }
    return;
  }
  
  // FROM DISTANCE PAGE - go back to lie selection
  // When on distancePage, we've already selected a lie for previous shot and 
  // created a new shot. We need to undo that.
  if(currentPage==='distancePage'){
    // Pop the current shot we were entering distance for
    if(S.currentHoleShots.length > 1) {
      S.currentHoleShots.pop();
      S.shots--;
    }
    // Clear the lie on the previous shot so user can re-select
    const prevShot=S.currentHoleShots[S.currentHoleShots.length-1];
    if(prevShot){
      prevShot.lie=null;
      prevShot.distanceAfter=null;
    }
    lieTitle.innerText=`Where did your ${ordinal(S.shots)} shot end?`;
    show('liePage');
    return;
  }
  
  // FROM PENALTY PAGES
  if(currentPage==='penaltyPage'||currentPage==='obPenaltyPage'||currentPage==='recoveryPage'||currentPage==='missedGreenPage'){
    const currentShot=S.currentHoleShots[S.currentHoleShots.length-1];
    if(currentShot) currentShot.lie=null;
    show('liePage');
    return;
  }
  
  // FROM PUTT PAGE
  if(currentPage==='puttPage'){
    if(S.putts===0){
      // First putt - go back to lie selection
      while(S.currentHoleShots.length>0 && S.currentHoleShots[S.currentHoleShots.length-1].isPutt){
        S.currentHoleShots.pop();
      }
      const approachShot=S.currentHoleShots[S.currentHoleShots.length-1];
      if(approachShot){
        approachShot.lie=null;
        approachShot.distanceAfter=null;
      }
      lieTitle.innerText=`Where did your ${ordinal(S.shots)} shot end?`;
      show('liePage');
    }else{
      // Later putt - go back to previous putt
      if(S.currentHoleShots.length>0) S.currentHoleShots.pop();
      if(S.totalPutts>0) S.totalPutts--;
      S.putts--;
      const prevPutt=S.currentHoleShots[S.currentHoleShots.length-1];
      if(prevPutt&&prevPutt.isPutt){
        prevPutt.distanceAfter=null;
        puttTitle.innerText=`Putt ${S.putts+1}`;
        puttShotNum.innerText=`Shot ${S.shots+S.putts+1}`;
        document.getElementById('puttDistance').value=prevPutt.distanceBefore||3;
      }
    }
    return;
  }
}

function goToNewRound() {
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
expose({ show, expandSearch, onSearchInput, onSearchKeydown, execSearch, persistentBack, goBack, goToNewRound, goToDashboard, goToRoundHistory, goToSettings, goToPracticeHub });
