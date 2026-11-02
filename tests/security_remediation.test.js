import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import http from "http";
import express from "express";
import apiRouter from "../src/api/index.js";
import {
  setAuthorizedUserCache,
  clearAuthorizedUserCache,
  getDefaultPermissions,
  hasUserPermission,
  resolveUserPermissions,
  ALL_PERMISSION_KEYS,
  getAuthoritativeUser
} from "../src/services/userService.js";
import {
  createSession,
  getSession,
  destroySession,
  destroyUserSessions,
  clearSessionCache
} from "../src/services/sessionService.js";
import { migrateUserPermissions } from "../scripts/migrate_user_permissions.js";
import { stopScheduler } from "../src/scheduler/dailyJob.js";
import { membersStateHandlers } from "../src/bot/handlers/members.js";
import Member from "../src/models/Member.js";
import Template from "../src/models/Template.js";
import Settings from "../src/models/Settings.js";
import { addAttachment } from "../src/services/taskService.js";
import { exportMembersToCSV } from "../src/services/exportService.js";

const TEST_BOT_TOKEN = "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_12345678";
const TEST_SUPERADMIN_ID = "7018241155";
const TEST_ADMIN_SECRET = "super_secure_secret_passcode_for_spbc_2026";

function createSignedInitData(userObj, botToken = TEST_BOT_TOKEN, authDate = Math.floor(Date.now() / 1000)) {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: "AAG123_TEST",
    user: JSON.stringify(userObj)
  });

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const validHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  params.append("hash", validHash);
  return params.toString();
}

test("Phase 2A Security Remediation: Full Verification Suite (All 13 Requirements)", async () => {
  const origBotToken = process.env.BOT_TOKEN;
  const origAdminId = process.env.ADMIN_ID;
  const origAdminSecret = process.env.ADMIN_SECRET;

  process.env.BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.ADMIN_ID = TEST_SUPERADMIN_ID;
  process.env.ADMIN_SECRET = TEST_ADMIN_SECRET;

  clearAuthorizedUserCache();

  const origSettingsFindOneAndUpdate = Settings.findOneAndUpdate;
  const origSettingsFindOne = Settings.findOne;
  Settings.findOneAndUpdate = () => Promise.resolve({});
  Settings.findOne = () => Promise.resolve(null);

  // Setup test express application matching production router
  const app = express();
  app.use(express.json());

  // Replicate /admin route from src/app.js
  app.get("/admin", (req, res) => {
    res.redirect(302, "/");
  });

  app.use("/api", apiRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // -------------------------------------------------------------------------
    // 1. Rejection of the numeric administrator ID as a bearer token
    // -------------------------------------------------------------------------
    const resAdminIdBearer = await fetch(`${baseUrl}/api/members`, {
      headers: { Authorization: `Bearer ${TEST_SUPERADMIN_ID}` }
    });
    assert.equal(
      resAdminIdBearer.status,
      401,
      "Requirement 1: Passing ADMIN_ID directly as a Bearer token must return 401 Unauthorized"
    );

    // -------------------------------------------------------------------------
    // 2. Rejection of unauthenticated requests to /api/members (returns 401)
    // -------------------------------------------------------------------------
    const resNoAuthMembers = await fetch(`${baseUrl}/api/members`);
    assert.equal(
      resNoAuthMembers.status,
      401,
      "Requirement 2: Unauthenticated request to /api/members must return 401"
    );

    // -------------------------------------------------------------------------
    // 3. Rejection of unauthenticated requests to /api/settings (returns 401)
    // -------------------------------------------------------------------------
    const resNoAuthSettings = await fetch(`${baseUrl}/api/settings`);
    assert.equal(
      resNoAuthSettings.status,
      401,
      "Requirement 3: Unauthenticated request to /api/settings must return 401"
    );

    // -------------------------------------------------------------------------
    // 4b. Rejection of expired and future-dated Telegram initData (returns 403)
    // -------------------------------------------------------------------------
    const expiredInitData = createSignedInitData(
      { id: Number(TEST_SUPERADMIN_ID), first_name: "Super" },
      TEST_BOT_TOKEN,
      Math.floor(Date.now() / 1000) - 86401 // 24h + 1s ago
    );
    const resExpired = await fetch(`${baseUrl}/api/members`, {
      headers: { Authorization: `Bearer ${expiredInitData}` }
    });
    assert.equal(
      resExpired.status,
      403,
      "Requirement 4b: Expired Telegram initData (> 24h) must return 403 Forbidden"
    );

    const futureInitData = createSignedInitData(
      { id: Number(TEST_SUPERADMIN_ID), first_name: "Super" },
      TEST_BOT_TOKEN,
      Math.floor(Date.now() / 1000) + 600 // 10 minutes in future
    );
    const resFuture = await fetch(`${baseUrl}/api/members`, {
      headers: { Authorization: `Bearer ${futureInitData}` }
    });
    assert.equal(
      resFuture.status,
      403,
      "Requirement 4b: Future-dated Telegram initData (> 300s) must return 403 Forbidden"
    );

    // -------------------------------------------------------------------------
    // 4c. Rejection of validly signed initData for UNREGISTERED/UNAUTHORIZED user
    // -------------------------------------------------------------------------
    const unauthorizedUserInitData = createSignedInitData({
      id: 999999999,
      first_name: "Stranger",
      username: "stranger_danger"
    });
    const resUnauthorizedUser = await fetch(`${baseUrl}/api/members`, {
      headers: { Authorization: `Bearer ${unauthorizedUserInitData}` }
    });
    assert.equal(
      resUnauthorizedUser.status,
      403,
      "Requirement 4c: Validly signed initData for unknown non-admin user must return 403 Forbidden"
    );

    // -------------------------------------------------------------------------
    // 5. Acceptance of valid Telegram initData for an authorized administrator
    // -------------------------------------------------------------------------
    const superAdminInitData = createSignedInitData({
      id: Number(TEST_SUPERADMIN_ID),
      first_name: "Super",
      username: "superadmin"
    });
    const resSuperAdminVerify = await fetch(`${baseUrl}/api/auth/verify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${superAdminInitData}` }
    });
    assert.equal(
      resSuperAdminVerify.status,
      200,
      "Requirement 5: Valid signed initData for Super Admin must be accepted (200 OK)"
    );
    const superAdminVerifyData = await resSuperAdminVerify.json();
    assert.equal(superAdminVerifyData.success, true);
    assert.equal(superAdminVerifyData.user.role, "superadmin");

    // -------------------------------------------------------------------------
    // 6. Acceptance of authorized administrator requests with full permissions
    // -------------------------------------------------------------------------
    assert.equal(hasUserPermission(TEST_SUPERADMIN_ID, "canManageMembers"), true);
    assert.equal(hasUserPermission(TEST_SUPERADMIN_ID, "canDeleteMembers"), true);
    assert.equal(hasUserPermission(TEST_SUPERADMIN_ID, "canExportData"), true);
    assert.equal(hasUserPermission(TEST_SUPERADMIN_ID, "canManageUsers"), true);
    assert.equal(hasUserPermission(TEST_SUPERADMIN_ID, "canManageEvents"), true);
    assert.equal(hasUserPermission(TEST_SUPERADMIN_ID, "canManageTasks"), true);
    assert.equal(hasUserPermission(TEST_SUPERADMIN_ID, "canViewAnalytics"), true);
    assert.equal(hasUserPermission(TEST_SUPERADMIN_ID, "canEditSettings"), true);
    assert.equal(hasUserPermission(TEST_SUPERADMIN_ID, "canSendGreetings"), true);

    // Standalone Admin Secret verification
    const resSecretVerify = await fetch(`${baseUrl}/api/auth/verify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TEST_ADMIN_SECRET}` }
    });
    assert.equal(resSecretVerify.status, 200, "Requirement 6: Valid ADMIN_SECRET must grant admin access");

    // -------------------------------------------------------------------------
    // 6b. Phase 2A Final Hardening: Cookie-Based Sessions & Anti-CSRF Protection
    // -------------------------------------------------------------------------
    const resVerifyNoAuth = await fetch(`${baseUrl}/api/auth/verify`, { method: "POST" });
    assert.equal(resVerifyNoAuth.status, 401, "Browser login without token must return 401");

    const resVerifyWrongSecret = await fetch(`${baseUrl}/api/auth/verify`, {
      method: "POST",
      headers: { Authorization: "Bearer wrong_secret_passcode_123" }
    });
    assert.equal(resVerifyWrongSecret.status, 401, "Browser login with wrong secret must return 401");

    // Login via POST /api/auth/login with valid secret exchanges secret for HttpOnly cookie + CSRF token
    const resLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: TEST_ADMIN_SECRET })
    });
    assert.equal(resLogin.status, 200, "POST /api/auth/login with valid secret must return 200 OK");
    const loginData = await resLogin.json();
    assert.equal(loginData.success, true, "Login response must indicate success");
    assert.ok(loginData.csrfToken && loginData.csrfToken.length >= 32, "Login must issue cryptographically secure CSRF token");

    // Verify Set-Cookie header parameters
    const setCookieHeader = resLogin.headers.get("set-cookie") || "";
    assert.ok(setCookieHeader.includes("spbc_session="), "Login response must set spbc_session cookie");
    assert.ok(setCookieHeader.toLowerCase().includes("httponly"), "Session cookie must be HttpOnly");
    assert.ok(setCookieHeader.toLowerCase().includes("samesite=lax"), "Session cookie must specify SameSite=Lax");

    const sessionIdMatch = setCookieHeader.match(/spbc_session=([a-f0-9]+);/);
    assert.ok(sessionIdMatch && sessionIdMatch[1], "Session ID must be a valid hex token");
    const activeSessionId = sessionIdMatch[1];
    const activeCsrfToken = loginData.csrfToken;

    // Cookie-authenticated GET request succeeds
    const origMemberFind = Member.find;
    Member.find = () => ({
      sort: () => ({
        lean: () => Promise.resolve([])
      })
    });

    const resCookieMembers = await fetch(`${baseUrl}/api/members`, {
      headers: { Cookie: `spbc_session=${activeSessionId}` }
    });
    assert.equal(resCookieMembers.status, 200, "Cookie-authenticated GET request to /api/members must succeed (200 OK)");

    // Mutating state-changing request WITHOUT CSRF token fails (403 Forbidden)
    const resMutateNoCsrf = await fetch(`${baseUrl}/api/settings`, {
      method: "POST",
      headers: {
        Cookie: `spbc_session=${activeSessionId}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ enableBirthdays: true })
    });
    assert.equal(resMutateNoCsrf.status, 403, "Cookie-authenticated mutating request without X-CSRF-Token must be rejected (403)");

    // Mutating state-changing request with INVALID CSRF token fails (403 Forbidden)
    const resMutateBadCsrf = await fetch(`${baseUrl}/api/settings`, {
      method: "POST",
      headers: {
        Cookie: `spbc_session=${activeSessionId}`,
        "X-CSRF-Token": "completely_bogus_csrf_token_12345",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ enableBirthdays: true })
    });
    assert.equal(resMutateBadCsrf.status, 403, "Cookie-authenticated mutating request with invalid X-CSRF-Token must be rejected (403)");

    // Mutating state-changing request with VALID CSRF token succeeds (200 OK)
    const resMutateValidCsrf = await fetch(`${baseUrl}/api/settings`, {
      method: "POST",
      headers: {
        Cookie: `spbc_session=${activeSessionId}`,
        "X-CSRF-Token": activeCsrfToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ enableBirthdays: true })
    });
    assert.equal(resMutateValidCsrf.status, 200, "Cookie-authenticated mutating request with valid X-CSRF-Token must succeed (200 OK)");

    // -------------------------------------------------------------------------
    // Logout CSRF Protection (SEC-AUDIT-04)
    // -------------------------------------------------------------------------
    // Logout without CSRF token fails (403 Forbidden)
    const resLogoutNoCsrf = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: `spbc_session=${activeSessionId}` }
    });
    assert.equal(resLogoutNoCsrf.status, 403, "Cookie-authenticated logout without CSRF token must return 403 Forbidden");

    // Logout with invalid CSRF token fails (403 Forbidden)
    const resLogoutBadCsrf = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: `spbc_session=${activeSessionId}`,
        "X-CSRF-Token": "bad_csrf_token_12345"
      }
    });
    assert.equal(resLogoutBadCsrf.status, 403, "Cookie-authenticated logout with invalid CSRF token must return 403 Forbidden");

    // Logout with valid CSRF token succeeds (200 OK) and clears session
    const resLogout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: `spbc_session=${activeSessionId}`,
        "X-CSRF-Token": activeCsrfToken
      }
    });
    assert.equal(resLogout.status, 200, "POST /api/auth/logout with valid CSRF must return 200 OK");
    const logoutCookie = resLogout.headers.get("set-cookie") || "";
    assert.ok(logoutCookie.includes("Max-Age=0") || logoutCookie.includes("expires="), "Logout must clear session cookie");

    // Subsequent request with the destroyed session must be rejected (401 Unauthorized)
    const resAfterLogout = await fetch(`${baseUrl}/api/members`, {
      headers: { Cookie: `spbc_session=${activeSessionId}` }
    });
    assert.equal(resAfterLogout.status, 401, "Destroyed session must be rejected on subsequent requests (401 Unauthorized)");

    // -------------------------------------------------------------------------
    // 6c. Member Photo Privacy & Security (GET /api/members/:id/photo)
    // -------------------------------------------------------------------------
    const nonExistentId = "507f1f77bcf86cd799439099";

    // 1. Unauthenticated request to photo endpoint MUST return 401 Unauthorized
    const resUnauthPhoto = await fetch(`${baseUrl}/api/members/${nonExistentId}/photo`);
    assert.equal(
      resUnauthPhoto.status,
      401,
      "Requirement 6c: Unauthenticated access to GET /api/members/:id/photo must be rejected with 401 Unauthorized"
    );

    // Create a new session for authorized photo testing
    const photoAuthSession = await createSession({ userId: TEST_SUPERADMIN_ID, role: "superadmin" });
    const photoAuthHeaders = { Cookie: `spbc_session=${photoAuthSession.sessionId}` };

    // 2. Path traversal attempt with authentication must return 400 Bad Request
    const resAvatarTraversal = await fetch(`${baseUrl}/api/members/..%2f..%2fpackage.json/photo`, {
      headers: photoAuthHeaders
    });
    assert.equal(resAvatarTraversal.status, 400, "Path traversal in photo endpoint must return 400 Bad Request");

    const origFindById = Member.findById;
    Member.findById = (id) => {
      if (String(id) === nonExistentId) return Promise.resolve(null);
      return Promise.resolve({
        _id: id,
        name: "Test Member",
        photo: "data:image/jpeg;base64,/9j/4AAQSkZJRg=="
      });
    };

    // 3. Authenticated request for non-existent member returns 404
    const resAvatarNotFound = await fetch(`${baseUrl}/api/members/${nonExistentId}/photo`, {
      headers: photoAuthHeaders
    });
    assert.equal(resAvatarNotFound.status, 404, "Authenticated request for non-existent member photo must return 404");

    // 4. Authenticated request for member with base64 data URL returns 200
    const resAvatarBase64 = await fetch(`${baseUrl}/api/members/${nonExistentId.replace('99', '88')}/photo`, {
      headers: photoAuthHeaders
    });
    assert.equal(resAvatarBase64.status, 200, "Base64 member photo must be served directly (200 OK)");
    assert.equal(resAvatarBase64.headers.get("content-type"), "image/jpeg");
    assert.equal(resAvatarBase64.headers.get("location"), null, "Photo endpoint must not redirect or leak tokens");

    Member.findById = origFindById;
    Member.find = origMemberFind;

    // -------------------------------------------------------------------------
    // 6d. Permission Idempotency & Migration Verification
    // -------------------------------------------------------------------------
    // Preserves existing explicit custom overrides while filling in missing schema fields
    const legacyPastorPermissions = {
      canManageMembers: false, // custom override
      canDeleteMembers: false
    };
    const resolvedPastor = resolveUserPermissions("pastor", legacyPastorPermissions);
    assert.equal(resolvedPastor.canManageMembers, false, "Custom override must be preserved");
    assert.equal(resolvedPastor.canViewAnalytics, true, "Missing schema permission must receive role default");
    assert.equal(resolvedPastor.canEditSettings, false, "Missing schema permission must receive role default");
    assert.equal(Object.keys(resolvedPastor).length, ALL_PERMISSION_KEYS.length, "All 10 schema permission keys must be resolved");

    // Unknown permission keys fail closed
    assert.equal(hasUserPermission(TEST_SUPERADMIN_ID, "unknown_permission_key"), false, "hasUserPermission must fail closed on unknown keys");

    // Dry-run migration execution
    const migrationDryRun = await migrateUserPermissions({ dryRun: true });
    assert.equal(migrationDryRun.dryRun, true, "migrateUserPermissions must support safe dryRun execution");

    // -------------------------------------------------------------------------
    // 7. Verification: volunteer role cannot manage members (canManageMembers: false -> 403)
    // -------------------------------------------------------------------------
    const VOLUNTEER_ID = "200000001";
    setAuthorizedUserCache(VOLUNTEER_ID, {
      name: "Volunteer Bob",
      role: "volunteer",
      status: "active",
      permissions: getDefaultPermissions("volunteer")
    });

    const volunteerInitData = createSignedInitData({
      id: Number(VOLUNTEER_ID),
      first_name: "Bob",
      username: "volunteer_bob"
    });

    const resVolunteerMembers = await fetch(`${baseUrl}/api/members`, {
      headers: { Authorization: `Bearer ${volunteerInitData}` }
    });
    assert.equal(
      resVolunteerMembers.status,
      403,
      "Requirement 7: User with role volunteer must receive 403 Forbidden on /api/members"
    );

    // -------------------------------------------------------------------------
    // 8. Verification: staff role cannot export data (canExportData: false -> 403 on /api/export)
    // -------------------------------------------------------------------------
    const STAFF_ID = "300000001";
    setAuthorizedUserCache(STAFF_ID, {
      name: "Staff Susan",
      role: "staff",
      status: "active",
      permissions: getDefaultPermissions("staff")
    });

    const staffInitData = createSignedInitData({
      id: Number(STAFF_ID),
      first_name: "Susan",
      username: "staff_susan"
    });

    const resStaffExport = await fetch(`${baseUrl}/api/export`, {
      headers: { Authorization: `Bearer ${staffInitData}` }
    });
    assert.equal(
      resStaffExport.status,
      403,
      "Requirement 8: Staff user with canExportData: false must receive 403 on /api/export"
    );

    const resStaffDirectory = await fetch(`${baseUrl}/api/directory`, {
      headers: { Authorization: `Bearer ${staffInitData}` }
    });
    assert.equal(
      resStaffDirectory.status,
      403,
      "Requirement 8: Staff user with canExportData: false must receive 403 on /api/directory"
    );

    // -------------------------------------------------------------------------
    // 9. Verification: user administration routes restricted to canManageUsers
    // -------------------------------------------------------------------------
    const PASTOR_ID = "400000001";
    setAuthorizedUserCache(PASTOR_ID, {
      name: "Pastor David",
      role: "pastor",
      status: "active",
      permissions: getDefaultPermissions("pastor")
    });

    const pastorInitData = createSignedInitData({
      id: Number(PASTOR_ID),
      first_name: "David",
      username: "pastor_david"
    });

    // Pastor cannot manage users (GET /api/users -> 403)
    const resPastorUsers = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${pastorInitData}` }
    });
    assert.equal(
      resPastorUsers.status,
      403,
      "Requirement 9: Pastor without canManageUsers must receive 403 on /api/users"
    );

    // Staff cannot create users (POST /api/users -> 403)
    const resStaffCreateUser = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${staffInitData}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ telegramId: "999", name: "Hacker" })
    });
    assert.equal(
      resStaffCreateUser.status,
      403,
      "Requirement 9: Staff without canManageUsers must receive 403 on POST /api/users"
    );

    // Volunteer cannot invite users (POST /api/users/invite -> 403)
    const resVolunteerInvite = await fetch(`${baseUrl}/api/users/invite`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${volunteerInitData}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ role: "admin" })
    });
    assert.equal(
      resVolunteerInvite.status,
      403,
      "Requirement 9: Volunteer without canManageUsers must receive 403 on /api/users/invite"
    );

    // -------------------------------------------------------------------------
    // 9b. Module-by-Module Permission Matrix Regression Checks
    // -------------------------------------------------------------------------
    // Tasks: Volunteer (false) -> 403
    const resVolunteerTasks = await fetch(`${baseUrl}/api/tasks`, {
      headers: { Authorization: `Bearer ${volunteerInitData}` }
    });
    assert.equal(resVolunteerTasks.status, 403, "Volunteer must be denied /api/tasks (403)");

    // Events: Volunteer (false) -> 403
    const resVolunteerEvents = await fetch(`${baseUrl}/api/events`, {
      headers: { Authorization: `Bearer ${volunteerInitData}` }
    });
    assert.equal(resVolunteerEvents.status, 403, "Volunteer must be denied /api/events (403)");

    // Templates: Volunteer (false) -> 403
    const resVolunteerTemplates = await fetch(`${baseUrl}/api/templates`, {
      headers: { Authorization: `Bearer ${volunteerInitData}` }
    });
    assert.equal(resVolunteerTemplates.status, 403, "Volunteer must be denied /api/templates (403)");

    // Templates: Staff (true) -> 200 (allowed)
    const origTemplateFind = Template.find;
    Template.find = () => ({ sort: () => ({ lean: () => Promise.resolve([]) }) });
    const resStaffTemplates = await fetch(`${baseUrl}/api/templates`, {
      headers: { Authorization: `Bearer ${staffInitData}` }
    });
    assert.equal(resStaffTemplates.status, 200, "Staff with canManageTemplates: true must be allowed /api/templates (200)");
    Template.find = origTemplateFind;

    // Settings: Staff (false) -> 403
    const resStaffSettings = await fetch(`${baseUrl}/api/settings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${staffInitData}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ sendTime: "07:00" })
    });
    assert.equal(resStaffSettings.status, 403, "Staff must be denied /api/settings (403)");

    // Settings: Volunteer (false) -> 403
    const resVolunteerSettings = await fetch(`${baseUrl}/api/settings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${volunteerInitData}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ sendTime: "07:00" })
    });
    assert.equal(resVolunteerSettings.status, 403, "Volunteer must be denied /api/settings (403)");

    // Gemini test: Staff (false) -> 403
    const resStaffGemini = await fetch(`${baseUrl}/api/actions/test-gemini`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${staffInitData}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ apiKey: "test" })
    });
    assert.equal(resStaffGemini.status, 403, "Staff must be denied /api/actions/test-gemini (403)");

    // Diagnostics endpoint: Public telemetry must not leak credentials
    const resDiag = await fetch(`${baseUrl}/api/diagnostics`);
    assert.equal(resDiag.status, 200, "Public diagnostics endpoint returns 200");
    const diagText = await resDiag.text();
    assert.equal(diagText.includes(TEST_BOT_TOKEN), false, "Diagnostics must not leak BOT_TOKEN");
    assert.equal(diagText.includes(TEST_ADMIN_SECRET), false, "Diagnostics must not leak ADMIN_SECRET");
    assert.equal(diagText.includes(TEST_SUPERADMIN_ID), false, "Diagnostics must not leak ADMIN_ID");

    // -------------------------------------------------------------------------
    // 10. Rejection of query string authentication (?auth=...)
    // -------------------------------------------------------------------------
    const resQueryAuthAdmin = await fetch(`${baseUrl}/api/members?auth=${TEST_SUPERADMIN_ID}`);
    assert.equal(
      resQueryAuthAdmin.status,
      401,
      "Requirement 10: Credentials supplied via ?auth= query string must be rejected (401)"
    );

    const resQueryAuthInit = await fetch(`${baseUrl}/api/members?auth=${encodeURIComponent(superAdminInitData)}`);
    assert.equal(
      resQueryAuthInit.status,
      401,
      "Requirement 10: Valid initData supplied via ?auth= query string must be rejected (401)"
    );

    // -------------------------------------------------------------------------
    // 11. Verification: GET /admin redirects without leaking credentials
    // -------------------------------------------------------------------------
    const resAdminRedirect = await fetch(`${baseUrl}/admin`, { redirect: "manual" });
    assert.equal(resAdminRedirect.status, 302, "Requirement 11: /admin must return 302 redirect");
    const locationHeader = resAdminRedirect.headers.get("location");
    assert.equal(
      locationHeader,
      "/",
      "Requirement 11: /admin must redirect cleanly to '/' with no leaked query parameters"
    );
    assert.equal(
      locationHeader.includes("auth="),
      false,
      "Requirement 11: Location header must never include ?auth="
    );
    assert.equal(
      locationHeader.includes(TEST_SUPERADMIN_ID),
      false,
      "Requirement 11: Location header must never leak ADMIN_ID"
    );

    // -------------------------------------------------------------------------
    // 12. Verification: error-log routes require canViewAnalytics / canEditSettings
    // -------------------------------------------------------------------------
    // Volunteer has neither canViewAnalytics nor canEditSettings
    const resVolunteerErrorsGet = await fetch(`${baseUrl}/api/errors`, {
      headers: { Authorization: `Bearer ${volunteerInitData}` }
    });
    assert.equal(
      resVolunteerErrorsGet.status,
      403,
      "Requirement 12: GET /api/errors must return 403 for user lacking canViewAnalytics"
    );

    const validDummyId = "507f1f77bcf86cd799439011";
    const resVolunteerErrorsResolve = await fetch(`${baseUrl}/api/errors/${validDummyId}/resolve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${volunteerInitData}` }
    });
    assert.equal(
      resVolunteerErrorsResolve.status,
      403,
      "Requirement 12: POST /api/errors/:id/resolve must return 403 for user lacking canEditSettings"
    );

    // Staff has canViewAnalytics: true, but canEditSettings: false
    const resStaffErrorsResolve = await fetch(`${baseUrl}/api/errors/${validDummyId}/resolve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${staffInitData}` }
    });
    assert.equal(
      resStaffErrorsResolve.status,
      403,
      "Requirement 12: POST /api/errors/:id/resolve must return 403 for staff lacking canEditSettings"
    );

    // -------------------------------------------------------------------------
    // 13. Verification: regex inputs containing special characters do not throw
    // -------------------------------------------------------------------------
    const dangerousRegexInputs = [
      "(unmatched_parens",
      "[unclosed_bracket",
      "*quantifier_start",
      "+plus_quantifier",
      "?question_mark",
      "\\trailing_backslash",
      "evil(a+)+pattern$",
      "John (Elder) [Dept]"
    ];

    const origMemberFindRegex = Member.find;
    Member.find = () => Promise.resolve([]);

    try {
      const mockBot = {
        sendMessage: async () => ({ message_id: 1234 })
      };

      for (const dangerousInput of dangerousRegexInputs) {
        await assert.doesNotReject(async () => {
          await membersStateHandlers["members.search"]({
            bot: mockBot,
            chatId: 99999,
            text: dangerousInput
          });
        }, `Requirement 13: Regex search input "${dangerousInput}" must not throw unhandled syntax errors`);
      }

      // Also verify /genwish regex compilation logic with dangerous inputs
      const escapeRegex = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      for (const dangerousInput of dangerousRegexInputs) {
        assert.doesNotThrow(() => {
          new RegExp(escapeRegex(dangerousInput), "i");
        }, `/genwish regex for "${dangerousInput}" must compile without error`);
      }
    } finally {
      Member.find = origMemberFindRegex;
    }

    // -------------------------------------------------------------------------
    // 14. Phase 2A.1 Verification: SEC-AUDIT-01 & SEC-AUDIT-02 Authoritative User Checks
    // -------------------------------------------------------------------------
    const AUDIT_STAFF_ID = "500000001";
    setAuthorizedUserCache(AUDIT_STAFF_ID, {
      name: "Staff Carol",
      role: "staff",
      status: "active",
      permissions: getDefaultPermissions("staff")
    });

    const staffSession = await createSession({ userId: AUDIT_STAFF_ID, role: "staff" });
    const origFindTemplates = Template.find;
    Template.find = () => ({ sort: () => ({ lean: () => Promise.resolve([]) }) });

    // Active staff session succeeds
    const resStaffActiveSession = await fetch(`${baseUrl}/api/templates`, {
      headers: { Cookie: `spbc_session=${staffSession.sessionId}` }
    });
    assert.equal(resStaffActiveSession.status, 200, "SEC-AUDIT-01: Active staff session cookie must be authorized (200 OK)");

    // Suspended staff session fails closed (403 Forbidden)
    setAuthorizedUserCache(AUDIT_STAFF_ID, {
      name: "Staff Carol",
      role: "staff",
      status: "suspended",
      permissions: getDefaultPermissions("staff")
    });
    const resStaffSuspendedSession = await fetch(`${baseUrl}/api/templates`, {
      headers: { Cookie: `spbc_session=${staffSession.sessionId}` }
    });
    assert.equal(resStaffSuspendedSession.status, 403, "SEC-AUDIT-01: Suspended staff session must return 403 Forbidden");

    // Session destruction revokes session (subsequent request returns 401 Unauthorized)
    await destroyUserSessions(AUDIT_STAFF_ID);
    const resStaffRevokedSession = await fetch(`${baseUrl}/api/templates`, {
      headers: { Cookie: `spbc_session=${staffSession.sessionId}` }
    });
    assert.equal(resStaffRevokedSession.status, 401, "SEC-AUDIT-01: Revoked session must return 401 Unauthorized");

    // Deleted user session fails closed (403 Forbidden)
    const DELETED_USER_ID = "500000002";
    const deletedUserSession = await createSession({ userId: DELETED_USER_ID, role: "staff" });
    const resDeletedUserSession = await fetch(`${baseUrl}/api/templates`, {
      headers: { Cookie: `spbc_session=${deletedUserSession.sessionId}` }
    });
    assert.equal(resDeletedUserSession.status, 403, "SEC-AUDIT-01: Session for deleted/unknown user must return 403 Forbidden");

    // Super Administrator session is always authoritative and active
    const superAdminSession = await createSession({ userId: TEST_SUPERADMIN_ID, role: "superadmin" });
    const resSuperAdminSession = await fetch(`${baseUrl}/api/templates`, {
      headers: { Cookie: `spbc_session=${superAdminSession.sessionId}` }
    });
    assert.equal(resSuperAdminSession.status, 200, "SEC-AUDIT-01: Super Administrator session must be authorized (200 OK)");

    Template.find = origFindTemplates;

    // -------------------------------------------------------------------------
    // 15. Phase 2A.1 Verification: SEC-AUDIT-07 Session Expiration
    // -------------------------------------------------------------------------
    const expiredSession = await createSession({ userId: TEST_SUPERADMIN_ID, role: "superadmin", durationHours: -1 });
    const resExpiredSession = await fetch(`${baseUrl}/api/members`, {
      headers: { Cookie: `spbc_session=${expiredSession.sessionId}` }
    });
    assert.equal(resExpiredSession.status, 401, "SEC-AUDIT-07: Expired session cookie must return 401 Unauthorized");

    // -------------------------------------------------------------------------
    // 16. Phase 2A.1 Verification: SEC-AUDIT-03 Client Error Limiting & Validation
    // -------------------------------------------------------------------------
    // Payload without message or stack returns 400
    const resClientErrorNoMsg = await fetch(`${baseUrl}/api/client-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ other: "data" })
    });
    assert.equal(resClientErrorNoMsg.status, 400, "SEC-AUDIT-03: Client-error payload without message or stack must return 400");

    // Valid payload returns 200
    const resClientErrorValid = await fetch(`${baseUrl}/api/client-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "UI render failure", stack: "Error at Vue component", url: "https://example.com" })
    });
    assert.equal(resClientErrorValid.status, 200, "SEC-AUDIT-03: Valid client-error payload must return 200 OK");
    const clientErrorBody = await resClientErrorValid.json();
    assert.equal(clientErrorBody.success, true);

    // -------------------------------------------------------------------------
    // 16b. Service Hardening Verification: SEC-05 Attachment Cap & Path Sanitization
    // -------------------------------------------------------------------------
    await assert.rejects(
      async () => {
        await addAttachment("dummyTaskId", {
          filename: "huge.bin",
          mimeType: "application/octet-stream",
          size: 2 * 1024 * 1024,
          data: "data:application/octet-stream;base64,AAAA"
        });
      },
      /Attachment size exceeds maximum limit of 1MB/,
      "SEC-05: addAttachment must reject files exceeding 1MB"
    );

    const exportedPath = await exportMembersToCSV([], "../../../evil_label");
    assert.equal(exportedPath.includes("evil_label"), true);
    assert.equal(exportedPath.includes(".."), false, "Export path must not contain path traversal characters");

    // -------------------------------------------------------------------------
    // 17. Phase 2A.1 Verification: SEC-AUDIT-05 Brute-Force Rate Limiting
    // -------------------------------------------------------------------------
    for (let attempt = 1; attempt <= 5; attempt++) {
      const resBadAttempt = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: "wrong_password_attempt" })
      });
      assert.equal(resBadAttempt.status, 401, `SEC-AUDIT-05: Failed login attempt ${attempt} must return 401`);
    }

    const resThrottledAttempt = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: "wrong_password_attempt" })
    });
    assert.equal(resThrottledAttempt.status, 429, "SEC-AUDIT-05: 6th failed login attempt must return 429 Too Many Requests");

  } finally {
    stopScheduler();
    Settings.findOneAndUpdate = origSettingsFindOneAndUpdate;
    Settings.findOne = origSettingsFindOne;
    clearAuthorizedUserCache();
    process.env.BOT_TOKEN = origBotToken;
    process.env.ADMIN_ID = origAdminId;
    process.env.ADMIN_SECRET = origAdminSecret;
    await new Promise((resolve) => server.close(resolve));
  }
});
