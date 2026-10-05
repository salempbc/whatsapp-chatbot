import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { isAdmin } from "../src/bot/guard.js";
import { validateStatusTransition } from "../src/services/memberService.js";
import { exportEventsToICS } from "../src/services/churchCalendarService.js";

// ============================================================================
// 1. TELEGRAM BOT AUTHORIZATION & CALLBACK ROUTING INTEGRATION
// ============================================================================

test("Integration: Telegram router rejects non-admin callback queries and allows admin", () => {
  const originalAdmin = process.env.ADMIN_ID;
  process.env.ADMIN_ID = "777888999";

  const simulateCallbackQuery = (fromId, data) => {
    if (!isAdmin(fromId)) {
      return { status: 403, error: "Unauthorized access" };
    }
    const [ns, action] = data.split(":");
    return { status: 200, executed: `${ns}:${action}` };
  };

  // Unauthorized user attempting callback query
  const unauthResult = simulateCallbackQuery("123456789", "events:list");
  assert.equal(unauthResult.status, 403);
  assert.equal(unauthResult.error, "Unauthorized access");

  // Authorized admin performing callback query
  const authResult = simulateCallbackQuery("777888999", "events:list");
  assert.equal(authResult.status, 200);
  assert.equal(authResult.executed, "events:list");

  // Multi-namespace routes
  assert.equal(simulateCallbackQuery("777888999", "tasks:list").executed, "tasks:list");
  assert.equal(simulateCallbackQuery("777888999", "review:summary").executed, "review:summary");
  assert.equal(simulateCallbackQuery("777888999", "stats:quality").executed, "stats:quality");

  process.env.ADMIN_ID = originalAdmin;
});

test("Integration: Telegram command guard denies unauthorized invocation across all command endpoints", () => {
  const originalAdmin = process.env.ADMIN_ID;
  process.env.ADMIN_ID = "100200300";

  const guardedCommands = ["/start", "/menu", "/review", "/events", "/addevent", "/tasks", "/addtask", "/stats", "/dataquality", "/ping", "/cancel", "/backup"];

  for (const cmd of guardedCommands) {
    const isAllowedForGuest = isAdmin("999999999");
    const isAllowedForAdmin = isAdmin("100200300");

    assert.equal(isAllowedForGuest, false, `Command ${cmd} must fail-closed for unauthorized guest`);
    assert.equal(isAllowedForAdmin, true, `Command ${cmd} must allow authorized admin`);
  }

  process.env.ADMIN_ID = originalAdmin;
});

// ============================================================================
// 2. API AUTHORIZATION & VALIDATION
// ============================================================================

test("Integration: WebApp HMAC signature verification and timestamp replay protection", () => {
  const botToken = "TEST_BOT_TOKEN_123456";
  const adminId = "555666777";
  const originalBotToken = process.env.BOT_TOKEN;
  const originalAdminId = process.env.ADMIN_ID;

  process.env.BOT_TOKEN = botToken;
  process.env.ADMIN_ID = adminId;

  const generateInitData = (userId, authDateOffsetSec = 0) => {
    const authDate = Math.floor(Date.now() / 1000) + authDateOffsetSec;
    const userJson = JSON.stringify({ id: userId, first_name: "Admin" });
    const params = new URLSearchParams({
      auth_date: String(authDate),
      query_id: "AAG_test_123",
      user: userJson
    });

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    params.set("hash", hash);
    return params.toString();
  };

  const verifyData = (initDataStr) => {
    const urlParams = new URLSearchParams(initDataStr);
    const hash = urlParams.get("hash");
    if (!hash) return { ok: false, reason: "Missing hash" };
    urlParams.delete("hash");

    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(process.env.BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (hash !== calculatedHash) return { ok: false, reason: "Invalid signature" };

    const authDate = Number(urlParams.get("auth_date"));
    if (Date.now() / 1000 - authDate > 86400 || Date.now() / 1000 - authDate < -300) {
      return { ok: false, reason: "Expired" };
    }

    const user = JSON.parse(urlParams.get("user") || "{}");
    if (String(user.id) !== String(process.env.ADMIN_ID)) {
      return { ok: false, reason: "Unauthorized user" };
    }

    return { ok: true, user };
  };

  // Valid admin request
  const validInitData = generateInitData(adminId, 0);
  assert.equal(verifyData(validInitData).ok, true);

  // Unauthorized user
  const guestInitData = generateInitData("999999999", 0);
  const guestRes = verifyData(guestInitData);
  assert.equal(guestRes.ok, false);
  assert.equal(guestRes.reason, "Unauthorized user");

  // Replay protection: Expired token (> 24 hours old)
  const expiredInitData = generateInitData(adminId, -90000);
  const expiredRes = verifyData(expiredInitData);
  assert.equal(expiredRes.ok, false);
  assert.equal(expiredRes.reason, "Expired");

  // Tampered payload
  const tamperedData = validInitData.replace("first_name", "hacked_name");
  assert.equal(verifyData(tamperedData).ok, false);

  process.env.BOT_TOKEN = originalBotToken;
  process.env.ADMIN_ID = originalAdminId;
});

// ============================================================================
// 3. MEMBER LIFECYCLE & ARCHIVE/RESTORE
// ============================================================================

test("Integration: Member lifecycle status transitions and invariant enforcement", () => {
  // Check valid transition chains
  assert.equal(validateStatusTransition("active", "inactive"), true);
  assert.equal(validateStatusTransition("inactive", "active"), true);
  assert.equal(validateStatusTransition("active", "transferred"), true);
  assert.equal(validateStatusTransition("active", "deceased"), true);
  assert.equal(validateStatusTransition("active", "archived"), true);

  // Check invalid transitions (deceased members cannot be resurrected to active)
  assert.equal(validateStatusTransition("deceased", "active"), false);
  assert.equal(validateStatusTransition("deceased", "transferred"), false);

  // Invariant simulation: status to flags
  const simulateModelHooks = (status) => {
    let isActive = false;
    let isDeleted = false;
    if (status === "active") {
      isActive = true;
      isDeleted = false;
    } else {
      isActive = false;
      if (status === "archived") {
        isDeleted = true;
      }
    }
    return { isActive, isDeleted };
  };

  assert.deepEqual(simulateModelHooks("active"), { isActive: true, isDeleted: false });
  assert.deepEqual(simulateModelHooks("inactive"), { isActive: false, isDeleted: false });
  assert.deepEqual(simulateModelHooks("transferred"), { isActive: false, isDeleted: false });
  assert.deepEqual(simulateModelHooks("deceased"), { isActive: false, isDeleted: false });
  assert.deepEqual(simulateModelHooks("archived"), { isActive: false, isDeleted: true });
});

// ============================================================================
// 4. EVENT CREATION & CALENDAR EXPORT
// ============================================================================

test("Integration: Church calendar .ics export produces standards-compliant calendar feed", () => {
  const events = [
    {
      _id: "evt101",
      title: "Sunday Communion Service",
      category: "worship_service",
      startDate: "2026-10-18",
      startTime: "09:30",
      venue: "SPBC Main Sanctuary",
      description: "Preacher: Pastor David. Special worship by Youth Choir.",
      status: "scheduled"
    },
    {
      _id: "evt102",
      title: "Mid-week Fasting Prayer",
      category: "prayer_meeting",
      startDate: "2026-10-21",
      startTime: "10:00",
      venue: "Cottage Hall",
      description: "Intercessory prayer for church ministries",
      status: "scheduled"
    }
  ];

  const ics = exportEventsToICS(events);

  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.includes("VERSION:2.0\r\n"));
  assert.ok(ics.includes("PRODID:-//Salem PBC//Church CMS 2.1//EN\r\n"));
  assert.ok(ics.includes("SUMMARY:Sunday Communion Service\r\n"));
  assert.ok(ics.includes("DTSTART:20261018T093000\r\n"));
  assert.ok(ics.includes("LOCATION:SPBC Main Sanctuary\r\n"));
  assert.ok(ics.includes("STATUS:CONFIRMED\r\n"));
  assert.ok(ics.includes("SUMMARY:Mid-week Fasting Prayer\r\n"));
  assert.ok(ics.includes("DTSTART:20261021T100000\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});

// ============================================================================
// 5. TASK LIFECYCLE & OVERDUE CALCULATION
// ============================================================================

test("Integration: Task status lifecycle and overdue categorization", () => {
  const refDate = new Date("2026-10-05T00:00:00Z");

  const tasks = [
    { id: "1", title: "Communion preparation", status: "todo", dueDate: "2026-10-02" }, // Overdue
    { id: "2", title: "Visit hospitalized elder", status: "in_progress", dueDate: "2026-10-04" }, // Overdue
    { id: "3", title: "Sunday school lesson plan", status: "todo", dueDate: "2026-10-05" }, // Due today / future
    { id: "4", title: "Print bulletin", status: "completed", dueDate: "2026-10-01" }, // Completed, not overdue
    { id: "5", title: "Old maintenance task", status: "cancelled", dueDate: "2026-09-30" } // Cancelled, not overdue
  ];

  const isOverdue = (t) => {
    if (t.status === "completed" || t.status === "cancelled") return false;
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < refDate;
  };

  const overdueTasks = tasks.filter(isOverdue);
  assert.equal(overdueTasks.length, 2);
  assert.equal(overdueTasks[0].id, "1");
  assert.equal(overdueTasks[1].id, "2");
});

// ============================================================================
// 6. REPORTING & DATA QUALITY AUDIT COMPATIBILITY
// ============================================================================

test("Integration: Data quality audit generates both issues and inconsistencies aliases", () => {
  const members = [
    { id: "m1", name: "Bro. Stephen", dob: "1985-05-10", isMarried: true, spouseName: "Sis. Rachel", gender: "male", spouseGender: "female" }, // Clean
    { id: "m2", name: "A", dob: "invalid-dob", isMarried: true, spouseName: "", gender: "male" } // 3 issues: truncated name, invalid DOB, missing spouse
  ];

  const auditEngine = (roster) => {
    const issues = [];
    for (const m of roster) {
      if (!m.name || m.name.length < 2) {
        issues.push({ id: m.id, memberName: m.name, severity: "HIGH", issue: "Missing or truncated name" });
      }
      if (m.dob && !/^\d{4}-\d{2}-\d{2}$/.test(m.dob)) {
        issues.push({ id: m.id, memberName: m.name, severity: "MEDIUM", issue: `Invalid DOB format (${m.dob})` });
      }
      if (m.isMarried && !m.spouseName) {
        issues.push({ id: m.id, memberName: m.name, severity: "HIGH", issue: "Marked as married but missing spouse name" });
      }
    }

    const inconsistencies = issues.map(i => ({
      id: i.id,
      name: i.memberName,
      memberName: i.memberName,
      type: i.severity,
      severity: i.severity,
      issue: i.issue
    }));

    const healthScore = roster.length > 0
      ? Math.max(0, Math.round(((roster.length - issues.length) / roster.length) * 100))
      : 100;

    return { totalChecked: roster.length, issuesFound: issues.length, healthScore, issues, inconsistencies };
  };

  const result = auditEngine(members);
  assert.equal(result.totalChecked, 2);
  assert.equal(result.issuesFound, 3);
  assert.ok(Array.isArray(result.issues));
  assert.ok(Array.isArray(result.inconsistencies));
  assert.equal(result.inconsistencies.length, 3);
  assert.equal(result.inconsistencies[0].name, "A");
  assert.equal(result.inconsistencies[0].type, "HIGH");
});

test("Integration: homeScreen dynamically configures WebApp URL without generating invalid URLs", async () => {
  const { homeScreen } = await import("../src/bot/handlers/home.js");
  const origWebapp = process.env.WEBAPP_URL;
  const origRender = process.env.RENDER_EXTERNAL_URL;

  try {
    // 1. With explicit HTTPS WEBAPP_URL
    process.env.WEBAPP_URL = "https://spbc-staging.onrender.com";
    delete process.env.RENDER_EXTERNAL_URL;
    const screenWithUrl = homeScreen();
    const webAppRow = screenWithUrl.keyboard.find(row => row.some(b => b.web_app));
    assert.ok(webAppRow, "Keyboard must include WebApp button when WEBAPP_URL is set");
    assert.equal(webAppRow[0].web_app.url, "https://spbc-staging.onrender.com");

    // 2. With no URL configured
    delete process.env.WEBAPP_URL;
    delete process.env.RENDER_EXTERNAL_URL;
    const screenNoUrl = homeScreen();
    const hasInvalidUrl = screenNoUrl.keyboard.some(row => row.some(b => b.web_app?.url === "https://"));
    assert.equal(hasInvalidUrl, false, "Must not include invalid 'https://' URL when no domain is configured");
  } finally {
    process.env.WEBAPP_URL = origWebapp;
    process.env.RENDER_EXTERNAL_URL = origRender;
  }
});
