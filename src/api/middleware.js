import crypto from "crypto";
import { isAdmin } from "../bot/guard.js";
import {
  getCachedUserRole,
  getCachedUserPermissions,
  getDefaultPermissions,
  hasUserPermission,
  getAuthoritativeUser
} from "../services/userService.js";
import { getSession, validateCsrfToken } from "../services/sessionService.js";

/**
 * Robust zero-dependency cookie parser helper.
 */
export const parseCookies = (cookieHeader) => {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== "string") return cookies;
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx > 0) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      try {
        cookies[key] = decodeURIComponent(val);
      } catch (_) {
        cookies[key] = val;
      }
    }
  }
  return cookies;
};

/**
 * Middleware to verify request authentication:
 * 1. Server-validated session cookie (`spbc_session`) with CSRF protection on mutating methods.
 * 2. Cryptographic Telegram WebApp initData HMAC-SHA256 signature and replay protection.
 * 3. Server-validated Bearer session ID.
 *
 * Query-string credentials (?auth=...) are strictly rejected.
 * Fails closed with 401/403. Never logs credentials or session IDs.
 */
export const verifyTelegramWebAppData = async (req, res, next) => {
  // A. Check for server-managed session cookie (Standalone WebApp)
  const cookies = parseCookies(req.headers.cookie);
  const cookieSessionId = cookies.spbc_session;

  if (cookieSessionId) {
    const session = await getSession(cookieSessionId);
    if (!session) {
      return res.status(401).json({ error: "Session expired or invalid" });
    }

    // CSRF Protection for state-changing requests authenticated via cookie
    // Exception: /auth/verify is a session verification read (not a state mutation)
    const isVerifyRoute = req.path === "/auth/verify" || req.originalUrl?.includes("/auth/verify");
    if (!isVerifyRoute && ["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
      const csrfHeader = req.headers["x-csrf-token"];
      if (!validateCsrfToken(session.csrfToken, csrfHeader)) {
        return res.status(403).json({ error: "Invalid or missing CSRF token" });
      }
    }

    // Authoritative user verification (fails closed if user suspended/revoked/deleted or DB error)
    try {
      const authUser = await getAuthoritativeUser(session.userId);
      if (!authUser || authUser.status !== "active") {
        return res.status(403).json({ error: "Account suspended, revoked, or unauthorized" });
      }

      req.user = {
        id: authUser.id,
        role: authUser.role,
        permissions: authUser.permissions,
        authMode: "cookie"
      };
      req.csrfToken = session.csrfToken;
      return next();
    } catch (dbErr) {
      return res.status(500).json({ error: "Authorization verification unavailable" });
    }
  }

  // B. Check for Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : null;

  if (!bearerToken) {
    return res.status(401).json({ error: "Missing authorization" });
  }

  // B1. Bearer session identifier (64-character hex string)
  if (bearerToken.length === 64 && /^[0-9a-f]{64}$/i.test(bearerToken)) {
    const session = await getSession(bearerToken);
    if (!session) {
      return res.status(401).json({ error: "Session expired or invalid" });
    }

    try {
      const authUser = await getAuthoritativeUser(session.userId);
      if (!authUser || authUser.status !== "active") {
        return res.status(403).json({ error: "Account suspended, revoked, or unauthorized" });
      }

      req.user = {
        id: authUser.id,
        role: authUser.role,
        permissions: authUser.permissions,
        authMode: "bearer_session"
      };
      return next();
    } catch (dbErr) {
      return res.status(500).json({ error: "Authorization verification unavailable" });
    }
  }

  // B2. Standalone timing-safe ADMIN_SECRET check (for testing / direct programmatic callers)
  if (process.env.ADMIN_SECRET && process.env.ADMIN_SECRET.length >= 8) {
    if (
      bearerToken.length === process.env.ADMIN_SECRET.length &&
      crypto.timingSafeEqual(Buffer.from(bearerToken), Buffer.from(process.env.ADMIN_SECRET))
    ) {
      req.user = {
        id: process.env.ADMIN_ID || "admin",
        role: "superadmin",
        permissions: getDefaultPermissions("superadmin"),
        authMode: "admin_secret"
      };
      return next();
    }
  }

  // B3. Telegram WebApp initData HMAC verification
  if (!process.env.BOT_TOKEN || !process.env.ADMIN_ID) {
    console.error("❌ [AUTH] BOT_TOKEN or ADMIN_ID is unset in environment.");
    return res.status(500).json({ error: "Server auth configuration missing" });
  }

  try {
    const urlParams = new URLSearchParams(bearerToken);
    const hash = urlParams.get("hash");
    if (!hash) {
      return res.status(401).json({ error: "Missing HMAC signature" });
    }
    urlParams.delete("hash");

    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(process.env.BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    const hashOk =
      hash.length === calculatedHash.length &&
      crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(calculatedHash));

    if (!hashOk) {
      return res.status(403).json({ error: "Invalid signature" });
    }

    // Freshness validation window: 24h (-300s to +86400s)
    const authDate = Number(urlParams.get("auth_date"));
    if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > 86400 || Date.now() / 1000 - authDate < -300) {
      return res.status(403).json({ error: "Session expired or invalid timestamp" });
    }

    // Strict User Authorization
    const userJson = urlParams.get("user");
    if (!userJson) {
      return res.status(400).json({ error: "Missing user object in initData" });
    }

    const user = JSON.parse(userJson);
    if (!user.id || !isAdmin(user.id)) {
      return res.status(403).json({ error: "Not authorized (Admin only)" });
    }

    const isSuper = process.env.ADMIN_ID && String(user.id).trim() === String(process.env.ADMIN_ID).trim();
    const userRole = isSuper ? "superadmin" : (getCachedUserRole(user.id) || "admin");
    const userPermissions = isSuper
      ? getDefaultPermissions("superadmin")
      : (getCachedUserPermissions(user.id) || getDefaultPermissions(userRole));

    req.user = {
      ...user,
      role: userRole,
      permissions: userPermissions,
      authMode: "telegram"
    };

    next();
  } catch (err) {
    return res.status(400).json({ error: "Malformed authentication data" });
  }
};

/**
 * Middleware to require a specific granular permission for a route.
 * Supports a single string or an array of permitted keys (OR logic).
 */
export const requirePermission = (permissionKey) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Superadmin or ENV ADMIN_ID always has root bypass
  if (process.env.ADMIN_ID && String(req.user.id).trim() === String(process.env.ADMIN_ID).trim()) {
    return next();
  }
  if (req.user.role === "superadmin") {
    return next();
  }

  const keys = Array.isArray(permissionKey) ? permissionKey : [permissionKey];
  const hasAny = keys.some((k) => hasUserPermission(req.user.id, k));

  if (hasAny) {
    return next();
  }

  return res.status(403).json({
    error: `Forbidden: Missing required permission '${Array.isArray(permissionKey) ? permissionKey.join("' or '") : permissionKey}'`
  });
};
