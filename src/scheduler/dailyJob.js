import cron from "node-cron";
import { getTodayEvents, buildMessage } from "../services/eventService.js";
import { getClient } from "../bot/whatsappClient.js";

export const startScheduler = () => {
  console.log("🧪 TEST MODE: starts 2:05 PM, every 1 min");

  cron.schedule("10-59/1 14 * * *", async () => {
    try {
      const client = getClient();

      if (!client) {
        console.log("Client not ready");
        return;
      }

      const events = await getTodayEvents();
      const message = buildMessage(events);

      if (!message) {
        console.log("No events today");
        return;
      }

      console.log("📤 Sending test message:\n", message);

      await client.sendMessage(process.env.GROUP_ID, message);

      console.log("✅ Message sent");

    } catch (err) {
      console.error("❌ Scheduler error:", err.message);
    }
  });
};