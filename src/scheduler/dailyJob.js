import cron from "node-cron";
import { getTodayEvents, buildMessage } from "../services/eventService.js";
import { getClient } from "../bot/whatsappClient.js";

const client = getClient();

if (!client) {
  console.log("Client not ready");
  return;
}

await client.sendMessage(process.env.GROUP_ID, message);

/**
 * Tracks last sent date to prevent duplicates
 */
let lastSentDate = null;

/**
 * Start daily scheduler
 */
export const startScheduler = () => {
  console.log("📅 Scheduler started (runs at 8:00 AM daily)");

  cron.schedule("0 8 * * *", async () => {
    console.log("⏰ Running daily job...");

    try {
      const today = new Date().toDateString();

      // Prevent duplicate sends (important for restarts)
      if (lastSentDate === today) {
        console.log("⚠️ Already sent today, skipping...");
        return;
      }

      // Ensure WhatsApp is ready
      if (!client.info) {
        console.log("⚠️ WhatsApp not ready yet, skipping...");
        return;
      }

      // Fetch today's events
      const events = await getTodayEvents();
      const message = buildMessage(events);

      // If no events → do nothing
      if (!message) {
        console.log("ℹ️ No events today");
        return;
      }

      // Safety delay (avoid bot-like behavior)
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Send message to group
      await client.sendMessage(process.env.GROUP_ID, message);

      console.log("✅ Message sent successfully");
      lastSentDate = today;

    } catch (err) {
      console.error("❌ Scheduler error:", err);
    }
  });
};