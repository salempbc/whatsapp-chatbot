import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "./config/db.js";
import { initTelegram } from "./bot/telegramClient.js";
import { startScheduler } from "./scheduler/dailyJob.js";

const startApp = async () => {
  console.log("🚀 Starting application...");

  await connectDB();

  initTelegram();   // ✅ Telegram only
  startScheduler(); // ✅ Scheduler

};

startApp();