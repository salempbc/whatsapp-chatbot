# SPBC Church CMS 2.1 — Comprehensive Engineering Report

## Executive Summary
The **Salem Primitive Baptist Church (SPBC) Church CMS Telegram Bot & WebApp** has been successfully upgraded to version **2.1**. This release expands the platform from a specialized member greetings bot into a comprehensive, production-grade church administration platform while strictly maintaining the core architectural principles:
- **Fail-closed security**: Strict admin authentication on all Telegram interactions and HMAC SHA-256 cryptographic verification on WebApp API calls.
- **Human-in-the-loop broadcast safety**: Absolute guarantee of zero automated broadcasts to public WhatsApp or Telegram groups; WhatsApp dispatches remain strictly under human manual copy-paste control.
- **Data integrity & backward compatibility**: Full preservation of existing MongoDB schemas, compound indexes, and date formats with zero data loss.
- **Bilingual excellence**: Full preservation of Tamil UTF-8 diacritics, script normalization, and canonical Scripture citations.

---

## 1. Module A: Complete Member Lifecycle Management

### 1.1 Lifecycle State Machine
Member status is governed by a formalized enum:
- `active`: Fully participating member. Counted in rosters and daily celebration scans.
- `inactive`: Temporarily inactive or non-attending member. Excluded from daily automated celebrations.
- `transferred`: Member formally transferred membership to another local church.
- `deceased`: Promoted to glory. Memorial tracking enabled; excluded from celebratory birthday/anniversary lists.
- `archived`: Soft-deleted record for historical preservation. Excluded from active queries.

```
       ┌───────────────────────┐
       │        ACTIVE         │◀─────────┐
       └───┬───────┬───────┬───┘          │
           │       │       │              │
           ▼       │       ▼              │
    ┌────────────┐ │ ┌────────────┐       │
    │  INACTIVE  │ │ │TRANSFERRED │       │
    └──────┬─────┘ │ └─────┬──────┘       │
           │       ▼       │              │
           │  ┌──────────┐ │              │
           └──┤ DECEASED │─┘              │
              └────┬─────┘                │
                   ▼                      │
             ┌──────────┐                 │
             │ ARCHIVED ├─────────────────┘
             └──────────┘
```

### 1.2 Database Pre-Save Invariant Synchronization
In `src/models/Member.js`, a Mongoose `pre("save")` hook ensures synchronization between legacy flags and new lifecycle statuses:
- When `status === "active"`, `isActive` is synchronized to `true` and `isDeleted` to `false`.
- When `status !== "active"`, `isActive` is set to `false`.
- When `status === "archived"`, `isDeleted` is set to `true`.
This design ensures that existing zero-scan compound indexes (`{ isDeleted: 1, isActive: 1, birthday: 1 }`) continue to function without any query degradation.

### 1.3 Intelligent Duplicate Detection
The duplicate detection engine (`src/services/memberService.js:checkDuplicates`) inspects incoming member records across four orthogonal dimensions:
1. Exact and normalized case-insensitive name matching.
2. Tokenized word matching across name tokens (length > 2).
3. Phone number normalization and exact collision checks.
4. Combination of Date of Birth (`dob`) and Family Name (`familyName`).
Real-time duplicate warnings are surfaced to administrators prior to record creation.

### 1.4 Audit Logging System
The new `AuditLog` collection records every state transition, archive, restore, and profile edit:
- Captures `entity`, `entityId`, `action` (`CREATE`, `UPDATE`, `STATUS_CHANGE`, `ARCHIVE`, `RESTORE`), `performedBy`, `timestamp`, and detailed before/after diffs.

---

## 2. Module B: Unified Church Calendar & Event Management

### 2.1 Unified Church Event Schema
A dedicated `ChurchEvent` model (`src/models/ChurchEvent.js`) supports:
- **Categories**: `worship_service`, `prayer_meeting`, `fellowship`, `special_service`, `meeting`, `other`.
- **Temporal Metadata**: `startDate` (`YYYY-MM-DD`), `startTime` (`HH:MM`), `endDate`, `endTime`, `timezone` (default `Asia/Kolkata`).
- **Recurrence**: `none`, `weekly`, `monthly`, `yearly` with recurrence end dates.
- **Audit & Metadata**: `venue`, `description`, `status` (`scheduled`, `completed`, `cancelled`), `createdBy`, `updatedBy`.

### 2.2 Standard iCalendar (.ics) RFC 5545 Export
`churchCalendarService.js` provides `exportEventsToICS()`:
- Generates fully compliant RFC 5545 iCalendar data feeds.
- Compatible with Apple Calendar, Google Calendar, and Microsoft Outlook.
- Escapes multi-line strings, formats timestamps in UTC/local formats, and handles cancellation statuses (`STATUS:CANCELLED` vs `STATUS:CONFIRMED`).
- Accessible via WebApp button or directly through `GET /api/events/export/ics?auth=...`.

### 2.3 Telegram Bot Event Commands & Wizards
- `/events`: Interactive inline keyboard listing all upcoming scheduled events with pagination.
- `/addevent`: Step-by-step bot conversational wizard guiding the administrator through Title, Category, Date, Time, and Venue.
- Inline callbacks for viewing event details, marking completed, or cancelling.

---

## 3. Module C: Administrative Task & Follow-up Management

### 3.1 Task Lifecycle & Pastoral Care Queue
A dedicated `Task` model (`src/models/Task.js`) provides structured management for church administrative duties:
- **Categories**: `pastoral_care` (visitations, counseling), `event_prep` (communion setup, audio/visual), `admin` (roster updates, finance), `facility` (maintenance, cleaning), `follow_up` (newcomers, prayer requests), `general`.
- **Priorities**: `low`, `medium`, `high`, `urgent`.
- **Statuses**: `todo` -> `in_progress` -> `waiting` -> `completed` / `cancelled`.
- **Follow-up Linking**: Tasks can optionally link directly to a specific church member (`memberId`).

### 3.2 Overdue Calculation & Timely Alerts
- Tasks track `dueDate` in `YYYY-MM-DD` format.
- Real-time overdue computation identifies pending tasks whose due date has passed.
- Red warning badges and Telegram `/tasks overdue` command immediately highlight overdue actions.

### 3.3 Telegram Bot Task Commands & Wizards
- `/tasks`: Interactive task dashboard showing open, completed, and overdue counts.
- `/addtask`: Interactive wizard to quickly register a new task with priority and due date.
- One-tap status updates (`Toggle Done`) directly within Telegram inline messages.

---

## 4. Module D: Advanced Church Statistics, Analytics & Data Quality

### 4.1 Comprehensive Demographics & Activity Reporting
The reporting engine (`src/services/reportService.js:getChurchStatistics`) generates aggregated metrics:
- **Membership**: Total records, active count, inactive count, transferred count, deceased count, archived count, unique family units count, gender distribution, married count, children & youth count, and designation distribution.
- **Tasks Execution**: Total tasks, open tasks, completed tasks, overdue tasks, and task completion percentage.
- **Events & Services**: Total events and upcoming scheduled events.
- **Celebration Analytics**: Year-to-date greetings prepared, marked as shared, edited, and skipped.

### 4.2 Automated Data Quality Health Audit
The `getDataQualityReport` engine computes an automated Database Health Score (0–100%) and surfaces inconsistencies:
1. **Missing or truncated names** (fewer than 2 characters).
2. **Invalid Date of Birth format** (non-ISO `YYYY-MM-DD`).
3. **Invalid Wedding Date format** (non-ISO `YYYY-MM-DD`).
4. **Marital inconsistency** (marked as married but missing spouse name).
5. **Gender pairing inconsistency** in church marital records.
- Accessible via `/dataquality` Telegram command and the WebApp Reports tab.

### 4.3 Formula Injection & CSV Hardening
All data export mechanisms (`CSV` and report tables) enforce strict formula injection sanitization:
- Cells beginning with dangerous spreadsheet execution prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`) are automatically prepended with a single quote `'`.
- UTF-8 BOM (`\uFEFF`) is included to ensure clean Tamil script rendering in Excel on Windows.

---

## 5. UI/UX Enhancements & WebApp Upgrades

### 5.1 Redesigned Tab Navigation
The WebApp has been upgraded with a responsive 6-item floating navigation bar:
1. **Members** (`members`): Member cards, search, family trees, active/inactive filters, bulk actions.
2. **Events** (`events`): Scheduled service list, upcoming/past filters, .ics export, add/edit modal.
3. **Tasks** (`tasks`): Task checklist, overdue indicator pill, priority tags, add/edit modal.
4. **Reports** (`analytics`): Health score banner, demographic breakdown, task velocity, quality issue list.
5. **Wishes** (`upcoming`): Today & upcoming birthdays, wedding anniversaries, AI wish generator.
6. **Settings** (`settings`): Cron broadcast times, custom attributes, backup/import operations.

### 5.2 Unified Modal Architecture
Modern Tailwind CSS dialogs with native Telegram theme support (`dark` and `light`):
- **Church Event Modal**: Clean inputs for Title, Category, Date, Time, Venue, and Description.
- **Church Task Modal**: Clean inputs for Title, Category, Priority, Due Date, Assignee, and Description.
- **Live AI Wish Modal**: Instant Bible verse preview with one-tap "Copy for WhatsApp" clipboard action.
- **Bulk CSV Import Modal**: Robust parsing with client-side header verification and preview.

---

## 6. Verification and Testing

The entire automated test suite runs via Node.js native test runner:
```bash
npm test
```
### Test Summary:
- **Total Tests**: 26
- **Passed**: 26 (100%)
- **Failed**: 0
- **Duration**: ~580ms

### Test Breakdown:
| Test Suite | Focus Area | Result |
| :--- | :--- | :--- |
| `tests/lifecycle_and_modules.test.js` | Member Lifecycle State Machine & Invariants | **PASS** |
| `tests/lifecycle_and_modules.test.js` | Intelligent Duplicate Detection Engine | **PASS** |
| `tests/lifecycle_and_modules.test.js` | RFC 5545 iCalendar (.ics) Export Generation | **PASS** |
| `tests/lifecycle_and_modules.test.js` | Calendar Special Character & Newline Sanitization | **PASS** |
| `tests/lifecycle_and_modules.test.js` | Task Due Date & Overdue Calculation | **PASS** |
| `tests/lifecycle_and_modules.test.js` | Task Priority Weight Ordering | **PASS** |
| `tests/lifecycle_and_modules.test.js` | Data Quality Health Score Formula & Checks | **PASS** |
| `tests/lifecycle_and_modules.test.js` | CSV Formula Injection Mitigation | **PASS** |
| `tests/security.test.js` | Telegram Fail-Closed Admin Guard | **PASS** |
| `tests/security.test.js` | WebApp HMAC SHA-256 Auth & Replay Protection | **PASS** |
| `tests/scheduler_and_data.test.js` | Zero Public Broadcast Invariant | **PASS** |
| `tests/scheduler_and_data.test.js` | Leap Year Feb 29 Birthday/Anniversary Matching | **PASS** |
| `tests/scheduler_and_data.test.js` | CSV Export BOM & Character Escaping | **PASS** |
| `tests/greeting.test.js` | Canonical Scripture Verification & Fallback | **PASS** |
| `tests/greeting.test.js` | Tamil Unicode Normalization & Diacritic Safety | **PASS** |
| `tests/api.test.js` | Cron Conversion & Accusative Suffix Generation | **PASS** |
| `tests/eventService.test.js` | Date Helpers & Template Conditionals | **PASS** |

### Syntax & Encoding Scan:
```bash
npm run check
# node --check src/app.js && node tools/scan-encoding.cjs
# Result: 0 mojibake, all critical files verified UTF-8 with BOM where required.
```

---

## 7. Operational Readiness Checklist

- [x] Fail-closed authentication strictly active on Telegram Bot and WebApp REST API.
- [x] Zero automated public broadcasts guaranteed; all WhatsApp sharing remains admin-initiated.
- [x] MongoDB compound indexes and existing database collections preserved without breaking schema changes.
- [x] 26/26 automated unit and integration tests passing.
- [x] Frontend fully responsive across Telegram Mobile WebApp, iOS, Android, and Desktop.
- [x] Documentation fully updated across `docs/` and root `README.md`.
