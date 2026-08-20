import { isAdmin } from "./guard.js";
import { getState, clearState } from "./session.js";
import { homeCallbacks } from "./handlers/home.js";
import { membersCallbacks, membersStateHandlers, handlePhotoUpload } from "./handlers/members.js";
import { templatesCallbacks, templatesStateHandlers } from "./handlers/templates.js";
import { calendarCallbacks } from "./handlers/calendar.js";
import { exportCallbacks } from "./handlers/export.js";
import { upcomingCallbacks } from "./handlers/upcoming.js";

import { statsCallbacks } from "./handlers/stats.js";
import { settingsCallbacks, settingsStateHandlers } from "./handlers/settings.js";

const callbackRoutes = {
  ...homeCallbacks,
  ...membersCallbacks,
  ...templatesCallbacks,
  ...calendarCallbacks,
  ...exportCallbacks,
  ...upcomingCallbacks,
  ...statsCallbacks,
  ...settingsCallbacks
};

const stateRoutes = {
  ...membersStateHandlers,
  ...templatesStateHandlers,
  ...settingsStateHandlers
};

export const registerRouter = (bot) => {
  bot.on("callback_query", async (q) => {
    if (!q.data || !q.message) return;

    const chatId = q.message.chat.id;
    const messageId = q.message.message_id;

    bot.answerCallbackQuery(q.id).catch(() => {});

    if (!isAdmin(q.from.id)) {
      return bot.sendMessage(chatId, "❌ Unauthorized");
    }

    const [ns, action, ...args] = q.data.split(":");
    const handler = callbackRoutes[`${ns}:${action}`];
    if (!handler) {
      bot.answerCallbackQuery(q.id).catch(() => {});
      return;
    }

    try {
      const toast = await handler({ bot, chatId, messageId, args, query: q });
      if (typeof toast === "string") {
        bot.answerCallbackQuery(q.id, { text: toast }).catch(() => {});
      } else {
        bot.answerCallbackQuery(q.id).catch(() => {});
      }
    } catch (err) {
      console.error(`❌ Callback error [${ns}:${action}]:`, err.message);
      bot.answerCallbackQuery(q.id, { text: "❌ Error" }).catch(() => {});
      bot.sendMessage(chatId, "❌ Something went wrong");
    }
  });

  bot.on("message", async (msg) => {
    if (!msg.text || !isAdmin(msg.from.id)) return;

    const chatId = msg.chat.id;

    if (msg.text.startsWith("/")) {
      clearState(chatId);
      return;
    }

    const state = getState(chatId);
    if (!state) return;

    const handler = stateRoutes[state.type];
    if (!handler) return;

    try {
      await handler({ bot, chatId, text: msg.text.trim(), state });
    } catch (err) {
      console.error(`❌ State handler error [${state.type}]:`, err.message);
      clearState(chatId);
      bot.sendMessage(chatId, "❌ Something went wrong");
    }
  });

  bot.on("photo", async (msg) => {
    if (!isAdmin(msg.from.id)) return;

    const chatId = msg.chat.id;
    const state = getState(chatId);
    if (!state || state.type !== "members.photo") return;

    try {
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      await handlePhotoUpload({ bot, chatId, fileId, state });
    } catch (err) {
      console.error("❌ Photo save error:", err.message);
      clearState(chatId);
      bot.sendMessage(chatId, "❌ Could not save photo");
    }
  });
};
