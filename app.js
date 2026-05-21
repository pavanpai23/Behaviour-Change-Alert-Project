/* MindGuard - production localStorage mental health monitoring system */

const ADMIN_EMAIL = 'admin@mindguard.app';
const ADMIN_PASSWORD = 'Admin@1234!';
const DB_KEY = 'mindguard_db_v2';
const SESSION_KEY = 'mindguard_session_v2';

const state = {
  currentUser: null,
  currentRole: 'user',
  currentPage: 'landing',
  logs: [],
  mcqScores: {},
  currentStepData: {},
  chatHistory: [],
  webSearchEnabled: false,
  selectedAdminUserId: null
};

let currentStep = 1;
let trendChartInst, donutChartInst, changeChartInst, riskChartInst, histChartInst;
let adminMoodChart, adminStressChart, adminSleepChart, adminRiskChart;

function db() {
  const base = { users: [], checkins: [], alerts: [] };
  try {
    const parsed = JSON.parse(localStorage.getItem(DB_KEY) || 'null');
    return parsed && Array.isArray(parsed.users) ? { ...base, ...parsed } : base;
  } catch {
    return base;
  }
}

function saveDb(next) {
  localStorage.setItem(DB_KEY, JSON.stringify({
    users: next.users || [],
    checkins: next.checkins || [],
    alerts: next.alerts || []
  }));
}

function saveSession(user) {
  if (!user) return;
  const session = {
    role: user.role,
    email: user.email,
    name: user.name,
    savedAt: new Date().toISOString()
  };
  if (user.role === 'user') session.userId = user.id;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function uid(prefix = 'mg') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function hashPassword(pass) {
  return btoa(unescape(encodeURIComponent(pass)));
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(text = '') {
  return String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function getInitials(name = '') {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'MG';
}

function userCheckins(userId) {
  return db().checkins
    .filter(c => c.userId === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function userAlerts(userId) {
  return db().alerts
    .filter(a => a.userId === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function latestCheckin(userId) {
  return userCheckins(userId)[0] || null;
}

function riskClass(risk) {
  return String(risk || 'low').toLowerCase();
}

function riskWeight(risk) {
  return { HIGH: 3, MEDIUM: 2, LOW: 1 }[risk] || 0;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3200);
}

function showPage(name) {
  const protectedPages = ['dashboard', 'track', 'reports', 'ai-chat', 'profile', 'wellness'];
  if (protectedPages.includes(name) && !state.currentUser) {
    name = 'login';
  }
  if (name === 'track' && state.currentUser?.role === 'admin') {
    showToast('Admin accounts monitor users and cannot submit personal check-ins.');
    name = 'reports';
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(`page-${name}`);
  if (el) {
    el.classList.add('active');
    state.currentPage = name;
  }
  window.scrollTo(0, 0);

  if (name === 'dashboard') initDashboard();
  if (name === 'reports') initReports();
  if (name === 'profile') initProfile();
  if (name === 'wellness') initWellness();
  if (name === 'track') resetTrack();
  document.getElementById('navLinks')?.classList.remove('open');
}

function toggleNav() {
  document.getElementById('navLinks')?.classList.toggle('open');
}

function setRole(role, btn) {
  state.currentRole = role === 'admin' ? 'admin' : 'user';
  btn?.closest('.role-tabs')?.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
  btn?.classList.add('active');
  const nameGroup = document.getElementById('loginNameGroup');
  if (nameGroup) nameGroup.style.display = state.currentRole === 'admin' ? 'none' : 'block';
}

function login() {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pass = document.getElementById('loginPass').value;
  if (!validEmail(email) || !pass) return showToast('Please enter a valid email and password.');

  if (state.currentRole === 'admin' || email === ADMIN_EMAIL) {
    if (email !== ADMIN_EMAIL || pass !== ADMIN_PASSWORD) return showToast('Invalid admin credentials.');
    state.currentUser = { id: 'admin', name: 'MindGuard Admin', email: ADMIN_EMAIL, role: 'admin' };
    state.logs = [];
    saveSession(state.currentUser);
    updateNavUser();
    showToast('Admin signed in.');
    return showPage('reports');
  }

  const data = db();
  const user = data.users.find(u => u.email.toLowerCase() === email);
  if (!user || user.password !== hashPassword(pass)) return showToast('Invalid user email or password.');
  state.currentUser = publicUser(user);
  state.logs = userCheckins(user.id).reverse();
  saveSession(state.currentUser);
  updateNavUser();
  showToast(`Welcome back, ${user.name.split(' ')[0]}.`);
  showPage('dashboard');
}

function register() {
  const first = document.getElementById('regFirst').value.trim();
  const last = document.getElementById('regLast').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const pass = document.getElementById('regPass').value;
  const ecName = document.getElementById('regEcName').value.trim();
  const ecEmail = document.getElementById('regEcEmail').value.trim();

  if (!first || !last || !validEmail(email) || !pass) return showToast('Please complete all required fields.');
  if (email === ADMIN_EMAIL) return showToast('That email is reserved for admin.');
  if (pass.length < 8) return showToast('Password must be at least 8 characters.');
  if (ecEmail && !validEmail(ecEmail)) return showToast('Emergency contact email is invalid.');

  const data = db();
  if (data.users.some(u => u.email.toLowerCase() === email)) return showToast('An account already exists. Please sign in.');

  const user = {
    id: uid('user'),
    role: 'user',
    name: `${first} ${last}`.trim(),
    email,
    password: hashPassword(pass),
    emergencyContact: { name: ecName, email: ecEmail, relation: 'Family/Counselor' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.users.push(user);
  saveDb(data);
  state.currentUser = publicUser(user);
  state.logs = [];
  saveSession(state.currentUser);
  updateNavUser();
  showToast('Account created.');
  showPage('dashboard');
}

function publicUser(user) {
  return {
    id: user.id,
    role: user.role || 'user',
    name: user.name,
    email: user.email,
    emergencyContact: user.emergencyContact || {}
  };
}

function demoLogin() {
  showToast('Demo users are disabled. Please register a real account.');
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  state.currentUser = null;
  state.logs = [];
  state.chatHistory = [];
  state.mcqScores = {};
  document.getElementById('userAvatar').style.display = 'none';
  document.getElementById('loginNavBtn').style.display = 'flex';
  showPage('landing');
  showToast('Signed out.');
}

function restoreSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!session) return false;
    if (session.role === 'admin' && session.email === ADMIN_EMAIL) {
      state.currentUser = { id: 'admin', name: 'MindGuard Admin', email: ADMIN_EMAIL, role: 'admin' };
      state.currentRole = 'admin';
    } else if (session.userId) {
      const user = db().users.find(u => u.id === session.userId);
      if (user) {
        state.currentUser = publicUser(user);
        state.logs = userCheckins(user.id).reverse();
        state.currentRole = 'user';
      }
    } else if (session.email) {
      const user = db().users.find(u => u.email.toLowerCase() === session.email.toLowerCase());
      if (user) {
        state.currentUser = publicUser(user);
        state.logs = userCheckins(user.id).reverse();
        state.currentRole = 'user';
      }
    }
    if (!state.currentUser) return false;
    updateNavUser();
    return true;
  } catch {}
  return false;
}

function updateNavUser() {
  if (!state.currentUser) return;
  setText('userNameNav', state.currentUser.role === 'admin' ? 'Admin' : state.currentUser.name.split(' ')[0]);
  const img = document.getElementById('avatarImg');
  if (img) img.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(state.currentUser.name)}&backgroundColor=4f46e5&textColor=ffffff`;
  document.getElementById('userAvatar').style.display = 'flex';
  document.getElementById('loginNavBtn').style.display = 'none';
}

function toggleUserMenu() {
  const dd = document.getElementById('userDropdown');
  if (dd) dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
}

function togglePass(id) {
  const el = document.getElementById(id);
  if (el) el.type = el.type === 'password' ? 'text' : 'password';
}

function toggleEcSection() {
  const body = document.getElementById('ecBody');
  const icon = document.getElementById('ecToggleIcon');
  body?.classList.toggle('open');
  if (icon && body) icon.textContent = body.classList.contains('open') ? '▲' : '▼';
}

function initDashboard() {
  if (state.currentUser?.role === 'admin') return initAdminDashboard();
  updateDashboardChartHeader('user');
  state.logs = userCheckins(state.currentUser.id).reverse();
  const logsNewest = [...state.logs].reverse();
  const latest = logsNewest[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  setText('dashGreeting', `${greet}, ${state.currentUser.name.split(' ')[0]}!`);
  setText('dashDate', new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));

  if (latest) updateDashboardScore(latest);
  else {
    setText('dashHealthScore', '-');
    setText('dashHealthStatus', "Complete today's check-in");
    ['hsMood', 'hsSleep', 'hsActivity', 'hsSocial', 'hsPsych'].forEach(id => setText(id, '-'));
  }
  updateStatCards(logsNewest);
  renderPersonalAlerts();
  renderTrendChart('trendChart', logsNewest.slice(0, 14).reverse());
  renderProgressDonut(logsNewest);
  document.getElementById('dashTipsList').innerHTML = getWellnessTips(latest).slice(0, 4).map(t => `<div class="tip-item">${t}</div>`).join('');
}

function initAdminDashboard() {
  updateDashboardChartHeader('admin');
  setText('dashGreeting', 'Admin Monitoring Dashboard');
  setText('dashDate', 'Real registered users and submitted check-ins only.');
  const summary = adminRows();
  const high = summary.filter(r => r.latestRisk === 'HIGH').length;
  setText('dashHealthScore', `${summary.length}`);
  setText('dashHealthStatus', `Registered users with data: ${summary.filter(r => r.totalEntries > 0).length}`);
  setText('hsMood', `${summary.length} users`);
  setText('hsSleep', `${db().checkins.length} entries`);
  setText('hsActivity', `${high} high risk`);
  setText('hsSocial', `${db().alerts.length} alerts`);
  setText('hsPsych', 'Protected');
  document.getElementById('alertList').innerHTML = db().alerts.slice(-5).reverse().map(a => `<div class="alert-item ${a.risk === 'MEDIUM' ? 'warn' : ''}"><div class="alert-item-icon">!</div><div class="alert-item-text"><div class="alert-item-name">${escapeHtml(a.userName || 'User alert')}</div><div class="alert-item-desc">${escapeHtml(a.message)}</div></div><div class="alert-item-time">${formatDate(a.timestamp)}</div></div>`).join('') || '<div class="empty-state">No alerts yet.</div>';
  document.getElementById('dashTipsList').innerHTML = '<div class="tip-item">Use Reports to inspect a user profile, send alerts, export data, or delete a user.</div>';
  renderAdminRiskChart('trendChart', summary);
  renderProgressDonut([]);
  updateStatCards([]);
}

function updateDashboardChartHeader(mode) {
  const card = document.getElementById('trendChart')?.closest('.dash-card');
  if (!card) return;
  const title = card.querySelector('.card-header h3');
  const legend = card.querySelector('.chart-legend');
  if (mode === 'admin') {
    if (title) title.textContent = 'Overall Risk Meaning';
    if (legend) legend.innerHTML = '<span class="legend-dot" style="background:#dc2626"></span>High risk<span class="legend-dot" style="background:#f59e0b"></span>Medium risk<span class="legend-dot" style="background:#059669"></span>Low risk';
  } else {
    if (title) title.textContent = 'Wellbeing Problem Map';
    if (legend) legend.innerHTML = '<span class="legend-dot" style="background:#2563eb"></span>Mood<span class="legend-dot" style="background:#dc2626"></span>Stress<span class="legend-dot" style="background:#059669"></span>Sleep';
  }
}

function updateDashboardScore(log) {
  setText('dashHealthScore', `${log.healthScore}/100`);
  setText('dashHealthStatus', `${log.risk} risk - ${log.risk === 'LOW' ? 'stable today' : 'support recommended'}`);
  setText('hsMood', `${log.mood}/10`);
  setText('hsSleep', `${log.sleepHours} hrs`);
  setText('hsActivity', log.physicalActivity);
  setText('hsSocial', `${log.social || '-'}/10`);
  setText('hsPsych', `Anxiety ${log.anxietyLevel}/10`);
  const banner = document.getElementById('alertBanner');
  if (banner) banner.style.display = log.risk === 'HIGH' ? 'flex' : 'none';
  setText('alertBannerText', `Latest check-in is ${log.risk} risk.`);
}

function updateStatCards(logsNewest) {
  const cards = document.querySelectorAll('.stat-card');
  if (!cards.length) return;
  const avg = key => logsNewest.length ? (logsNewest.reduce((a, l) => a + Number(l[key] || 0), 0) / logsNewest.length) : 0;
  const values = [
    [`${Math.round(avg('activityScore'))}%`, 'Avg Activity'],
    [`${Math.round(avg('waterIntake') * 10) / 10} L`, 'Avg Water'],
    [`${Math.round(avg('sleepHours') * 10) / 10} hrs`, 'Avg Sleep'],
    [`${Math.round(avg('mood') * 10) / 10}/10`, 'Avg Mood']
  ];
  cards.forEach((card, i) => {
    const val = card.querySelector('.stat-card-val');
    const label = card.querySelector('.stat-card-label');
    const trend = card.querySelector('.stat-trend');
    if (val) val.textContent = values[i][0];
    if (label) label.textContent = values[i][1];
    if (trend) trend.textContent = logsNewest.length ? `${logsNewest.length} total check-ins` : 'No entries yet';
  });
}

function renderPersonalAlerts() {
  const alerts = userAlerts(state.currentUser.id).slice(0, 5);
  const el = document.getElementById('alertList');
  el.innerHTML = alerts.length ? alerts.map(a => `<div class="alert-item ${a.risk === 'MEDIUM' ? 'warn' : ''}"><div class="alert-item-icon">!</div><div class="alert-item-text"><div class="alert-item-name">${escapeHtml(a.title)}</div><div class="alert-item-desc">${escapeHtml(a.message)}</div></div><div class="alert-item-time">${formatDate(a.timestamp)}</div></div>`).join('') : '<div class="empty-state">No alerts yet. Keep checking in.</div>';
}

function avgMetric(logs, key) {
  return logs.length ? logs.reduce((sum, log) => sum + Number(log[key] || 0), 0) / logs.length : 0;
}

function readableChartOptions(yTitle, min = 0, max = 10, valueLabel = value => value) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14 } },
      tooltip: {
        callbacks: {
          label: ctx => `${ctx.dataset.label}: ${valueLabel(ctx.parsed.y ?? ctx.raw)}`
        }
      }
    },
    scales: {
      y: {
        min,
        max,
        title: { display: true, text: yTitle },
        ticks: { stepSize: max <= 12 ? 2 : undefined },
        grid: { color: '#eef2f7' }
      },
      x: { grid: { display: false } }
    }
  };
}

function renderChartInsight(canvasId, insight) {
  const canvas = document.getElementById(canvasId);
  const card = canvas?.closest('.dash-card, .modal');
  if (!card || !insight) return;
  const existing = card.querySelector(`[data-chart-note="${canvasId}"]`);
  const note = existing || document.createElement('div');
  note.className = `chart-note ${insight.tone || 'info'}`;
  note.dataset.chartNote = canvasId;
  note.innerHTML = `<strong>${escapeHtml(insight.title)}</strong><span>${escapeHtml(insight.body)}</span>`;
  if (!existing) canvas.before(note);
}

function getTrendInsight(logs) {
  if (!logs.length) return { title: 'No graph data yet', body: 'Submit check-ins to see mood, stress, and sleep patterns.', tone: 'info' };
  const latest = logs[logs.length - 1];
  const avgMood = avgMetric(logs, 'mood');
  const avgStress = avgMetric(logs, 'stressLevel');
  const avgSleep = avgMetric(logs, 'sleepHours');
  if (latest.risk === 'HIGH') return { title: 'Main concern: high latest risk', body: 'Look for high stress, low mood, or low sleep on the same date.', tone: 'risk' };
  if (avgStress >= 7) return { title: 'Main concern: stress is staying high', body: `Average stress is ${avgStress.toFixed(1)}/10. Lower is better.`, tone: 'risk' };
  if (avgSleep < 6) return { title: 'Main concern: sleep is low', body: `Average sleep is ${avgSleep.toFixed(1)} hours. Aim for 7-9 hours when possible.`, tone: 'warn' };
  if (avgMood < 5) return { title: 'Main concern: mood is low', body: `Average mood is ${avgMood.toFixed(1)}/10. Extra support may help.`, tone: 'warn' };
  return { title: 'Pattern looks mostly stable', body: 'Mood, stress, and sleep are not showing a strong warning pattern.', tone: 'ok' };
}

function getRiskInsight(counts, total) {
  const [high, medium, low] = counts;
  if (!total) return { title: 'No risk data yet', body: 'Risk distribution appears after check-ins are submitted.', tone: 'info' };
  if (high) return { title: `${high} high-risk check-in${high === 1 ? '' : 's'}`, body: 'Red means support is recommended soon. Open the user profile for details.', tone: 'risk' };
  if (medium) return { title: `${medium} medium-risk check-in${medium === 1 ? '' : 's'}`, body: 'Yellow means watch closely and encourage consistent check-ins.', tone: 'warn' };
  return { title: `${low} low-risk check-in${low === 1 ? '' : 's'}`, body: 'Green means the latest submitted data looks stable.', tone: 'ok' };
}

function getSingleMetricInsight(id, logs, dataset) {
  if (!logs.length) return { title: 'No data yet', body: 'This chart will update after check-ins.', tone: 'info' };
  const values = dataset.data.map(Number).filter(Number.isFinite);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (id === 'adminMoodChart') {
    return avg < 5
      ? { title: 'Mood concern', body: `Average mood is ${avg.toFixed(1)}/10. Lower mood can signal emotional distress.`, tone: 'warn' }
      : { title: 'Mood is mostly stable', body: `Average mood is ${avg.toFixed(1)}/10. Higher is better.`, tone: 'ok' };
  }
  if (id === 'adminStressChart') {
    return avg >= 7
      ? { title: 'Stress concern', body: `Average stress is ${avg.toFixed(1)}/10. Higher stress needs attention.`, tone: 'risk' }
      : { title: 'Stress is not extreme', body: `Average stress is ${avg.toFixed(1)}/10. Lower is better.`, tone: 'ok' };
  }
  if (id === 'adminSleepChart') {
    return avg < 6
      ? { title: 'Sleep concern', body: `Average sleep is ${avg.toFixed(1)} hours. Low sleep can worsen mood and anxiety.`, tone: 'warn' }
      : { title: 'Sleep is readable', body: `Average sleep is ${avg.toFixed(1)} hours. Target range is 7-9.`, tone: 'ok' };
  }
  return { title: dataset.label, body: 'Read the line from left to right to see whether the problem is improving or worsening.', tone: 'info' };
}

function renderTrendChart(id, logs) {
  const ctx = document.getElementById(id);
  if (!ctx || !window.Chart) return;
  if (trendChartInst) trendChartInst.destroy();
  renderChartInsight(id, getTrendInsight(logs));
  trendChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels: logs.map(l => new Date(l.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })),
      datasets: [
        { label: 'Mood - higher is better', data: logs.map(l => l.mood), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.08)', tension: .35, fill: true },
        { label: 'Stress - higher needs attention', data: logs.map(l => l.stressLevel), borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,.06)', tension: .35, fill: false },
        { label: 'Sleep hours - target 7-9', data: logs.map(l => l.sleepHours), borderColor: '#059669', backgroundColor: 'rgba(5,150,105,.06)', tension: .35, fill: false }
      ]
    },
    options: readableChartOptions('Daily scores', 0, 12, value => `${value}/10 or hours`)
  });
}

function renderProgressDonut(logsNewest) {
  const ctx = document.getElementById('donutChart');
  if (!ctx || !window.Chart) return;
  if (donutChartInst) donutChartInst.destroy();
  const count = logsNewest.filter(l => new Date(l.timestamp) >= new Date(Date.now() - 7 * 86400000)).length;
  const pct = Math.min(100, Math.round((count / 7) * 100));
  renderChartInsight('donutChart', {
    title: logsNewest.length ? `${count} of 7 days completed this week` : 'No check-ins this week',
    body: logsNewest.length ? 'Regular check-ins make the risk graph more reliable.' : 'Complete a check-in to start seeing weekly progress.',
    tone: pct >= 70 ? 'ok' : pct >= 40 ? 'warn' : 'risk'
  });
  donutChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['Completed', 'Missed'], datasets: [{ data: [pct, 100 - pct], backgroundColor: ['#2563eb', '#e2e8f0'], borderWidth: 0 }] },
    options: { cutout: '72%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw}%` } } } }
  });
  const val = document.querySelector('.donut-val');
  if (val) val.textContent = `${pct}%`;
  const legend = document.querySelector('.donut-legend');
  if (legend) legend.innerHTML = `<div class="dl-item"><span class="dl-dot" style="background:#2563eb"></span>Completed (${pct}%)</div><div class="dl-item"><span class="dl-dot" style="background:#e2e8f0"></span>Missed (${100 - pct}%)</div>`;
}

function initReports() {
  if (state.currentUser.role === 'admin') renderAdminReports();
  else renderUserReports();
}

function adminRows() {
  const data = db();
  return data.users.map(user => {
    const entries = data.checkins.filter(c => c.userId === user.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const latest = entries[0];
    return {
      ...user,
      totalEntries: entries.length,
      latestRisk: latest?.risk || 'NONE',
      lastCheckin: latest?.timestamp || '',
      latest
    };
  }).filter(u => u.totalEntries > 0);
}

function renderAdminReports() {
  const rows = adminRows().sort((a, b) => riskWeight(b.latestRisk) - riskWeight(a.latestRisk) || new Date(b.lastCheckin) - new Date(a.lastCheckin));
  document.querySelector('#page-reports .page-header h1').textContent = 'Admin Dashboard';
  document.querySelector('#page-reports .page-sub').textContent = 'Real registered users with submitted check-ins only';
  const search = document.getElementById('studentSearch');
  if (search) search.placeholder = 'Search real users by name or email...';

  document.getElementById('alertsTable').innerHTML = `<table><thead><tr><th>User Name</th><th>Email</th><th>Latest Risk</th><th>Total Entries</th><th>Last Check-in Date</th><th>Action</th></tr></thead><tbody>${rows.map(u => `<tr><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td><td><span class="risk-badge ${riskClass(u.latestRisk)}">${u.latestRisk}</span></td><td>${u.totalEntries}</td><td>${formatDate(u.lastCheckin)}</td><td><button class="card-btn" onclick="openStudentModal('${u.id}')">View Profile</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty-cell">No registered users have submitted check-ins yet.</td></tr>'}</tbody></table>`;
  renderStudentGrid(rows, document.getElementById('studentGrid'));
  renderAdminRiskChart('riskChart', rows);
  renderAdminVolumeChart(rows);
}

function renderUserReports() {
  const entries = userCheckins(state.currentUser.id);
  document.querySelector('#page-reports .page-header h1').textContent = 'My Reports & Analytics';
  document.querySelector('#page-reports .page-sub').textContent = 'Your private check-in history and trends';
  const search = document.getElementById('studentSearch');
  if (search) search.placeholder = 'Search your notes or risk level...';
  document.getElementById('alertsTable').innerHTML = renderCheckinsTable(entries);
  document.getElementById('studentGrid').innerHTML = renderAnalyticsCards(entries);
  renderUserReportCharts(entries);
}

function renderCheckinsTable(entries) {
  return `<table><thead><tr><th>Date</th><th>Mood</th><th>Sleep</th><th>Stress</th><th>Anxiety</th><th>Water</th><th>Activity</th><th>Risk</th><th>Notes</th></tr></thead><tbody>${entries.map(c => `<tr><td>${formatDate(c.timestamp)}</td><td>${c.mood}/10</td><td>${c.sleepHours}h</td><td>${c.stressLevel}/10</td><td>${c.anxietyLevel}/10</td><td>${c.waterIntake}L</td><td>${escapeHtml(c.physicalActivity)}</td><td><span class="risk-badge ${riskClass(c.risk)}">${c.risk}</span></td><td>${escapeHtml(c.notes || '-')}</td></tr>`).join('') || '<tr><td colspan="9" class="empty-cell">No check-ins yet.</td></tr>'}</tbody></table>`;
}

function renderAnalyticsCards(entries) {
  const total = entries.length;
  const latest = entries[0];
  const high = entries.filter(e => e.risk === 'HIGH').length;
  const medium = entries.filter(e => e.risk === 'MEDIUM').length;
  return `<div class="student-card"><div class="student-card-name">Total Entries</div><div class="metric-val">${total}</div></div><div class="student-card"><div class="student-card-name">Latest Risk</div><div><span class="risk-badge ${riskClass(latest?.risk)}">${latest?.risk || 'NONE'}</span></div></div><div class="student-card"><div class="student-card-name">High Risk Days</div><div class="metric-val" style="color:#ef4444">${high}</div></div><div class="student-card"><div class="student-card-name">Medium Risk Days</div><div class="metric-val" style="color:#f59e0b">${medium}</div></div>`;
}

function renderUserReportCharts(entriesNewest) {
  const logs = [...entriesNewest].reverse();
  renderChartInsight('changeChart', getTrendInsight(logs));
  renderChartById('changeChart', 'line', logs, [
    { label: 'Mood - higher is better', data: logs.map(l => l.mood), color: '#2563eb' },
    { label: 'Stress - higher needs attention', data: logs.map(l => l.stressLevel), color: '#dc2626' },
    { label: 'Sleep hours - target 7-9', data: logs.map(l => l.sleepHours), color: '#059669' }
  ], inst => changeChartInst = inst, changeChartInst);
  renderRiskPie('riskChart', entriesNewest, inst => riskChartInst = inst, riskChartInst);
}

function renderStudentGrid(users, container) {
  if (!container) return;
  container.innerHTML = users.map(u => `<div class="student-card" onclick="openStudentModal('${u.id}')"><div class="student-card-top"><div class="profile-avatar-initials mini-avatar">${getInitials(u.name)}</div><div><div class="student-card-name">${escapeHtml(u.name)}</div><div class="student-card-id">${escapeHtml(u.email)}</div></div></div><div class="student-metrics"><div class="metric"><div class="metric-val">${u.totalEntries}</div><div class="metric-label">Entries</div></div><div class="metric"><div class="metric-val"><span class="risk-badge ${riskClass(u.latestRisk)}">${u.latestRisk}</span></div><div class="metric-label">Risk</div></div></div></div>`).join('') || '<div class="empty-state">No real user submissions yet.</div>';
}

function filterStudents() {
  if (state.currentUser.role !== 'admin') return renderUserReports();
  const q = document.getElementById('studentSearch').value.toLowerCase();
  renderStudentGrid(adminRows().filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)), document.getElementById('studentGrid'));
}

function updateReports() {
  initReports();
}

function openStudentModal(id) {
  if (state.currentUser.role !== 'admin') return showToast('Only admin can open user profiles.');
  const data = db();
  const user = data.users.find(u => u.id === id);
  if (!user) return;
  state.selectedAdminUserId = id;
  const entries = userCheckins(id);
  const alerts = userAlerts(id);
  const latest = entries[0];
  document.getElementById('modalContent').innerHTML = `<div class="admin-profile-head"><div class="profile-avatar-initials big-avatar">${getInitials(user.name)}</div><div><h2>${escapeHtml(user.name)}</h2><p>${escapeHtml(user.email)} ${latest ? `<span class="risk-badge ${riskClass(latest.risk)}">${latest.risk}</span>` : ''}</p></div></div><div class="admin-actions"><button class="btn-primary" onclick="sendAlert('${id}')">Send Alert</button><button class="btn-outline" onclick="exportUserData('${id}')">Download PDF</button><button class="btn-outline danger-btn" onclick="deleteUser('${id}')">Delete User</button></div><div class="admin-chart-grid"><div class="mini-chart-panel"><canvas id="adminMoodChart"></canvas></div><div class="mini-chart-panel"><canvas id="adminStressChart"></canvas></div><div class="mini-chart-panel"><canvas id="adminSleepChart"></canvas></div><div class="mini-chart-panel"><canvas id="adminRiskChart"></canvas></div></div><h3 style="margin:1rem 0">All Check-in History</h3><div class="alerts-table">${renderCheckinsTable(entries)}</div><h3 style="margin:1rem 0">Alert History</h3><div class="alerts-table"><table><thead><tr><th>Time</th><th>Title</th><th>Message</th></tr></thead><tbody>${alerts.map(a => `<tr><td>${formatDate(a.timestamp)}</td><td>${escapeHtml(a.title)}</td><td>${escapeHtml(a.message)}</td></tr>`).join('') || '<tr><td colspan="3">No alerts sent yet.</td></tr>'}</tbody></table></div>`;
  document.getElementById('studentModal').classList.add('open');
  setTimeout(() => renderAdminDetailCharts(entries), 50);
}

function closeModal() {
  document.getElementById('studentModal')?.classList.remove('open');
}

function sendAlert(userId) {
  const data = db();
  const user = data.users.find(u => u.id === userId);
  if (!user) return;
  const latest = latestCheckin(userId);
  data.alerts.push({
    id: uid('alert'),
    userId,
    userName: user.name,
    title: 'Admin Support Alert',
    message: `Admin reviewed ${user.name}'s profile and sent a support alert.${latest ? ` Latest risk: ${latest.risk}.` : ''}`,
    risk: latest?.risk || 'MEDIUM',
    timestamp: new Date().toISOString(),
    sentBy: ADMIN_EMAIL
  });
  saveDb(data);
  showToast('Alert saved with timestamp.');
  openStudentModal(userId);
}

function deleteUser(userId) {
  if (!confirm('Delete this user and all related check-ins/alerts?')) return;
  const data = db();
  saveDb({
    users: data.users.filter(u => u.id !== userId),
    checkins: data.checkins.filter(c => c.userId !== userId),
    alerts: data.alerts.filter(a => a.userId !== userId)
  });
  closeModal();
  initReports();
  showToast('User deleted.');
}

function exportUserData(userId) {
  const user = db().users.find(u => u.id === userId);
  const entries = userCheckins(userId);
  exportPdf(`${user.name} MindGuard Report`, entries);
}

function exportReport() {
  const isAdmin = state.currentUser.role === 'admin';
  const entries = isAdmin ? db().checkins : userCheckins(state.currentUser.id);
  const title = isAdmin ? 'MindGuard Admin Report' : 'MindGuard Personal Report';
  return exportPdf(title, entries);
}

function exportPdf(title, entries) {
  const rows = entries.map(e => `<tr><td>${formatDate(e.timestamp)}</td><td>${e.mood}</td><td>${e.sleepHours}</td><td>${e.stressLevel}</td><td>${e.anxietyLevel}</td><td>${e.risk}</td><td>${escapeHtml(e.notes || '')}</td></tr>`).join('');
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px;text-align:left}.risk{font-weight:bold}</style></head><body><h1>${title}</h1><p>Generated ${formatDate(new Date().toISOString())}</p><table><thead><tr><th>Date</th><th>Mood</th><th>Sleep</th><th>Stress</th><th>Anxiety</th><th>Risk</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table><script>window.print()<\/script></body></html>`);
  win.document.close();
}

function resetTrack() {
  currentStep = 1;
  state.mcqScores = {};
  state.currentStepData = {};
  goStep(1);
  document.querySelectorAll('.mcq-opt.active,.chip.active').forEach(el => el.classList.remove('active'));
}

function goStep(n) {
  currentStep = Math.max(1, Math.min(5, n));
  document.querySelectorAll('.track-step').forEach(s => s.classList.add('hidden'));
  document.getElementById(`step-${currentStep}`)?.classList.remove('hidden');
  document.querySelectorAll('.step-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`stab-${currentStep}`)?.classList.add('active');
  setText('trackProgress', `Step ${currentStep} of 5`);
}

function updateEmoji(type, val) {
  const labels = val <= 3 ? 'Very low' : val <= 5 ? 'Low' : val <= 7 ? 'Good' : 'Great';
  setText(`${type}Val`, `${val} - ${labels}`);
}

function updateSleepVal(val) { setText('sleepVal', `${val} hours`); }
function updateSocialVal(val) { setText('socialVal', `${val} - ${val < 4 ? 'Low interaction' : val < 8 ? 'Moderate interaction' : 'Connected'}`); }
function updateStressVal(val) { setText('stressVal', `${val} - ${val > 7 ? 'High stress' : val > 4 ? 'Manageable stress' : 'Calm'}`); }
function toggleChip(el) { el.classList.toggle('active'); }
function selectQual(el, groupId) { document.querySelectorAll(`#${groupId} .qual-opt`).forEach(o => o.classList.remove('active')); el.classList.add('active'); }
function selectAct(el) { document.querySelectorAll('.act-opt').forEach(o => o.classList.remove('active')); el.classList.add('active'); }
function selectMCQ(el, groupId, score) { document.querySelectorAll(`#${groupId} .mcq-opt`).forEach(o => o.classList.remove('active')); el.classList.add('active'); state.mcqScores[groupId] = Number(score); }
function calculateHealthScore() {
  const mood = Number(document.getElementById('moodScore').value);
  const sleepHours = Number(document.getElementById('sleepHours').value);
  const stressLevel = Number(document.getElementById('stressScore').value);
  const social = Number(document.getElementById('socialScore')?.value || 6);
  const anxietyLevel = Math.max(Number(state.mcqScores.mq_anx1 || 0), Number(state.mcqScores.mq_anx2 || 0)) * 3 + 1;
  const steps = Number(document.getElementById('stepsCount')?.value || 0);
  const active = document.querySelector('.act-opt.active .act-label')?.textContent || 'Moderate';
  const activityMap = { Sedentary: 20, Light: 45, Moderate: 65, Active: 85, 'Very Active': 95 };
  const activityScore = Math.min(100, (activityMap[active] || 65) + Math.min(10, Math.floor(steps / 2000)));
  const waterIntake = inferWaterIntake();
  const psychLoad = Object.values(state.mcqScores).reduce((a, n) => a + Number(n || 0), 0);
  const sleepScore = sleepHours >= 7 && sleepHours <= 9 ? 100 : sleepHours >= 6 ? 75 : sleepHours >= 5 ? 50 : 25;
  const moodScore = mood * 10;
  const stressScore = (11 - stressLevel) * 10;
  const anxietyScore = (11 - anxietyLevel) * 10;
  const socialScore = social * 10;
  const psychPenalty = Math.min(35, psychLoad * 2.5);
  const total = Math.max(0, Math.round((moodScore * .22) + (sleepScore * .18) + (stressScore * .20) + (anxietyScore * .16) + (activityScore * .12) + (socialScore * .12) - psychPenalty));
  const answeredScreening = Object.values(state.mcqScores).filter(v => Number.isFinite(Number(v))).length;
  return { mood, sleepHours, stressLevel, anxietyLevel, social, waterIntake, physicalActivity: active, activityScore, total, psychLoad, answeredScreening };
}

function getScreeningSeverity(score) {
  if (score >= 20) return 'Severe concern';
  if (score >= 15) return 'Moderately severe concern';
  if (score >= 10) return 'Moderate concern';
  if (score >= 5) return 'Mild concern';
  return 'Minimal concern';
}

function inferWaterIntake() {
  const mood = Number(document.getElementById('moodScore')?.value || 7);
  const sleep = Number(document.getElementById('sleepHours')?.value || 7);
  const stress = Number(document.getElementById('stressScore')?.value || 4);
  return Math.max(1, Math.min(4, Math.round((1.8 + mood * .08 + sleep * .05 - stress * .04) * 10) / 10));
}

function getRiskLevel(score) {
  if (score < 50) return 'HIGH';
  if (score < 70) return 'MEDIUM';
  return 'LOW';
}

function getResultLabel(score) {
  if (score < 50) return { emoji: '!', label: 'High Risk', color: '#ef4444' };
  if (score < 70) return { emoji: '!', label: 'Medium Risk', color: '#f59e0b' };
  return { emoji: 'OK', label: 'Low Risk', color: '#10b981' };
}

function submitLog() {
  if (!state.currentUser || state.currentUser.role !== 'user') return showToast('Please sign in as a user.');
  const s = calculateHealthScore();
  const risk = getRiskLevel(s.total);
  const checkin = {
    id: uid('checkin'),
    userId: state.currentUser.id,
    timestamp: new Date().toISOString(),
    mood: s.mood,
    sleepHours: s.sleepHours,
    stressLevel: s.stressLevel,
    anxietyLevel: s.anxietyLevel,
    waterIntake: s.waterIntake,
    physicalActivity: s.physicalActivity,
    activityScore: s.activityScore,
    social: s.social,
    notes: document.getElementById('generalNotes').value.trim() || document.getElementById('moodNotes').value.trim(),
    moodNotes: document.getElementById('moodNotes').value.trim(),
    calculatedRisk: risk,
    risk,
    healthScore: s.total,
    mcqScores: { ...state.mcqScores },
    diagnosticSummary: {
      screeningScore: s.psychLoad,
      answeredQuestions: s.answeredScreening,
      severity: getScreeningSeverity(s.psychLoad),
      note: 'Screening result only; not a clinical diagnosis.'
    }
  };
  const data = db();
  data.checkins.push(checkin);
  if (risk !== 'LOW') {
    data.alerts.push({ id: uid('alert'), userId: state.currentUser.id, userName: state.currentUser.name, title: `${risk} Risk Check-in`, message: `${state.currentUser.name} submitted a ${risk} risk check-in.`, risk, timestamp: new Date().toISOString(), sentBy: 'system' });
  }
  saveDb(data);
  state.logs = userCheckins(state.currentUser.id).reverse();
  showResultModal(s, risk, checkin);
  if (risk === 'HIGH') setTimeout(() => showAlertModal('High Risk Detected', 'Your latest check-in indicates high risk. Consider contacting your emergency support person or a qualified professional.'), 800);
}

function showResultModal(scores, riskLevel, log) {
  const r = getResultLabel(scores.total);
  const diag = log.diagnosticSummary || { screeningScore: scores.psychLoad || 0, answeredQuestions: 0, severity: getScreeningSeverity(scores.psychLoad || 0), note: 'Screening result only; not a clinical diagnosis.' };
  document.getElementById('resultModalContent').innerHTML = `<div style="text-align:center"><div style="font-size:3rem;font-weight:900;color:${r.color}">${r.emoji}</div><div style="font-size:1.4rem;font-weight:800;color:${r.color}">${r.label}</div><div style="font-size:3.5rem;font-weight:900;color:${r.color}">${scores.total}<span style="font-size:1.2rem">/100</span></div><p style="color:var(--text-2)">Saved ${formatDate(log.timestamp)}</p></div><div class="result-details"><div class="rd-item"><div class="rd-label">Mood</div><div class="rd-val">${log.mood}/10</div></div><div class="rd-item"><div class="rd-label">Sleep</div><div class="rd-val">${log.sleepHours}h</div></div><div class="rd-item"><div class="rd-label">Stress</div><div class="rd-val">${log.stressLevel}/10</div></div><div class="rd-item"><div class="rd-label">Anxiety</div><div class="rd-val">${log.anxietyLevel}/10</div></div></div><div class="result-tips"><h4>Screening summary</h4><div class="result-tip-item">${escapeHtml(diag.severity)} - ${diag.screeningScore} points from ${diag.answeredQuestions} answered questions.</div><div class="result-tip-item">${escapeHtml(diag.note)}</div></div><div class="result-tips"><h4>Personal tips</h4>${getWellnessTips(log).slice(0, 4).map(t => `<div class="result-tip-item">${t}</div>`).join('')}</div><div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:1.5rem"><button class="btn-primary" onclick="closeResultModal();showPage('dashboard')">Dashboard</button><button class="btn-outline" onclick="closeResultModal();showPage('reports')">Reports</button></div>`;
  document.getElementById('resultModal').classList.add('open');
}

function closeResultModal() {
  document.getElementById('resultModal')?.classList.remove('open');
  showPage('dashboard');
}

function showAlertModal(title, body) {
  setText('alertModalTitle', title);
  setText('alertModalBody', body);
  document.getElementById('alertModal').style.display = 'flex';
}

function closeAlertModal() {
  document.getElementById('alertModal').style.display = 'none';
}

function getWellnessTips(log) {
  if (!log) return ['Complete your first check-in to unlock personalized guidance.', 'Keep a consistent sleep and wake time.', 'A short walk can improve mood and stress.'];
  const tips = [];
  if (log.mood < 5) tips.push('Low mood noted: try one small enjoyable activity and message someone you trust.');
  if (log.sleepHours < 6) tips.push('Sleep is low: aim for a screen-free wind-down and a consistent bedtime tonight.');
  if (log.stressLevel > 7) tips.push('Stress is high: use slow breathing for 3 minutes and reduce non-urgent tasks.');
  if (log.anxietyLevel > 6) tips.push('Anxiety is elevated: try grounding with 5 things you see, 4 you feel, 3 you hear.');
  if (log.waterIntake < 2) tips.push('Hydration looks low: keep water nearby and sip steadily.');
  if ((log.activityScore || 0) < 50) tips.push('Activity is low: a 10-minute walk is enough to restart momentum.');
  return [...tips, 'If symptoms feel intense or unsafe, contact a mental health professional or crisis support.'].slice(0, 8);
}

function initWellness() {
  const latest = state.currentUser?.role === 'user' ? latestCheckin(state.currentUser.id) : null;
  const wc = document.getElementById('wellnessContent');
  if (wc) {
    wc.innerHTML = latest ? `<div class="wellness-result ${latest.risk === 'LOW' ? 'ok' : latest.risk === 'MEDIUM' ? 'warn' : 'risk'}"><div class="wr-header"><div class="wr-icon">${latest.risk}</div><div><div class="wr-title">Latest risk: ${latest.risk}</div><div style="color:var(--text-2)">Score ${latest.healthScore}/100</div></div></div><div class="wr-tips">${getWellnessTips(latest).map(t => `<div class="wr-tip">${t}</div>`).join('')}</div></div>` : `<div class="dash-card" style="text-align:center"><h3>No check-in data yet</h3><p style="color:var(--text-2);margin:1rem">Complete a check-in to personalize this hub.</p><button class="btn-primary" onclick="showPage('track')">Start Check-In</button></div>`;
  }
  setText('wcTipsMindful', '');
  document.getElementById('wcTipsMindful').innerHTML = ['4-7-8 breathing', 'Five-minute body scan', 'Single-task for ten minutes'].map(t => `<div class="wc-tip">${t}</div>`).join('');
  document.getElementById('wcTipsSleep').innerHTML = ['No screens before bed', 'Keep the room cool', 'Avoid late caffeine'].map(t => `<div class="wc-tip">${t}</div>`).join('');
  document.getElementById('wcTipsActivity').innerHTML = ['Walk for 10 minutes', 'Stretch your shoulders', 'Choose stairs for one trip'].map(t => `<div class="wc-tip">${t}</div>`).join('');
  document.getElementById('wcTipsSocial').innerHTML = ['Send one honest message', 'Schedule a short call', 'Ask for practical support'].map(t => `<div class="wc-tip">${t}</div>`).join('');
}

function initProfile() {
  if (!state.currentUser || state.currentUser.role === 'admin') {
    setText('profileName', 'MindGuard Admin');
    setText('profileRole', 'Admin - MindGuard');
    return;
  }
  const user = db().users.find(u => u.id === state.currentUser.id);
  if (!user) return;
  const parts = user.name.split(' ');
  setText('profileAvatarInitials', getInitials(user.name));
  setText('profileName', user.name);
  setText('profileRole', 'User - MindGuard');
  document.getElementById('pfFirst').value = parts[0] || '';
  document.getElementById('pfLast').value = parts.slice(1).join(' ');
  document.getElementById('pfEmail').value = user.email;
  document.getElementById('pfEcName').value = user.emergencyContact?.name || '';
  document.getElementById('pfEcEmail').value = user.emergencyContact?.email || '';
  const entries = userCheckins(user.id);
  setText('pDaysLogged', entries.length);
  setText('pStreak', calcStreak(entries));
  setText('pHealthScore', entries[0] ? `${entries[0].healthScore}/100` : '-');
  renderChartById('myHistoryChart', 'line', entries.slice(0, 14).reverse(), [{ label: 'Health Score', data: entries.slice(0, 14).reverse().map(e => e.healthScore), color: '#4f46e5' }], inst => histChartInst = inst, histChartInst, 100);
}

function calcStreak(entries) {
  const days = new Set(entries.map(e => new Date(e.timestamp).toDateString()));
  let streak = 0;
  const d = new Date();
  while (days.has(d.toDateString())) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function saveProfile() {
  if (state.currentUser.role !== 'user') return;
  const data = db();
  const user = data.users.find(u => u.id === state.currentUser.id);
  if (!user) return;
  const first = document.getElementById('pfFirst').value.trim();
  const last = document.getElementById('pfLast').value.trim();
  const newPass = document.getElementById('pfPass').value;
  if (!first) return showToast('First name is required.');
  if (newPass && newPass.length < 8) return showToast('New password must be at least 8 characters.');
  user.name = `${first} ${last}`.trim();
  user.emergencyContact = { name: document.getElementById('pfEcName').value.trim(), email: document.getElementById('pfEcEmail').value.trim(), relation: document.getElementById('pfEcRelation').value };
  if (newPass) user.password = hashPassword(newPass);
  user.updatedAt = new Date().toISOString();
  saveDb(data);
  state.currentUser = publicUser(user);
  updateNavUser();
  initProfile();
  showToast('Profile saved.');
}

function renderChartById(id, type, logs, datasets, setter, oldInst, max = 12) {
  const ctx = document.getElementById(id);
  if (!ctx || !window.Chart) return;
  if (oldInst) oldInst.destroy();
  if (id.startsWith('admin')) renderChartInsight(id, getSingleMetricInsight(id, logs, datasets[0]));
  const inst = new Chart(ctx, {
    type,
    data: {
      labels: logs.map(l => new Date(l.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })),
      datasets: datasets.map(d => ({ label: d.label, data: d.data, borderColor: d.color, backgroundColor: `${d.color}22`, tension: .35, fill: type === 'line' }))
    },
    options: readableChartOptions(max === 100 ? 'Score out of 100' : 'Daily value', 0, max, value => max === 100 ? `${value}/100` : `${value}`)
  });
  setter(inst);
}

function renderRiskPie(id, entries, setter, oldInst) {
  const ctx = document.getElementById(id);
  if (!ctx || !window.Chart) return;
  if (oldInst) oldInst.destroy();
  const counts = ['HIGH', 'MEDIUM', 'LOW'].map(r => entries.filter(e => e.risk === r).length);
  renderChartInsight(id, getRiskInsight(counts, entries.length));
  const displayCounts = entries.length ? counts : [0, 0, 1];
  setter(new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['High risk - needs support', 'Medium risk - watch closely', entries.length ? 'Low risk - stable' : 'No data yet'], datasets: [{ data: displayCounts, backgroundColor: ['#dc2626', '#f59e0b', entries.length ? '#059669' : '#e2e8f0'], borderWidth: 2, borderColor: '#ffffff' }] },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } }, tooltip: { callbacks: { label: ctx => entries.length ? `${ctx.label}: ${ctx.raw} check-in${ctx.raw === 1 ? '' : 's'}` : 'No check-ins yet' } } } }
  }));
}

function renderAdminRiskChart(id, rows) {
  const entries = rows.flatMap(r => userCheckins(r.id));
  if (id === 'trendChart') {
    renderRiskPie(id, entries, inst => trendChartInst = inst, trendChartInst);
  } else {
    renderRiskPie(id, entries, inst => riskChartInst = inst, riskChartInst);
  }
}

function renderAdminVolumeChart(rows) {
  const ctx = document.getElementById('changeChart');
  if (!ctx || !window.Chart) return;
  if (changeChartInst) changeChartInst.destroy();
  const mostEntries = rows.reduce((top, row) => row.totalEntries > (top?.totalEntries || 0) ? row : top, null);
  const highRisk = rows.filter(row => row.latestRisk === 'HIGH').length;
  renderChartInsight('changeChart', rows.length
    ? { title: `${highRisk} high-risk user${highRisk === 1 ? '' : 's'} need attention`, body: `Tall bars mean more check-ins. ${mostEntries?.name || 'A user'} has the most data for review.`, tone: highRisk ? 'risk' : 'ok' }
    : { title: 'No user check-ins yet', body: 'Graphs will appear after users submit check-ins.', tone: 'info' });
  changeChartInst = new Chart(ctx, {
    type: 'bar',
    data: { labels: rows.map(r => r.name), datasets: [{ label: 'Number of check-ins submitted', data: rows.map(r => r.totalEntries), backgroundColor: rows.map(r => r.latestRisk === 'HIGH' ? '#dc2626' : r.latestRisk === 'MEDIUM' ? '#f59e0b' : '#059669'), borderRadius: 6 }] },
    options: readableChartOptions('Check-ins per user', 0, Math.max(5, ...rows.map(r => r.totalEntries)) + 1, value => `${value} check-ins`)
  });
}

function renderAdminDetailCharts(entriesNewest) {
  const logs = [...entriesNewest].reverse();
  renderChartById('adminMoodChart', 'line', logs, [{ label: 'Mood - higher is better', data: logs.map(l => l.mood), color: '#2563eb' }], inst => adminMoodChart = inst, adminMoodChart);
  renderChartById('adminStressChart', 'line', logs, [{ label: 'Stress - higher needs attention', data: logs.map(l => l.stressLevel), color: '#dc2626' }], inst => adminStressChart = inst, adminStressChart);
  renderChartById('adminSleepChart', 'line', logs, [{ label: 'Sleep hours - target 7-9', data: logs.map(l => l.sleepHours), color: '#059669' }], inst => adminSleepChart = inst, adminSleepChart);
  renderRiskPie('adminRiskChart', entriesNewest, inst => adminRiskChart = inst, adminRiskChart);
}

function toggleWebSearch(el) {
  state.webSearchEnabled = el.checked;
  showToast(el.checked ? 'Web search enabled.' : 'Web search disabled.');
}

function newChat() {
  document.getElementById('chatMessages').innerHTML = '<div class="msg ai"><div class="msg-avatar">AI</div><div class="msg-bubble"><p>New conversation started. How can I support you today?</p></div></div>';
  state.chatHistory = [];
}

function askSuggestion(btn) {
  document.getElementById('chatInput').value = btn.textContent;
  sendChat();
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 150) + 'px';
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  const latest = state.currentUser?.role === 'user' ? latestCheckin(state.currentUser.id) : null;
  const response = latest
    ? `I see your latest risk is ${latest.risk} with a score of ${latest.healthScore}/100. A helpful next step is: ${getWellnessTips(latest)[0]}`
    : 'I can help best after your first check-in. If you feel unsafe or in crisis, contact emergency support immediately.';
  const box = document.getElementById('chatMessages');
  box.innerHTML += `<div class="msg user"><div class="msg-avatar">U</div><div class="msg-bubble">${escapeHtml(msg)}</div></div><div class="msg ai"><div class="msg-avatar">AI</div><div class="msg-bubble">${escapeHtml(response)}</div></div>`;
  box.scrollTop = box.scrollHeight;
}

function formatAIResponse(text) { return escapeHtml(text).replace(/\n/g, '<br>'); }

document.addEventListener('DOMContentLoaded', () => {
  const restored = restoreSession();
  if (restored) showPage(state.currentUser.role === 'admin' ? 'reports' : 'dashboard');
  document.addEventListener('click', e => {
    if (!e.target.closest('.user-avatar-wrap')) {
      const dd = document.getElementById('userDropdown');
      if (dd) dd.style.display = 'none';
    }
    if (!e.target.closest('.hamburger') && !e.target.closest('.nav-links')) {
      document.getElementById('navLinks')?.classList.remove('open');
    }
  });
});
