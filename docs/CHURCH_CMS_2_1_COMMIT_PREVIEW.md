# SPBC Church CMS 2.1 — Final Release Commit Preview

**Target Release:** Salem Primitive Baptist Church (SPBC) Church CMS 2.1  
**Base Commit Tested:** `baec6a6` (`fix: total contrast and dark mode overhaul - crisp white text on dark cards, theme-adaptive navbar, and manual theme switcher`)  
**Commit Action Status:** **READY FOR USER APPROVAL (UNCOMMITTED / STAGING PREPARED)**  

---

## 1. Proposed Commit Message

```text
feat(release): SPBC Church CMS 2.1 — Member Lifecycle, Calendar, Tasks & Advanced Reports

- Module A: Complete Member Lifecycle Management (status state machine, multi-field duplicate detection, archive/restore, audit logging)
- Module B: Unified Church Calendar & Event Management (custom events, recurrence, RFC 5545 iCalendar stream, bot wizards)
- Module C: Administrative Task & Follow-up Management (priority queues, overdue computation, bot task wizards)
- Module D: Advanced Church Statistics, Demographics & Data Quality Audit (health score, inconsistency detection)
- Security Hardening: Fail-closed admin guards, WebApp HMAC-SHA256 with 24h replay window, timing-safe secret comparisons, CSV formula injection neutralization
- Workflow Architecture: Zero automated group broadcasts; morning celebrant review cards delivered privately to ADMIN_ID with one-tap copy for WhatsApp
- Deployment Readiness: Render Web Service Blueprint (render.yaml), sanitized environment templates (.env.example), and comprehensive operational staging guide
```

---

## 2. Exact Files to Commit (55 Files Total)

### 2.1 Configuration & Package Files (5 files)
1. `.gitignore` — Hardened to exclude `.env.*` while keeping `.env.example`.
2. `.env.example` — Sanitized environment configuration template with unmistakable placeholders.
3. `package.json` — Version bumped to `2.1.0`.
4. `package-lock.json` — Version synchronized to `2.1.0`.
5. `render.yaml` — Declarative Render Web Service Blueprint (`sync: false` on secrets, `/ping` health check).

### 2.2 Application Source Code (27 files)
6. `src/api/index.js` — REST API endpoints for all modules, rate limiter, and photo proxy cache.
7. `src/api/middleware.js` — Telegram WebApp HMAC-SHA256 signature verification, timing-safe token checks, 24h expiration.
8. `src/bot/guard.js` — Fail-closed administrator authorization filter.
9. `src/bot/handlers/events.js` — Bot `/events` list and `/addevent` conversational wizard.
10. `src/bot/handlers/home.js` — Bot dashboard, dynamic WebApp URL resolution, `/ping` guard.
11. `src/bot/handlers/review.js` — Interactive celebrant greeting review deck for `/review`.
12. `src/bot/handlers/settings.js` — Bot notification timing and scheduler settings.
13. `src/bot/handlers/stats.js` — Bot demographics, metrics, and data quality commands.
14. `src/bot/handlers/tasks.js` — Bot `/tasks` list and `/addtask` conversational wizard.
15. `src/bot/index.js` — Bot lifecycle, rate-limited queue, webhook secret token verification.
16. `src/bot/router.js` — Callback query router with fail-closed security.
17. `src/config/db.js` — MongoDB connection manager supporting `MONGO_DB_NAME` staging isolation override.
18. `src/models/AuditLog.js` — Mutation audit logging schema with before/after state diffs.
19. `src/models/ChurchEvent.js` — Church calendar event schema with category enums, recurrence, reminders.
20. `src/models/GreetingLog.js` — Celebrant greeting lifecycle model with unique compound key.
21. `src/models/Member.js` — Member schema with lifecycle status enum, sync hooks, marital rules.
22. `src/models/Task.js` — Administrative task schema with priority, categories, overdue tracking.
23. `src/scheduler/dailyJob.js` — Morning cron job delivering private review decks to `ADMIN_ID` (zero group broadcasts).
24. `src/services/aiService.js` — Canonical Tamil Bible verse grounding, Gemini AI integration, offline fallback.
25. `src/services/churchCalendarService.js` — RFC 5545 iCalendar stream generation, event unification.
26. `src/services/greetingService.js` — Idempotent daily greeting preparation and status tracking.
27. `src/services/memberService.js` — Multi-dimensional duplicate detection, archive/restore, status machine.
28. `src/services/reportService.js` — Demographic aggregations, health score audit, data aliases.
29. `src/services/taskService.js` — Task lifecycle, priority sorting, overdue categorization.
30. `public/app.js` — Vue 3 frontend logic, pre-save duplicate modal, calendar download.
31. `public/index.html` — 6-tab floating island navigation, member forms, event/task dialogs, dark mode.
32. `CHURCH_CMS_TELEGRAM_BOT_AUDIT.md` — Historical system audit and architectural gap analysis.

### 2.3 Automated Test Suites (6 files)
33. `tests/api.test.js` — Cron converter, Tamil name suffixes, loopback HTTP endpoint integration tests.
34. `tests/greeting.test.js` — Canonical Scripture verses, offline fallback, formatGreetingCard.
35. `tests/integration_and_audit.test.js` — Bot guard, WebApp HMAC, member lifecycle, `.ics` export, task overdue, URL resilience.
36. `tests/lifecycle_and_modules.test.js` — Modules A-D unit tests, duplicate detection, CSV formula injection defense.
37. `tests/scheduler_and_data.test.js` — Leap year date logic, scheduler broadcast safety (zero group message guarantee).
38. `tests/security.test.js` — Fail-closed `isAdmin`, `adminOnly` wrapper, timing-safe HMAC checks.

### 2.4 Documentation & Operational Manuals (17 files)
39. `README.md` — Comprehensive repository overview, quick start, architecture summary.
40. `docs/AI_GREETING_SYSTEM.md` — AI greeting and canonical scripture pipeline.
41. `docs/ARCHITECTURE.md` — System architecture and component breakdown.
42. `docs/BACKUP_RECOVERY.md` — Database backup and recovery procedures.
43. `docs/CHANGELOG.md` — Version changelog (2.0.0 & 2.1.0).
44. `docs/CHURCH_CMS_2_1_COMMIT_PREVIEW.md` — This release commit preview.
45. `docs/CHURCH_CMS_2_1_ENGINEERING_REPORT.md` — Master engineering report for SPBC Church CMS 2.1.
46. `docs/CHURCH_CMS_2_1_RELEASE_AUDIT.md` — Code audit findings and 8 remediations log.
47. `docs/CHURCH_CMS_2_1_RELEASE_MANIFEST.md` — Release manifest and file inventory.
48. `docs/CHURCH_CMS_2_1_STAGING_VERIFICATION.md` — 9-phase staging deployment verification report.
49. `docs/DATABASE.md` — Entity-relationship diagrams and index references.
50. `docs/DEPLOYMENT.md` — Deployment and operations reference.
51. `docs/FINAL_ENGINEERING_REPORT.md` — Handover engineering report.
52. `docs/SECURITY.md` — Security architecture and authentication specifications.
53. `docs/STAGING_DEPLOYMENT_GUIDE.md` — Complete operational staging runbook & 27-item checklist.
54. `docs/TELEGRAM_BOT.md` — Command inventory and router namespaces.
55. `docs/TESTING.md` — Testing strategies and test suite structure.

---

## 3. Files Excluded from Release

| File / Directory | Reason for Exclusion |
| :--- | :--- |
| `.env` | Active local environment variables; ignored by `.gitignore`. |
| `.env.staging` | Local staging environment variables; ignored by `.gitignore`. |
| `node_modules/` | Third-party dependency tree; managed via `package.json`. |
| `session/`, `.wwebjs_cache/` | Local WhatsApp web session caches; ignored by `.gitignore`. |

---

## 4. Security & Safety Verification Summary

- **Live Secrets Detected:** **0** (All patterns `BOT_TOKEN`, `MONGO_URI`, `ADMIN_SECRET`, `GEMINI_API_KEY` are either environment references or sanitized placeholders).
- **Production Reference Scan:** **0** hardcoded production domains or database URIs exist. All endpoints and connections are strictly dynamic.
- **Local Machine Paths:** **0** instances of `file:///`, `d:/whatsapp-chatbot`, or `C:\Users\` exist in the staged files.
- **Git Ignore Security:** Verified via `git check-ignore .env` and `git check-ignore .env.staging`.

---

## 5. Automated Test & Integrity Verification

- **Automated Tests:** **35/35 passing (100% pass rate in ~1150ms)**
- **Syntax & Encoding Check (`npm run check`):** **PASS (0 syntax errors, 0 mojibake)**
- **Package Consistency:** `package.json` (`2.1.0`) and `package-lock.json` (`2.1.0`) synchronized.

---

## 6. Production Safety Invariant

```text
Production deployment: NOT PERFORMED
Production database: NOT MODIFIED
Production Telegram bot: NOT MODIFIED
Production webhook: NOT MODIFIED
```
