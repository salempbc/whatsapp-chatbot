# Salem Primitive Baptist Church (SPBC) CMS Telegram Bot & WebApp

A dedicated, private, admin-only Church Management System and administrative assistant for **Salem Primitive Baptist Church (SPBC)**. Built with Node.js 20+, Express, grammY/node-telegram-bot-api, MongoDB Atlas, Vue 3, and Tailwind CSS.

## 🎯 Purpose & Operating Model
The bot serves church administrators by:
1. Managing congregation member directories, family connections, attendance, and leadership designations.
2. Tracking birthdays, wedding anniversaries, and memorial days.
3. Automatically preparing daily Christian greetings with canonical Tamil Bible verses and personalized pastoral blessings (powered by Google Gemini AI with resilient offline fallbacks).
4. Providing a private **Admin Review deck** (`/review`) where administrators can preview, customize tone/style, edit text, and copy finalized messages with one tap.
5. **Human-in-the-Loop Delivery:** The administrator manually pastes approved greetings into church WhatsApp groups. **No automated external broadcasting or unsolicited third-party delivery is permitted.**

---

## 🛠 Technology Stack
- **Runtime:** Node.js 20+ (ES Modules)
- **Telegram Bot:** `node-telegram-bot-api` / grammY compatible router
- **Backend Framework:** Express.js 4 (embedded with API rate limiting and Helmet headers)
- **Database & ODM:** MongoDB Atlas + Mongoose 8/9
- **Scheduling:** `node-cron` with timezone set to `Asia/Kolkata` (IST)
- **Frontend Admin Panel:** Vue 3 Composition API + Tailwind CSS
- **AI Engine:** Google Gemini (`gemini-1.5-flash`) with prompt sanitization, persistent cache, and curated canonical Tamil fallbacks
- **Testing:** Node.js Native Test Runner (`node --test`)

---

## 🚀 Quick Start & Setup

### 1. Prerequisites
- Node.js 20.x or higher
- MongoDB instance (local or Atlas URI)
- Telegram Bot Token from [@BotFather](https://t.me/BotFather)
- Telegram User ID of the church administrator (obtain from [@userinfobot](https://t.me/userinfobot))
- Google Gemini API Key (optional, offline canonical blessings activate if unset)

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in your values:

```env
NODE_ENV=staging
PORT=3000
MONGO_URI=<YOUR_MONGO_URI>
MONGO_DB_NAME=spbc_staging
BOT_TOKEN=<YOUR_BOT_TOKEN>
ADMIN_ID=<YOUR_TELEGRAM_ADMIN_ID>
ADMIN_SECRET=<YOUR_32_CHAR_RANDOM_SECRET>
WEBAPP_URL=<YOUR_WEBAPP_URL>
GEMINI_API_KEY=<YOUR_GEMINI_API_KEY>
GEMINI_MODEL=gemini-1.5-flash
```

### 3. Installation & Run
```bash
# Install dependencies
npm install

# Run automated test suite
npm test

# Verify syntax and encoding integrity
npm run check

# Start application server
npm start
```

---

## 🔒 Security Architecture
- **Fail-Closed Guard:** Rejects all user commands and callback queries if `ADMIN_ID` is missing, malformed, or doesn't match the incoming user ID.
- **Telegram WebApp HMAC Verification:** Validates `window.Telegram.WebApp.initData` with SHA-256 HMAC signature checking, 24-hour replay protection window, and server-side admin ID validation.
- **Broadcast Elimination:** The morning job dispatches private interactive review cards solely to `ADMIN_ID`. No automated public broadcasts occur.
- **CSV Formula Neutralization:** All spreadsheet exports neutralize spreadsheet formulas (prefixing `=,+,-,@`) to prevent Excel injection.

---

## 📖 Telegram Commands & Navigation
- `/review` — Open today's celebrations review deck (interactive preview, copy, edit, style, and WhatsApp share tracking)
- `/events` — View upcoming church calendar events and services
- `/addevent` — Register a new church service or meeting
- `/tasks` — Administrative task queue and overdue items
- `/addtask` — Register a new pastoral or administrative task
- `/stats` — Church demographics, membership totals, and activity statistics
- `/dataquality` — Run real-time data quality audit and view database health score
- `/menu` or `/start` — Return to the main administrative dashboard
- `/bible <reference>` — Search canonical Tamil Bible verses (TAOVBSI)
- `/addverse <type> <reference>` — Add custom Scripture reference for events
- `/listverses` — List tracked custom verses
- `/addmemorial <MM-DD> <Name>, [Note]` — Track memorial anniversary
- `/listmemorials` — View tracked memorial remembrance days
- `/cancel` — Cancel any multi-step wizard

---

## 📚 Technical Documentation
Detailed technical specifications are located in the `docs/` directory:
- [SPBC Church CMS 2.1 Comprehensive Engineering Report](docs/CHURCH_CMS_2_1_ENGINEERING_REPORT.md)
- [Architecture Overview](docs/ARCHITECTURE.md)
- [Database Schema & Models](docs/DATABASE.md)
- [Telegram Bot Command & Router Specs](docs/TELEGRAM_BOT.md)
- [AI Greeting & Scripture Pipeline](docs/AI_GREETING_SYSTEM.md)
- [Security & Authentication Model](docs/SECURITY.md)
- [Deployment & Operations](docs/DEPLOYMENT.md)
- [Backup & Recovery Procedures](docs/BACKUP_RECOVERY.md)
- [Testing & Quality Assurance](docs/TESTING.md)
- [Changelog](docs/CHANGELOG.md)
- [Final Engineering Audit Report](docs/FINAL_ENGINEERING_REPORT.md)
