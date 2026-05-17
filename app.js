/* =============================================
   MindGuard — Complete App Logic
   Mental Health & Behaviour Alert System
   ============================================= */

// ===== STATE =====
const state = {
  currentUser: null,
  currentRole: 'student',
  currentPage: 'landing',
  webSearchEnabled: false,
  logs: [],
  chatHistory: [],
  mcqScores: {},
  currentStepData: {}
};

// ===== SAMPLE DATA (for counselor/admin view) =====
function generateStudents() {
  const names = [
    'Aarav Sharma','Priya Patel','Rohan Mehta','Sneha Iyer','Kiran Nair',
    'Anjali Singh','Vikram Gupta','Meera Reddy','Arjun Kumar','Divya Joshi',
    'Siddharth Rao','Kavya Pillai','Rahul Verma','Ananya Bhat','Nikhil Das'
  ];
  const avatarSeeds = ['alice','bob','charlie','diana','evan','fiona','george','helen','ivan','julia','kevin','lily','mike','nina','oscar'];
  return names.map((name, i) => ({
    id: `MG${String(i+1).padStart(3,'0')}`,
    name,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeeds[i]}`,
    mood: Math.round((Math.random() * 4 + 5) * 10) / 10,
    sleep: Math.round((Math.random() * 3 + 5) * 10) / 10,
    activity: Math.round(Math.random() * 40 + 50),
    social: Math.round(Math.random() * 40 + 50),
    risk: ['low','medium','high'][Math.floor(Math.random() * 3)],
    riskScore: Math.round(Math.random() * 100),
    trend: Math.random() > 0.5 ? 'improving' : 'declining',
    alerts: Math.floor(Math.random() * 4),
    phqScore: Math.floor(Math.random() * 27),
    gadScore: Math.floor(Math.random() * 21)
  }));
}

function generateAlerts() {
  const students = generateStudents();
  const types = [
    { icon: '😞', type: 'Mood Drop', desc: 'Mood score dropped significantly over 3 days', level: 'high' },
    { icon: '😴', type: 'Sleep Decline', desc: 'Sleeping under 5 hours for 4 consecutive days', level: 'high' },
    { icon: '🚶', type: 'Low Activity', desc: 'Physical activity significantly below baseline', level: 'medium' },
    { icon: '🤐', type: 'Social Withdrawal', desc: 'Social score declined 40% this week', level: 'medium' },
    { icon: '📉', type: 'Overall Decline', desc: 'All indicators trending downward', level: 'high' },
    { icon: '🧠', type: 'PHQ-9 High Score', desc: 'Psychological assessment indicates moderate risk', level: 'high' },
  ];
  return students.filter(s => s.risk !== 'low').slice(0, 6).map((s, i) => ({
    student: s,
    ...types[i % types.length],
    time: `${Math.floor(Math.random() * 8 + 1)}h ago`
  }));
}

// ===== NAVIGATION =====
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(`page-${name}`);
  if (el) { el.classList.add('active'); state.currentPage = name; }
  window.scrollTo(0, 0);

  const guarded = ['dashboard','track','reports','ai-chat','profile','wellness'];
  if (guarded.includes(name) && !state.currentUser) { showPage('login'); return; }

  if (name === 'dashboard') initDashboard();
  if (name === 'reports') initReports();
  if (name === 'profile') initProfile();
  if (name === 'wellness') initWellness();
  if (name === 'track') resetTrack();
  document.getElementById('navLinks')?.classList.remove('open');
}

function toggleNav() {
  document.getElementById('navLinks').classList.toggle('open');
}

// ===== ROLE =====
function setRole(role, btn) {
  state.currentRole = role;
  btn.closest('.role-tabs').querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
}

// ===== AUTH =====
function login() {
  const name = document.getElementById('loginName').value.trim();
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  if (!name || !email || !pass) { showToast('⚠️ Please fill in all fields'); return; }

  const ecName = document.getElementById('ecName').value.trim();
  const ecEmail = document.getElementById('ecEmail').value.trim();
  const ecRelation = document.getElementById('ecRelation').value;

  const stored = getStoredUsers();
  const existing = stored.find(u => u.email === email);
  if (existing && existing.password !== btoa(pass)) { showToast('⚠️ Incorrect password'); return; }

  performLogin(email, name, state.currentRole, pass, { name: ecName, email: ecEmail, relation: ecRelation });
}

function register() {
  const first = document.getElementById('regFirst').value.trim();
  const last = document.getElementById('regLast').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass = document.getElementById('regPass').value;
  const ecName = document.getElementById('regEcName').value.trim();
  const ecEmail = document.getElementById('regEcEmail').value.trim();
  if (!first || !last || !email || !pass) { showToast('⚠️ Please fill all required fields'); return; }
  if (pass.length < 8) { showToast('⚠️ Password must be at least 8 characters'); return; }
  performLogin(email, `${first} ${last}`, state.currentRole, pass, { name: ecName, email: ecEmail, relation: 'Family' });
}

function demoLogin(role) {
  const demos = {
    student: { email: 'demo@mindguard.app', name: 'Demo User', pass: 'demo1234' },
    teacher: { email: 'counselor@mindguard.app', name: 'Dr. Counselor', pass: 'demo1234' }
  };
  const d = demos[role];
  state.currentRole = role;
  performLogin(d.email, d.name, role, d.pass, { name: 'Support Team', email: 'support@mindguard.app', relation: 'Counselor' });
}

function performLogin(email, name, role, pass, emergencyContact) {
  // Save user to local registry (only email, name, role, password hash — no sensitive health data stored with user)
  const users = getStoredUsers();
  const existingIdx = users.findIndex(u => u.email === email);
  const userRecord = { email, name, role, password: btoa(pass), emergencyContact };
  if (existingIdx >= 0) {
    // Preserve existing emergency contact if not provided
    if (!emergencyContact.name && users[existingIdx].emergencyContact) {
      userRecord.emergencyContact = users[existingIdx].emergencyContact;
    }
    users[existingIdx] = userRecord;
  } else {
    users.push(userRecord);
  }
  localStorage.setItem('mg_users', JSON.stringify(users));

  state.currentUser = { email, name, role, emergencyContact: userRecord.emergencyContact };

  // Load user's logs (only for session — logs stored per user key)
  state.logs = getUserLogs(email);

  updateNavUser();
  showToast(`👋 Welcome, ${name.split(' ')[0]}!`);
  showPage('dashboard');
}

function getStoredUsers() {
  try { return JSON.parse(localStorage.getItem('mg_users') || '[]'); } catch(e) { return []; }
}

function getUserLogs(email) {
  try { return JSON.parse(localStorage.getItem(`mg_logs_${btoa(email)}`) || '[]'); } catch(e) { return []; }
}

function saveUserLog(log) {
  if (!state.currentUser) return;
  state.logs.push(log);
  localStorage.setItem(`mg_logs_${btoa(state.currentUser.email)}`, JSON.stringify(state.logs.slice(-90)));
}

function logout() {
  state.currentUser = null;
  state.logs = [];
  state.chatHistory = [];
  state.mcqScores = {};
  document.getElementById('userAvatar').style.display = 'none';
  document.getElementById('loginNavBtn').style.display = 'flex';
  showPage('landing');
  showToast('👋 Signed out successfully');
}

function updateNavUser() {
  if (!state.currentUser) return;
  const ua = document.getElementById('userAvatar');
  const nb = document.getElementById('loginNavBtn');
  const firstName = state.currentUser.name.split(' ')[0];
  document.getElementById('userNameNav').textContent = firstName;
  // Set avatar initials
  const img = document.getElementById('avatarImg');
  img.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(state.currentUser.name)}&backgroundColor=4f46e5&textColor=ffffff`;
  ua.style.display = 'flex';
  nb.style.display = 'none';
}

function toggleUserMenu() {
  const dd = document.getElementById('userDropdown');
  dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
}

function togglePass(id) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
}

function toggleEcSection() {
  const body = document.getElementById('ecBody');
  const icon = document.getElementById('ecToggleIcon');
  body.classList.toggle('open');
  icon.textContent = body.classList.contains('open') ? '▲' : '▼';
}

// ===== DASHBOARD =====
let trendChartInst, donutChartInst;
function initDashboard() {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const firstName = state.currentUser?.name?.split(' ')[0] || 'there';
  document.getElementById('dashGreeting').textContent = `${greet}, ${firstName}! 👋`;
  document.getElementById('dashDate').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Show latest health score if available
  const latestLog = state.logs[state.logs.length - 1];
  if (latestLog && latestLog.healthScore !== undefined) {
    updateDashboardScore(latestLog);
  }

  // Alerts list
  const al = document.getElementById('alertList');
  if (state.currentRole === 'student' || state.currentRole === 'student') {
    // For individual users, show personal alerts based on logs
    const personalAlerts = buildPersonalAlerts();
    al.innerHTML = personalAlerts.length > 0
      ? personalAlerts.map(a => `
        <div class="alert-item ${a.level === 'medium' ? 'warn' : ''}">
          <div class="alert-item-icon">${a.icon}</div>
          <div class="alert-item-text">
            <div class="alert-item-name">${a.type}</div>
            <div class="alert-item-desc">${a.desc}</div>
          </div>
        </div>`).join('')
      : '<div style="color:var(--text-3);font-size:0.9rem;padding:1rem 0">✅ No alerts — keep it up!</div>';
  } else {
    const alerts = generateAlerts().slice(0, 3);
    al.innerHTML = alerts.map(a => `
      <div class="alert-item ${a.level === 'medium' ? 'warn' : ''}">
        <div class="alert-item-icon">${a.icon}</div>
        <div class="alert-item-text">
          <div class="alert-item-name">${a.student.name}</div>
          <div class="alert-item-desc">${a.type}: ${a.desc}</div>
        </div>
        <div class="alert-item-time">${a.time}</div>
      </div>`).join('');
  }

  // Tips
  const tips = getWellnessTips(latestLog);
  document.getElementById('dashTipsList').innerHTML = tips.slice(0, 4).map(t => `<div class="tip-item">${t}</div>`).join('');

  // Trend Chart
  const tCtx = document.getElementById('trendChart');
  if (tCtx) {
    if (trendChartInst) trendChartInst.destroy();
    const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    trendChartInst = new Chart(tCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Mood', data: [6.5,7,6.8,7.2,7,6.9,7.1], borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.08)', tension: 0.4, fill: true },
          { label: 'Activity', data: [65,70,68,75,72,68,72], borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.05)', tension: 0.4, fill: true },
          { label: 'Sleep', data: [6.5,7,6.5,6,6.8,7.5,6.8], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.05)', tension: 0.4, fill: true },
          { label: 'Social', data: [70,65,60,68,72,70,68], borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.05)', tension: 0.4, fill: true }
        ]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } } }
    });
  }

  const dCtx = document.getElementById('donutChart');
  if (dCtx) {
    if (donutChartInst) donutChartInst.destroy();
    const checked = state.logs.filter(l => isThisWeek(new Date(l.date))).length;
    const pct = Math.min(Math.round((checked / 7) * 100), 100);
    donutChartInst = new Chart(dCtx, {
      type: 'doughnut',
      data: { datasets: [{ data: [pct, 100 - pct], backgroundColor: ['#4f46e5', '#e2e8f0'], borderWidth: 0 }] },
      options: { cutout: '72%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
    });
    document.querySelector('.donut-val').textContent = pct + '%';
  }
}

function isThisWeek(date) {
  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  return date >= weekAgo && date <= now;
}

function updateDashboardScore(log) {
  const score = log.healthScore;
  document.getElementById('dashHealthScore').textContent = score + '/100';
  let status = score >= 75 ? '✅ Good mental health' : score >= 50 ? '⚠️ Some concerns detected' : '🔴 Significant concerns';
  document.getElementById('dashHealthStatus').textContent = status;

  if (log.mood) document.getElementById('hsMood').textContent = log.mood + '/10';
  if (log.sleep) document.getElementById('hsSleep').textContent = log.sleep + ' hrs';
  if (log.activity) document.getElementById('hsActivity').textContent = log.activityLabel || 'Moderate';
  if (log.social) document.getElementById('hsSocial').textContent = log.social + '/10';
  if (log.psychScore !== undefined) document.getElementById('hsPsych').textContent = log.psychScore <= 4 ? 'Good' : log.psychScore <= 9 ? 'Mild concerns' : 'Review needed';

  if (score < 50) {
    document.getElementById('alertBanner').style.display = 'flex';
    document.getElementById('alertBannerText').textContent = `Mental health score is ${score}/100. Consider checking our wellness tips.`;
  }
}

function buildPersonalAlerts() {
  if (state.logs.length === 0) return [];
  const recent = state.logs.slice(-3);
  const alerts = [];
  const avgMood = recent.reduce((a, l) => a + Number(l.mood), 0) / recent.length;
  const avgSleep = recent.reduce((a, l) => a + Number(l.sleep), 0) / recent.length;
  const avgSocial = recent.reduce((a, l) => a + Number(l.social), 0) / recent.length;
  if (avgMood < 5) alerts.push({ icon: '😞', type: 'Low Mood Pattern', desc: 'Your mood has been low over recent check-ins', level: 'high' });
  if (avgSleep < 6) alerts.push({ icon: '😴', type: 'Sleep Deficit', desc: 'You have been getting less than 6 hours of sleep', level: 'high' });
  if (avgSocial < 4) alerts.push({ icon: '🤐', type: 'Social Withdrawal', desc: 'Low social interaction detected this week', level: 'medium' });
  return alerts;
}

// ===== REPORTS =====
let changeChartInst, riskChartInst;
let reportStudents = [];
function initReports() {
  if (!reportStudents.length) reportStudents = generateStudents();
  const alerts = generateAlerts();
  const at = document.getElementById('alertsTable');
  at.innerHTML = `<table>
    <thead><tr><th>Person</th><th>Alert Type</th><th>Description</th><th>Risk Level</th><th>Time</th><th>Action</th></tr></thead>
    <tbody>${alerts.map(a => `
      <tr>
        <td><div style="display:flex;align-items:center;gap:8px"><img src="${a.student.avatar}" width="30" height="30" style="border-radius:50%;object-fit:cover">${a.student.name}</div></td>
        <td>${a.icon} ${a.type}</td>
        <td style="max-width:200px;font-size:0.8rem;color:var(--text-2)">${a.desc}</td>
        <td><span class="risk-badge ${a.level}">${a.level.toUpperCase()}</span></td>
        <td style="color:var(--text-3);font-size:0.8rem">${a.time}</td>
        <td><button class="card-btn" onclick="openStudentModal('${a.student.id}')">View</button></td>
      </tr>`).join('')}</tbody>
  </table>`;

  renderStudentGrid(reportStudents, document.getElementById('studentGrid'));

  const cCtx = document.getElementById('changeChart');
  if (cCtx) {
    if (changeChartInst) changeChartInst.destroy();
    changeChartInst = new Chart(cCtx, {
      type: 'bar',
      data: {
        labels: ['Week 1','Week 2','Week 3','Week 4'],
        datasets: [
          { label: 'High Risk', data: [3,5,4,7], backgroundColor: '#ef4444' },
          { label: 'Medium Risk', data: [5,7,6,8], backgroundColor: '#f59e0b' },
          { label: 'Low Risk', data: [10,8,9,5], backgroundColor: '#10b981' }
        ]
      },
      options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true, grid: { color: '#f1f5f9' } } }, plugins: { legend: { position: 'bottom' } } }
    });
  }

  const rCtx = document.getElementById('riskChart');
  if (rCtx) {
    const high = reportStudents.filter(s => s.risk === 'high').length;
    const med = reportStudents.filter(s => s.risk === 'medium').length;
    const low = reportStudents.filter(s => s.risk === 'low').length;
    if (riskChartInst) riskChartInst.destroy();
    riskChartInst = new Chart(rCtx, {
      type: 'doughnut',
      data: { labels: ['High','Medium','Low'], datasets: [{ data: [high, med, low], backgroundColor: ['#ef4444','#f59e0b','#10b981'], borderWidth: 2 }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }
}

function renderStudentGrid(students, container) {
  if (!container) return;
  container.innerHTML = students.map(s => `
    <div class="student-card" onclick="openStudentModal('${s.id}')">
      <div class="student-card-top">
        <img src="${s.avatar}" alt="${s.name}">
        <div>
          <div class="student-card-name">${s.name}</div>
          <div class="student-card-id">${s.id} · <span class="risk-badge ${s.risk}">${s.risk.toUpperCase()}</span></div>
        </div>
      </div>
      <div class="student-metrics">
        <div class="metric"><div class="metric-val" style="color:${s.mood<6?'#ef4444':'#10b981'}">${s.mood}</div><div class="metric-label">Mood</div></div>
        <div class="metric"><div class="metric-val" style="color:${s.sleep<6?'#ef4444':'#10b981'}">${s.sleep}h</div><div class="metric-label">Sleep</div></div>
        <div class="metric"><div class="metric-val" style="color:${s.activity<60?'#ef4444':'#10b981'}">${s.activity}%</div><div class="metric-label">Activity</div></div>
        <div class="metric"><div class="metric-val" style="color:${s.social<55?'#ef4444':'#10b981'}">${s.social}%</div><div class="metric-label">Social</div></div>
      </div>
    </div>`).join('');
}

function filterStudents() {
  const q = document.getElementById('studentSearch').value.toLowerCase();
  const filtered = reportStudents.filter(s => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  renderStudentGrid(filtered, document.getElementById('studentGrid'));
}

function updateReports() { initReports(); }

function openStudentModal(id) {
  const s = reportStudents.find(st => st.id === id);
  if (!s) return;
  const mc = document.getElementById('modalContent');
  const riskColor = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' }[s.risk];
  mc.innerHTML = `
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap">
      <img src="${s.avatar}" width="64" height="64" style="border-radius:50%;border:3px solid ${riskColor}">
      <div>
        <h2 style="font-size:1.3rem;font-weight:700">${s.name}</h2>
        <p style="color:var(--text-2)">${s.id} · <span class="risk-badge ${s.risk}">${s.risk.toUpperCase()} RISK</span></p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;margin-bottom:1.5rem">
      ${[['🎭 Mood', s.mood+'/10', s.mood<6],['🌙 Sleep', s.sleep+' hrs', s.sleep<6],['🏃 Activity', s.activity+'%', s.activity<60],['💬 Social', s.social+'%', s.social<55]].map(([label,val,warn]) => `
        <div style="background:${warn?'#fff5f5':'var(--bg)'};border:1px solid ${warn?'#fca5a5':'var(--border)'};border-radius:8px;padding:1rem">
          <div style="font-size:0.8rem;color:var(--text-2)">${label}</div>
          <div style="font-size:1.4rem;font-weight:800;color:${warn?'#ef4444':'var(--text)'}">${val}</div>
          ${warn?'<div style="font-size:0.72rem;color:#ef4444;margin-top:0.2rem">⚠️ Below threshold</div>':''}
        </div>`).join('')}
    </div>
    <div style="background:var(--bg);border-radius:8px;padding:1rem;margin-bottom:1rem">
      <h4 style="margin-bottom:0.5rem">📊 Risk Assessment</h4>
      <p style="font-size:0.85rem;color:var(--text-2);line-height:1.6">Risk Score: <strong>${s.riskScore}%</strong> · Trend: <strong>${s.trend}</strong> · Active Alerts: <strong>${s.alerts}</strong></p>
      ${s.phqScore >= 10 ? `<p style="margin-top:0.5rem;font-size:0.82rem;color:#b91c1c;font-weight:600">⚠️ PHQ-9 Score: ${s.phqScore} — Possible depression symptoms</p>` : ''}
    </div>
    <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
      <button class="btn-primary" onclick="alertFamilyFromModal('${s.name}');closeModal()">📧 Send Alert</button>
      <button class="btn-outline" onclick="showToast('🔔 Counselor notified for ${s.name}');closeModal()">🔔 Alert Counselor</button>
    </div>`;
  document.getElementById('studentModal').classList.add('open');
}

function alertFamilyFromModal(name) {
  showToast(`📧 Alert sent for ${name}`);
}

function closeModal() {
  document.getElementById('studentModal').classList.remove('open');
}

function exportReport() {
  showToast('📥 Generating report... (demo)');
}

// ===== TRACK (Daily Check-In) =====
let currentStep = 1;

function resetTrack() {
  currentStep = 1;
  document.querySelectorAll('.track-step').forEach(s => s.classList.add('hidden'));
  document.getElementById('step-1').classList.remove('hidden');
  document.querySelectorAll('.step-tab').forEach(t => t.classList.remove('active','done'));
  document.getElementById('stab-1').classList.add('active');
  document.getElementById('trackProgress').textContent = 'Step 1 of 6';
  state.mcqScores = {};
  state.currentStepData = {};
}

function goStep(n) {
  document.getElementById(`step-${currentStep}`).classList.add('hidden');
  document.getElementById(`stab-${currentStep}`).classList.remove('active');
  if (n > currentStep) document.getElementById(`stab-${currentStep}`).classList.add('done');
  currentStep = n;
  document.getElementById(`step-${currentStep}`).classList.remove('hidden');
  document.getElementById(`stab-${currentStep}`).classList.add('active');
  document.getElementById('trackProgress').textContent = `Step ${n} of 6`;
  window.scrollTo(0, 0);
}

function updateEmoji(type, val) {
  const emojis = {1:'😢',2:'😞',3:'😕',4:'😐',5:'😶',6:'🙂',7:'😊',8:'😄',9:'😁',10:'🤩'};
  const labels = {1:'Very Low',2:'Low',3:'Below Average',4:'Below Average',5:'Neutral',6:'Okay',7:'Good',8:'Great',9:'Excellent',10:'Amazing!'};
  document.getElementById('moodVal').textContent = `${val} — ${emojis[val]} ${labels[val]}`;
}

function updateSleepVal(val) {
  document.getElementById('sleepVal').textContent = `${val} hours`;
}

function updateSocialVal(val) {
  const labels = {1:'Completely isolated',2:'Very isolated',3:'Little interaction',4:'Below normal',5:'Some interaction',6:'Moderate interaction',7:'Good interaction',8:'Very social',9:'Highly social',10:'Extremely social'};
  document.getElementById('socialVal').textContent = `${val} — ${labels[Math.round(val)]}`;
}

function updateStressVal(val) {
  const labels = {1:'Very calm',2:'Relaxed',3:'Calm',4:'Manageable',5:'Noticeable',6:'Moderate stress',7:'High stress',8:'Very stressed',9:'Extremely stressed',10:'Overwhelmed'};
  document.getElementById('stressVal').textContent = `${val} — ${labels[Math.round(val)]}`;
}

function toggleChip(el) { el.classList.toggle('active'); }

function selectQual(el, groupId) {
  document.getElementById(groupId).querySelectorAll('.qual-opt').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
}

function selectAct(el) {
  el.closest('.activity-grid').querySelectorAll('.act-opt').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
  // Map to numeric score
  const scores = ['Sedentary','Light','Moderate','Active','Very Active'];
  const label = el.querySelector('.act-label')?.textContent;
  state.currentStepData.activityLabel = label;
  state.currentStepData.activityScore = (scores.indexOf(label) + 1) * 20;
}

function selectMCQ(el, groupId, score) {
  document.getElementById(groupId).querySelectorAll('.mcq-opt').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
  state.mcqScores[groupId] = score;
}

function selectPhoto(el, groupId) {
  document.getElementById(groupId).querySelectorAll('.pf-item, .cf-item').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
}

// ===== SCORING ENGINE =====
function calculateHealthScore() {
  const mood = Number(document.getElementById('moodScore').value);
  const sleep = Number(document.getElementById('sleepHours').value);
  const social = Number(document.getElementById('socialScore').value);
  const stress = Number(document.getElementById('stressScore').value);

  // PHQ-9 like score from MCQs
  const depressionKeys = ['mq1','mq2','mq_sleep1','mq_conc1','mq_self1','mq_psych1'];
  let phqLike = depressionKeys.reduce((acc, k) => acc + (state.mcqScores[k] || 0), 0);

  // GAD-7 like score
  const anxietyKeys = ['mq_anx1','mq_anx2'];
  let gadLike = anxietyKeys.reduce((acc, k) => acc + (state.mcqScores[k] || 0), 0);

  // Social avoidance
  const socAvoid = state.mcqScores['mq_soc1'] || 0;
  const socQual = state.mcqScores['mq_soc2'] || 0;

  // Functional impairment
  const funcImp = state.mcqScores['mq_diff1'] || 0;
  const fatigue = state.mcqScores['mq_act1'] || 0;

  // Component scores (0-100)
  const moodScore = (mood / 10) * 100;
  const sleepScore = sleep >= 8 ? 100 : sleep >= 7 ? 85 : sleep >= 6 ? 65 : sleep >= 5 ? 40 : 20;
  const actScore = state.currentStepData.activityScore || 60;
  const socialScore = (social / 10) * 100;
  const stressScore = ((10 - stress) / 9) * 100;
  const phqScore = Math.max(0, 100 - (phqLike / 18) * 100);
  const gadScore = Math.max(0, 100 - (gadLike / 6) * 100);
  const socIsolScore = Math.max(0, 100 - (socAvoid + socQual) * 12.5);
  const funcScore = Math.max(0, 100 - funcImp * 25);
  const fatScore = Math.max(0, 100 - fatigue * 25);

  // Weighted composite
  const composite = (
    moodScore * 0.18 +
    sleepScore * 0.12 +
    actScore * 0.08 +
    socialScore * 0.08 +
    stressScore * 0.10 +
    phqScore * 0.20 +
    gadScore * 0.12 +
    socIsolScore * 0.06 +
    funcScore * 0.04 +
    fatScore * 0.02
  );

  return {
    total: Math.round(composite),
    mood, sleep, social, stress,
    phqLike, gadLike,
    moodScore, sleepScore, actScore, socialScore,
    activityLabel: state.currentStepData.activityLabel || 'Moderate'
  };
}

function getRiskLevel(score) {
  if (score >= 75) return 'good';
  if (score >= 50) return 'moderate';
  return 'high';
}

function getResultLabel(score) {
  if (score >= 85) return { emoji: '🌟', label: 'Excellent Mental Health', color: '#059669' };
  if (score >= 70) return { emoji: '😊', label: 'Good Mental Wellbeing', color: '#10b981' };
  if (score >= 55) return { emoji: '🙂', label: 'Mild Concerns Detected', color: '#f59e0b' };
  if (score >= 40) return { emoji: '😟', label: 'Moderate Concerns', color: '#f97316' };
  return { emoji: '⚠️', label: 'Significant Concerns', color: '#ef4444' };
}

function getWellnessTips(log) {
  const defaultTips = [
    '🧘 Try 5 minutes of deep breathing — inhale for 4, hold for 4, exhale for 4',
    '🚶 A 20-min walk outside can boost your mood by 25-30%',
    '📵 Reduce screen time 1 hour before bed for better sleep quality',
    '🤝 Reach out to one friend or family member today',
    '💧 Stay hydrated — even mild dehydration affects mood and concentration',
    '📔 Write down 3 things you are grateful for before sleeping',
    '🎵 Listen to music that uplifts your mood for 10 minutes',
    '☀️ Get 15 minutes of sunlight in the morning to regulate your body clock',
    '🍎 Eat a balanced breakfast — skipping it affects your mood and focus',
    '😴 Maintain a consistent sleep schedule, even on weekends'
  ];

  if (!log) return defaultTips;

  const tips = [];
  if (log.mood < 6) {
    tips.push('🎭 Low mood detected: Try engaging in one activity you normally enjoy, even for just 10 minutes');
    tips.push('📞 Consider talking to someone you trust about how you are feeling');
  }
  if (log.sleep < 6) {
    tips.push('🌙 You are sleeping under 6 hours: Aim for 7-9 hours; avoid screens 1 hour before bed');
    tips.push('🛏️ Create a consistent bedtime routine to signal your brain it is time to sleep');
  }
  if (log.social < 4) {
    tips.push('💬 Low social interaction: Send a short message to a friend or family member today');
    tips.push('🤝 Isolation can worsen mood — try joining a group activity, even online');
  }
  if (log.stress > 7) {
    tips.push('😤 High stress: Try the 5-4-3-2-1 grounding technique to calm your nervous system');
    tips.push('🧘 Progressive muscle relaxation for 10 minutes can significantly reduce stress');
  }

  return [...tips, ...defaultTips].slice(0, 8);
}

// ===== SUBMIT LOG =====
function submitLog() {
  const scores = calculateHealthScore();
  const riskLevel = getRiskLevel(scores.total);

  const log = {
    date: new Date().toISOString(),
    mood: scores.mood,
    sleep: scores.sleep,
    social: scores.social,
    stress: scores.stress,
    activity: scores.actScore,
    activityLabel: scores.activityLabel,
    moodNotes: document.getElementById('moodNotes').value,
    generalNotes: document.getElementById('generalNotes').value,
    healthScore: scores.total,
    phqLike: scores.phqLike,
    gadLike: scores.gadLike,
    riskLevel
  };

  saveUserLog(log);
  resetTrack();

  // Show result modal
  showResultModal(scores, riskLevel, log);

  // Alert logic
  analyseAndAlert(log, scores);
}

function showResultModal(scores, riskLevel, log) {
  const { emoji, label, color } = getResultLabel(scores.total);
  const mc = document.getElementById('resultModalContent');
  const alertSent = riskLevel === 'high' && state.currentUser?.emergencyContact?.email;
  const tips = getWellnessTips(log);

  mc.innerHTML = `
    <div style="text-align:center;margin-bottom:1rem">
      <div style="font-size:4rem;margin-bottom:0.5rem">${emoji}</div>
      <div style="font-size:1.5rem;font-weight:700;color:${color}">${label}</div>
      <div style="font-size:4rem;font-weight:900;color:${color};line-height:1">${scores.total}<span style="font-size:1.5rem">/100</span></div>
      <div style="color:var(--text-2);font-size:0.9rem;margin-top:0.25rem">Mental Health Score — ${new Date().toLocaleDateString('en-IN')}</div>
    </div>

    <div class="result-details">
      <div class="rd-item"><div class="rd-label">🎭 Mood Score</div><div class="rd-val" style="color:${scores.mood<6?'#ef4444':'#10b981'}">${scores.mood}/10</div></div>
      <div class="rd-item"><div class="rd-label">🌙 Sleep</div><div class="rd-val" style="color:${scores.sleep<6?'#ef4444':'#10b981'}">${scores.sleep} hrs</div></div>
      <div class="rd-item"><div class="rd-label">💬 Social</div><div class="rd-val" style="color:${scores.social<5?'#ef4444':'#10b981'}">${scores.social}/10</div></div>
      <div class="rd-item"><div class="rd-label">😤 Stress</div><div class="rd-val" style="color:${scores.stress>7?'#ef4444':'#10b981'}">${scores.stress}/10</div></div>
    </div>

    ${scores.phqLike >= 10 ? `
    <div style="background:#fff3cd;border:1px solid #f59e0b;border-radius:8px;padding:0.75rem 1rem;margin:1rem 0;font-size:0.85rem">
      ⚠️ <strong>Psychological Screen:</strong> Your responses suggest possible ${scores.phqLike >= 15 ? 'moderate-to-severe' : 'mild-to-moderate'} depression symptoms (PHQ-9 equivalent: ${scores.phqLike}/27). Consider speaking with a mental health professional.
    </div>` : ''}

    ${scores.gadLike >= 5 ? `
    <div style="background:#fff3cd;border:1px solid #f59e0b;border-radius:8px;padding:0.75rem 1rem;margin:1rem 0;font-size:0.85rem">
      ⚠️ <strong>Anxiety Screen:</strong> Your responses indicate possible anxiety symptoms. Mindfulness and breathing exercises may help.
    </div>` : ''}

    <div class="result-tips">
      <h4>💡 Your Personalised Tips</h4>
      <div class="result-tip-list">
        ${tips.slice(0, 5).map(t => `<div class="result-tip-item">${t}</div>`).join('')}
      </div>
    </div>

    ${alertSent ? `<div class="alert-sent-badge">🔔 Alert automatically sent to ${state.currentUser.emergencyContact.name} (${state.currentUser.emergencyContact.relation})</div>` : ''}

    <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-top:1.5rem">
      <button class="btn-primary" onclick="closeResultModal();showPage('wellness')">💚 Wellness Hub</button>
      <button class="btn-outline" onclick="closeResultModal();showPage('ai-chat')">🤖 Talk to AI</button>
      <button class="btn-outline" onclick="closeResultModal();showPage('dashboard')">📊 Dashboard</button>
    </div>`;

  document.getElementById('resultModal').classList.add('open');
}

function closeResultModal() {
  document.getElementById('resultModal').classList.remove('open');
  showPage('dashboard');
}

function analyseAndAlert(log, scores) {
  const riskLevel = scores.total < 50 ? 'high' : scores.total < 70 ? 'moderate' : 'good';

  if (riskLevel === 'high') {
    const ec = state.currentUser?.emergencyContact;
    if (ec && ec.email) {
      // Simulate sending alert
      setTimeout(() => {
        showAlertModal(
          '⚠️ Concern Detected — Alert Sent',
          `Your mental health score is ${scores.total}/100, indicating significant concerns. An alert has been sent to ${ec.name} (${ec.relation}) at ${ec.email}. We also recommend speaking with a counselor.`,
        );
      }, 2500);
    } else {
      setTimeout(() => {
        showAlertModal(
          '⚠️ Significant Concerns Detected',
          `Your mental health score is ${scores.total}/100. We strongly recommend adding a family member or counselor contact in your profile so they can be notified when you need support.`
        );
      }, 2500);
    }
  } else if (riskLevel === 'moderate') {
    setTimeout(() => showToast('💛 Mild concerns noted. Check wellness tips for support.'), 2000);
  } else {
    setTimeout(() => showToast('✅ Great job! Your mental health looks good today.'), 1500);
  }
}

function showAlertModal(title, body) {
  document.getElementById('alertModalTitle').textContent = title;
  document.getElementById('alertModalBody').textContent = body;
  document.getElementById('alertModal').style.display = 'flex';
}

function closeAlertModal() {
  document.getElementById('alertModal').style.display = 'none';
}

// ===== WELLNESS HUB =====
function initWellness() {
  const latestLog = state.logs[state.logs.length - 1];
  const wc = document.getElementById('wellnessContent');

  if (latestLog && latestLog.healthScore !== undefined) {
    const score = latestLog.healthScore;
    const { emoji, label, color } = getResultLabel(score);
    const riskClass = score >= 70 ? 'ok' : score >= 50 ? 'warn' : 'risk';
    const tips = getWellnessTips(latestLog);
    wc.innerHTML = `
      <div class="wellness-result ${riskClass}">
        <div class="wr-header">
          <div class="wr-icon">${emoji}</div>
          <div>
            <div class="wr-title" style="color:${color}">${label}</div>
            <div style="font-size:0.85rem;color:var(--text-2)">Based on your latest check-in</div>
          </div>
          <div class="wr-score" style="color:${color};margin-left:auto">${score}/100</div>
        </div>
        <div class="wr-tips">
          ${tips.map(t => `<div class="wr-tip">${t}</div>`).join('')}
        </div>
      </div>`;
  } else {
    wc.innerHTML = `<div class="dash-card" style="text-align:center;padding:2rem;margin-bottom:2rem">
      <div style="font-size:3rem;margin-bottom:1rem">📋</div>
      <h3>No Check-In Data Yet</h3>
      <p style="color:var(--text-2);margin:0.75rem 0 1.5rem">Complete your first check-in to get personalized wellness tips and your mental health score.</p>
      <button class="btn-primary" onclick="showPage('track')">Start Check-In →</button>
    </div>`;
  }

  // Populate wellness cards
  document.getElementById('wcTipsMindful').innerHTML = [
    '🧘 Try 4-7-8 breathing: inhale 4s, hold 7s, exhale 8s',
    '🌿 5-minute body scan meditation before sleep',
    '🎯 Focus on one thing at a time — avoid multitasking',
    '🌊 Try box breathing during stressful moments'
  ].map(t => `<div class="wc-tip">${t}</div>`).join('');

  document.getElementById('wcTipsSleep').innerHTML = [
    '📵 No screens 1 hour before bed',
    '🌡️ Keep your room cool (18-20°C) for better sleep',
    '⏰ Same bedtime and wake-up daily, even weekends',
    '🚫 Avoid caffeine after 2 PM'
  ].map(t => `<div class="wc-tip">${t}</div>`).join('');

  document.getElementById('wcTipsActivity').innerHTML = [
    '🚶 Start with a 10-minute walk — it is enough to start',
    '💃 Dance to your favorite song — counts as exercise!',
    '🚴 Cycle or walk instead of taking a vehicle for short trips',
    '🏊 Try swimming — excellent for mental health'
  ].map(t => `<div class="wc-tip">${t}</div>`).join('');

  document.getElementById('wcTipsSocial').innerHTML = [
    '📞 Call a friend you have not spoken to in a while',
    '☕ Suggest a coffee meetup with someone you trust',
    '🤝 Volunteer for a local cause — great for social health',
    '👨‍👩‍👧 Have one full meal with family without phones'
  ].map(t => `<div class="wc-tip">${t}</div>`).join('');
}

// ===== PROFILE =====
let histChartInst;
function initProfile() {
  if (!state.currentUser) return;
  const name = state.currentUser.name;
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('profileAvatarInitials').textContent = initials;
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileRole').textContent = `${state.currentUser.role === 'student' ? 'Individual' : state.currentUser.role === 'teacher' ? 'Counselor' : 'Admin'} · MindGuard`;
  document.getElementById('pfFirst').value = name.split(' ')[0] || '';
  document.getElementById('pfLast').value = name.split(' ').slice(1).join(' ') || '';
  document.getElementById('pfEmail').value = state.currentUser.email || '';

  const ec = state.currentUser.emergencyContact || {};
  document.getElementById('pfEcName').value = ec.name || '';
  document.getElementById('pfEcEmail').value = ec.email || '';
  if (ec.relation) document.getElementById('pfEcRelation').value = ec.relation;

  const latestLog = state.logs[state.logs.length - 1];
  document.getElementById('pDaysLogged').textContent = state.logs.length;
  document.getElementById('pHealthScore').textContent = latestLog?.healthScore ? latestLog.healthScore + '/100' : '—';

  // Streak
  let streak = 0;
  const today = new Date(); today.setHours(0,0,0,0);
  for (let i = state.logs.length - 1; i >= 0; i--) {
    const logDate = new Date(state.logs[i].date); logDate.setHours(0,0,0,0);
    const diff = Math.round((today - logDate) / (1000 * 60 * 60 * 24));
    if (diff === streak) streak++;
    else break;
  }
  document.getElementById('pStreak').textContent = streak;

  const hCtx = document.getElementById('myHistoryChart');
  if (hCtx) {
    if (histChartInst) histChartInst.destroy();
    const recentLogs = state.logs.slice(-7);
    const labels = recentLogs.map(l => new Date(l.date).toLocaleDateString('en-IN', { weekday: 'short' }));
    const scores = recentLogs.map(l => l.healthScore || 0);
    histChartInst = new Chart(hCtx, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['No data'],
        datasets: [{
          label: 'Health Score', data: scores.length ? scores : [0],
          borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,0.1)',
          tension: 0.4, fill: true, pointBackgroundColor: '#4f46e5', pointRadius: 5
        }]
      },
      options: { responsive: true, scales: { y: { min: 0, max: 100, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } }
    });
  }
}

function saveProfile() {
  if (!state.currentUser) return;
  const first = document.getElementById('pfFirst').value.trim();
  const last = document.getElementById('pfLast').value.trim();
  const ecName = document.getElementById('pfEcName').value.trim();
  const ecEmail = document.getElementById('pfEcEmail').value.trim();
  const ecRelation = document.getElementById('pfEcRelation').value;

  state.currentUser.name = `${first} ${last}`.trim();
  state.currentUser.emergencyContact = { name: ecName, email: ecEmail, relation: ecRelation };

  // Update stored user
  const users = getStoredUsers();
  const idx = users.findIndex(u => u.email === state.currentUser.email);
  if (idx >= 0) {
    users[idx].name = state.currentUser.name;
    users[idx].emergencyContact = state.currentUser.emergencyContact;
    // Update password if provided
    const newPass = document.getElementById('pfPass').value;
    if (newPass && newPass.length >= 8) users[idx].password = btoa(newPass);
    localStorage.setItem('mg_users', JSON.stringify(users));
  }

  updateNavUser();
  initProfile();
  showToast('✅ Profile saved!');
}

// ===== AI CHAT =====
function toggleWebSearch(el) {
  state.webSearchEnabled = el.checked;
  showToast(el.checked ? '🌐 Web search enabled' : '🌐 Web search disabled');
}

function newChat() {
  document.getElementById('chatMessages').innerHTML = `
    <div class="msg ai">
      <div class="msg-avatar">🤖</div>
      <div class="msg-bubble"><p>New conversation started. How can I help with your mental health and wellbeing?</p></div>
    </div>`;
  state.chatHistory = [];
}

function askSuggestion(btn) {
  document.getElementById('chatInput').value = btn.textContent;
  sendChat();
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 150) + 'px';
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  input.style.height = 'auto';

  const messagesEl = document.getElementById('chatMessages');
  const firstName = state.currentUser?.name?.split(' ')[0] || 'the user';

  messagesEl.innerHTML += `
    <div class="msg user">
      <div class="msg-avatar">👤</div>
      <div class="msg-bubble">${escapeHtml(msg)}</div>
    </div>`;

  const loadId = 'load-' + Date.now();
  messagesEl.innerHTML += `
    <div class="msg ai" id="${loadId}">
      <div class="msg-avatar">🤖</div>
      <div class="msg-bubble loading"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
    </div>`;
  messagesEl.scrollTop = messagesEl.scrollHeight;

  const latestLog = state.logs[state.logs.length - 1];
  const scoreContext = latestLog ? `Latest health score: ${latestLog.healthScore}/100. Mood: ${latestLog.mood}/10. Sleep: ${latestLog.sleep}hrs. Social: ${latestLog.social}/10. Stress: ${latestLog.stress}/10.` : 'No check-in data yet.';

  const systemPrompt = `You are an empathetic, professional mental health AI assistant for MindGuard, a wellbeing tracking app. The user's name is ${firstName}.

User context: ${scoreContext}

Guidelines:
- Be warm, empathetic, and supportive — never clinical or cold
- Provide practical, evidence-based coping strategies
- For serious concerns (suicidal thoughts, self-harm), immediately direct to professional help and crisis lines: iCall (9152987821), Vandrevala Foundation (1860-2662-345), Emergency (112)
- Never diagnose — encourage professional consultation for clinical concerns
- Reference the user's actual data when relevant
- Keep responses concise and actionable
- Use simple language appropriate for all ages and education levels
${state.webSearchEnabled ? '- Web search is enabled. Reference current research on mental health when relevant.' : ''}`;

  state.chatHistory.push({ role: 'user', content: msg });

  try {
    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: state.chatHistory.slice(-10)
    };
    if (state.webSearchEnabled) body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n') || 'I encountered an issue. Please try again.';

    state.chatHistory.push({ role: 'assistant', content: text });

    const loadEl = document.getElementById(loadId);
    if (loadEl) loadEl.outerHTML = `
      <div class="msg ai">
        <div class="msg-avatar">🤖</div>
        <div class="msg-bubble">${formatAIResponse(text)}</div>
      </div>`;
  } catch (err) {
    const loadEl = document.getElementById(loadId);
    if (loadEl) loadEl.outerHTML = `
      <div class="msg ai">
        <div class="msg-avatar">🤖</div>
        <div class="msg-bubble">⚠️ Unable to connect. Please check your internet and try again.</div>
      </div>`;
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function formatAIResponse(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^• (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*?<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(?!<)(.+)$/, '<p>$1</p>');
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ===== TOAST =====
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ===== SESSION RESTORE =====
function restoreSession() {
  // We intentionally do NOT auto-restore sessions — user must sign in each visit for security
  // Only restore if they had a recent session (< 2 hours)
  const sessionData = sessionStorage.getItem('mg_session');
  if (sessionData) {
    try {
      const session = JSON.parse(sessionData);
      if (session.email) {
        const users = getStoredUsers();
        const user = users.find(u => u.email === session.email);
        if (user) {
          state.currentUser = { email: user.email, name: user.name, role: user.role, emergencyContact: user.emergencyContact };
          state.logs = getUserLogs(user.email);
          updateNavUser();
        }
      }
    } catch(e) {}
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  restoreSession();

  document.addEventListener('click', e => {
    if (!e.target.closest('.user-avatar-wrap')) {
      const dd = document.getElementById('userDropdown');
      if (dd) dd.style.display = 'none';
    }
    if (!e.target.closest('.hamburger') && !e.target.closest('.nav-links')) {
      document.getElementById('navLinks')?.classList.remove('open');
    }
  });

  // Save session reference on login (store only email in sessionStorage — no passwords/health data)
  const origPerformLogin = window.performLogin;
  const origLogin = performLogin;
});

// Persist session (just email reference, never health data)
const _origPerformLogin = performLogin;
window.performLogin = function(email, name, role, pass, emergencyContact) {
  _origPerformLogin(email, name, role, pass, emergencyContact);
  sessionStorage.setItem('mg_session', JSON.stringify({ email, timestamp: Date.now() }));
};
performLogin = window.performLogin;