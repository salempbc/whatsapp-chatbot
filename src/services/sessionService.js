import crypto from "crypto";
import mongoose from "mongoose";
import AdminSession from "../models/AdminSession.js";

/* In-memory session cache for low-latency lookup and unit-test execution */
const sessionCache = new Map();

/**
 * Creates a server-validated session with cryptographically secure identifiers.
 */
export const createSession = async ({
  userId = "admin",
  role = "superadmin",
  userAgent = "",
  ip = "",
  durationHours = 12
} = {}) => {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const csrfToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000);

  const sessionData = {
    sessionId,
    userId: String(userId).trim(),
    role,
    csrfToken,
    expiresAt,
    userAgent: String(userAgent || "").slice(0, 500),
    ip: String(ip || "").slice(0, 100),
    createdAt: new Date()
  };

  // Cache in-memory
  sessionCache.set(sessionId, sessionData);

  // Persist to MongoDB if connection is ready
  if (mongoose.connection?.readyState === 1) {
    try {
      await AdminSession.create(sessionData);
    } catch (err) {
      console.warn("⚠️ [SESSION] Could not persist session to MongoDB:", err.message);
    }
  }

  return {
    sessionId,
    csrfToken,
    expiresAt,
    role,
    userId: sessionData.userId
  };
};

/**
 * Retrieves an active, unexpired session by session ID.
 * MongoDB is authoritative when connected to prevent cross-instance invalidation bypasses.
 * Server-side expiration is strictly enforced on every lookup.
 */
export const getSession = async (sessionId) => {
  if (!sessionId || typeof sessionId !== "string") return null;
  const cleanId = sessionId.trim();

  // 1. Authoritative check via MongoDB shared store when connected
  if (mongoose.connection?.readyState === 1) {
    try {
      const doc = await AdminSession.findOne({ sessionId: cleanId }).lean();
      if (!doc) {
        // Revoked or expired in shared store: purge from local cache
        sessionCache.delete(cleanId);
        return null;
      }
      if (new Date() > new Date(doc.expiresAt)) {
        sessionCache.delete(cleanId);
        await AdminSession.deleteOne({ sessionId: cleanId }).catch(() => {});
        return null;
      }
      // Synchronize in-memory cache with authoritative record
      sessionCache.set(cleanId, doc);
      return doc;
    } catch (err) {
      console.error("❌ [SESSION] Authoritative session lookup failed:", err.message);
      // Fail closed on shared-store lookup errors: do not trust unverified memory cache
      return null;
    }
  }

  // 2. Fallback when MongoDB is offline / disconnected (e.g. testing)
  const cached = sessionCache.get(cleanId);
  if (cached) {
    if (new Date() > new Date(cached.expiresAt)) {
      sessionCache.delete(cleanId);
      return null;
    }
    return cached;
  }

  return null;
};

/**
 * Invalidate / destroy an active session across all instances.
 */
export const destroySession = async (sessionId) => {
  if (!sessionId || typeof sessionId !== "string") return;
  const cleanId = sessionId.trim();
  sessionCache.delete(cleanId);

  if (mongoose.connection?.readyState === 1) {
    try {
      await AdminSession.deleteOne({ sessionId: cleanId });
    } catch (err) {
      console.warn("⚠️ [SESSION] Could not delete session from DB:", err.message);
    }
  }
};

/**
 * Invalidate all active sessions for a specific user ID across all instances.
 */
export const destroyUserSessions = async (userId) => {
  if (!userId) return;
  const uid = String(userId).trim();

  // Invalidate local memory cache
  for (const [sId, sess] of sessionCache.entries()) {
    if (String(sess.userId).trim() === uid) {
      sessionCache.delete(sId);
    }
  }

  // Delete from shared MongoDB store so all instances immediately reject subsequent requests
  if (mongoose.connection?.readyState === 1) {
    try {
      await AdminSession.deleteMany({ userId: uid });
    } catch (err) {
      console.warn("⚠️ [SESSION] Could not delete user sessions from DB:", err.message);
    }
  }
};

/**
 * Timing-safe validation of CSRF tokens.
 */
export const validateCsrfToken = (expectedToken, suppliedToken) => {
  if (!expectedToken || !suppliedToken) return false;
  const expStr = String(expectedToken).trim();
  const supStr = String(suppliedToken).trim();
  if (expStr.length !== supStr.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expStr), Buffer.from(supStr));
};

/**
 * Clear in-memory session cache (used in testing).
 */
export const clearSessionCache = () => {
  sessionCache.clear();
};
