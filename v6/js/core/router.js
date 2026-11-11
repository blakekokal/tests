// Page router. Every screen is a <div class="page">; show(id) makes one active.
// Features register what should happen when their page opens (onEnter) or when
// Back is pressed on it (onBack) instead of the router knowing about each page.
import { expose } from './expose.js';

const enterHooks = {};
const backHooks = {};
const beforeEach = [];
const afterEach = [];

/** Run fn whenever pageId is shown. Returning false stops the rest of show(). */
export function onEnter(pageId, fn) { enterHooks[pageId] = fn; }
/** Custom Back behaviour for pageId. Return false to fall through to the default target. */
export function onBack(pageId, fn) { backHooks[pageId] = fn; }
export function onBeforeShow(fn) { beforeEach.push(fn); }
export function onAfterShow(fn) { afterEach.push(fn); }

export function activePageId() {
  var page = document.querySelector('.page.active');
  return page ? page.id : '';
}

export function show(id){
  beforeEach.forEach(function(fn){ fn(id); });
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (enterHooks[id] && enterHooks[id]() === false) return;
  afterEach.forEach(function(fn){ fn(id); });
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
  'photoEntryPage': 'roundPage',
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
  var activeId = activePageId();
  if (backHooks[activeId] && backHooks[activeId]() !== false) return;
  show(_persistentBackTarget);
}

// Functions called from inline HTML handlers
expose({ show, persistentBack });
