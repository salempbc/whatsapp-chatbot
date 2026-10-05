# SPBC Church CMS 2.1 — Final Release Manifest

**Release Target:** Salem Primitive Baptist Church (SPBC) Church CMS 2.1  
**Base Commit Tested:** `baec6a6` (`fix: total contrast and dark mode overhaul - crisp white text on dark cards, theme-adaptive navbar, and manual theme switcher`)  
**Audit Date:** October 5, 2026  
**Auditor:** Senior DevOps Engineer, QA Automation Lead & Application Security Engineer  

---

## 1. Release Inventory & Classification

Every changed and untracked file in the repository has been audited and classified into defined categories:

### Category A — Required for 2.1 Core Application (26 files)
Files that implement the core features, API routes, security guards, data models, and UI:

| File | Status | Description |
| :--- | :---: | :--- |
| `src/models/Member.js` | Modified | Member schema with lifecycle status enum, sync hooks, marital rules |
| `src/models/ChurchEvent.js` | Untracked | Church event schema with category enums, recurrence, reminders |
| `src/models/Task.js` | Untracked | Administrative task schema with priority, categories, overdue tracking |
| `src/models/AuditLog.js` | Untracked | Entity mutation audit log with before/after state diffs |
| `src/models/GreetingLog.js` | Untracked | Greeting state machine with compound unique idempotency index |
| `src/services/memberService.js` | Modified | Multi-dimensional duplicate detection, archive/restore, status machine |
| `src/services/churchCalendarService.js` | Untracked | RFC 5545 iCalendar stream generation, event unification |
| `src/services/taskService.js` | Untracked | Task lifecycle, priority sorting, overdue categorization |
| `src/services/reportService.js` | Untracked | Demographic aggregations, health score audit, data aliases |
| `src/services/greetingService.js` | Untracked | Idempotent daily greeting preparation and status tracking |
| `src/services/aiService.js` | Modified | Canonical Tamil Bible verse grounding, Gemini AI integration, offline fallback |
| `src/bot/guard.js` | Modified | Fail-closed administrator authorization engine |
| `src/bot/router.js` | Modified | Callback query router with strict authorization barrier |
| `src/bot/handlers/home.js` | Modified | Main menu screen, dynamic WebApp URL handling, /ping guard |
| `src/bot/handlers/events.js` | Untracked | Telegram /events list and /addevent conversational wizard |
| `src/bot/handlers/tasks.js` | Untracked | Telegram /tasks list and /addtask conversational wizard |
| `src/bot/handlers/review.js` | Untracked | Interactive greeting review deck for /review |
| `src/bot/handlers/settings.js` | Modified | Notification timing and cron schedule settings |
| `src/bot/handlers/stats.js` | Modified | Congregational statistics and data quality commands |
| `src/bot/index.js` | Modified | Bot lifecycle, rate-limited queue, webhook registration |
| `src/api/index.js` | Modified | Express REST API endpoints, rate limiting, member photo caching |
| `src/api/middleware.js` | Untracked | WebApp HMAC-SHA256 verification, timing-safe token check, 24h replay protection |
| `src/config/db.js` | Modified | MongoDB connection manager supporting `MONGO_DB_NAME` isolation override |
| `src/scheduler/dailyJob.js` | Modified | Morning cron job delivering private review decks to `ADMIN_ID` |
| `public/index.html` | Modified | 6-tab floating island navigation, member forms, event/task dialogs, dark mode |
| `public/app.js` | Modified | Vue 3 frontend logic, pre-save duplicate modal, calendar download |

### Category B — Required Deployment & Configuration (5 files)
Files necessary to build, configure, and safely deploy the staging release:

| File | Status | Description |
| :--- | :---: | :--- |
| `render.yaml` | Untracked | Render Web Service Blueprint with health check `/ping` and `sync: false` secrets |
| `package.json` | Modified | Updated to version `2.1.0` |
| `package-lock.json` | Modified | Synced lockfile with version `2.1.0` |
| `.env.example` | Modified | Complete environment template with sanitized `<STAGING_*>` placeholders |
| `.gitignore` | Modified | Hardened to exclude `.env.*` while keeping `.env.example` |

### Category C — Automated Test Suites (6 files)
Automated unit, integration, and security tests covering all 2.1 features:

| File | Status | Test Coverage |
| :--- | :---: | :--- |
| `tests/api.test.js` | Modified | Cron converter, Tamil name suffixes, loopback HTTP endpoint tests |
| `tests/greeting.test.js` | Untracked | Canonical Scripture verses, offline fallback, formatGreetingCard |
| `tests/integration_and_audit.test.js` | Untracked | Telegram auth, WebApp HMAC, member lifecycle, `.ics` export, task overdue |
| `tests/lifecycle_and_modules.test.js` | Untracked | Modules A-D unit tests, duplicate detection, CSV formula injection defense |
| `tests/scheduler_and_data.test.js` | Untracked | Leap year date logic, scheduler broadcast safety (zero group message guarantee) |
| `tests/security.test.js` | Untracked | Fail-closed `isAdmin`, `adminOnly` wrapper, timing-safe HMAC verification |

### Category D — Technical Documentation (16 files)
Complete architectural specifications, operational runbooks, and audit logs:

| File | Status | Description |
| :--- | :---: | :--- |
| `README.md` | Untracked | Comprehensive repository overview, quick start, architecture summary |
| `docs/STAGING_DEPLOYMENT_GUIDE.md` | Untracked | Complete step-by-step staging operational runbook & 27-item checklist |
| `docs/CHURCH_CMS_2_1_STAGING_VERIFICATION.md` | Untracked | 9-phase staging deployment verification report |
| `docs/CHURCH_CMS_2_1_RELEASE_AUDIT.md` | Untracked | Code audit findings and 8 remediations log |
| `docs/CHURCH_CMS_2_1_ENGINEERING_REPORT.md` | Untracked | Master engineering report for SPBC Church CMS 2.1 |
| `docs/CHURCH_CMS_2_1_RELEASE_MANIFEST.md` | Untracked | This final release manifest |
| `docs/ARCHITECTURE.md` | Untracked | System context and component breakdown |
| `docs/DATABASE.md` | Untracked | Entity-relationship diagrams and schema reference |
| `docs/TELEGRAM_BOT.md` | Untracked | Command inventory and router namespaces |
| `docs/CHANGELOG.md` | Untracked | Version changelog (2.0.0 & 2.1.0) |
| `docs/AI_GREETING_SYSTEM.md` | Untracked | AI greeting and canonical scripture pipeline |
| `docs/SECURITY.md` | Untracked | Security architecture, fail-closed guards, and HMAC auth specs |
| `docs/DEPLOYMENT.md` | Untracked | Deployment and operations reference |
| `docs/BACKUP_RECOVERY.md` | Untracked | Database backup and recovery procedures |
| `docs/TESTING.md` | Untracked | Testing strategies and test suite structure |
| `docs/FINAL_ENGINEERING_REPORT.md` | Untracked | Handover engineering report |

### Category E — Excluded Files (Must NOT Be Committed)
Files excluded from the release by design:

| File / Pattern | Status | Reason for Exclusion |
| :--- | :---: | :--- |
| `.env` | Untracked (Ignored) | Contains local active credentials; excluded by `.gitignore` |
| `.env.staging` | Untracked (Ignored) | May contain staging credentials; excluded by `.gitignore` |
| `node_modules/` | Ignored | Third-party dependencies; installed via `npm install` |
| `session/`, `.wwebjs_cache/` | Ignored | Local WhatsApp web session caches; excluded by `.gitignore` |

### Category F — Historical Reference Documents (1 file)
| File | Status | Decision | Reason |
| :--- | :---: | :---: | :--- |
| `CHURCH_CMS_TELEGRAM_BOT_AUDIT.md` | Untracked | Include in Commit | Historical initial codebase audit report providing context on the 1.0 to 2.1 migration; fully sanitized with placeholders. |

---

## 2. Security & Secret Verification

### 2.1 Repository-Wide Secret Scan
- **Scan Targets:** Tracked and untracked files scanned for regex patterns: `BOT_TOKEN`, `MONGO_URI`, `ADMIN_SECRET`, `GEMINI_API_KEY`, `WEBHOOK_SECRET`, `mongodb+srv://`, `AIza`, `password=`, `Bearer`.
- **Findings:**
  - Zero live credentials detected in any committed or tracked file.
  - Zero hardcoded production database connection strings.
  - All documentation examples sanitized with unmistakable `<PLACEHOLDER>` tokens.
  - Test suites utilize dedicated mock strings (`TEST_BOT_TOKEN_FOR_API`, `999888777`) within isolated in-memory test scopes.
- **Git Safety Verification:**
  - `git check-ignore .env` confirms `.env` is ignored.
  - `git check-ignore .env.staging` confirms `.env.staging` is ignored.
  - `git ls-files .env` confirms `.env` is not tracked.

### 2.2 Production Reference Scan
- **Scan Results:** Zero hardcoded production church domains exist in the codebase.
- **Dynamic Configuration:**
  - Database target: `process.env.MONGO_DB_NAME || "whatsapp-chatbot"`
  - Bot token: `process.env.BOT_TOKEN`
  - Admin ID: `process.env.ADMIN_ID`
  - WebApp URL: `process.env.WEBAPP_URL || process.env.RENDER_EXTERNAL_URL`
  - Webhook secret: `process.env.WEBHOOK_SECRET`

---

## 3. Automated Test Suite & Integrity

- **Final Test Count:** **35 tests passing, 0 failing, 0 skipped**
- **Test Runner:** Node.js native test runner (`node --test tests/*.test.js`)
- **Execution Time:** ~1120ms
- **Integrity Check:**
  - Unit tests verify pure functions (age calculations, date formatting, template parsing).
  - Integration tests verify real crypto math (HMAC-SHA256, `crypto.timingSafeEqual`).
  - HTTP tests verify real Express routes over loopback HTTP (`/ping`, `/api/ping`, `/api/diagnostics`).
  - Security tests verify fail-closed boundaries when `ADMIN_ID` is missing or mismatched.
  - Scheduler tests verify zero group broadcast invariant.
- **Syntax & Encoding Check:** `npm run check` confirms 0 syntax errors and 0 mojibake across all Tamil Scripture and memorial files.

---

## 4. Deployment Configuration Audit

- **Render Blueprint (`render.yaml`):**
  - Web Service configuration: Node runtime, `npm install`, `npm start`.
  - Health check: `/ping` (HTTP 200 `pong`).
  - Environment variables: `NODE_ENV=staging`, `MONGO_DB_NAME=spbc_staging`.
  - Sensitive variables configured with `sync: false` to prevent secret leakage.
- **Package Integrity:**
  - `package.json` version: `2.1.0`
  - `package-lock.json` version: `2.1.0`
  - Dependencies: Only standard required packages (`compression`, `cors`, `dotenv`, `express`, `express-rate-limit`, `helmet`, `mongoose`, `node-cron`, `node-telegram-bot-api`).

---

## 5. Production Safety Invariant

> [!CAUTION]
> **PRODUCTION DEPLOYMENT: NOT PERFORMED**  
> - Production database: **NOT modified**  
> - Production Telegram bot: **NOT modified**  
> - Production webhooks: **NOT modified**  
> - Production scheduler: **NOT activated**  
> - Production credentials: **NOT altered**  
>
> Production cutover remains strictly locked until staging is provisioned and all 27 manual checklist items in [`docs/STAGING_DEPLOYMENT_GUIDE.md`](../docs/STAGING_DEPLOYMENT_GUIDE.md) are completed.

---

## 6. Remaining Blockers Prior to Live Staging Verification

1. **Staging Service Provisioning:** Provisioning the `spbc-church-cms-staging` Web Service on Render using [`render.yaml`](../render.yaml).
2. **Staging Database Setup:** Configuring `spbc_staging` on MongoDB Atlas and running compound index scripts.
3. **Dedicated Staging Bot:** Registering `@spbc_staging_bot` via [@BotFather](https://t.me/BotFather) and configuring menu buttons.
4. **Physical Device QA:** Executing manual smoke tests on physical iOS, Android, and WhatsApp clients.
