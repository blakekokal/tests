// Shared mutable app state. Feature-private state stays inside its own module;
// only values that more than one module (or an inline HTML handler) writes live here.
export const S = {

  // coaching/roles
  currentStudentId: null,
  currentStudentHcp: 'pro',
  combSaveForStudent: null,
  svAllRounds: null,
  svDashData: null,
  svDashAllData: null,
  isAdmin: undefined,

  // core/nav
  activeDashTarget: 'dashContent',

  // round/state
  totalHoles: null,
  currentHole: 1,
  totalPar: 0,
  totalStrokes: 0,
  par: 4,
  shots: 0,
  putts: 0,
  fwOpp: 0,
  fwHit: 0,
  fwLeft: 0,
  fwRight: 0,
  gir: 0,
  girFirstPuttDist: 0,
  girOpp: 0,
  missLeft: 0,
  missRight: 0,
  missShort: 0,
  missLong: 0,
  scrOpp: 0,
  scr: 0,
  bunOpp: 0,
  bun: 0,
  p3: 0,
  p4: 0,
  p5: 0,
  c3: 0,
  c4: 0,
  c5: 0,
  firstPuttThisHole: null,
  girThisHole: false,
  scrCountedThisHole: false,
  totalPutts: 0,
  girPutts: 0,
  threePlusPutts: 0,
  onePuttOpp: 0,
  onePuttMade: 0,
  sgPuttingTotal: 0,
  sgOTTTotal: 0,
  sgAPPTotal: 0,
  sgARGTotal: 0,
  currentRoundId: null,
  currentYards: undefined,
  currentPar: undefined,
  viewingStudentRound: false,

  // courses/search
  selectedCourse: null,
  selectedTee: null,
  courseHoleData: null,
  userCustomCourses: [],

  // round/shot-entry
  allHoles: [],
  currentHoleData: {},
  currentHoleShots: [],
  processingClick: false,

  // core/session
  currentUser: null,

  // round/setup
  entryMode: 'shot',
  simpleHasStats: false,   // the simple round being submitted carries fairway/green/putt stats

  // practice/drills
  drillsOnPracticeHub: false,

  // performance/rounds
  perfCachedRounds: null,
  perfCombineLoaded: false,

  // round/edit-hole
  editingHoleIndex: null,

  // combines/table
  combPendingType: null,
  combFromShortGame: false,
  combFromPracticeHub: false,
  combReturnToView: null,
  coachCombineOverride: undefined,

  // coaching/assignments
  drillDetailBackTarget: 'drillsPage',
  drillDetailBackCategory: null,
  ppReturningFromDrill: false,

  // practice/hub
  currentPHTab: 'combines',
  boInited: undefined,

  // practice/log
  practiceNotes: [],
  editingPracticeSessionId: null,

  // bag/clubs
  bagViewingStudentId: null,
  bagViewingStudentName: null,
  bagStudentClubs: null,
  bagStudentWgSessions: null,

  // bag/speed
  bagStudentSpeedSessions: null,

  // coaching/students
  allStudentsData: undefined,

  // stats/dashboard
  dashSGData: undefined,
  dashRadarData: undefined,

  // stats/full-stats
  fullStatsRadarData: undefined,
  fullStatTabs: undefined,

  // combines/history
  combRowDataMap: undefined,
  combNoteMap: undefined,

  // coaching/student-side
  allCoachNotes: undefined,
  assignedDrillsData: undefined,
  assignedCombinesData: undefined,

  // coaching/coach-side
  coachRosterData: undefined,
  coachStudentsForSearch: undefined,

  // coaching/assign
  coachCombShots: undefined,

  // coaching/student-notes
  svAllNotes: undefined,

  // learn/proximity
  proxExpBefore: undefined,
  proxBreakFt: undefined,
  proxCurrentFt: undefined,
};
