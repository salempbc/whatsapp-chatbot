import cron from "node-cron";
import { getTodayEvents, buildMessage } from "../services/eventService.js";
import { sendMessage } from "../bot/telegramClient.js";

export const startScheduler = () => {
  console.log("🧪 TEST MODE: starts 3:08 PM IST, runs every 1 min");

  cron.schedule("8-59/1 15 * * *", async () => {
    console.log("⏱️ CRON TRIGGERED:", new Date().toLocaleTimeString());

    try {
      const events = await getTodayEvents();
      const message = buildMessage(events);

      if (!message) {
        console.log("⚠️ No events today");
        return;
      }

      console.log("📤 Sending Telegram message:\n", message);

      await sendMessage(message);

      console.log("✅ Message sent");

    } catch (err) {
      console.error("❌ Scheduler error:", err.message);
    }
  });
};