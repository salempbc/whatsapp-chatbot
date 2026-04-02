import cron from "node-cron";
import { getTodayEvents, buildMessage } from "../services/eventService.js";
import { sendMessage } from "../bot/telegramClient.js";

export const startScheduler = () => {
  console.log("🧪 TEST MODE: starts 3:30 PM IST");

  cron.schedule("30-59/1 15 * * *", async () => {
    console.log("⏱️ CRON TRIGGERED");

    try {
      const events = await getTodayEvents();
      const message = buildMessage(events);

      if (!message) {
        console.log("⚠️ No events today");
        return;
      }

      await sendMessage(message);

      console.log("✅ Message sent");
    } catch (err) {
      console.error("❌ Scheduler error:", err.message);
    }
  });
};