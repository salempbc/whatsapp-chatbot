import cron from "node-cron";
import { getTodayEvents, buildMessage } from "../services/eventService.js";
import { sendMessage } from "../bot/telegramClient.js";

export const startScheduler = () => {
  console.log("🧪 TEST MODE: starts 2:55 PM IST, runs every 1 min");

  cron.schedule("55-59/1 14 * * *", async () => {
    try {
      const events = await getTodayEvents();
      const message = buildMessage(events);

      if (!message) {
        console.log("No events today");
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