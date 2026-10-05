import { getSetting, setSetting } from "../../models/Settings.js";
import { restartScheduler, triggerNow } from "../../scheduler/dailyJob.js";
import { renderScreen } from "../ui.js";
import { setState } from "../session.js";
import { sendAdminMessage } from "../index.js";

const settingsScreen = async () => {
  const sendTime = await getSetting("sendTime", "06:00");
  const reminderTime = await getSetting("reminderTime", "20:00");
  return {
    text: `⚙️ <b>System Settings & Diagnostics</b>\n\n` +
          `• <b>Morning Review Dispatch:</b> ${sendTime} IST (Private Admin Chat)\n` +
          `• <b>Day-Before Reminder:</b> ${reminderTime} IST\n` +
          `• <b>Broadcast Mode:</b> Manual Admin WhatsApp Approval Only\n`,
    keyboard: [
      [{ text: "🕐 Change Morning Time", callback_data: "settings:edittime" }],
      [{ text: "🌅 Run Morning Scan Now",   callback_data: "settings:testsend" }],
      [{ text: "🔔 Test Admin Ping", callback_data: "settings:ping" }],
      [{ text: "🏠 Return to Dashboard", callback_data: "home:show" }]
    ]
  };
};

export const settingsCallbacks = {
  "settings:show": async ({ bot, chatId, messageId }) => {
    await renderScreen(bot, chatId, messageId, await settingsScreen());
  },

  "settings:ping": async ({ bot, chatId, messageId }) => {
    try {
      await sendAdminMessage("🔧 <b>Admin Ping Test</b>\nThis verifies that direct administrative notifications and review reminders are functioning correctly.");
      await renderScreen(bot, chatId, messageId, {
        text: "✅ Ping sent successfully to your private Admin chat!",
        keyboard: [[{ text: "🔙 Back", callback_data: "settings:show" }]]
      });
    } catch (err) {
      await renderScreen(bot, chatId, messageId, {
        text: `❌ Failed to send admin ping: ${err.message}`,
        keyboard: [[{ text: "🔙 Back", callback_data: "settings:show" }]]
      });
    }
  },

  "settings:edittime": async ({ bot, chatId, messageId }) => {
    setState(chatId, { type: "settings.editTime", messageId });
    await renderScreen(bot, chatId, messageId, {
      text: "Enter new morning review time in 24-hr format (e.g. 06:00 or 07:30):",
      keyboard: [[{ text: "❌ Cancel", callback_data: "settings:show" }]]
    });
  },

  "settings:testsend": async ({ bot, chatId, messageId }) => {
    await renderScreen(bot, chatId, messageId, {
      text: "⏳ Running today's morning celebration scan...",
      keyboard: []
    });
    try {
      const count = await triggerNow();
      
      let text = `✅ Scan complete — prepared ${count} celebrations for your review.`;
      if (count === 0) {
        text = "ℹ️ No birthdays or wedding anniversaries found for today.";
      }

      await renderScreen(bot, chatId, messageId, {
        text,
        keyboard: [
          [{ text: "📋 Open Review Deck", callback_data: "review:summary" }],
          [{ text: "🏠 Return to Dashboard", callback_data: "home:show" }]
        ]
      });
    } catch (err) {
      await renderScreen(bot, chatId, messageId, {
        text: `❌ Error during scan: ${err.message}`,
        keyboard: [[{ text: "🏠 Return to Dashboard", callback_data: "home:show" }]]
      });
    }
  }
};

export const settingsStateHandlers = {
  "settings.editTime": async ({ bot, chatId, text, state }) => {
    if (!/^\d{2}:\d{2}$/.test(text)) {
      return bot.sendMessage(chatId, "❌ Invalid format. Use HH:MM e.g. 06:00");
    }
    const [h, m] = text.split(":").map(Number);
    if (h > 23 || m > 59) {
      return bot.sendMessage(chatId, "❌ Invalid time value.");
    }

    await setSetting("sendTime", text);
    await restartScheduler();

    await bot.sendMessage(chatId, `✅ Morning review dispatch time updated to ${text} IST. Scheduler reloaded.`);
    await renderScreen(bot, chatId, state.messageId, await settingsScreen());
  }
};
