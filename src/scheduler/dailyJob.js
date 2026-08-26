import Memorial from "../models/Memorial.js";
import { getTodayKey, getTomorrowKey } from "../services/eventService.js";
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
    
    const todayStr = getTodayKey();
    const todayMemorials = await Memorial.find({ date: todayStr });
    if (todayMemorials.length > 0) {
      let mText = "🕊️ *Memorial Anniversary Today*\n\n";
      todayMemorials.forEach(m => {
        mText += `- ${m.name} ${m.relation ? "(" + m.relation + ")" : ""}\n`;
      });
      mText += "\n_Please keep the family in your prayers and reach out to them._";
      await sendAdminMessage(mText);
    }

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

    
    const tomorrowStr = getTomorrowKey();
    const tomorrowMemorials = await Memorial.find({ date: tomorrowStr });
    if (tomorrowMemorials.length > 0) {
      text += "\n🕊️ *Memorials Tomorrow:*\n";
      tomorrowMemorials.forEach(m => {
        text += `  - ${m.name} ${m.relation ? "(" + m.relation + ")" : ""}\n`;
      });
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

/* A stored value that is not HH:MM would build an invalid cron expression and
   throw after stopAll() has already run — leaving both jobs dead until the next
   deploy. Fall back to the default instead. */
const toCron = (value, fallback) => {
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value ?? "")) ? String(value) : fallback;
  if (time !== value) {
    console.warn(`⚠️ Invalid schedule time ${JSON.stringify(value)}, falling back to ${fallback}`);
  }
  const [hh, mm] = time.split(":");
  return { cron: `${Number(mm)} ${Number(hh)} * * *`, time };
};

export const startScheduler = async () => {
  stopAll();

  const morning = toCron(await getSetting("sendTime", "06:00"), "06:00");
  const reminder = toCron(await getSetting("reminderTime", "20:00"), "20:00");

  morningTask = cron.schedule(morning.cron, runMorningJob, { timezone: "Asia/Kolkata" });
  reminderTask = cron.schedule(reminder.cron, runReminderJob, { timezone: "Asia/Kolkata" });

  console.log(`⏱️ Scheduler started (${morning.time} IST daily + ${reminder.time} IST reminder)`);
};

export const restartScheduler = async () => {
  await startScheduler();
};
