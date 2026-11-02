import express from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { handleWebhook, getWebhookSecret } from "../bot/index.js";
import { verifyTelegramWebAppData, parseCookies } from "./middleware.js";
import { createSession, destroySession, getSession, validateCsrfToken } from "../services/sessionService.js";
import { getDefaultPermissions } from "../services/userService.js";
import { captureError } from "../services/errorLogService.js";
import { createRouter } from "./router.js";
import { validateBody, loginSchema } from "./validate.js";
import { clientErrorLimiter, loginLimiter, authVerifyLimiter } from "./limiters.js";
import membersRoutes from "./routes/members.js";
import eventsRoutes from "./routes/events.js";
import tasksRoutes from "./routes/tasks.js";
import reportsRoutes from "./routes/reports.js";
import templatesRoutes from "./routes/templates.js";
import settingsRoutes from "./routes/settings.js";
import greetingsRoutes from "./routes/greetings.js";
import usersRoutes from "./routes/users.js";
import errorsRoutes from "./routes/errors.js";

export { clientErrorLimiter, loginLimiter, authVerifyLimiter, inviteLimiter } from "./limiters.js";

const router = createRouter();

router.post("/bot-webhook", express.json({ limit: "1mb" }), (req, res) => {
  const provided = req.get("X-Telegram-Bot-Api-Secret-Token") || "";
  const expected = getWebhookSecret();
  const ok =
    expected.length > 0 &&
    provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));

  if (!ok) return res.sendStatus(401);

  handleWebhook(req.body);
  res.sendStatus(200);
});

router.use(express.json({ limit: "15mb" }));
router.use(express.urlencoded({ extended: true, limit: "15mb" }));

/* 1. PUBLIC HEALTH & TELEMETRY */
router.get("/ping", (req, res) => res.status(200).send("pong"));

router.get("/diagnostics", async (req, res) => {
  const start = Date.now();
  let dbStatus = "connected";
  let dbLatency = 0;
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      dbLatency = Date.now() - start;
    } else {
      dbStatus = "disconnected";
    }
  } catch (e) {
    dbStatus = "error: " + e.message;
  }

  const mem = process.memoryUsage();
  res.json({
    status: dbStatus === "connected" ? "healthy" : "degraded",
    uptimeSeconds: Math.floor(process.uptime()),
    database: { status: dbStatus, latencyMs: dbLatency },
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024)
    },
    nodeVersion: process.version,
    platform: process.platform,
    timestamp: new Date().toISOString()
  });
});

/* Client-side telemetry & error reporting endpoint (Accessible without auth to report frontend crashes) */
router.post(
  "/client-error",
  clientErrorLimiter,
  express.json({ limit: "16kb" }),
  async (req, res) => {
    try {
      if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({ error: "Invalid payload format" });
      }

      const { message, stack, info, userAgent, url } = req.body;
      if (!message && !stack) {
        return res.status(400).json({ error: "Missing required error message or stack trace" });
      }
      const msgStr = typeof message === "string" ? message : (message?.message || String(message || ""));
      if (msgStr.includes("WebAppMethodUnsupported")) {
        return res.json({ success: true, ignored: true });
      }

      let cleanEndpoint = "webapp:client";
      if (url && typeof url === "string") {
        try {
          const parsed = new URL(url);
          cleanEndpoint = (parsed.pathname || "/").slice(0, 200);
        } catch (_) {
          cleanEndpoint = String(url).split("#")[0].split("?")[0].slice(0, 200) || "webapp:client";
        }
      }

      // Sanitize context: strip any authorization tokens, passwords, secrets, cookies
      const cleanInfo = typeof info === "string" ? info.slice(0, 500) : (info && typeof info === "object" ? JSON.stringify(info).slice(0, 500) : "");
      const cleanUserAgent = typeof userAgent === "string" ? userAgent.slice(0, 300) : "";
      const cleanUrl = typeof url === "string" ? url.split("?")[0].slice(0, 500) : "";

      await captureError({
        error: {
          message: String(msgStr || "Unknown WebApp client error").slice(0, 500),
          stack: String(stack || "").slice(0, 2000)
        },
        source: "client",
        endpoint: cleanEndpoint,
        statusCode: 500,
        userId: String(req.headers["x-telegram-user-id"] || "client-user").slice(0, 100),
        context: { info: cleanInfo, userAgent: cleanUserAgent, url: cleanUrl }
      });

      res.json({ success: true });
    } catch (err) {
      res.status(200).json({ ok: false });
    }
  }
);

/* ========================================================= */
/* STANDALONE SESSION AUTHENTICATION & LOGIN / LOGOUT        */
/* ========================================================= */

/* Public Standalone Login endpoint: exchanges ADMIN_SECRET for a server-validated session cookie */
router.post("/auth/login", loginLimiter, validateBody(loginSchema), async (req, res) => {
  const secret = req.body?.secret || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7).trim() : null);
  if (!secret || !process.env.ADMIN_SECRET || process.env.ADMIN_SECRET.length < 8) {
    return res.status(401).json({ error: "Invalid administrator credentials" });
  }

  const cleanSecret = String(secret).trim();
  const envSecret = String(process.env.ADMIN_SECRET).trim();

  if (
    cleanSecret.length !== envSecret.length ||
    !crypto.timingSafeEqual(Buffer.from(cleanSecret), Buffer.from(envSecret))
  ) {
    return res.status(401).json({ error: "Invalid administrator credentials" });
  }

  const session = await createSession({
    userId: process.env.ADMIN_ID || "admin",
    role: "superadmin",
    userAgent: req.headers["user-agent"],
    ip: req.ip
  });

  res.cookie("spbc_session", session.sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 12 * 3600 * 1000,
    path: "/"
  });

  res.json({
    success: true,
    user: { id: session.userId, role: "superadmin", permissions: getDefaultPermissions("superadmin") },
    csrfToken: session.csrfToken
  });
});

/* Public Standalone Logout endpoint: requires CSRF token if cookie session is present, invalidates session and clears cookie */
router.post("/auth/logout", async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const cookieSessionId = cookies.spbc_session;

  if (cookieSessionId) {
    const session = await getSession(cookieSessionId);
    if (session) {
      const csrfHeader = req.headers["x-csrf-token"];
      if (!validateCsrfToken(session.csrfToken, csrfHeader)) {
        return res.status(403).json({ error: "Invalid or missing CSRF token" });
      }
      await destroySession(cookieSessionId);
    }
  }

  res.setHeader(
    "Set-Cookie",
    "spbc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
  );
  res.json({ success: true, message: "Logged out" });
});

/* Auth verification ping / login fallback for WebApp sessions (Supports GET & POST) */
router.all("/auth/verify", authVerifyLimiter, async (req, res, _next) => {
  // If request contains credentials (secret), delegate to login logic
  const candidateSecret = req.body?.secret || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7).trim() : null);
  if (candidateSecret && process.env.ADMIN_SECRET && candidateSecret.length === process.env.ADMIN_SECRET.length) {
    if (crypto.timingSafeEqual(Buffer.from(candidateSecret), Buffer.from(process.env.ADMIN_SECRET))) {
      const session = await createSession({
        userId: process.env.ADMIN_ID || "admin",
        role: "superadmin",
        userAgent: req.headers["user-agent"],
        ip: req.ip
      });

      res.cookie("spbc_session", session.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 12 * 3600 * 1000,
        path: "/"
      });

      return res.json({
        success: true,
        user: { id: session.userId, role: "superadmin", permissions: getDefaultPermissions("superadmin") },
        csrfToken: session.csrfToken
      });
    }
  }

  // Otherwise, verify session or TMA token
  return verifyTelegramWebAppData(req, res, async () => {
    let sessionCsrf = req.csrfToken || null;
    const cookies = parseCookies(req.headers.cookie);
    if (!cookies.spbc_session && req.user) {
      try {
        const session = await createSession({
          userId: String(req.user.telegramId || req.user.id || req.user._id || "admin"),
          role: req.user.role || "admin",
          userAgent: req.headers["user-agent"],
          ip: req.ip
        });
        sessionCsrf = session.csrfToken;
        res.cookie("spbc_session", session.sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 12 * 3600 * 1000,
          path: "/"
        });
      } catch (_) {}
    }

    res.json({
      success: true,
      user: req.user || { role: "admin" },
      csrfToken: sessionCsrf
    });
  });
});


/* 2. PROTECTED ADMIN ROUTES */
router.use(verifyTelegramWebAppData);

router.use(membersRoutes);
router.use(eventsRoutes);
router.use(tasksRoutes);
router.use(reportsRoutes);
router.use(templatesRoutes);
router.use(settingsRoutes);
router.use(greetingsRoutes);
router.use(usersRoutes);
router.use(errorsRoutes);

/* Catch-all error handler */
router.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err?.name === "ValidationError") {
    return res.status(400).json({ error: err.message });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: "A record with that name already exists" });
  }
  if (err?.name === "CastError") {
    return res.status(400).json({ error: "Invalid id" });
  }

  console.error("❌ API error:", err);
  res.status(500).json({ error: "Internal server error" });
});


export default router;
