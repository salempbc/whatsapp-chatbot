import cron from "node-cron";
import { getTodayEvents, buildMessages } from "../services/eventService.js";
import { sendMessage } from "../bot/index.js";

export const startScheduler = () => {
  console.log("📅 Scheduler started (6:00 AM IST)");

  cron.schedule("0 6 * * *", async () => {
    try {
      console.log("⏱️ CRON TRIGGERED");

      const events = await getTodayEvents();
      const messages = await buildMessages(events);

      if (!messages.length) {
        console.log("⚠️ No events today");
        return;
      }

      /* ✅ SEND ONE BY ONE (PHOTO SUPPORT) */
      let sent = 0;
      for (const m of messages) {
        try {
          await sendMessage(m.text, { photo: m.photo });
          sent++;
        } catch (sendErr) {
          console.error("❌ Failed to send one message:", sendErr.message);
        }
      }

      console.log(`✅ ${sent}/${messages.length} messages sent`);

    } catch (err) {
      console.error("❌ Scheduler error:", err.message);
    }
  }, { timezone: "Asia/Kolkata" });
};