import test from "node:test";
import assert from "node:assert/strict";
import { resolveCallbackHandler } from "../src/bot/router.js";
import { sanitizeContext } from "../src/services/errorLogService.js";

test("Telegram Router: resolveCallbackHandler correctly matches exact and multi-segment actions", () => {
  const dummyRoutes = {
    "home:show": () => "home",
    "tasks:list": () => "tasks-list",
    "tasks:done": () => "tasks-done",
    "tasks:add:start": () => "tasks-add-start",
    "events:add:start": () => "events-add-start",
    "auth:approve": () => "auth-approve",
    "members:open": () => "members-open"
  };

  // 1. Exact 2-segment match
  const res1 = resolveCallbackHandler("tasks:list", dummyRoutes);
  assert.equal(typeof res1.handler, "function");
  assert.equal(res1.handler(), "tasks-list");
  assert.deepEqual(res1.args, []);

  // 2. Exact 3-segment match (fixing broken buttons like ➕ Add Task and ➕ Add Church Event)
  const res2 = resolveCallbackHandler("tasks:add:start", dummyRoutes);
  assert.equal(typeof res2.handler, "function");
  assert.equal(res2.handler(), "tasks-add-start");
  assert.deepEqual(res2.args, []);

  const res3 = resolveCallbackHandler("events:add:start", dummyRoutes);
  assert.equal(typeof res3.handler, "function");
  assert.equal(res3.handler(), "events-add-start");
  assert.deepEqual(res3.args, []);

  // 3. Parameterized prefix matching (e.g., tasks:done:12345 or auth:approve:9876:admin)
  const res4 = resolveCallbackHandler("tasks:done:task123", dummyRoutes);
  assert.equal(typeof res4.handler, "function");
  assert.equal(res4.handler(), "tasks-done");
  assert.deepEqual(res4.args, ["task123"]);

  const res5 = resolveCallbackHandler("auth:approve:9876:admin", dummyRoutes);
  assert.equal(typeof res5.handler, "function");
  assert.equal(res5.handler(), "auth-approve");
  assert.deepEqual(res5.args, ["9876", "admin"]);

  // 4. Non-existent action returns null
  const res6 = resolveCallbackHandler("nonexistent:unknown:action", dummyRoutes);
  assert.equal(res6.handler, null);
  assert.deepEqual(res6.args, []);
});

test("Error Logging Service: sanitizeContext redacts passwords, tokens, and sensitive secrets", () => {
  const rawContext = {
    url: "/api/login",
    bot_token: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    admin_secret: "super-secret-pass",
    user: {
      id: "999",
      password: "plain_password_123",
      email: "pastor@salempbc.in"
    },
    nested: {
      authHeader: "Bearer eyJhbGciOi...",
      sessionCookie: "sess_abc123"
    },
    safeField: "Everything is OK"
  };

  const clean = sanitizeContext(rawContext);

  assert.equal(clean.bot_token, "[REDACTED]");
  assert.equal(clean.admin_secret, "[REDACTED]");
  assert.equal(clean.user.password, "[REDACTED]");
  assert.equal(clean.user.email, "pastor@salempbc.in");
  assert.equal(clean.nested.authHeader, "[REDACTED]");
  assert.equal(clean.nested.sessionCookie, "[REDACTED]");
  assert.equal(clean.safeField, "Everything is OK");
});
