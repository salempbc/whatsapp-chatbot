import cron from "node-cron";
import { getTodayEvents, buildMessage } from "../services/eventService.js";
import { sendMessage } from "../bot/telegramClient.js";

export const startScheduler = () => {
  console.log("📅 Scheduler started (6:00 AM IST)");

  cron.schedule("0 6 * * *", async () => {
    try {
      console.log("⏱️ CRON TRIGGERED");

      const events = await getTodayEvents();
      const message = await buildMessage(events);

      if (!message) {
        console.log("⚠️ No events today");
        return;
      }

      await sendMessage(message);

    } catch (err) {
      console.error("❌ Scheduler error:", err.message);
    }
  });
};