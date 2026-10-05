import test from "node:test";
import assert from "node:assert/strict";
import { isAdmin, isSuperAdmin } from "../src/bot/guard.js";
import {
  setAuthorizedUserCache,
  clearAuthorizedUserCache,
  isAuthorizedUser,
  getCachedUserRole
} from "../src/services/userService.js";
import { renderScreen } from "../src/bot/ui.js";

test("User Authorization: Super Admin recognized from environment", () => {
  const orig = process.env.ADMIN_ID;
  process.env.ADMIN_ID = "5550001";

  assert.equal(isAdmin("5550001"), true);
  assert.equal(isAdmin(5550001), true);
  assert.equal(isSuperAdmin("5550001"), true);
  assert.equal(getCachedUserRole("5550001"), "superadmin");

  process.env.ADMIN_ID = orig;
});

test("User Authorization: Added co-admins & staff dynamically authorized via cache", () => {
  const orig = process.env.ADMIN_ID;
  process.env.ADMIN_ID = "5550001";
  clearAuthorizedUserCache();

  // Initially unrecognized
  assert.equal(isAdmin("8887771"), false);
  assert.equal(isAuthorizedUser("8887771"), false);

  // Authorize user dynamically
  setAuthorizedUserCache("8887771", {
    name: "Pastor Peter",
    username: "peter_pastor",
    role: "admin",
    status: "active"
  });

  assert.equal(isAuthorizedUser("8887771"), true);
  assert.equal(isAdmin("8887771"), true, "Added co-admin must pass isAdmin guard");
  assert.equal(isAdmin(8887771), true, "Numeric ID also passes");
  assert.equal(isSuperAdmin("8887771"), false, "Co-admin is not Super Admin");
  assert.equal(getCachedUserRole("8887771"), "admin");

  // Revoke user
  setAuthorizedUserCache("8887771", { status: "revoked" });
  assert.equal(isAuthorizedUser("8887771"), false);
  assert.equal(isAdmin("8887771"), false, "Revoked user must be denied");

  clearAuthorizedUserCache();
  process.env.ADMIN_ID = orig;
});

test("User Authorization: Fails closed when ADMIN_ID is unset and user not in cache", () => {
  const orig = process.env.ADMIN_ID;
  delete process.env.ADMIN_ID;
  clearAuthorizedUserCache();

  assert.equal(isAdmin("999999"), false, "Unset admin must fail closed");
  assert.equal(isAdmin(null), false);
  assert.equal(isAdmin(undefined), false);

  process.env.ADMIN_ID = orig;
});

test("Error Resilience: renderScreen recovers gracefully when HTML contains unescaped entities", async () => {
  let editCalled = false;
  let sendCalled = false;
  let sentPlain = false;

  const mockBot = {
    editMessageText: async () => {
      editCalled = true;
      const err = new Error("ETELEGRAM: 400 Bad Request: can't parse entities: Character '<' is reserved");
      throw err;
    },
    sendMessage: async (chatId, text) => {
      sendCalled = true;
      if (!text.includes("<") && !text.includes(">")) {
        sentPlain = true;
      }
      return { message_id: 101 };
    }
  };

  // Screen with broken entity
  const screen = {
    text: "<b>Hello <unclosed_tag> World</b>",
    keyboard: [[{ text: "Tap", callback_data: "test" }]]
  };

  // Must not throw uncaught exception; must recover and send fallback
  await assert.doesNotReject(async () => {
    await renderScreen(mockBot, 12345, 999, screen);
  });

  assert.equal(editCalled, true, "Tried to edit first");
  assert.equal(sendCalled, true, "Fell back to sending fresh message");
  assert.equal(sentPlain, true, "Stripped broken tags for entity safety");
});
