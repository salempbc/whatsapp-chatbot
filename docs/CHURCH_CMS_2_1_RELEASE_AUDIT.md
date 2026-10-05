# SPBC Church CMS 2.1 — Release Readiness & Code Audit Report

**Auditor:** Principal Software Architect & Application Security Auditor  
**Date of Audit:** October 5, 2026  
**Target Release:** Salem Primitive Baptist Church (SPBC) Church CMS 2.1  
**Repository:** `salempbc/whatsapp-chatbot`  
**Git Branch:** `main`

---

## 1. Executive Verdict

### **VERDICT: PASS WITH LIMITATIONS (READY FOR STAGING)**

> [!IMPORTANT]
> The codebase has been audited from first principles. During the audit, **8 functional, schema, and UI defects** were identified that would have caused runtime validation errors and UI data dropouts in a live staging deployment. All 8 defects have been remediated in-place, and the automated test suite has been expanded from 26 to **33 passing tests (100% pass rate)**.
> 
> The application is verified secure and structurally sound for **Staging Deployment**. However, **production release is gated** on completing the manual smoke testing protocol (specifically physical Telegram WebApp UI rendering, live MongoDB Atlas index verification, and real-time administrator interaction via Telegram Bot).

---

## 2. Verified Functionality vs. Documentation Claims

| Module / Requirement | Documentation Claim | Audit Verification Status | Technical Notes |
| :--- | :--- | :--- | :--- |
| **Fail-Closed Security** | All bot commands & API routes reject non-admins | **VERIFIED & SECURE** | `src/bot/guard.js` fails closed. WebApp uses timing-safe HMAC-SHA256 with 24h replay protection. |
| **Zero Public Broadcasts** | No automated broadcasts to WhatsApp or public Telegram | **VERIFIED & SECURE** | `src/scheduler/dailyJob.js` only sends private review decks to `ADMIN_ID`. No `CHAT_ID` group broadcasting exists. |
| **Module A: Lifecycle State Machine** | Members support `active`, `inactive`, `transferred`, `deceased`, `archived` | **VERIFIED & REMEDIATED** | `validateStatusTransition` enforced on `PUT /api/members/:id`. Pre-save & pre-findOneAndUpdate hooks keep `isActive` and `isDeleted` strictly synced. |
| **Module A: Duplicate Detection** | Multi-dimensional duplicate matching (name, phone, family+DOB) | **VERIFIED & REMEDIATED** | `checkDuplicates` implemented in backend and now wired to WebApp `saveMember` pre-save confirmation modal. |
| **Module B: Church Calendar & Events** | Custom events, recurrence, .ics exports, admin wizards | **VERIFIED & REMEDIATED** | Schema category enum expanded to reconcile WebApp dropdown values with backend model. `exportEventsToICS` generates RFC 5545 streams. |
| **Module C: Administrative Tasks** | Task management, priority queues, due date tracking, overdue alerts | **VERIFIED & REMEDIATED** | Schema category enum expanded to accept `pastoral_care`, `facility`, and `admin`. `DELETE /tasks/:id` now routes through `updateTask` audit logging. |
| **Module D: Statistics & Reporting** | Demographics, task completion velocity, data quality audit | **VERIFIED & REMEDIATED** | Data aliases added (`members: membership` and `inconsistencies: issues`) so WebApp Reports tab renders live health scores and inconsistency lists without dropouts. |
| **Scripture Integrity** | Authentic canonical Tamil Bible verses (TAOVBSI), zero AI hallucination | **VERIFIED** | Gemini API is strictly bounded to canonical Bible text with reverent offline pastoral fallbacks. |
| **Data Safety & Exports** | Formula injection protection and UTF-8 BOM encoding | **VERIFIED** | CSV export prepends single quote `'` on dangerous characters (`=`, `+`, `-`, `@`) and outputs UTF-8 BOM. |

---

## 3. Detailed Audit Findings & Defects Identified

### Finding 1: Inconsistent Category Enum in ChurchEvent Model
- **Severity:** `HIGH`
- **File:** [`src/models/ChurchEvent.js`](../src/models/ChurchEvent.js#L10-L28) vs [`public/index.html`](../public/index.html#L854-L860)
- **Defect Description:** The WebApp event creation form submitted `category` values: `worship_service`, `prayer_meeting`, `meeting`, and `other`. However, the Mongoose schema only allowed `worship`, `prayer`, `committee`, `custom`, etc. Saving any event using the WebApp form resulted in a runtime Mongoose `ValidationError` (HTTP 400).
- **Remediation Applied:** The schema enum was expanded to accept both canonical and UI category descriptors:
  ```javascript
  enum: ["worship", "worship_service", "prayer", "prayer_meeting", "bible_study", "fasting", "youth", "choir", "committee", "conference", "special_service", "fellowship", "administrative", "meeting", "member_milestone", "custom", "other"]
  ```

### Finding 2: Inconsistent Category Enum in Task Model
- **Severity:** `HIGH`
- **File:** [`src/models/Task.js`](../src/models/Task.js#L15-L25) vs [`public/index.html`](../public/index.html#L924-L932)
- **Defect Description:** The WebApp task form submitted `pastoral_care`, `facility`, and `admin`, while the schema strictly required `pastoral`, `maintenance`, and `administrative`. Any attempt to create tasks in those categories from the frontend failed with a schema `ValidationError`.
- **Remediation Applied:** Added category aliases to the `Task` schema enum:
  ```javascript
  enum: ["general", "pastoral", "pastoral_care", "event_prep", "follow_up", "volunteer", "maintenance", "facility", "administrative", "admin"]
  ```

### Finding 3: `PUT /api/members/:id` Bypassed Pre-Save Invariant Hooks
- **Severity:** `HIGH`
- **File:** [`src/api/index.js`](../src/api/index.js#L187-L200) & [`src/models/Member.js`](../src/models/Member.js#L164-L192)
- **Defect Description:** `PUT /api/members/:id` previously invoked `Member.findByIdAndUpdate(req.params.id, req.body)`. In Mongoose, `findByIdAndUpdate` does **NOT** fire `pre("save")` hooks. Consequently, updating a member's status to `inactive`, `transferred`, or `archived` failed to update `isActive` to `false` and `isDeleted` to `true`. Furthermore, `validateStatusTransition` was not enforced on API edits.
- **Remediation Applied:**
  1. Updated `PUT /api/members/:id` to fetch the member, enforce `validateStatusTransition(current, new)`, apply mutations, and call `await m.save()`.
  2. Added a defensive `pre("findOneAndUpdate")` hook in `Member.js` to ensure background updates also keep flags synchronized.
  3. Made the pre-save hook symmetric so restoring to `status === "active"` automatically clears `isDeleted = false`.

### Finding 4: Data Quality & Demographics Object Key Mismatch in WebApp
- **Severity:** `MEDIUM`
- **File:** [`src/services/reportService.js`](../src/services/reportService.js#L64-L130) vs [`public/index.html`](../public/index.html#L578-L605)
- **Defect Description:**
  - `reportService.js` returned `{ issues }`, while `index.html` looked for `dataQuality.inconsistencies`, rendering "0 Issues" and failing to display data inconsistencies.
  - Issue objects had properties `memberName` and `severity`, while the WebApp template expected `issue.name` and `issue.type`.
  - Demographic statistics were returned under `stats.membership`, while `index.html` queried `churchStats?.members`, causing inactive, archived, and youth counts to drop out.
- **Remediation Applied:** Provided full backward/forward compatibility aliases in `reportService.js`:
  ```javascript
  return {
    membership,
    members: membership, // WebApp compatibility alias
    ...
  };
  ```
  ```javascript
  const inconsistencies = issues.map(i => ({
    id: i.id,
    name: i.memberName,
    memberName: i.memberName,
    type: i.severity,
    severity: i.severity,
    issue: i.issue
  }));
  return { totalChecked, issuesFound, healthScore, issues, inconsistencies };
  ```

### Finding 5: Missing `adminOnly` Guard on `/ping` Bot Command
- **Severity:** `LOW`
- **File:** [`src/bot/handlers/home.js`](../src/bot/handlers/home.js#L48-L50)
- **Defect Description:** The bot command `bot.onText(/^\/ping$/, ...)` was registered without the `adminOnly` wrapper, allowing unauthorized users to receive a `pong` reply.
- **Remediation Applied:** Wrapped the command handler with `adminOnly`:
  ```javascript
  bot.onText(/^\/ping$/, adminOnly(async (msg) => {
    await bot.sendMessage(msg.chat.id, "pong");
  }));
  ```

### Finding 6: Premature Closing `</div>` in Member Profile Form
- **Severity:** `LOW`
- **File:** [`public/index.html`](../public/index.html#L1022-L1030)
- **Defect Description:** A stray `</div>` tag closed the Personal Information card prematurely, leaving Contact Phone, Ministry, and Residential Address unstyled and floating outside the card layout.
- **Remediation Applied:** Removed the premature closing tag so all personal profile fields sit inside the card.

### Finding 7: Frontend `defaultForm` Missing 2.1 Profile Fields
- **Severity:** `LOW`
- **File:** [`public/app.js`](../public/app.js#L115-L135)
- **Defect Description:** `defaultForm` did not include default values for `phone`, `ministry`, `address`, `status`, `membershipDate`, and `adminNotes`. When editing existing members, `openMemberForm` could result in `undefined` field bindings.
- **Remediation Applied:** Initialized all 2.1 fields in `defaultForm()` and merged defaults with `m` in `openMemberForm(m)`.

### Finding 8: Duplicate Detection Unwired in WebApp Submission
- **Severity:** `INFORMATIONAL / ENHANCEMENT`
- **File:** [`public/app.js`](../public/app.js#L320-L335)
- **Defect Description:** While `POST /api/members/check-duplicate` was implemented on the server, the WebApp `saveMember()` function did not query it before creating a new member.
- **Remediation Applied:** Added pre-save duplicate inspection in `saveMember()` when `!form.value._id`. If collisions are found, the administrator is prompted with a confirmation dialog displaying the matched name and reason.

---

## 4. Security Audit Evaluation

### 4.1 Authentication & Authorization Verification
- **Telegram WebApp HMAC Validation:** Verified in [`src/api/middleware.js`](../src/api/middleware.js).
  - Uses `crypto.createHmac("sha256", "WebAppData")` with timing-safe comparison (`crypto.timingSafeEqual`).
  - Enforces 24-hour expiration (`auth_date`).
  - Verifies that `user.id` strictly matches `ADMIN_ID`.
- **Telegram Bot Guard:** Verified in [`src/bot/guard.js`](../src/bot/guard.js).
  - Rejects access if `ADMIN_ID` is unset, null, or mismatched.
  - All command registrations and callback query routes (`src/bot/router.js`) enforce `isAdmin()`.
- **Zero Public Broadcasts:** Verified in [`src/scheduler/dailyJob.js`](../src/scheduler/dailyJob.js).
  - The morning cron job exclusively delivers private review summaries to `ADMIN_ID`.
  - Finalized messages must be manually copied by the administrator to WhatsApp.

### 4.2 Injection & Input Sanitization
- **Spreadsheet Formula Injection:** Verified in [`src/services/exportService.js`](../src/services/exportService.js) and [`tests/lifecycle_and_modules.test.js`](../tests/lifecycle_and_modules.test.js#L174-L192).
  - Cells starting with `=`, `+`, `-`, or `@` are safely prefixed with a single quote `'`.
  - Exports include UTF-8 BOM (`\uFEFF`) to prevent corrupt rendering in Windows Excel.
- **iCalendar RFC 5545 Sanitization:** Verified in [`src/services/churchCalendarService.js`](../src/services/churchCalendarService.js#L95-L115).
  - Newlines are escaped as `\n`. Titles strip carriage returns.

---

## 5. Automated Testing Verification

The complete test suite was executed:
```bash
npm test
```

### Test Output:
```text
> whatsapp-chatbot@1.0.0 test
> node --test tests/*.test.js

✔ Cron Converter: Validates HH:MM and generates valid cron format (1.124ms)
✔ Sanitization: Accusative Tamil name suffix generator (0.1534ms)
✔ Date Helpers: getTodayKey and getTomorrowKey return valid MM-DD format (15.4656ms)
✔ Event Engine: Age calculation logic (0.1956ms)
✔ Template Parser: Conditional block rendering (0.6434ms)
✔ AI & Scripture: getCanonicalVerse returns authentic Scripture references without hallucination (2.1035ms)
✔ AI & Scripture: Offline fallback generates valid, reverent Tamil Christian blessings (0.5125ms)
✔ Formatting: formatGreetingCard produces structured, WhatsApp-ready message (0.1736ms)
✔ Lifecycle: Greeting statuses adhere to expected administrative transitions (0.1542ms)
✔ Tamil Unicode: Text normalization preserves Tamil combining diacritics and glyphs (0.2272ms)
✔ Integration: Telegram router rejects non-admin callback queries and allows admin (0.8531ms)
✔ Integration: Telegram command guard denies unauthorized invocation across all command endpoints (0.2381ms)
✔ Integration: WebApp HMAC signature verification and timestamp replay protection (8.9306ms)
✔ Integration: Member lifecycle status transitions and invariant enforcement (0.7744ms)
✔ Integration: Church calendar .ics export produces standards-compliant calendar feed (0.3623ms)
✔ Integration: Task status lifecycle and overdue categorization (1.4037ms)
✔ Integration: Data quality audit generates both issues and inconsistencies aliases (0.381ms)
✔ Module A - Lifecycle Transitions: Validates status state machine correctly (0.8078ms)
✔ Module A - Duplicate Detection Logic: Matches exact and partial tokens (0.2452ms)
✔ Module A - Model Hook Mapping: status to isActive and isDeleted invariants (0.7693ms)
✔ Module B - Calendar Export: exportEventsToICS generates compliant RFC 5545 iCalendar stream (0.4939ms)
✔ Module B - Calendar Sanitization: Handles newlines and special characters in ICS (0.1375ms)
✔ Module C - Task Overdue Computation: Correctly classifies overdue tasks against date boundaries (1.6174ms)
✔ Module C - Task Priority Ordering: Sorts tasks by priority urgency (0.1848ms)
✔ Module D - Data Quality Health Score Calculation: Evaluates compliance and calculates score (0.2688ms)
✔ Module D - Formula Injection Safeguard: Escapes malicious formula characters in exports (0.2145ms)
✔ Date Logic: Leap year Feb 29 anniversary and birthday matching (1.3003ms)
✔ Scheduler Broadcast Safety: Morning job must never send messages to public group CHAT_ID (0.4553ms)
✔ Data Management: CSV export protects against CSV injection and preserves Tamil UTF-8 BOM (1.2727ms)
✔ Security Guard: isAdmin fails closed when ADMIN_ID is missing or empty (1.1115ms)
✔ Security Guard: isAdmin matches exact numeric and string ID (0.1809ms)
✔ Security Guard: adminOnly wraps and rejects unauthorized calls (0.2643ms)
✔ Security Middleware: WebApp initData HMAC verification and expiration (8.321ms)

ℹ tests 33 | pass 33 | fail 0 | cancelled 0 | duration_ms ~645ms
```

### Syntax & Mojibake Check:
```bash
npm run check
# Result: 0 mojibake detected across all critical Scripture and message templates.
```

---

## 6. Manual Verification Still Required Prior to Production Cutover

Automated unit and integration tests cannot substitute for end-to-end device testing. The following manual tests must be performed on the staging environment:

1. **Telegram WebApp Mini App Rendering**:
   - Open the WebApp via `/start` on **Telegram iOS**, **Telegram Android**, and **Telegram Desktop**.
   - Verify that safe-area insets (`env(safe-area-inset-bottom)`) do not overlap with the floating 6-tab navigation island.
   - Test dark mode / light mode toggle synchronization with Telegram client theme.
2. **Duplicate Detection Alert**:
   - In the staging WebApp, attempt to add a member with an existing member's phone number or name.
   - Verify that the warning modal pops up displaying the conflict details before creation.
3. **Calendar Export in Calendar Clients**:
   - Download the `.ics` calendar from the Events tab.
   - Import into Google Calendar and Apple Calendar to ensure recurring events and time zones display correctly.
4. **WhatsApp Manual Paste Ergonomics**:
   - Trigger `/review` in Telegram.
   - Tap "Show Copyable Text" and tap "Copy Message for WhatsApp".
   - Paste into a test WhatsApp group to confirm bolding, spacing, and Tamil script fidelity.

---

## 7. Staging Deployment Checklist

### Step 1: Environment Variables Configuration
Ensure the staging environment has isolated credentials:
- `PORT=3000`
- `NODE_ENV=staging`
- `MONGO_URI`: Must point to an isolated staging database (e.g., `spbc_staging`). **Never point staging to production database.**
- `BOT_TOKEN`: A dedicated staging bot token from [@BotFather](https://t.me/BotFather) (e.g. `@spbc_staging_bot`).
- `ADMIN_ID`: Numeric Telegram user ID of the staging administrator.
- `ADMIN_SECRET`: A secure 32+ character hex string for diagnostics and web verification.
- `WEBAPP_URL`: HTTPS URL of the staging instance (e.g., `https://spbc-staging.onrender.com`).
- `GEMINI_API_KEY`: Staging Google Gemini API key.

### Step 2: Database Preparation & Index Verification
Before booting the staging instance:
1. Verify existing MongoDB collections: `members`, `greetinglogs`, `templates`, `churchevents`, `tasks`, `auditlogs`.
2. Ensure compound indexes are built:
   - `db.members.createIndex({ isDeleted: 1, isActive: 1, birthday: 1 })`
   - `db.members.createIndex({ isDeleted: 1, isActive: 1, wedding: 1 })`
   - `db.churchevents.createIndex({ startDate: 1, status: 1 })`
   - `db.tasks.createIndex({ status: 1, dueDate: 1 })`

### Step 3: Staging Deployment & Liveness Check
1. Deploy code to staging container / Render staging service.
2. Query health endpoint:
   ```bash
   curl -I https://spbc-staging.onrender.com/ping
   # Expected: HTTP/1.1 200 OK (pong)
   ```
3. Query diagnostics endpoint:
   ```bash
   curl https://spbc-staging.onrender.com/api/diagnostics
   # Expected: { "status": "healthy", "database": { "status": "connected" } }
   ```

### Step 4: Staging Smoke Test Sequence
1. Send `/start` to the staging bot: Confirm dashboard appears.
2. Send `/ping` from non-admin account: Confirm bot remains silent (fail-closed).
3. Send `/events` and `/tasks`: Confirm screens render.
4. Open WebApp: Test tabs `Members`, `Events`, `Tasks`, `Reports`, `Wishes`, `Settings`.
5. Test adding a test event and marking a test task complete.

### Step 5: Rollback Strategy
If any unexpected defect occurs during staging verification:
- Staging container can be rolled back to commit `HEAD~1` or previous tag without database schema corruption because all 2.1 collections and fields are non-destructive and backward-compatible.

---

## 8. Prioritized Remediation & Maintenance Plan

| Priority | Task | Target Milestone |
| :--- | :--- | :--- |
| **Immediate (P0)** | Complete manual staging smoke tests on physical iOS and Android devices | Prior to Production Cutover |
| **P1** | Verify staging database indexes in MongoDB Atlas dashboard | Prior to Production Cutover |
| **P2** | Add database migration script for backfilling `phone` and `ministry` from customData if present in legacy records | Post-Staging Verification |
| **P3** | Schedule regular automated weekly backup of MongoDB Atlas collections | Production Deployment |
