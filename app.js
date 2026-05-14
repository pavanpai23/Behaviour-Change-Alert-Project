/* =============================================
   BehaviourSense — Complete App Logic
   Student Behaviour Change Alert System
   ============================================= */

// ===== STATE =====
const state = {
  currentUser: null,
  currentRole: 'teacher',
  currentPage: 'landing',
  webSearchEnabled: false,
  logs: JSON.parse(localStorage.getItem('behaviourLogs') || '[]'),
  chatHistory: [],
  students: generateStudents()
};

// ===== SAMPLE DATA =====
function generateStudents() {
  const names = [
    'Aarav Sharma','Priya Patel','Rohan Mehta','Sneha Iyer','Kiran Nair',
    'Anjali Singh','Vikram Gupta','Meera Reddy','Arjun Kumar','Divya Joshi',
    'Siddharth Rao','Kavya Pillai','Rahul Verma','Ananya Bhat','Nikhil Das'
  ];
  const avatarSeeds = ['alice','bob','charlie','diana','evan','fiona','george','helen','ivan','julia','kevin','lily','mike','nina','oscar'];
  return names.map((name, i) => ({
    id: `STU${String(i+1).padStart(3,'0')}`,
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
    streak: Math.floor(Math.random() * 14)
  }));
}

function generateAlerts() {
  const types = [
    { icon: '😞', type: 'Mood Drop', desc: 'Mood score dropped 3+ points in 3 days', level: 'high' },
    { icon: '😴', type: 'Sleep Decline', desc: 'Sleeping < 5 hours for 4 consecutive days', level: 'high' },
    { icon: '🚶', type: 'Low Activity', desc: 'Physical activity significantly below baseline', level: 'medium' },
    { icon: '🤐', type: 'Social Withdrawal', desc: 'Communication score declined 40% this week', level: 'medium' },
    { icon: '📉', type: 'Overall Decline', desc: 'All four indicators trending downward', level: 'high' },
    { icon: '⚠️', type: 'Attendance Drop', desc: 'Missing multiple classes without explanation', level: 'medium' },
  ];
  return state.students
    .filter(s => s.risk !== 'low')
    .slice(0, 6)
    .map((s, i) => ({
      student: s,
      ...types[i % types.length],
      time: `${Math.floor(Math.random() * 8 + 1)}h ago`
    }));
}

// ===== NAVIGATION =====
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(`page-${name}`);
  if (el) {
    el.classList.add('active');
    state.currentPage = name;
  }
  window.scrollTo(0, 0);

  // Auth guard
  const guarded = ['dashboard','track','reports','ai-chat','profile'];
  if (guarded.includes(name) && !state.currentUser) {
    showPage('login');
    return;
  }

  // Page init
  if (name === 'dashboard') initDashboard();
  if (name === 'reports') initReports();
  if (name === 'profile') initProfile();
}

function toggleNav() {
  document.getElementById('navLinks').classList.toggle('open');
}

// ===== AUTH =====
function setRole(role, btn) {
  state.currentRole = role;
  btn.closest('.role-tabs').querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
}

function login() {
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPass').value;
  if (!email || !pass) { showToast('⚠️ Please enter email and password'); return; }
  performLogin(email, state.currentRole === 'teacher' ? 'Ms. ' + email.split('@')[0] : email.split('@')[0], state.currentRole);
}

function demoLogin(role) {
  const names = { teacher: 'Ms. Priya Nair', student: 'Rohan Mehta', admin: 'Dr. Admin' };
  const emails = { teacher: 'priya.nair@school.edu', student: 'rohan.mehta@school.edu', admin: 'admin@school.edu' };
  state.currentRole = role;
  performLogin(emails[role], names[role], role);
}

function performLogin(email, name, role) {
  state.currentUser = {
    name, email, role,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name.replace(/\s/g,'')}`
  };
  localStorage.setItem('behaviourUser', JSON.stringify(state.currentUser));
  updateNavUser();
  showToast(`👋 Welcome back, ${name.split(' ')[0]}!`);
  showPage('dashboard');
}

function register() {
  const first = document.getElementById('regFirst').value;
  const last = document.getElementById('regLast').value;
  const email = document.getElementById('regEmail').value;
  const school = document.getElementById('regSchool').value;
  if (!first || !last || !email || !school) { showToast('⚠️ Please fill all fields'); return; }
  performLogin(email, `${first} ${last}`, state.currentRole);
}

function logout() {
  state.currentUser = null;
  localStorage.removeItem('behaviourUser');
  document.getElementById('userAvatar').style.display = 'none';
  document.getElementById('loginNavBtn').style.display = 'flex';
  showPage('landing');
  showToast('👋 Logged out successfully');
}

function updateNavUser() {
  if (!state.currentUser) return;
  const ua = document.getElementById('userAvatar');
  const nb = document.getElementById('loginNavBtn');
  document.getElementById('avatarImg').src = state.currentUser.avatar;
  document.getElementById('userNameNav').textContent = state.currentUser.name.split(' ')[0];
  ua.style.display = 'flex';
  nb.style.display = 'none';
}

function toggleUserMenu() {
  document.getElementById('userDropdown').style.display =
    document.getElementById('userDropdown').style.display === 'block' ? 'none' : 'block';
}

function togglePass(id) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
}

// ===== DASHBOARD =====
let trendChartInst, donutChartInst;
function initDashboard() {
  // Greeting
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  document.getElementById('dashGreeting').textContent = `${greet}, ${state.currentUser?.name?.split(' ')[0] || 'there'}! 👋`;
  document.getElementById('dashDate').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Alerts list
  const alerts = generateAlerts().slice(0, 4);
  const al = document.getElementById('alertList');
  al.innerHTML = alerts.map(a => `
    <div class="alert-item ${a.level === 'medium' ? 'warn' : ''}">
      <div class="alert-item-icon">${a.icon}</div>
      <div class="alert-item-text">
        <div class="alert-item-name">${a.student.name}</div>
        <div class="alert-item-desc">${a.type}: ${a.desc}</div>
      </div>
      <div class="alert-item-time">${a.time}</div>
    </div>
  `).join('');

  // Risk list
  const highRisk = state.students.filter(s => s.risk === 'high').slice(0, 4);
  const rl = document.getElementById('riskList');
  rl.innerHTML = highRisk.map(s => `
    <div class="risk-item" onclick="openStudentModal('${s.id}')">
      <img class="risk-avatar" src="${s.avatar}" alt="${s.name}">
      <div class="risk-info">
        <div class="risk-name">${s.name}</div>
        <div class="risk-score">Risk Score: ${s.riskScore}%</div>
      </div>
      <div class="risk-bar-wrap">
        <div class="risk-bar"><div class="risk-bar-fill" style="width:${s.riskScore}%;background:${s.riskScore>70?'#ef4444':s.riskScore>40?'#f59e0b':'#10b981'}"></div></div>
      </div>
    </div>
  `).join('');

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
          { label: 'Mood', data: [6.5,7,6.8,7.2,7,6.9,7.1], borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', tension: 0.4, fill: true },
          { label: 'Activity', data: [65,70,68,75,72,68,72], borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', tension: 0.4, fill: true },
          { label: 'Sleep', data: [6.5,7,6.5,6,6.8,7.5,6.8], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)', tension: 0.4, fill: true },
          { label: 'Communication', data: [70,65,60,68,72,70,68], borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)', tension: 0.4, fill: true }
        ]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } } }
    });
  }

  // Donut Chart
  const dCtx = document.getElementById('donutChart');
  if (dCtx) {
    if (donutChartInst) donutChartInst.destroy();
    donutChartInst = new Chart(dCtx, {
      type: 'doughnut',
      data: { datasets: [{ data: [78, 22], backgroundColor: ['#6366f1', '#e2e8f0'], borderWidth: 0 }] },
      options: { cutout: '72%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
    });
  }
}

// ===== REPORTS =====
let changeChartInst, riskChartInst;
function initReports() {
  // Alerts table
  const alerts = generateAlerts();
  const at = document.getElementById('alertsTable');
  at.innerHTML = `<table>
    <thead><tr><th>Student</th><th>Alert Type</th><th>Description</th><th>Risk Level</th><th>Time</th><th>Action</th></tr></thead>
    <tbody>${alerts.map(a => `
      <tr>
        <td><div style="display:flex;align-items:center;gap:8px"><img src="${a.student.avatar}" width="32" height="32" style="border-radius:50%;object-fit:cover">${a.student.name}</div></td>
        <td>${a.icon} ${a.type}</td>
        <td style="max-width:250px;font-size:0.8rem;color:var(--text-2)">${a.desc}</td>
        <td><span class="risk-badge ${a.level}">${a.level.toUpperCase()}</span></td>
        <td style="color:var(--text-3);font-size:0.8rem">${a.time}</td>
        <td><button class="card-btn" onclick="openStudentModal('${a.student.id}')">View Profile</button></td>
      </tr>
    `).join('')}</tbody>
  </table>`;

  // Student grid
  const sg = document.getElementById('studentGrid');
  renderStudentGrid(state.students, sg);

  // Change Chart
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

  // Risk Chart
  const rCtx = document.getElementById('riskChart');
  if (rCtx) {
    const high = state.students.filter(s => s.risk === 'high').length;
    const med = state.students.filter(s => s.risk === 'medium').length;
    const low = state.students.filter(s => s.risk === 'low').length;
    if (riskChartInst) riskChartInst.destroy();
    riskChartInst = new Chart(rCtx, {
      type: 'doughnut',
      data: {
        labels: ['High Risk','Medium Risk','Low Risk'],
        datasets: [{ data: [high, med, low], backgroundColor: ['#ef4444','#f59e0b','#10b981'], borderWidth: 2 }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }
}

function renderStudentGrid(students, container) {
  container.innerHTML = students.map(s => `
    <div class="student-card" onclick="openStudentModal('${s.id}')">
      <div class="student-card-top">
        <img src="${s.avatar}" alt="${s.name}" onerror="this.src='https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(s.name)}'">
        <div>
          <div class="student-card-name">${s.name}</div>
          <div class="student-card-id">${s.id} · <span class="risk-badge ${s.risk}" style="font-size:0.68rem">${s.risk.toUpperCase()}</span></div>
        </div>
      </div>
      <div class="student-metrics">
        <div class="metric"><div class="metric-val" style="color:${s.mood<6?'#ef4444':'#10b981'}">${s.mood}</div><div class="metric-label">Mood</div></div>
        <div class="metric"><div class="metric-val" style="color:${s.sleep<6?'#ef4444':'#10b981'}">${s.sleep}h</div><div class="metric-label">Sleep</div></div>
        <div class="metric"><div class="metric-val" style="color:${s.activity<60?'#ef4444':'#10b981'}">${s.activity}%</div><div class="metric-label">Activity</div></div>
        <div class="metric"><div class="metric-val" style="color:${s.social<55?'#ef4444':'#10b981'}">${s.social}%</div><div class="metric-label">Social</div></div>
      </div>
    </div>
  `).join('');
}

function filterStudents() {
  const q = document.getElementById('studentSearch').value.toLowerCase();
  const filtered = state.students.filter(s =>
    s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
  );
  renderStudentGrid(filtered, document.getElementById('studentGrid'));
}

function updateReports() { initReports(); }

function openStudentModal(id) {
  const s = state.students.find(st => st.id === id);
  if (!s) return;
  const mc = document.getElementById('modalContent');
  const riskColor = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' }[s.risk];
  mc.innerHTML = `
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem">
      <img src="${s.avatar}" width="72" height="72" style="border-radius:50%;object-fit:cover;border:3px solid ${riskColor}">
      <div>
        <h2 style="font-family:var(--font-display);font-size:1.4rem;font-weight:700">${s.name}</h2>
        <p style="color:var(--text-2)">${s.id} · <span class="risk-badge ${s.risk}">${s.risk.toUpperCase()} RISK</span></p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;margin-bottom:1.5rem">
      ${[
        ['🎭 Mood', s.mood + '/10', s.mood < 6],
        ['🌙 Sleep', s.sleep + ' hrs', s.sleep < 6],
        ['🏃 Activity', s.activity + '%', s.activity < 60],
        ['💬 Social', s.social + '%', s.social < 55]
      ].map(([label, val, warn]) => `
        <div style="background:${warn ? '#fff5f5' : 'var(--bg)'};border:1px solid ${warn ? '#fca5a5' : 'var(--border)'};border-radius:8px;padding:1rem">
          <div style="font-size:0.8rem;color:var(--text-2);margin-bottom:0.25rem">${label}</div>
          <div style="font-size:1.4rem;font-weight:700;color:${warn ? '#ef4444' : 'var(--text)'}">${val}</div>
          ${warn ? '<div style="font-size:0.72rem;color:#ef4444;margin-top:0.25rem">⚠️ Below threshold</div>' : ''}
        </div>
      `).join('')}
    </div>
    <div style="background:var(--bg);border-radius:8px;padding:1rem;margin-bottom:1rem">
      <h4 style="font-family:var(--font-display);margin-bottom:0.5rem">📊 Risk Assessment</h4>
      <p style="font-size:0.85rem;color:var(--text-2);line-height:1.6">Risk Score: <strong>${s.riskScore}%</strong> · Trend: <strong>${s.trend}</strong> · Active Alerts: <strong>${s.alerts}</strong></p>
    </div>
    <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
      <button class="btn-primary" onclick="showToast('📧 Message sent to ${s.name}');closeModal()">📧 Send Message</button>
      <button class="btn-outline" onclick="showToast('🔔 Counselor notified for ${s.name}');closeModal()">🔔 Alert Counselor</button>
      <button class="btn-outline" onclick="showPage('ai-chat')">🤖 Ask AI about this student</button>
    </div>
  `;
  document.getElementById('studentModal').classList.add('open');
}

function closeModal() {
  document.getElementById('studentModal').classList.remove('open');
}

function exportReport() {
  showToast('📥 Generating PDF report... (demo)');
}

// ===== TRACK (Daily Log) =====
let currentStep = 1;
function goStep(n) {
  document.getElementById(`step-${currentStep}`).classList.add('hidden');
  document.getElementById(`stab-${currentStep}`).classList.remove('active');
  if (n > currentStep) document.getElementById(`stab-${currentStep}`).classList.add('done');
  currentStep = n;
  document.getElementById(`step-${currentStep}`).classList.remove('hidden');
  document.getElementById(`stab-${currentStep}`).classList.add('active');
  document.getElementById('trackProgress').textContent = `Step ${n} of 4`;
  window.scrollTo(0, 0);
}

function updateEmoji(type, val) {
  const emojis = { 1: '😢', 2: '😞', 3: '😕', 4: '😐', 5: '😶', 6: '🙂', 7: '😊', 8: '😄', 9: '😁', 10: '🤩' };
  const labels = { 1: 'Very Low', 2: 'Low', 3: 'Below Average', 4: 'Below Average', 5: 'Neutral', 6: 'Okay', 7: 'Good', 8: 'Great', 9: 'Excellent', 10: 'Amazing!' };
  document.getElementById('moodVal').textContent = `${val} — ${emojis[val]} ${labels[val]}`;
}

function updateSleepVal(val) {
  document.getElementById('sleepVal').textContent = `${val} hours`;
}

function updateSocialVal(val) {
  const labels = { 1:'Very isolated',2:'Isolated',3:'Little interaction',4:'Below normal',5:'Some interaction',6:'Moderate interaction',7:'Good interaction',8:'Very social',9:'Highly social',10:'Extremely social' };
  document.getElementById('socialVal').textContent = `${val} — ${labels[Math.round(val)]}`;
}

function toggleChip(el) {
  el.classList.toggle('active');
}

function selectQual(el, groupId) {
  document.getElementById(groupId).querySelectorAll('.qual-opt').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
}

function selectAct(el) {
  el.closest('.activity-grid').querySelectorAll('.act-opt').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
}

function submitLog() {
  const log = {
    date: new Date().toISOString(),
    mood: document.getElementById('moodScore').value,
    sleep: document.getElementById('sleepHours').value,
    social: document.getElementById('socialScore').value,
    moodNotes: document.getElementById('moodNotes').value,
    generalNotes: document.getElementById('generalNotes').value,
    userId: state.currentUser?.email
  };
  state.logs.push(log);
  localStorage.setItem('behaviourLogs', JSON.stringify(state.logs));

  // Reset steps
  currentStep = 1;
  document.querySelectorAll('.track-step').forEach(s => s.classList.add('hidden'));
  document.getElementById('step-1').classList.remove('hidden');
  document.querySelectorAll('.step-tab').forEach(t => t.classList.remove('active','done'));
  document.getElementById('stab-1').classList.add('active');

  showToast('✅ Check-in submitted! Your data has been logged.');
  analyseAndAlert(log);
  showPage('dashboard');
}

function analyseAndAlert(log) {
  const alerts = [];
  if (log.mood < 5) alerts.push('Low mood detected');
  if (log.sleep < 6) alerts.push('Insufficient sleep');
  if (log.social < 4) alerts.push('Low social interaction');
  if (alerts.length >= 2) {
    setTimeout(() => showToast('⚠️ AI Alert: Multiple concern indicators detected. Counselor notified.'), 2000);
  }
}

// ===== PROFILE =====
let histChartInst;
function initProfile() {
  if (!state.currentUser) return;
  document.getElementById('profileName').textContent = state.currentUser.name;
  document.getElementById('profileRole').textContent = `${state.currentUser.role.charAt(0).toUpperCase() + state.currentUser.role.slice(1)} · ${document.getElementById('pfSchool')?.value || 'School'}`;
  document.getElementById('profileAvatarImg').src = state.currentUser.avatar;
  document.getElementById('pfFirst').value = state.currentUser.name.split(' ')[0] || '';
  document.getElementById('pfLast').value = state.currentUser.name.split(' ').slice(1).join(' ') || '';
  document.getElementById('pfEmail').value = state.currentUser.email || '';
  document.getElementById('pDaysLogged').textContent = state.logs.filter(l => l.userId === state.currentUser?.email).length || 24;

  // History Chart
  const hCtx = document.getElementById('myHistoryChart');
  if (hCtx) {
    if (histChartInst) histChartInst.destroy();
    histChartInst = new Chart(hCtx, {
      type: 'radar',
      data: {
        labels: ['Mood', 'Sleep', 'Activity', 'Social', 'Overall'],
        datasets: [{
          label: 'This Week',
          data: [7.2, 6.5, 72, 68, 71],
          borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.15)',
          pointBackgroundColor: '#6366f1'
        },{
          label: 'Last Week',
          data: [6.8, 7, 65, 72, 70],
          borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)',
          pointBackgroundColor: '#22c55e'
        }]
      },
      options: { responsive: true, scales: { r: { grid: { color: '#f1f5f9' }, min: 0, max: 100 } }, plugins: { legend: { position: 'bottom' } } }
    });
  }
}

function saveProfile() {
  if (state.currentUser) {
    state.currentUser.name = `${document.getElementById('pfFirst').value} ${document.getElementById('pfLast').value}`;
    state.currentUser.email = document.getElementById('pfEmail').value;
    localStorage.setItem('behaviourUser', JSON.stringify(state.currentUser));
    updateNavUser();
    showToast('✅ Profile saved successfully!');
  }
}

function updateAvatar(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      state.currentUser.avatar = e.target.result;
      document.getElementById('profileAvatarImg').src = e.target.result;
      document.getElementById('avatarImg').src = e.target.result;
      showToast('✅ Avatar updated!');
    };
    reader.readAsDataURL(input.files[0]);
  }
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
      <div class="msg-bubble"><p>New conversation started. How can I help you with student behaviour analysis?</p></div>
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

  // User message
  messagesEl.innerHTML += `
    <div class="msg user">
      <div class="msg-avatar">👤</div>
      <div class="msg-bubble">${escapeHtml(msg)}</div>
    </div>`;

  // Loading indicator
  const loadId = 'load-' + Date.now();
  messagesEl.innerHTML += `
    <div class="msg ai" id="${loadId}">
      <div class="msg-avatar">🤖</div>
      <div class="msg-bubble loading"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
    </div>`;
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Build context
  const studentContext = buildStudentContext();
  const systemPrompt = `You are an expert educational psychologist and AI assistant for BehaviourSense, a student behaviour monitoring platform. You help teachers and school counselors understand student behaviour patterns.

Current system data:
${studentContext}

Guidelines:
- Provide empathetic, professional, actionable advice
- Reference actual student data when relevant
- Suggest specific interventions for at-risk students
- Explain behaviour patterns clearly
- When asked about research, provide evidence-based insights
- Keep responses concise but comprehensive
- Use emojis sparingly for readability
${state.webSearchEnabled ? '- Web search is enabled. Reference current research and best practices in student wellbeing.' : ''}`;

  // Add to history
  state.chatHistory.push({ role: 'user', content: msg });

  try {
    const tools = state.webSearchEnabled ? [{ type: 'web_search_20250305', name: 'web_search' }] : undefined;
    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: state.chatHistory.slice(-10)
    };
    if (tools) body.tools = tools;

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
        <div class="msg-bubble">⚠️ Unable to connect to AI. Please check your connection and try again.</div>
      </div>`;
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function buildStudentContext() {
  const highRisk = state.students.filter(s => s.risk === 'high');
  const avgMood = (state.students.reduce((a, s) => a + s.mood, 0) / state.students.length).toFixed(1);
  const avgSleep = (state.students.reduce((a, s) => a + s.sleep, 0) / state.students.length).toFixed(1);
  return `Total students: ${state.students.length}
High risk students (${highRisk.length}): ${highRisk.map(s => `${s.name} (mood:${s.mood}, sleep:${s.sleep}hrs, social:${s.social}%)`).join(', ')}
Class averages: Mood ${avgMood}/10, Sleep ${avgSleep}hrs, Activity ${Math.round(state.students.reduce((a,s)=>a+s.activity,0)/state.students.length)}%, Social ${Math.round(state.students.reduce((a,s)=>a+s.social,0)/state.students.length)}%`;
}

function formatAIResponse(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^• (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(.+)$/, '<p>$1</p>');
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

// ===== RESTORE SESSION =====
function restoreSession() {
  const saved = localStorage.getItem('behaviourUser');
  if (saved) {
    state.currentUser = JSON.parse(saved);
    updateNavUser();
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  restoreSession();

  // Close dropdown on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.user-avatar')) {
      const dd = document.getElementById('userDropdown');
      if (dd) dd.style.display = 'none';
    }
    if (!e.target.closest('.hamburger') && !e.target.closest('.nav-links')) {
      document.getElementById('navLinks')?.classList.remove('open');
    }
  });

  // Initialize landing animations
  setTimeout(() => {
    document.querySelectorAll('.preview-card').forEach((card, i) => {
      card.style.animationPlayState = 'running';
    });
  }, 300);
});
