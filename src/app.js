import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "./config/db.js";
import { initWhatsApp } from "./bot/whatsappClient.js";
import { startScheduler } from "./scheduler/dailyJob.js";

const startApp = async () => {
  console.log("🚀 Starting application...");

  // 1. Connect DB FIRST (required for RemoteAuth)
  await connectDB();

  // 2. Start WhatsApp (uses Mongo session)
  await initWhatsApp();

  // 3. Start scheduler
  startScheduler();
};

startApp();