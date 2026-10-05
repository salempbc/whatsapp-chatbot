import "dotenv/config";
import express from "express";
import compression from "compression";
import cors from "cors";
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
import { captureError } from "./services/errorLogService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🚀 Starting application...");

const app = express();

/* Railway/Heroku-style single proxy in front of the app. Without this,
   express-rate-limit v7 refuses to trust X-Forwarded-For and every request
   looks like it comes from the same proxy IP. */
app.set("trust proxy", 1);

// Lightweight health check for uptime pingers (cron-job.org)
app.get("/ping", (req, res) => res.status(200).send("pong"));

/* --- 1. SECURITY & OPTIMIZATION MIDDLEWARE --- */
app.use(compression());
app.use(cors());

// Helmet for security headers (CSP disabled to allow Vue/Tailwind/Telegram CDNs)
app.use(helmet({ contentSecurityPolicy: false, xFrameOptions: false }));

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

/* --- 2. ROUTES --- */

/* Convenience admin shortcut — bookmark /admin to skip the auth modal in standalone browser.
   Redirects to the CMS SPA with the ADMIN_ID pre-filled as auth token via query param.
   Never expose ADMIN_SECRET via URL; ADMIN_ID is already shown in .env and used as passcode. */
app.get("/admin", (req, res) => {
  const adminId = process.env.ADMIN_ID || "";
  if (!adminId) {
    return res.status(503).send("ADMIN_ID not configured in server environment.");
  }
  // Redirect to the SPA root with auth token pre-set — the frontend reads ?auth= and stores it
  return res.redirect(`/?auth=${encodeURIComponent(adminId)}`);
});

app.use(express.static(path.join(__dirname, "../public")));

// Apply rate limiter specifically to /api
app.use("/api", apiLimiter, apiRouter);

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
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
      userAgent: req.headers["user-agent"]
    }
  }).catch(() => {});

  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

/* --- 3. SERVER BOOTSTRAP --- */
const PORT = process.env.PORT || 3000;
let server;

connectDB()
  .then(async () => {
    await loadAuthorizedUsersCache();
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

  /* Platforms SIGKILL after a grace period (~30s on Railway). Exit on our own
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

// Listen for Railway / PM2 / Docker termination signals
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

