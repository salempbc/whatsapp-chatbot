# Testing & Quality Assurance Report

## 1. Automated Test Suite Execution

The repository uses the native Node.js Test Runner (`node --test`), providing zero-dependency, deterministic test execution.

To execute tests:
```bash
npm test
```

To run encoding and syntax verification:
```bash
npm run check
```

---

## 2. Test Coverage Inventory

| Test Suite | File | Focus Areas & Invariants Verified |
|---|---|---|
| **API & Conversion** | `tests/api.test.js` | Cron string conversion from HH:MM, accusative Tamil name grammatical suffixes. |
| **Event Service Engine** | `tests/eventService.test.js` | MM-DD date key generators, age calculation logic across month/day boundaries, template conditional rendering (`{if age >= 60}`). |
| **Security & Authentication** | `tests/security.test.js` | Fail-closed `isAdmin` checks when `ADMIN_ID` is missing/empty/whitespace, numeric/string ID validation, `adminOnly` wrapper protection, Telegram WebApp `initData` HMAC-SHA256 signature verification, 24-hour expiration check, unauthorized user rejection, and `ADMIN_SECRET` bearer token validation. |
| **AI Greeting & Scripture** | `tests/greeting.test.js` | Curated Scripture reference resolution without hallucinations, offline pastoral Tamil fallback generation, WhatsApp greeting card formatting, greeting state machine transitions, and Tamil Unicode normalization. |
| **Scheduler & Data Safety** | `tests/scheduler_and_data.test.js` | Leap year February 29 recognition on February 28 in non-leap years, invariant verification that `dailyJob.js` never sends to group `CHAT_ID`, CSV injection formula neutralization, and UTF-8 BOM preservation in exports. |

---

## 3. Test Execution Verification Baseline

```text
✔ Cron Converter: Validates HH:MM and generates valid cron format
✔ Sanitization: Accusative Tamil name suffix generator
✔ Date Helpers: getTodayKey and getTomorrowKey return valid MM-DD format
✔ Event Engine: Age calculation logic
✔ Template Parser: Conditional block rendering
✔ AI & Scripture: getCanonicalVerse returns authentic Scripture references without hallucination
✔ AI & Scripture: Offline fallback generates valid, reverent Tamil Christian blessings
✔ Formatting: formatGreetingCard produces structured, WhatsApp-ready message
✔ Lifecycle: Greeting statuses adhere to expected administrative transitions
✔ Tamil Unicode: Text normalization preserves Tamil combining diacritics and glyphs
✔ Date Logic: Leap year Feb 29 anniversary and birthday matching
✔ Scheduler Broadcast Safety: Morning job must never send messages to public group CHAT_ID
✔ Data Management: CSV export protects against CSV injection and preserves Tamil UTF-8 BOM
✔ Security Guard: isAdmin fails closed when ADMIN_ID is missing or empty
✔ Security Guard: isAdmin matches exact numeric and string ID
✔ Security Guard: adminOnly wraps and rejects unauthorized calls
✔ Security Middleware: WebApp initData HMAC verification and expiration

ℹ tests 17
ℹ suites 0
ℹ pass 17
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```
