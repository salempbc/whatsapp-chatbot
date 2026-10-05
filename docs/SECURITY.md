# Application Security Model — SPBC Church CMS

## 1. Security Invariants & Compliance

1. **Fail-Closed Authorization:** Every administrative touchpoint (Telegram command, callback query, REST endpoint) fails closed if credentials or configuration are absent.
2. **Zero Automated Broadcasting:** The morning scheduler dispatches messages solely to the administrator's private Telegram account.
3. **No Credential Leakage:** Sensitive keys (`BOT_TOKEN`, `MONGO_URI`, `GEMINI_API_KEY`, `ADMIN_SECRET`) are never logged or returned in HTTP error payloads.
4. **Data Sanitization & Injection Prevention:** Inputs and exports are sanitized against SQL/NoSQL injection and spreadsheet formula execution.

---

## 2. Authentication & Authorization Layers

### 2.1 Telegram Guard (`src/bot/guard.js`)
- Checks `String(userId) === String(process.env.ADMIN_ID)`.
- If `ADMIN_ID` is missing, empty, or malformed, it immediately returns `false` and logs a warning.
- Protects both text commands (`/start`, `/menu`, `/review`) and callback queries (`q.data`).

### 2.2 Telegram WebApp API Middleware (`src/api/middleware.js`)
- **HMAC-SHA256 Signature Verification:** Derives a secret key from `crypto.createHmac("sha256", "WebAppData").update(process.env.BOT_TOKEN).digest()`.
- Sorts and validates all key-value pairs in `window.Telegram.WebApp.initData`.
- **Timing-Safe Equality:** Uses `crypto.timingSafeEqual` to prevent timing attacks.
- **Replay Protection:** Rejects any `initData` where `auth_date` is older than 24 hours.
- **User Identity Check:** Parses the `user` payload and verifies that `user.id` strictly matches `ADMIN_ID`.
- **Standalone Access:** Permitted only when `ADMIN_SECRET` meets a 16+ character complexity requirement.

### 2.3 Spreadsheet Injection Neutralization (`src/services/exportService.js`)
- Any cell value beginning with `=, +, -, @, \t, \r` is prefixed with `'` to prevent spreadsheet formula execution upon opening in Microsoft Excel or Google Sheets.

---

## 3. Threat Model & Remediation Matrix

| Threat | Risk Level | Implemented Mitigation | Verification Test |
|---|---|---|---|
| Missing `ADMIN_ID` environment variable allows takeover | Critical | Fail-closed check in `src/bot/guard.js` | `tests/security.test.js` |
| Group chat broadcast spam from morning scheduler | High | Eliminated group broadcast; output sent solely to `ADMIN_ID` | `tests/scheduler_and_data.test.js` |
| Forged WebApp initData query string | High | HMAC-SHA256 verification using bot token | `tests/security.test.js` |
| Replay attacks using intercepted initData tokens | Medium | 24-hour expiration window validation | `tests/security.test.js` |
| Formula injection in CSV member exports | Medium | Single-quote formula neutralization | `tests/scheduler_and_data.test.js` |
| DoS via rapid API requests | Medium | Express rate limiter (300 requests / 5 minutes) | Verified in `src/app.js` |
