import { getBotInstance } from "../../bot/index.js";
import { requirePermission } from "../middleware.js";
import { getAllUsers, createUser, updateUser, deleteUser, toggleUserStatus, approveUser, revokeUser, createInviteToken } from "../../services/userService.js";
import { inviteLimiter } from "../limiters.js";
import { createRouter } from "../router.js";

const router = createRouter();

/* User Management (Church Leaders & Staff - Full Access Control CRUD) */
router.get("/users", requirePermission("canManageUsers"), async (req, res) => {
  const users = await getAllUsers();
  res.json({
    superAdminId: process.env.ADMIN_ID || null,
    currentUser: req.user || null,
    users
  });
});

/* CRUD CREATE: Directly register a church leader / staff */
router.post("/users", requirePermission("canManageUsers"), async (req, res) => {
  const { telegramId, name, username, role = "admin", status = "active", permissions, notes } = req.body || {};
  if (!telegramId || !name) {
    return res.status(400).json({ error: "Telegram ID and Name are required" });
  }
  try {
    const user = await createUser({
      telegramId,
      name,
      username,
      role,
      status,
      permissions,
      notes,
      addedBy: req.user?.first_name || req.user?.name || req.user?.id || "Admin"
    });
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* CRUD UPDATE: Update a leader's details, role, status, or granular permissions */
router.put("/users/:telegramId", requirePermission("canManageUsers"), async (req, res) => {
  const { telegramId } = req.params;
  const updates = req.body || {};
  if (!telegramId) return res.status(400).json({ error: "Telegram ID required" });
  try {
    const user = await updateUser(telegramId, updates);
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* CRUD DELETE: Permanently delete or revoke an authorized user */
router.delete("/users/:telegramId", requirePermission("canManageUsers"), async (req, res) => {
  const { telegramId } = req.params;
  const { hard } = req.query;
  if (!telegramId) return res.status(400).json({ error: "Telegram ID required" });
  if (process.env.ADMIN_ID && String(telegramId).trim() === String(process.env.ADMIN_ID).trim()) {
    return res.status(400).json({ error: "Cannot delete or revoke primary Super Admin" });
  }
  try {
    if (hard === "true" || hard === "1") {
      const user = await deleteUser(telegramId);
      return res.json({ success: true, user, action: "deleted" });
    }
    const user = await revokeUser(telegramId);
    res.json({ success: true, user, action: "revoked" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* TOGGLE STATUS: Toggle active / suspended */
router.post("/users/:telegramId/toggle-status", requirePermission("canManageUsers"), async (req, res) => {
  const { telegramId } = req.params;
  if (!telegramId) return res.status(400).json({ error: "Telegram ID required" });
  try {
    const user = await toggleUserStatus(telegramId);
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/users/invite", inviteLimiter, requirePermission("canManageUsers"), async (req, res) => {
  const { role = "admin", permissions = null, hoursValid = 72 } = req.body || {};
  let botUsername = process.env.BOT_USERNAME || "";
  if (!botUsername) {
    const bot = getBotInstance();
    if (bot) {
      const me = await bot.getMe().catch(() => null);
      if (me?.username) botUsername = me.username;
    }
  }
  const invite = await createInviteToken({
    role,
    permissions,
    hoursValid,
    botUsername,
    createdBy: req.user?.first_name || req.user?.id || "Admin"
  });
  res.json(invite);
});

router.post("/users/approve", requirePermission("canManageUsers"), async (req, res) => {
  const { telegramId, role = "admin", permissions = null, name, username } = req.body || {};
  if (!telegramId) return res.status(400).json({ error: "Telegram ID required" });
  const user = await approveUser({
    telegramId,
    role,
    permissions,
    name,
    username,
    approvedBy: req.user?.first_name || req.user?.id || "Admin"
  });
  res.json({ success: true, user });
});

export default router;
