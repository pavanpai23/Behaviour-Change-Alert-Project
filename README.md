# 🎓 BehaviourSense — Student Behaviour Change Alert System

A beautiful, AI-powered web application to detect and alert on student behaviour changes across **Mood**, **Sleep**, **Activity**, and **Social Communication**.

---

## ✨ Features

- 🔐 **Auth System** — Login/Register with Teacher, Student, Admin roles
- 📊 **Dashboard** — Live charts, alert banners, risk indicators
- 📋 **Daily Check-In** — 4-step guided form (Mood → Sleep → Activity → Social)
- 📈 **Reports & Analytics** — Student profiles, behaviour charts, risk table
- 🤖 **AI Assistant** — Claude-powered chat with optional web search
- 🔔 **Auto Alerts** — Triggered when behaviour falls below thresholds
- 📱 **Fully Responsive** — Mobile, tablet, desktop
- 🖼️ **Rich Images** — Real photos for each tracking category

---

## 🚀 Running Locally

### Option 1: Just Open the HTML (simplest)

```bash
# No setup needed! Just open index.html in your browser
open index.html
# or double-click index.html
```

### Option 2: With Node.js Backend (recommended)

**Requirements:** Node.js 18+

```bash
# 1. Install dependencies
npm install

# 2. Set your Anthropic API key (for AI chat)
export ANTHROPIC_API_KEY=your_key_here   # Mac/Linux
set ANTHROPIC_API_KEY=your_key_here      # Windows

# 3. Start the server
npm start
# or for development with auto-reload:
npm run dev

# 4. Open browser
# http://localhost:3000
```

---

## 📦 Deployment Options

### 🟢 Vercel (Recommended — Free)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables in Vercel Dashboard:
# ANTHROPIC_API_KEY = your_key
```

### 🔵 Railway (Free tier)

```bash
# Install Railway CLI
npm install -g @railway/cli

railway login
railway init
railway up

# Set env vars:
railway variables set ANTHROPIC_API_KEY=your_key
```

### 🟠 Render (Free tier)

1. Go to https://render.com
2. Connect your GitHub repo
3. Set Build Command: `npm install`
4. Set Start Command: `node server.js`
5. Add Environment Variable: `ANTHROPIC_API_KEY`

#### Persistence on Render (important)

By default this project stores data in a local `data.json` file which is fine for demos but not durable on many cloud platforms. For reliable storage on Render:

- Use Render Managed Postgres: create a Postgres instance, then set `DATABASE_URL` in your service's Environment.
- Or enable a persistent disk for your service and mount it; set `DATA_PATH` to point at the mounted folder where `data.json` will be written.

If you choose Postgres, update `server.js` to read `process.env.DATABASE_URL` and switch storage from the local JSON file to Postgres. For quick deployments you can continue using the file-based DB, but prefer managed Postgres for production to ensure all login, registration and check-in events are durable and visible to admins.

### 🟣 Heroku

```bash
# Install Heroku CLI, then:
heroku create behaviour-sense-app
heroku config:set ANTHROPIC_API_KEY=your_key
git push heroku main
heroku open
```

### 🐳 Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
docker build -t behaviour-sense .
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=your_key behaviour-sense
```

### 🔺 GitHub Pages (Static only — no backend)

```bash
# Just push to GitHub and enable GitHub Pages
# The app works without backend using localStorage
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/behaviour-sense
git push -u origin main
# Then go to Settings → Pages → Enable
```

---

## 🔑 Getting Your Anthropic API Key

1. Go to https://console.anthropic.com
2. Sign up / Log in
3. Go to **API Keys** → **Create Key**
4. Copy the key starting with `sk-ant-...`
5. Add it as `ANTHROPIC_API_KEY` environment variable

---

## 🗂️ Project Structure

```
behaviour-sense/
├── index.html          # Main app (single-page)
├── server.js           # Node.js Express backend
├── package.json        # Dependencies
├── css/
│   └── style.css       # Complete stylesheet
├── js/
│   └── app.js          # Frontend logic + AI chat
└── README.md           # This file
```

---

## 🔐 Demo Credentials

| Role    | Email              | Password |
| ------- | ------------------ | -------- |
| Teacher | teacher@school.edu | demo123  |
| Student | student@school.edu | demo123  |
| Admin   | admin@school.edu   | demo123  |

Or use the **"Quick Demo"** buttons on the login page!

---

## 📱 Responsive Breakpoints

- **Mobile:** < 480px
- **Tablet:** 480px – 1024px
- **Desktop:** > 1024px

---

## 🤖 AI Chat Features

- Student behaviour analysis
- Risk pattern identification
- Intervention recommendations
- Toggle **Web Search** to get latest research
- Powered by Claude Sonnet

---

## ⚡ Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS (no framework needed)
- **Charts:** Chart.js 4.4
- **Fonts:** Syne (display) + DM Sans (body)
- **Avatars:** DiceBear API
- **Images:** Unsplash (free, no API key needed)
- **Backend:** Node.js + Express
- **AI:** Anthropic Claude API
- **Storage:** localStorage (demo) / JSON file (backend)

---

## 🛠️ Customisation

### Change colours (css/style.css):

```css
:root {
  --primary: #5b4af7; /* Main purple */
  --accent: #06b6d4; /* Cyan accent */
  --success: #10b981; /* Green */
  --warning: #f59e0b; /* Orange */
  --danger: #ef4444; /* Red */
}
```

### Add more students (js/app.js):

```js
// Edit the names array in generateStudents()
const names = ['Your Student Names Here', ...];
```

### Connect to a real database:

Replace the `db` object in `server.js` with PostgreSQL/MongoDB calls.

---

Built with ❤️ for student wellbeing.
