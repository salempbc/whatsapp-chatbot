import dotenv from "dotenv";
dotenv.config();

import http from "http";
import { connectDB, disconnectDB } from "./config/db.js";
import { initTelegram, stopTelegram } from "./bot/index.js";
import { startScheduler } from "./scheduler/dailyJob.js";

/* ── Render free tier requires an HTTP listener ── */
const PORT = process.env.PORT || 3000;
http.createServer((_, res) => res.end("OK")).listen(PORT, () =>
  console.log(`🌐 Health-check server on :${PORT}`)
);

const REQUIRED_ENV = ["MONGO_URI", "BOT_TOKEN", "CHAT_ID"];

const assertEnv = () => {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

  if (missing.length) {
    console.error(`❌ Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }
};

const startApp = async () => {
  console.log("🚀 Starting application...");

  assertEnv();
  await connectDB();

  initTelegram();
  startScheduler();
};

const shutdown = async (signal) => {
  console.log(`\n🛑 ${signal} received, shutting down...`);

  try {
    await stopTelegram();
    await disconnectDB();
  } catch (err) {
    console.error("❌ Error during shutdown:", err.message);
  }

  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startApp();
