# Project Changelog — SPBC Church CMS

All notable changes made to the Salem Primitive Baptist Church (SPBC) CMS Telegram Bot codebase are documented below.

---

## [2.1.0] - 2026-10-05

### 👥 Module A: Complete Member Lifecycle Management
- **Lifecycle State Machine (`src/models/Member.js`):** Added status enum (`active`, `inactive`, `transferred`, `deceased`, `archived`) with automated pre-save synchronization to `isActive` and `isDeleted`.
- **Intelligent Duplicate Detection (`src/services/memberService.js`):** Multi-dimensional collision detection across names, phone numbers, and family+DOB combinations.
- **Audit Logging Engine (`src/models/AuditLog.js`):** Granular tracking of all state transitions, archives, and profile modifications.
- **Member Archiving & Restoration (`POST /api/members/:id/archive`, `POST /api/members/:id/restore`):** Safe soft-delete and restore capabilities.

### 📅 Module B: Unified Church Calendar & Event Management
- **Church Event Schema (`src/models/ChurchEvent.js`):** Support for services, prayer meetings, fellowship, and special revivals with category, venue, and recurrence.
- **iCalendar Export (`src/services/churchCalendarService.js`):** Full RFC 5545 `.ics` calendar generation for Google Calendar, Apple Calendar, and Microsoft Outlook (`GET /api/events/export/ics`).
- **Telegram Bot Event Wizards (`src/bot/handlers/events.js`):** Added `/events` interactive list and `/addevent` conversational wizard.

### 📋 Module C: Administrative Task & Follow-up Management
- **Task Management Engine (`src/models/Task.js`, `src/services/taskService.js`):** Track pastoral visits, event preparation, facility maintenance, and member follow-ups.
- **Priority Queues & Overdue Detection:** Priorities (`low`, `medium`, `high`, `urgent`), statuses (`todo`, `in_progress`, `waiting`, `completed`, `cancelled`), and real-time overdue alerts.
- **Telegram Bot Task Commands (`src/bot/handlers/tasks.js`):** Added `/tasks` dashboard and `/addtask` conversational wizard.

### 📊 Module D: Advanced Church Statistics, Analytics & Data Quality
- **Demographics & Velocity Aggregations (`src/services/reportService.js`):** Deep statistical breakdowns of active/inactive rosters, married couples, youth, gender, and task completion velocity (`GET /api/reports/stats`).
- **Automated Data Quality Health Audit (`GET /api/reports/data-quality`):** Database health score (0–100%) and automatic flagging of missing names, non-standard dates, orphaned spouses, or marital gender pairing inconsistencies.
- **Telegram Analytics Commands:** Upgraded `/stats` and added `/dataquality` inspection commands.

### 💻 WebApp UI/UX Redesign
- **6-Tab Floating Island Navigation (`public/index.html`):** Quick navigation between Members, Events, Tasks, Reports, Wishes, and Settings.
- **Dedicated Events & Tasks Dashboards:** Event cards with `.ics` export, task checklists with one-tap status toggling and overdue indicators.
- **Health Audit & Demographics View:** Live database quality score, flagged issues inspector, and demographic metrics.
- **Modals for Events & Tasks:** Fluid, accessible creation and editing dialogs.

### 🧪 Automated Testing
- **Expanded Test Suite (`tests/lifecycle_and_modules.test.js`):** Added 9 unit and integration tests (totaling 26 tests, 100% passing) verifying state machines, duplicate matching, calendar exports, overdue filters, health score formulas, and CSV formula injection mitigations.

---

## [2.0.0] - 2026-10-05

### 🚨 Critical Security Remediation
- **Fixed Fail-Open Admin Guard (`src/bot/guard.js`):** Replaced `if (!process.env.ADMIN_ID) return true;` with strict fail-closed authorization. All requests are denied when `ADMIN_ID` is missing, empty, or unconfigured.
- **Fixed Callback Query Authorization Bypass (`src/bot/router.js`):** Enforced `isAdmin(q.from?.id)` check on every incoming callback query before routing to handlers.
- **Created Telegram WebApp HMAC Security Middleware (`src/api/middleware.js`):** Implemented timing-safe HMAC-SHA256 signature verification, 24-hour expiration check, and server-side admin user ID verification.
- **Spreadsheet Formula Injection Neutralization (`src/services/exportService.js`):** Neutralized formula injection attempts (`=, +, -, @`) by prefixing single quotes in CSV exports.

### 🌅 Core Morning Workflow Overhaul
- **Eliminated Public Group Broadcasts (`src/scheduler/dailyJob.js`):** Completely removed automated broadcasting to group `CHAT_ID`.
- **Created Private Admin Review Deck (`src/bot/handlers/review.js`, `/review`):** The morning job now prepares celebrations idempotently and dispatches an interactive card deck privately to `ADMIN_ID`.
- **Implemented Greeting State Lifecycle (`src/models/GreetingLog.js`, `src/services/greetingService.js`):** Full lifecycle management with states `PENDING`, `READY_FOR_REVIEW`, `EDITED`, `SKIPPED`, `MARKED_AS_SHARED`, and `FAILED`.
- **Idempotency Guarantee:** Prevents duplicate cards across repeated job triggers or server restarts using compound unique index `{ dateKey, year, memberId, type }`.
- **Interactive Review Capabilities:** Administrators can preview greeting cards, tap to copy formatted text, regenerate AI prayers, switch tones/styles, manually edit text inline, or mark as shared to WhatsApp.

### 🤖 AI & Scripture Engine Enhancement
- **Canonical Scripture Grounding (`src/services/aiService.js`):** Eliminated AI hallucinations by binding greetings to canonical Tamil Bible verses (TAOVBSI) and curated `EventVerse` collections.
- **Resilient Offline Fallbacks:** Structured deterministic Tamil Christian pastoral blessings when Google Gemini is unavailable, rate-limited, or disabled.
- **Style Selection:** Supported four distinct pastoral tones (`pastoral`, `heartfelt`, `short`, `formal`).
- **Greeting Card Formatter:** Clean, structured card layout designed for immediate pasting into church WhatsApp groups.

### 💻 Web Admin Dashboard & UX Alignment
- **Refactored WebApp Actions (`public/app.js`, `public/index.html`):** Replaced group broadcast actions with one-tap clipboard copy and WhatsApp manual delivery cues.
- **Liveness & Diagnostics:** Upgraded `/api/diagnostics` and `/ping` for fast, non-blocking monitoring.

### 🧪 Automated Testing Suite
- **Added Comprehensive Tests (`tests/security.test.js`, `tests/greeting.test.js`, `tests/scheduler_and_data.test.js`):** Expanded automated tests from 5 to 17 passing tests covering security guards, HMAC verification, AI fallbacks, greeting state machines, leap-year logic, and scheduler broadcast safety invariants.
