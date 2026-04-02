import cron from "node-cron";
import { getTodayEvents, buildMessage } from "../services/eventService.js";
import { sendMessage } from "../bot/telegramClient.js";

export const startScheduler = () => {
  console.log("⏰ Scheduler set for 6:00 AM IST daily");

  cron.schedule("0 6 * * *", async () => {
    console.log("⏱️ CRON TRIGGERED");

    try {
      const events = await getTodayEvents();
      const message = await buildMessage(events);

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