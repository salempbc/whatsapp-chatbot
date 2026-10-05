import crypto from "crypto";
import { isAdmin } from "../bot/guard.js";

/**
 * Middleware to verify Telegram WebApp initData with strict HMAC-SHA256,
 * freshness validation, and admin authentication.
 */
export const verifyTelegramWebAppData = (req, res, next) => {
  const authHeader = req.headers.authorization;

  const initData =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : typeof req.query?.auth === "string"
        ? req.query.auth
        : null;

  if (!initData) {
    return res.status(401).json({ error: "Missing authorization" });
  }

  // 1. Standalone admin token check
  if (process.env.ADMIN_SECRET && process.env.ADMIN_SECRET.length >= 8) {
    if (
      initData.length === process.env.ADMIN_SECRET.length &&
      crypto.timingSafeEqual(Buffer.from(initData), Buffer.from(process.env.ADMIN_SECRET))
    ) {
      req.user = { id: process.env.ADMIN_ID || "admin", role: "admin" };
      return next();
    }
  }

  // 1b. Fallback: Allow ADMIN_ID as passcode when accessing from standalone browser
  if (process.env.ADMIN_ID) {
    const adminIdStr = String(process.env.ADMIN_ID).trim();
    if (initData.trim().length === adminIdStr.length && crypto.timingSafeEqual(Buffer.from(initData.trim()), Buffer.from(adminIdStr))) {
      req.user = { id: adminIdStr, role: "admin" };
      return next();
    }
  }

  // 2. Validate environment configuration
  if (!process.env.BOT_TOKEN || !process.env.ADMIN_ID) {
    console.error("❌ [AUTH] BOT_TOKEN or ADMIN_ID is unset in environment.");
    return res.status(500).json({ error: "Server auth configuration missing" });
  }

  try {
    const urlParams = new URLSearchParams(initData);
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

    // 3. Replay protection window: 24h
    const authDate = Number(urlParams.get("auth_date"));
    if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > 86400 || Date.now() / 1000 - authDate < -300) {
      return res.status(403).json({ error: "Session expired or invalid timestamp" });
    }

    // 4. Strict Admin Authorization
    const userJson = urlParams.get("user");
    if (!userJson) {
      return res.status(400).json({ error: "Missing user object in initData" });
    }

    const user = JSON.parse(userJson);
    if (!user.id || !isAdmin(user.id)) {
      return res.status(403).json({ error: "Not authorized (Admin only)" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(400).json({ error: "Malformed authentication data" });
  }
};
