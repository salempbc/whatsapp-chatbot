import { isAuthorizedUser, getCachedUserRole } from "../services/userService.js";

/**
 * Checks if a Telegram user ID is authorized as an administrator or staff.
 * Fails closed if ADMIN_ID is unset and user is not in the authorized registry.
 */
export const isAdmin = (id) => {
  if (!id && id !== 0) return false;
  const userKey = String(id).trim();
  if (!userKey) return false;

  const adminId = process.env.ADMIN_ID;
  const hasEnvAdmin = adminId && typeof adminId === "string" && adminId.trim().length > 0;

  // 1. Primary Super Admin from environment
  if (hasEnvAdmin && userKey === adminId.trim()) {
    return true;
  }

  // 2. Active Authorized Church Leader from database/cache
  if (isAuthorizedUser(userKey)) {
    return true;
  }

  // 3. Fail-closed: Log warning if primary admin is not set
  if (!hasEnvAdmin) {
    console.warn("⚠️ [SECURITY] ADMIN_ID is unset, missing or malformed. Rejecting access (fail-closed).");
  }

  return false;
};

/**
 * Checks if a user is the primary super administrator defined in environment.
 */
export const isSuperAdmin = (id) => {
  if (!id && id !== 0) return false;
  const adminId = process.env.ADMIN_ID;
  if (!adminId || typeof adminId !== "string" || !adminId.trim()) return false;
  return String(id).trim() === adminId.trim();
};

/**
 * Higher-order function to protect Telegram bot handlers with admin-level authorization.
 */
export const adminOnly = (fn) => (msg, ...rest) => {
  const userId = msg?.from?.id;
  if (!isAdmin(userId)) {
    console.warn(`⚠️ [SECURITY] Denied unauthorized interaction from user ID: ${userId || "unknown"}`);
    return;
  }
  return fn(msg, ...rest);
};

/**
 * Protects handlers that can only be performed by the primary super administrator.
 */
export const superAdminOnly = (fn) => (msg, ...rest) => {
  const userId = msg?.from?.id;
  if (!isSuperAdmin(userId)) {
    console.warn(`⚠️ [SECURITY] Denied non-superadmin interaction from user ID: ${userId || "unknown"}`);
    return;
  }
  return fn(msg, ...rest);
};
