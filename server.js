/**
 * BehaviourSense - Backend Server
 * Node.js + Express
 * Run: node server.js
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// ===== IN-MEMORY DATA STORE =====
// In production, replace with a real database (PostgreSQL, MongoDB, etc.)
let db = {
  users: [
    { id: 'u1', email: 'teacher@school.edu', password: 'demo123', name: 'Ms. Priya Nair', role: 'teacher', school: 'Greenwood High' },
    { id: 'u2', email: 'student@school.edu', password: 'demo123', name: 'Rohan Mehta', role: 'student', school: 'Greenwood High' },
    { id: 'u3', email: 'admin@school.edu', password: 'demo123', name: 'Dr. Admin', role: 'admin', school: 'Greenwood High' }
  ],
  logs: [],
  alerts: []
};

// Load existing data
const dataFile = path.join(__dirname, 'data.json');
if (fs.existsSync(dataFile)) {
  try { db = { ...db, ...JSON.parse(fs.readFileSync(dataFile, 'utf8')) }; } catch(e) {}
}

function saveDb() {
  fs.writeFileSync(dataFile, JSON.stringify(db, null, 2));
}

// ===== AUTH ROUTES =====
app.post('/api/auth/login', (req, res) => {
  const { email, password, role } = req.body;
  const user = db.users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, school: user.school } });
});

app.post('/api/auth/register', (req, res) => {
  const { firstName, lastName, email, password, role, school } = req.body;
  if (db.users.find(u => u.email === email)) return res.status(400).json({ error: 'Email already registered' });
  const user = { id: 'u' + Date.now(), email, password, name: `${firstName} ${lastName}`, role, school };
  db.users.push(user);
  saveDb();
  const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, school: user.school } });
});

// ===== LOG ROUTES =====
app.post('/api/logs', (req, res) => {
  const log = { id: 'log' + Date.now(), ...req.body, createdAt: new Date().toISOString() };
  db.logs.push(log);
  
  // Auto-generate alert if indicators are low
  const alerts = [];
  if (log.mood < 5) alerts.push({ type: 'Mood Drop', level: 'high', desc: `Mood score of ${log.mood} is critically low` });
  if (log.sleep < 5) alerts.push({ type: 'Sleep Deficit', level: 'high', desc: `Only ${log.sleep} hours of sleep` });
  if (log.social < 4) alerts.push({ type: 'Social Withdrawal', level: 'medium', desc: `Social score of ${log.social} indicates withdrawal` });
  alerts.forEach(a => db.alerts.push({ ...a, userId: log.userId, logId: log.id, createdAt: new Date().toISOString() }));
  
  saveDb();
  res.json({ success: true, log, alertsGenerated: alerts.length });
});

app.get('/api/logs/:userId', (req, res) => {
  const logs = db.logs.filter(l => l.userId === req.params.userId);
  res.json(logs);
});

// ===== ANALYTICS ROUTES =====
app.get('/api/analytics/summary', (req, res) => {
  const recentLogs = db.logs.slice(-100);
  const avg = (key) => recentLogs.length ? (recentLogs.reduce((s, l) => s + (parseFloat(l[key]) || 0), 0) / recentLogs.length).toFixed(1) : 0;
  res.json({
    avgMood: avg('mood'), avgSleep: avg('sleep'), avgSocial: avg('social'),
    totalLogs: db.logs.length, totalAlerts: db.alerts.length,
    highRiskCount: db.alerts.filter(a => a.level === 'high').length
  });
});

app.get('/api/alerts', (req, res) => {
  res.json(db.alerts.slice(-50).reverse());
});

// ===== AI PROXY ROUTE (keeps API key server-side) =====
app.post('/api/ai/chat', async (req, res) => {
  const { messages, systemPrompt, webSearch } = req.body;
  
  try {
    const tools = webSearch ? [{ type: 'web_search_20250305', name: 'web_search' }] : undefined;
    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages
    };
    if (tools) body.tools = tools;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY || ''
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'AI service unavailable', message: err.message });
  }
});

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ===== SERVE FRONTEND =====
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 BehaviourSense Server running at http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔌 API: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
