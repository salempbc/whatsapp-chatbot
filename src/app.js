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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🚀 Starting application...");

const app = express();

/* Railway/Heroku-style single proxy in front of the app. Without this,
   express-rate-limit v7 refuses to trust X-Forwarded-For and every request
   looks like it comes from the same proxy IP. */
app.set("trust proxy", 1);

/* --- 1. SECURITY & OPTIMIZATION MIDDLEWARE --- */
app.use(compression());
app.use(cors());

// Helmet for security headers (CSP disabled to allow Vue/Tailwind/Telegram CDNs)
app.use(helmet({ contentSecurityPolicy: false }));

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
app.use(express.static(path.join(__dirname, "../public")));

// Apply rate limiter specifically to /api
app.use("/api", apiLimiter, apiRouter);

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

/* --- 3. SERVER BOOTSTRAP --- */
const PORT = process.env.PORT || 3000;
let server;

connectDB().then(() => {
  initTelegram();
  startScheduler();
  server = app.listen(PORT, () => console.log(`🌍 Web Server & API listening on port ${PORT}`));
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
