import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { isAdmin, adminOnly } from "../src/bot/guard.js";
import { verifyTelegramWebAppData } from "../src/api/middleware.js";

test("Security Guard: isAdmin fails closed when ADMIN_ID is missing or empty", () => {
  const orig = process.env.ADMIN_ID;
  delete process.env.ADMIN_ID;

  assert.equal(isAdmin(123456), false, "Missing ADMIN_ID must fail closed");
  assert.equal(isAdmin("123456"), false);
  assert.equal(isAdmin(""), false);
  assert.equal(isAdmin(null), false);

  process.env.ADMIN_ID = "   ";
  assert.equal(isAdmin(123456), false, "Whitespace ADMIN_ID must fail closed");

  process.env.ADMIN_ID = orig;
});

test("Security Guard: isAdmin matches exact numeric and string ID", () => {
  const orig = process.env.ADMIN_ID;
  process.env.ADMIN_ID = "987654321";

  assert.equal(isAdmin(987654321), true);
  assert.equal(isAdmin("987654321"), true);
  assert.equal(isAdmin("123456789"), false, "Different ID must be denied");
  assert.equal(isAdmin(null), false);
  assert.equal(isAdmin(undefined), false);

  process.env.ADMIN_ID = orig;
});

test("Security Guard: adminOnly wraps and rejects unauthorized calls", () => {
  const orig = process.env.ADMIN_ID;
  process.env.ADMIN_ID = "999";

  let executed = false;
  const protectedFn = adminOnly((msg) => {
    executed = true;
    return "ok";
  });

  const deniedResult = protectedFn({ from: { id: 111 } });
  assert.equal(executed, false, "Unauthorized user must not execute protected handler");
  assert.equal(deniedResult, undefined);

  const allowedResult = protectedFn({ from: { id: 999 } });
  assert.equal(executed, true, "Authorized admin must execute handler");
  assert.equal(allowedResult, "ok");

  process.env.ADMIN_ID = orig;
});

test("Security Middleware: WebApp initData HMAC verification and expiration", () => {
  const botToken = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
  const adminId = "5551234";
  const adminSecret = "a_very_secret_and_complex_admin_key_32bytes";

  const origToken = process.env.BOT_TOKEN;
  const origAdmin = process.env.ADMIN_ID;
  const origSecret = process.env.ADMIN_SECRET;

  process.env.BOT_TOKEN = botToken;
  process.env.ADMIN_ID = adminId;
  process.env.ADMIN_SECRET = adminSecret;

  // 1. Missing auth
  const reqNoAuth = { headers: {} };
  let statusNoAuth = 0;
  let jsonNoAuth = null;
  const resNoAuth = {
    status: (s) => {
      statusNoAuth = s;
      return { json: (d) => { jsonNoAuth = d; } };
    }
  };
  verifyTelegramWebAppData(reqNoAuth, resNoAuth, () => {});
  assert.equal(statusNoAuth, 401, "Missing auth header must return 401");

  // 2. Standalone admin secret header
  const reqSecret = { headers: { authorization: `Bearer ${adminSecret}` } };
  let nextCalled = false;
  verifyTelegramWebAppData(reqSecret, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true, "Valid ADMIN_SECRET bearer token must allow access");

  // 3. Forged WebApp initData
  const forgedInitData = "auth_date=1700000000&query_id=AA&user=%7B%22id%22%3A5551234%7D&hash=invalidhash0000";
  const reqForged = { headers: { authorization: `Bearer ${forgedInitData}` } };
  let statusForged = 0;
  const resForged = {
    status: (s) => {
      statusForged = s;
      return { json: () => {} };
    }
  };
  verifyTelegramWebAppData(reqForged, resForged, () => {});
  assert.equal(statusForged, 403, "Forged HMAC signature must return 403");

  // 4. Valid signed HMAC with unauthorized user ID
  const now = Math.floor(Date.now() / 1000);
  const userUnauthorized = JSON.stringify({ id: 888888, first_name: "Attacker" });
  const params = new URLSearchParams({
    auth_date: String(now),
    query_id: "AAG123",
    user: userUnauthorized
  });

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const validHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  params.append("hash", validHash);

  const reqUnauthAdmin = { headers: { authorization: `Bearer ${params.toString()}` } };
  let statusUnauthAdmin = 0;
  const resUnauthAdmin = {
    status: (s) => {
      statusUnauthAdmin = s;
      return { json: () => {} };
    }
  };
  verifyTelegramWebAppData(reqUnauthAdmin, resUnauthAdmin, () => {});
  assert.equal(statusUnauthAdmin, 403, "Non-admin valid Telegram user must be rejected with 403");

  // 5. Valid signed HMAC with authorized admin ID
  const userAdmin = JSON.stringify({ id: Number(adminId), first_name: "Pastor" });
  const adminParams = new URLSearchParams({
    auth_date: String(now),
    query_id: "AAG123",
    user: userAdmin
  });

  const adminDataCheckString = Array.from(adminParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const adminValidHash = crypto.createHmac("sha256", secretKey).update(adminDataCheckString).digest("hex");
  adminParams.append("hash", adminValidHash);

  const reqAdmin = { headers: { authorization: `Bearer ${adminParams.toString()}` } };
  let adminNextCalled = false;
  verifyTelegramWebAppData(reqAdmin, {}, () => { adminNextCalled = true; });
  assert.equal(adminNextCalled, true, "Correctly signed admin WebApp data must pass verification");

  process.env.BOT_TOKEN = origToken;
  process.env.ADMIN_ID = origAdmin;
  process.env.ADMIN_SECRET = origSecret;
});
