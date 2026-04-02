import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import mongoose from "mongoose";
import { MongoStore } from "wwebjs-mongo";

const { Client, RemoteAuth } = pkg;

let client;

/**
 * Initialize WhatsApp with RemoteAuth
 */
export const initWhatsApp = async () => {
  console.log("🚀 Starting WhatsApp (RemoteAuth)...");

  // Create Mongo store (uses existing mongoose connection)
  const store = new MongoStore({ mongoose });

  client = new Client({
    authStrategy: new RemoteAuth({
      store: store,
      backupSyncIntervalMs: 300000 // 5 min
    }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    }
  });

  // QR (ONLY FIRST TIME)
  client.on("qr", (qr) => {
    console.log("\n========== SCAN QR (ONE TIME) ==========\n");

    console.log("RAW_QR:\n", qr, "\n");

    qrcode.generate(qr, { small: true });

    console.log("\n========================================\n");
  });

  client.on("ready", () => {
    console.log("✅ WhatsApp bot is ready (RemoteAuth)");
  });

  client.on("remote_session_saved", () => {
    console.log("💾 Session saved to MongoDB");
  });

  client.on("auth_failure", (msg) => {
    console.error("❌ Auth failure:", msg);
  });

  client.on("disconnected", (reason) => {
    console.warn("⚠️ Disconnected:", reason);
  });

  await client.initialize();

  return client;
};

/**
 * Export getter (for scheduler)
 */
export const getClient = () => client;