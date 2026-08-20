import cron from "node-cron";
import { getTodayEvents, buildMessages, getTomorrowEvents } from "../services/eventService.js";
import { sendMessage, sendAdminMessage } from "../bot/index.js";
import { getSetting } from "../models/Settings.js";

let morningTask = null;
let reminderTask = null;

/* ===== MORNING JOB — send today's messages to group ===== */
const runMorningJob = async () => {
  try {
    console.log("⏱️ Morning cron triggered");
    const events = await getTodayEvents();
    const messages = await buildMessages(events);

    if (!messages.length) {
      console.log("⚠️ No events today");
      return 0;
    }

    let sent = 0;
    for (const msg of messages) {
      try {
        await sendMessage(msg.text, { photo: msg.photo });
        sent++;
      } catch (err) {
        console.error("❌ Failed to send message:", err.message);
      }
    }
    console.log(`✅ ${sent}/${messages.length} messages sent`);
    return sent;
  } catch (err) {
    console.error("❌ Scheduler error:", err.message);
    throw err;
  }
};

/* ===== REMINDER JOB — notify admin the night before ===== */
const runReminderJob = async () => {
  try {
    const { birthdays, weddings } = await getTomorrowEvents();
    if (!birthdays.length && !weddings.length) return;

    let text = "📅 நாளை நினைவூட்டல்:\n\n";
    if (birthdays.length) {
      text += "🎂 பிறந்தநாள்:\n";
      for (const m of birthdays) text += `  • ${m.name}\n`;
    }
    if (weddings.length) {
      text += "\n💍 திருமண நாள்:\n";
      for (const m of weddings) text += `  • ${m.name} & ${m.spouseName || "?"}\n`;
    }

    await sendAdminMessage(text);
    console.log("📬 Day-before reminder sent to admin");
  } catch (err) {
    console.error("❌ Reminder job error:", err.message);
  }
};

/* ===== PUBLIC: manual test trigger ===== */
export const triggerNow = async () => {
  return await runMorningJob();
};

/* ===== START / RESTART ===== */
const stopAll = () => {
  if (morningTask) { morningTask.stop(); morningTask = null; }
  if (reminderTask) { reminderTask.stop(); reminderTask = null; }
};

export const startScheduler = async () => {
  stopAll();

  const sendTime = await getSetting("sendTime", "06:00");
  const [hh, mm] = sendTime.split(":");
  const morningCron = `${mm} ${hh} * * *`;

  const reminderTime = await getSetting("reminderTime", "20:00");
  const [rhh, rmm] = reminderTime.split(":");
  const reminderCron = `${rmm} ${rhh} * * *`;

  morningTask = cron.schedule(morningCron, runMorningJob, { timezone: "Asia/Kolkata" });
  reminderTask = cron.schedule(reminderCron, runReminderJob, { timezone: "Asia/Kolkata" });

  console.log(`⏱️ Scheduler started (${sendTime} IST daily + ${reminderTime} IST reminder)`);
};

export const restartScheduler = async () => {
  await startScheduler();
};
