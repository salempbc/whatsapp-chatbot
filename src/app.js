import "dotenv/config";
import express from "express";
import compression from "compression";
import cors from "cors";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { initTelegram, stopTelegram, waitForQueueToDrain } from "./bot/index.js";
import { startScheduler } from "./scheduler/dailyJob.js";
import apiRouter from "./api/index.js";
import { connectDB } from "./config/db.js";
import { initLogger } from "./config/logger.js";
import { loadAuthorizedUsersCache } from "./services/userService.js";
import { ensureMemberStatusIntegrity } from "./services/memberService.js";
import { captureError } from "./services/errorLogService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🚀 Starting application...");

const app = express();

/* Standard reverse proxy setup. Trust the first hop (Render / cloud edge proxy)
   so express-rate-limit correctly resolves client IP from X-Forwarded-For. */
app.set("trust proxy", 1);

// Lightweight health check for uptime pingers (cron-job.org)
app.get("/ping", (req, res) => res.status(200).send("pong"));

/* Readiness probe: 200 only while the database connection is up, so the
   platform stops routing traffic during a DB outage or shutdown. */
app.get("/readyz", (req, res) => {
  const ready = mongoose.connection.readyState === 1 && !shuttingDown;
  res.status(ready ? 200 : 503).json({ ready });
});

/* Correlate logs and error reports with a per-request id (echoed to the client). */
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
});

/* --- 1. SECURITY & OPTIMIZATION MIDDLEWARE --- */
app.use(compression());
/* The admin UI is served from the same origin, so cross-origin access is only
   granted to the configured WEBAPP_URL; everything else is same-origin only. */
const allowedOrigin = (() => {
  try {
    return process.env.WEBAPP_URL ? new URL(process.env.WEBAPP_URL).origin : false;
  } catch (_) {
    return false;
  }
})();
app.use(cors({ origin: allowedOrigin, credentials: true }));

// Helmet for security headers with Content Security Policy and iframe compatibility for Telegram WebApp
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://telegram.org"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https://telegram.org", "https://*.telegram.org", "https://api.telegram.org"],
      frameAncestors: ["'self'", "https://web.telegram.org", "https://*.telegram.org", "https://telegram.org"]
    }
  },
  xFrameOptions: false
}));

// Recursive sanitizer to strip MongoDB query operator keys starting with '$' or containing '.'
const sanitizeMongoInput = (obj) => {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      sanitizeMongoInput(obj[key]);
    }
  }
};

app.use((req, res, next) => {
  if (req.body) sanitizeMongoInput(req.body);
  if (req.query) sanitizeMongoInput(req.query);
  if (req.params) sanitizeMongoInput(req.params);
  next();
});

// Rate limiter for API routes to prevent DDoS / Spam
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  /* Telegram delivers every update from a small pool of IPs and the endpoint is
     already protected by the webhook secret, so throttling it only drops
     legitimate messages. */
  skip: (req) => req.path === "/bot-webhook",
  message: { error: "Too many requests, please try again later." }
});

// Rate limiter for SPA page fallback routes
const pageLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." }
});

/* --- 2. ROUTES --- */

/* Admin route — redirects cleanly to SPA root without credential exposure */
app.get("/admin", (req, res) => {
  return res.redirect("/");
});

/* The frontend is built by Vite into dist/ (hashed, immutable assets). */
const distDir = path.join(__dirname, "../dist");

/* The service worker and HTML shell must never be served stale; hashed assets are immutable. */
app.get("/sw.js", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  next();
});

app.use(express.static(distDir, {
  setHeaders: (res, filePath) => {
    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache");
    }
  }
}));

// Apply rate limiter specifically to /api
/* /api/v1 is the stable versioned prefix; /api remains as a backwards-compatible alias. */
app.use(["/api/v1", "/api"], apiLimiter, apiRouter);

app.get("*", pageLimiter, (req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

/* Catch-all global Express error handler */
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Malformed JSON payload" });
  }
  if (err?.name === "CastError") {
    return res.status(400).json({ error: "Invalid resource identifier format" });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Payload exceeds size limit (max 15MB)" });
  }

  console.error("💥 [EXPRESS ERROR]:", err?.stack || err?.message || err);

  // Capture error into database for CMS audit & debugging
  captureError({
    error: err,
    source: "express",
    endpoint: req.originalUrl || req.path,
    method: req.method,
    statusCode: err.status || 500,
    userId: req.user?.id || req.headers["x-telegram-user-id"] || "client",
    userName: req.user?.username || "",
    context: {
      params: req.params,
      query: req.query,
      ip: req.ip,
      requestId: req.id,
      userAgent: req.headers["user-agent"]
    }
  }).catch(() => {});

  if (res.headersSent) return next(err);
  const statusCode = Number(err.status) || 500;
  const clientMessage = (statusCode >= 500 && process.env.NODE_ENV === "production")
    ? "Internal server error"
    : (err.message || "Internal server error");
  res.status(statusCode).json({ error: clientMessage });
});

/* --- 3. SERVER BOOTSTRAP --- */
const PORT = process.env.PORT || 3000;
let server;

connectDB()
  .then(async () => {
    await loadAuthorizedUsersCache();
    await ensureMemberStatusIntegrity();
    initTelegram();
    startScheduler();
    server = app.listen(PORT, () => console.log(`🌍 Web Server & API listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error("💥 Fatal DB connection error:", err);
  });

/* --- 4. GRACEFUL SHUTDOWN (DATA INTEGRITY) --- */
let shuttingDown = false;

const shutdown = async (signal) => {
  /* A second SIGTERM must not run the sequence twice. */
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  /* Cloud platforms SIGKILL after a grace period (~30s). Exit on our own
     terms first so we never die halfway through closing the DB connection. */
  const hardExit = setTimeout(() => {
    console.error("⚠️ Graceful shutdown timed out after 20s, exiting now.");
    process.exit(1);
  }, 20000);
  hardExit.unref();

  if (server) {
    console.log("🔌 Closing HTTP server...");
    server.close();
  }

  // 1. Drain any pending messages to Telegram
  await waitForQueueToDrain();

  // 2. Stop Telegram bot (polling/webhook)
  await stopTelegram();

  // 3. Safely disconnect database
  if (mongoose.connection.readyState === 1) {
    console.log("💾 Disconnecting MongoDB...");
    await mongoose.connection.close();
  }

  console.log("✅ Shutdown complete. Exiting.");
  process.exit(0);
};

// Listen for process termination signals (SIGTERM / SIGINT)
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

// Process-level unhandled exception safety net (resilient crash guard)
process.on("uncaughtException", (err) => {
  console.error("💥 [UNCAUGHT EXCEPTION]:", err?.stack || err?.message || err);
  captureError({
    error: err,
    source: "system",
    endpoint: "process:uncaughtException"
  }).catch(() => {});
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 [UNHANDLED REJECTION]:", reason?.stack || reason?.message || reason);
  captureError({
    error: reason instanceof Error ? reason : new Error(String(reason)),
    source: "system",
    endpoint: "process:unhandledRejection"
  }).catch(() => {});
});

