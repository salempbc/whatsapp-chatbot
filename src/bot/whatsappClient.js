import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

const { Client, LocalAuth } = pkg;

export const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: "./session"
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

export const initWhatsApp = () => {
  console.log("🚀 Starting WhatsApp...");

  client.on("qr", (qr) => {
    console.log("\n================ QR START ================\n");

    // 1) RAW STRING (always works)
    console.log("RAW_QR:\n", qr, "\n");

    // 2) ASCII QR (may break on Railway, but try)
    console.log("ASCII QR:\n");
    qrcode.generate(qr, { small: true });

    console.log("\n================ QR END ==================\n");
  });

  client.on("ready", () => {
    console.log("✅ WhatsApp bot is ready");
  });

  client.on("auth_failure", (msg) => {
    console.error("❌ Auth failure:", msg);
  });

  client.on("disconnected", (reason) => {
    console.warn("⚠️ Disconnected:", reason);
  });

  client.initialize();
};