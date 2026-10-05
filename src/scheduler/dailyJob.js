import Memorial from "../models/Memorial.js";
import { getTodayKey, getTomorrowKey, getTomorrowEvents } from "../services/eventService.js";
import { prepareTodayGreetings } from "../services/greetingService.js";
import { reviewSummaryScreen } from "../bot/handlers/review.js";
import { renderScreen } from "../bot/ui.js";
import cron from "node-cron";
import { sendAdminMessage, getBotInstance } from "../bot/index.js";
import { getSetting } from "../models/Settings.js";

let morningTask = null;
let reminderTask = null;
let monthlyBackupTask = null;

const runMonthlyBackupJob = async () => {
  try {
    const { createDatabaseDump } = await import("../services/backupService.js");
    const Member = (await import("../models/Member.js")).default;
    const adminId = process.env.ADMIN_ID;
    if (!adminId) return;

    const dump = await createDatabaseDump();
    const activeCount = await Member.countDocuments({ isDeleted: { $ne: true }, isActive: { $ne: false } });
    const bot = getBotInstance();

    if (bot) {
      await bot.sendDocument(adminId, dump.filePath, {
        caption: `🛡️ <b>Monthly Automated Backup & Health Check</b>\n\n` +
                 `• <b>Active Members:</b> ${activeCount}\n` +
                 `• <b>Total Records:</b> ${dump.totalRecords}\n` +
                 `• <b>Collections:</b> ${dump.collectionsCount}\n` +
                 `• <b>Backup Size:</b> ${(dump.sizeBytes / 1024).toFixed(1)} KB\n` +
                 `• <b>Status:</b> ✅ Database Healthy & Consistent`,
        parse_mode: "HTML"
      });
    }
    const fs = (await import("fs")).default;
    fs.unlink(dump.filePath, () => {});
  } catch (err) {
    console.error("❌ Monthly backup job error:", err.message);
  }
};

/**
 * Morning job:
 * 1. Prepares greeting drafts idempotently.
 * 2. Checks memorials today.
 * 3. Delivers a private review summary directly to the Admin chat.
 * 4. NEVER automatically broadcasts to CHAT_ID or WhatsApp.
 */
const runMorningJob = async () => {
  try {
    console.log("🌞 Morning greeting job triggered (Admin Review Mode)");
    const adminId = process.env.ADMIN_ID;
    if (!adminId) {
      console.error("❌ Cannot run morning job: ADMIN_ID is unset.");
      return 0;
    }

    const todayStr = getTodayKey();
    const todayMemorials = await Memorial.find({ date: todayStr });
    if (todayMemorials.length > 0) {
      let mText = "🕊️ <b>Memorial Anniversary Today</b>\n\n";
      todayMemorials.forEach(m => {
        mText += `- <b>${m.name}</b> ${m.relation ? "(" + m.relation + ")" : ""}\n`;
      });
      mText += "\n<i>Please remember the bereaved family in your prayers.</i>";
      await sendAdminMessage(mText);
    }

    // 1. Prepare today's greetings idempotently in GreetingLog
    const preparedLogs = await prepareTodayGreetings();

    // 2. Send private review card to admin
    const bot = getBotInstance();
    if (bot && adminId) {
      const summary = await reviewSummaryScreen();
      await renderScreen(bot, adminId, null, summary);
    }

    console.log(`✅ Morning job prepared ${preparedLogs.length} greeting cards for admin review.`);
    return preparedLogs.length;
  } catch (err) {
    console.error("❌ Morning job error:", err.message);
    throw err;
  }
};

const runReminderJob = async () => {
  try {
    const { birthdays, weddings } = await getTomorrowEvents();
    const tomorrowStr = getTomorrowKey();
    const tomorrowMemorials = await Memorial.find({ date: tomorrowStr });

    if (!birthdays.length && !weddings.length && tomorrowMemorials.length === 0) return;

    let text = "📅 🔔 <b>நாளைக் குறிப்புகள் (Admin Reminder):</b>\n\n";
    if (birthdays.length) {
      text += "🎂 <b>பிறந்தநாள்:</b>\n";
      for (const m of birthdays) text += `  🔹 ${m.name}\n`;
    }
    if (weddings.length) {
      text += "\n💍 <b>திருமண நாள்:</b>\n";
      for (const m of weddings) text += `  🔹 ${m.name} & ${m.spouseName || "அவர்கள்"}\n`;
    }

    if (tomorrowMemorials.length > 0) {
      text += "\n🕊️ <b>Memorials Tomorrow:</b>\n";
      tomorrowMemorials.forEach(m => {
        text += `  - ${m.name} ${m.relation ? "(" + m.relation + ")" : ""}\n`;
      });
    }

    await sendAdminMessage(text);
    console.log("🔔 Day-before reminder sent privately to admin");
  } catch (err) {
    console.error("❌ Reminder job error:", err.message);
  }
};

export const triggerNow = async () => {
  return await runMorningJob();
};

const stopAll = () => {
  if (morningTask) { morningTask.stop(); morningTask = null; }
  if (reminderTask) { reminderTask.stop(); reminderTask = null; }
  if (monthlyBackupTask) { monthlyBackupTask.stop(); monthlyBackupTask = null; }
};

const toCron = (value, fallback) => {
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value ?? "")) ? String(value) : fallback;
  if (time !== value) {
    console.warn(`ℹ️ Invalid schedule time ${JSON.stringify(value)}, falling back to ${fallback}`);
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
  // Runs on the 1st day of every month at 06:15 IST
  monthlyBackupTask = cron.schedule("15 6 1 * *", runMonthlyBackupJob, { timezone: "Asia/Kolkata" });

  console.log(`⏰ Scheduler started (${morning.time} IST daily + ${reminder.time} IST reminder + Monthly Backup)`);
};

export const restartScheduler = async () => {
  await startScheduler();
};
