import { S } from '../core/state.js';

var _sgRadarChartFullInstance = null;
var _sgRadarDashInstance = null;
var _sgRadarSummaryInstance = null;

function renderSGRadar(canvas, values, instance) {
  if (instance && instance.destroy) instance.destroy();
  
  var size = 300;
  var dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  
  var cx = size / 2;
  var cy = size / 2;
  var radius = 95;
  var rings = 4;
  var n = values.length;
  var startAngle = -Math.PI / 2;
  var rawLabels = ['SG:TOTAL', 'SG:OTT', 'SG:APP', 'SG:ARG', 'SG:PUTT'];
  
  // Find scale range
  var absMax = 0.5;
  for (var i = 0; i < n; i++) { absMax = Math.max(absMax, Math.abs(values[i])); }
  absMax = Math.ceil(absMax * 2) / 2;
  if (absMax < 1) absMax = 1;
  var scaleMax = absMax;
  
  ctx.clearRect(0, 0, size, size);
  
  // Draw rings
  for (var r = 1; r <= rings; r++) {
    var rr = (radius / rings) * r;
    ctx.beginPath();
    for (var i = 0; i <= n; i++) {
      var angle = startAngle + (2 * Math.PI / n) * (i % n);
      var x = cx + rr * Math.cos(angle);
      var y = cy + rr * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#3d3d3d';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  
  // Draw angle lines
  for (var i = 0; i < n; i++) {
    var angle = startAngle + (2 * Math.PI / n) * i;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  
  // Draw zero ring (middle circle) 
  var zeroR = radius / 2;
  ctx.beginPath();
  for (var i = 0; i <= n; i++) {
    var angle = startAngle + (2 * Math.PI / n) * (i % n);
    var x = cx + zeroR * Math.cos(angle);
    var y = cy + zeroR * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = '#606060';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Draw data polygon - map values from [-scaleMax, +scaleMax] to [0, radius]
  ctx.beginPath();
  for (var i = 0; i < n; i++) {
    var angle = startAngle + (2 * Math.PI / n) * i;
    var normalized = ((values[i] + scaleMax) / (2 * scaleMax));
    normalized = Math.max(0, Math.min(1, normalized));
    var dr = normalized * radius;
    var x = cx + dr * Math.cos(angle);
    var y = cy + dr * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(46, 125, 50, 0.15)';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Draw data points and labels
  for (var i = 0; i < n; i++) {
    var angle = startAngle + (2 * Math.PI / n) * i;
    var normalized = ((values[i] + scaleMax) / (2 * scaleMax));
    normalized = Math.max(0, Math.min(1, normalized));
    var dr = normalized * radius;
    var px = cx + dr * Math.cos(angle);
    var py = cy + dr * Math.sin(angle);
    
    var color = values[i] >= 0 ? '#007a52' : '#e06060';
    
    // Point dot
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Label
    var labelR = radius + 22;
    var lx = cx + labelR * Math.cos(angle);
    var ly = cy + labelR * Math.sin(angle);
    
    var sign = values[i] >= 0 ? '+' : '';
    var labelColor = values[i] >= 0 ? '#00a06d' : '#d4706e';
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = labelColor;
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.fillText(rawLabels[i], lx, ly - 7);
    ctx.font = 'bold 10px -apple-system, sans-serif';
    ctx.fillText('(' + sign + values[i].toFixed(1) + ')', lx, ly + 7);
  }
  
  return { destroy: function() { ctx.clearRect(0, 0, canvas.width, canvas.height); } };
}

export function renderSGRadarChartFull(canvas) {
  var sgTot = S.sgOTTTotal + S.sgAPPTotal + S.sgARGTotal + S.sgPuttingTotal;
  var values = [sgTot, S.sgOTTTotal, S.sgAPPTotal, S.sgARGTotal, S.sgPuttingTotal];
  _sgRadarChartFullInstance = renderSGRadar(canvas, values, _sgRadarChartFullInstance);
}

export function renderSGRadarDash(canvas, data) {
  var values = [data.tot, data.ott, data.app, data.arg, data.putt];
  _sgRadarDashInstance = renderSGRadar(canvas, values, _sgRadarDashInstance);
}

export function renderSGRadarSummary() {
  var canvas = document.getElementById('sgRadarSummary');
  if (!canvas) return;
  var sgTot = S.sgOTTTotal + S.sgAPPTotal + S.sgARGTotal + S.sgPuttingTotal;
  var values = [sgTot, S.sgOTTTotal, S.sgAPPTotal, S.sgARGTotal, S.sgPuttingTotal];
  _sgRadarSummaryInstance = renderSGRadar(canvas, values, _sgRadarSummaryInstance);
}

// ===== NEW CATEGORY RADAR CHARTS =====
var _scoringRadarInstance = null;
var _drivingRadarInstance = null;
var _approachRadarInstance = null;
var _argRadarInstance = null;
var _puttingRadarInstance = null;

function normalizeValue(val, min, max, higherIsBetter) {
  var clamped = Math.max(min, Math.min(max, val));
  var pct = (clamped - min) / (max - min) * 100;
  return higherIsBetter ? pct : (100 - pct);
}

function getRadarColor(normalizedVal) {
  if (normalizedVal >= 60) return '#00b87a';  // Green - good
  if (normalizedVal >= 40) return '#ffffff';  // White - average
  return '#d4706e';  // Red - bad
}

function createCategoryRadar(canvasId, labels, rawData, units, scales, instanceVar) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  
  if (instanceVar && instanceVar.destroy) instanceVar.destroy();
  
  // Fixed dimensions
  var size = 300;
  var dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  
  var cx = size / 2;
  var cy = size / 2;
  var radius = 95;
  var rings = 4;
  var n = labels.length;
  var startAngle = -Math.PI / 2;
  
  var normalizedData = rawData.map(function(val, i) {
    var s = scales[i];
    return normalizeValue(val, s.min, s.max, s.higher);
  });
  var colorData = normalizedData.map(function(v, i) {
    return scales[i].invertColor ? (100 - v) : v;
  });
  
  ctx.clearRect(0, 0, size, size);
  
  // Draw rings
  for (var r = 1; r <= rings; r++) {
    var rr = (radius / rings) * r;
    ctx.beginPath();
    for (var i = 0; i <= n; i++) {
      var angle = startAngle + (2 * Math.PI / n) * (i % n);
      var x = cx + rr * Math.cos(angle);
      var y = cy + rr * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#3d3d3d';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  
  // Draw angle lines
  for (var i = 0; i < n; i++) {
    var angle = startAngle + (2 * Math.PI / n) * i;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  
  // Draw data polygon
  ctx.beginPath();
  for (var i = 0; i < n; i++) {
    var angle = startAngle + (2 * Math.PI / n) * i;
    var val = Math.max(0, Math.min(100, normalizedData[i]));
    var dr = (val / 100) * radius;
    var x = cx + dr * Math.cos(angle);
    var y = cy + dr * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(46, 125, 50, 0.15)';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Draw data points and labels
  for (var i = 0; i < n; i++) {
    var angle = startAngle + (2 * Math.PI / n) * i;
    var val = Math.max(0, Math.min(100, normalizedData[i]));
    var dr = (val / 100) * radius;
    var px = cx + dr * Math.cos(angle);
    var py = cy + dr * Math.sin(angle);
    
    // Point dot
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, 2 * Math.PI);
    ctx.fillStyle = getRadarColor(colorData[i]);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Label
    var labelR = radius + 22;
    var lx = cx + labelR * Math.cos(angle);
    var ly = cy + labelR * Math.sin(angle);
    
    var displayVal = typeof rawData[i] === 'number' ? (Number.isInteger(rawData[i]) ? rawData[i] : rawData[i].toFixed(1)) : rawData[i];
    var labelText = labels[i];
    var valueText = '(' + displayVal + (units[i] || '') + ')';
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = getRadarColor(colorData[i]);
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.fillText(labelText, lx, ly - 7);
    ctx.font = 'bold 10px -apple-system, sans-serif';
    ctx.fillText(valueText, lx, ly + 7);
  }
  
  return { destroy: function() { ctx.clearRect(0, 0, canvas.width, canvas.height); } };
}

export function renderScoringRadar() {
  var d = S.dashRadarData;
  if (!d) return;
  _scoringRadarInstance = createCategoryRadar('scoringRadarDash',
    ['Birdie Avg', 'Scoring Avg', 'Par 5 Avg', 'Par 4 Avg', 'Par 3 Avg'],
    [d.birdieAvg, d.scoringAvg, d.par5Avg, d.par4Avg, d.par3Avg],
    ['/rd', '', '', '', ''],
    [
      {min: 0, max: 5, higher: true},
      {min: 65, max: 120, higher: false},
      {min: 4, max: 8, higher: false},
      {min: 3, max: 7, higher: false},
      {min: 2, max: 6, higher: false}
    ],
    _scoringRadarInstance
  );
}

export function renderDrivingRadar() {
  var d = S.dashRadarData;
  if (!d) return;
  _drivingRadarInstance = createCategoryRadar('drivingRadarDash',
    ['SG: OTT', 'Miss Right', 'Accuracy', 'Avg Distance', 'Miss Left'],
    [d.sgOTT, d.missRight, d.accuracy, d.avgDistance, d.missLeft],
    ['', '%', '%', ' yds', '%'],
    [
      {min: -5, max: 5, higher: true},
      {min: 5, max: 50, higher: true, invertColor: true},
      {min: 30, max: 80, higher: true},
      {min: 150, max: 320, higher: true},
      {min: 5, max: 50, higher: true, invertColor: true}
    ],
    _drivingRadarInstance
  );
}

export function renderApproachRadar() {
  var d = S.dashRadarData;
  if (!d) return;
  _approachRadarInstance = createCategoryRadar('approachRadarDash',
    ['GIR %', 'SG: APP', 'Outside 100', 'Inside 100', 'Proximity'],
    [d.girPct, d.sgAPP, d.proxOutside100, d.proxInside100, d.proximity],
    ['', '', ' ft', ' ft', ' ft'],
    [
      {min: 20, max: 80, higher: true},
      {min: -5, max: 5, higher: true},
      {min: 15, max: 50, higher: false},
      {min: 5, max: 30, higher: false},
      {min: 10, max: 45, higher: false}
    ],
    _approachRadarInstance
  );
}

export function renderARGRadar() {
  var d = S.dashRadarData;
  if (!d) return;
  _argRadarInstance = createCategoryRadar('argRadarDash',
    ['Scrambling', 'SG: ARG', 'From Rough', 'Sand Save', '30 Yds & In'],
    [d.scrambling, d.sgARG, d.scrFromRough, d.sandSave, d.scr30In],
    ['%', '', '%', '%', '%'],
    [
      {min: 20, max: 70, higher: true},
      {min: -5, max: 5, higher: true},
      {min: 20, max: 70, higher: true},
      {min: 10, max: 60, higher: true},
      {min: 10, max: 60, higher: true}
    ],
    _argRadarInstance
  );
}

export function renderPuttingRadar() {
  var d = S.dashRadarData;
  if (!d) return;
  _puttingRadarInstance = createCategoryRadar('puttingRadarDash',
    ['Putts/Round', 'Make %<9ft', 'SG: Putt', 'Avg Made Dist', '3-Putt Avoid', 'One-Putt %'],
    [d.puttsPerRound, d.make9ft, d.sgPutt, d.avgMadeDist, d.threePuttAvoid, d.onePuttPct],
    ['', '%', '', ' ft', '%', ''],
    [
      {min: 26, max: 38, higher: false},
      {min: 50, max: 95, higher: true},
      {min: -5, max: 5, higher: true},
      {min: 3, max: 15, higher: true},
      {min: 80, max: 100, higher: true},
      {min: 20, max: 50, higher: true}
    ],
    _puttingRadarInstance
  );
}

// ===== FULL STATS RADAR CHART FUNCTIONS =====
var _scoringRadarFullInstance = null;
var _drivingRadarFullInstance = null;
var _approachRadarFullInstance = null;
var _argRadarFullInstance = null;
var _puttingRadarFullInstance = null;

function renderFullStatsScoringRadar() {
  var d = S.fullStatsRadarData;
  if (!d) return;
  _scoringRadarFullInstance = createCategoryRadar('scoringRadarFull',
    ['Birdie Avg', 'Scoring Avg', 'Par 5 Avg', 'Par 4 Avg', 'Par 3 Avg'],
    [d.birdieAvg, d.scoringAvg, d.par5Avg, d.par4Avg, d.par3Avg],
    ['', '', '', '', ''],
    [
      {min: 0, max: 5, higher: true},
      {min: 65, max: 120, higher: false},
      {min: 4, max: 8, higher: false},
      {min: 3, max: 7, higher: false},
      {min: 2, max: 6, higher: false}
    ],
    _scoringRadarFullInstance
  );
}

export function renderFullStatsDrivingRadar() {
  var d = S.fullStatsRadarData;
  if (!d) return;
  _drivingRadarFullInstance = createCategoryRadar('drivingRadarFull',
    ['SG: OTT', 'Miss Right', 'Accuracy', 'Avg Distance', 'Miss Left'],
    [d.sgOTT, d.missRight, d.accuracy, d.avgDistance, d.missLeft],
    ['', '%', '%', ' yds', '%'],
    [
      {min: -5, max: 5, higher: true},
      {min: 5, max: 50, higher: true, invertColor: true},
      {min: 30, max: 80, higher: true},
      {min: 150, max: 320, higher: true},
      {min: 5, max: 50, higher: true, invertColor: true}
    ],
    _drivingRadarFullInstance
  );
}

export function renderFullStatsApproachRadar() {
  var d = S.fullStatsRadarData;
  if (!d) return;
  _approachRadarFullInstance = createCategoryRadar('approachRadarFull',
    ['GIR %', 'SG: APP', 'Outside 100', 'Inside 100', 'Proximity'],
    [d.girPct, d.sgAPP, d.proxOutside100, d.proxInside100, d.proximity],
    ['', '', ' ft', ' ft', ' ft'],
    [
      {min: 20, max: 80, higher: true},
      {min: -5, max: 5, higher: true},
      {min: 15, max: 50, higher: false},
      {min: 5, max: 30, higher: false},
      {min: 10, max: 45, higher: false}
    ],
    _approachRadarFullInstance
  );
}

export function renderFullStatsARGRadar() {
  var d = S.fullStatsRadarData;
  if (!d) return;
  _argRadarFullInstance = createCategoryRadar('argRadarFull',
    ['Scrambling', 'SG: ARG', 'From Rough', 'Sand Save', '30 Yds & In'],
    [d.scrambling, d.sgARG, d.scrFromRough, d.sandSave, d.scr30In],
    ['%', '', '%', '%', '%'],
    [
      {min: 20, max: 70, higher: true},
      {min: -5, max: 5, higher: true},
      {min: 20, max: 70, higher: true},
      {min: 10, max: 60, higher: true},
      {min: 10, max: 60, higher: true}
    ],
    _argRadarFullInstance
  );
}

export function renderFullStatsPuttingRadar() {
  var d = S.fullStatsRadarData;
  if (!d) return;
  _puttingRadarFullInstance = createCategoryRadar('puttingRadarFull',
    ['Putts/Round', 'Make %<9ft', 'SG: Putt', 'Avg Made Dist', '3-Putt Avoid', 'One-Putt %'],
    [d.puttsPerRound, d.make9ft, d.sgPutt, d.avgMadeDist, d.threePuttAvoid, d.onePuttPct],
    ['', '%', '', ' ft', '%', ''],
    [
      {min: 26, max: 38, higher: false},
      {min: 50, max: 95, higher: true},
      {min: -5, max: 5, higher: true},
      {min: 3, max: 15, higher: true},
      {min: 80, max: 100, higher: true},
      {min: 20, max: 50, higher: true}
    ],
    _puttingRadarFullInstance
  );
}