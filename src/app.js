import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "./config/db.js";
import { initWhatsApp } from "./bot/whatsappClient.js";
import { startScheduler } from "./scheduler/dailyJob.js";

/**
 * Main application entry point
 */
const startApp = async () => {
  try {
    console.log("🚀 Starting application...");

    // Connect to database
    await connectDB();

    // Initialize WhatsApp client
    initWhatsApp();

    // Start scheduler
    startScheduler();

  } catch (err) {
    console.error("❌ App startup error:", err);
    process.exit(1);
  }
};

startApp();