/**
 * MindGuard - optional static server/API shell
 * Node.js + Express
 * Run: node server.js
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname)));

// ===== IN-MEMORY DATA STORE =====
let db = {
  users: [],
  checkins: [],
  alerts: [],
  logins: [],
};

// Load existing data
const dataFile = path.join(__dirname, "data.json");
if (fs.existsSync(dataFile)) {
  try {
    db = { ...db, ...JSON.parse(fs.readFileSync(dataFile, "utf8")) };
  } catch (e) {}
}

function saveDb() {
  fs.writeFileSync(dataFile, JSON.stringify(db, null, 2));
}

function publicDb() {
  return {
    users: db.users,
    checkins: db.checkins,
    alerts: db.alerts,
    logins: db.logins,
  };
}

function upsertById(current, incoming) {
  const map = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    if (item && item.id)
      map.set(item.id, { ...(map.get(item.id) || {}), ...item });
  });
  return Array.from(map.values());
}

function replaceDb(next = {}) {
  db = {
    users: Array.isArray(next.users) ? next.users : [],
    checkins: Array.isArray(next.checkins) ? next.checkins : [],
    alerts: Array.isArray(next.alerts) ? next.alerts : [],
    logins: Array.isArray(next.logins) ? next.logins : [],
  };
  saveDb();
}

function mergeDb(next = {}) {
  db = {
    users: upsertById(db.users, Array.isArray(next.users) ? next.users : []),
    checkins: upsertById(
      db.checkins,
      Array.isArray(next.checkins) ? next.checkins : [],
    ),
    alerts: upsertById(
      db.alerts,
      Array.isArray(next.alerts) ? next.alerts : [],
    ),
    logins: upsertById(
      db.logins,
      Array.isArray(next.logins) ? next.logins : [],
    ),
  };
  saveDb();
}

function getClientIp(req) {
  return (
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    ""
  );
}

function detectDeviceFromReq(req, body = {}) {
  const ua = body.userAgent || req.headers["user-agent"] || "";
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(ua);
  return {
    userAgent: ua,
    platform: body.platform || req.headers["sec-ch-ua-platform"] || "",
    isMobile,
    deviceType: isMobile ? "mobile" : "desktop",
    ip: getClientIp(req),
  };
}

// ===== SSE: REAL-TIME PUSH TO ALL CONNECTED CLIENTS =====
// Keeps a set of active SSE response objects (one per open browser tab/device)
const sseClients = new Set();

/**
 * Push the latest DB to every connected client immediately.
 * Called after any write so admin on phone AND laptop both update without polling.
 */
function broadcastDb() {
  const payload = `data: ${JSON.stringify(publicDb())}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch (_) {
      sseClients.delete(res);
    }
  }
}

// Client connects here to receive push updates
app.get("/api/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // disable Nginx buffering if behind a proxy
  });
  res.flushHeaders();

  // Send current state immediately on connect
  res.write(`data: ${JSON.stringify(publicDb())}\n\n`);

  // Keep connection alive with a heartbeat every 20 s
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch (_) {}
  }, 20000);

  sseClients.add(res);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// ===== SHARED DATA ROUTES =====
app.get("/api/db", (req, res) => {
  res.json(publicDb());
});

app.put("/api/db", (req, res) => {
  if (req.query.mode === "replace") replaceDb(req.body);
  else mergeDb(req.body);
  broadcastDb(); // ← push update to ALL devices instantly
  res.json({ success: true, db: publicDb() });
});

app.delete("/api/users/:id", (req, res) => {
  const { id } = req.params;
  db.users = db.users.filter((u) => u.id !== id);
  db.checkins = db.checkins.filter((c) => c.userId !== id);
  db.alerts = db.alerts.filter((a) => a.userId !== id);
  saveDb();
  broadcastDb(); // ← push update to ALL devices instantly
  res.json({ success: true, db: publicDb() });
});

// ===== AUTH ROUTES =====
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const meta = detectDeviceFromReq(req, req.body);

  // Admin shortcut
  if (email === "admin@mindguard.app" && password === "Admin@1234!") {
    const token = Buffer.from(`admin:${Date.now()}`).toString("base64");
    // record admin login
    db.logins.push({
      id: `login${Date.now()}`,
      event: "login",
      userId: "admin",
      email,
      success: true,
      timestamp: new Date().toISOString(),
      userAgent: meta.userAgent,
      deviceType: meta.deviceType,
      ip: meta.ip,
    });
    saveDb();
    broadcastDb();
    return res.json({
      token,
      user: { id: "admin", name: "MindGuard Admin", email, role: "admin" },
    });
  }

  const user = db.users.find((u) => u.email === email);
  if (!user || user.password !== password) {
    // failed login event
    db.logins.push({
      id: `login${Date.now()}`,
      event: "login",
      userId: user ? user.id : null,
      email,
      success: false,
      timestamp: new Date().toISOString(),
      userAgent: meta.userAgent,
      deviceType: meta.deviceType,
      ip: meta.ip,
    });
    saveDb();
    broadcastDb();
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // successful login
  const token = Buffer.from(`${user.id}:${Date.now()}`).toString("base64");
  db.logins.push({
    id: `login${Date.now()}`,
    event: "login",
    userId: user.id,
    email: user.email,
    success: true,
    timestamp: new Date().toISOString(),
    userAgent: meta.userAgent,
    deviceType: meta.deviceType,
    ip: meta.ip,
  });
  saveDb();
  broadcastDb();
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      school: user.school,
    },
  });
});

app.post("/api/auth/register", (req, res) => {
  const { firstName, lastName, email, password, emergencyContact } = req.body;
  const meta = detectDeviceFromReq(req, req.body);
  if (email === "admin@mindguard.app")
    return res.status(400).json({ error: "Email reserved for admin" });
  if (db.users.find((u) => u.email === email))
    return res.status(400).json({ error: "Email already registered" });
  const user = {
    id: "u" + Date.now(),
    email,
    password,
    name: `${firstName} ${lastName}`,
    role: "user",
    emergencyContact,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  // record registration as a login-type event for auditing
  db.logins.push({
    id: `login${Date.now()}`,
    event: "register",
    userId: user.id,
    email: user.email,
    success: true,
    timestamp: new Date().toISOString(),
    userAgent: meta.userAgent,
    deviceType: meta.deviceType,
    ip: meta.ip,
  });
  saveDb();
  broadcastDb(); // ← push new user to admin on every device immediately
  const token = Buffer.from(`${user.id}:${Date.now()}`).toString("base64");
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emergencyContact: user.emergencyContact,
    },
  });
});

// ===== LOGIN EVENTS =====
app.get("/api/logins", (req, res) => {
  res.json((db.logins || []).slice(-200).reverse());
});

app.get("/api/logins/:userId", (req, res) => {
  const logs = (db.logins || [])
    .filter((l) => l.userId === req.params.userId)
    .slice(-200)
    .reverse();
  res.json(logs);
});

// ===== LOG ROUTES =====
app.post("/api/checkins", (req, res) => {
  const log = {
    id: "checkin" + Date.now(),
    ...req.body,
    timestamp: req.body.timestamp || new Date().toISOString(),
  };
  db.checkins.push(log);

  // Auto-generate alert if indicators are low
  const alerts = [];
  if (log.mood < 5)
    alerts.push({
      type: "Mood Drop",
      level: "high",
      desc: `Mood score of ${log.mood} is critically low`,
    });
  if (log.sleepHours < 5)
    alerts.push({
      type: "Sleep Deficit",
      level: "high",
      desc: `Only ${log.sleepHours} hours of sleep`,
    });
  if (log.social < 4)
    alerts.push({
      type: "Social Withdrawal",
      level: "medium",
      desc: `Social score of ${log.social} indicates withdrawal`,
    });
  alerts.forEach((a) =>
    db.alerts.push({
      ...a,
      userId: log.userId,
      checkinId: log.id,
      timestamp: new Date().toISOString(),
    }),
  );

  saveDb();
  broadcastDb(); // ← push new check-in to admin on every device immediately
  res.json({ success: true, log, alertsGenerated: alerts.length });
});

app.get("/api/checkins/:userId", (req, res) => {
  const logs = db.checkins.filter((l) => l.userId === req.params.userId);
  res.json(logs);
});

// ===== ANALYTICS ROUTES =====
app.get("/api/analytics/summary", (req, res) => {
  const recentLogs = db.checkins.slice(-100);
  const avg = (key) =>
    recentLogs.length
      ? (
          recentLogs.reduce((s, l) => s + (parseFloat(l[key]) || 0), 0) /
          recentLogs.length
        ).toFixed(1)
      : 0;
  res.json({
    avgMood: avg("mood"),
    avgSleep: avg("sleepHours"),
    avgSocial: avg("social"),
    totalCheckins: db.checkins.length,
    totalAlerts: db.alerts.length,
    highRiskCount: db.alerts.filter((a) => a.level === "high").length,
  });
});

app.get("/api/alerts", (req, res) => {
  res.json(db.alerts.slice(-50).reverse());
});

// ===== AI PROXY ROUTE (keeps API key server-side) =====
app.post("/api/ai/chat", async (req, res) => {
  const { messages, systemPrompt, webSearch } = req.body;

  try {
    const tools = webSearch
      ? [{ type: "web_search_20250305", name: "web_search" }]
      : undefined;
    const body = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    };
    if (tools) body.tools = tools;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "AI service unavailable", message: err.message });
  }
});

// ===== HEALTH CHECK =====
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    connectedClients: sseClients.size,
  });
});

// ===== SERVE FRONTEND =====
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`\nMindGuard Server running at http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}`);
  console.log(`API: http://localhost:${PORT}/api/health\n`);
  console.log(`Real-time SSE: http://localhost:${PORT}/api/events`);
  console.log(`Open on multiple devices/tabs — admin updates instantly!\n`);
});

module.exports = app;
