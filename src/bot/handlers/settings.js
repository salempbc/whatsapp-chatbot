import { getSetting, setSetting } from "../../models/Settings.js";
import { restartScheduler, triggerNow } from "../../scheduler/dailyJob.js";
import { renderScreen } from "../ui.js";
import { setState } from "../session.js";

const settingsScreen = async () => {
  const sendTime = await getSetting("sendTime", "06:00");
  return {
    text: `⚙️ Settings\n\nDaily message time : ${sendTime} IST\nDay-before reminder: 20:00 IST (fixed)`,
    keyboard: [
      [{ text: "🕐 Change Send Time", callback_data: "settings:edittime" }],
      [{ text: "📨 Send Today Now",   callback_data: "settings:testsend" }],
      [{ text: "🏠 Home",             callback_data: "home:show" }]
    ]
  };
};

export const settingsCallbacks = {
  "settings:show": async ({ bot, chatId, messageId }) => {
    await renderScreen(bot, chatId, messageId, await settingsScreen());
  },

  "settings:edittime": async ({ bot, chatId, messageId }) => {
    setState(chatId, { type: "settings.editTime", messageId });
    await renderScreen(bot, chatId, messageId, {
      text: "Enter new send time in 24-hr format (e.g. 06:00 or 18:30):",
      keyboard: [[{ text: "❌ Cancel", callback_data: "settings:show" }]]
    });
  },

  "settings:testsend": async ({ bot, chatId, messageId }) => {
    await renderScreen(bot, chatId, messageId, {
      text: "⏳ Sending today'\''s messages...",
      keyboard: []
    });
    try {
      await triggerNow();
      await renderScreen(bot, chatId, messageId, {
        text: "✅ Done — today'\''s messages sent to the group.",
        keyboard: [[{ text: "🏠 Home", callback_data: "home:show" }]]
      });
    } catch (err) {
      await renderScreen(bot, chatId, messageId, {
        text: `❌ Error: ${err.message}`,
        keyboard: [[{ text: "🏠 Home", callback_data: "home:show" }]]
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

    await bot.sendMessage(chatId, `✅ Send time updated to ${text} IST. Scheduler restarted.`);
    await renderScreen(bot, chatId, state.messageId, await settingsScreen());
  }
};
