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
import { reviewCallbacks, reviewStateHandlers } from "./handlers/review.js";
import { eventsCallbacks, eventsStateHandlers } from "./handlers/events.js";
import { tasksCallbacks, tasksStateHandlers } from "./handlers/tasks.js";
import { bulletinCallbacks } from "./handlers/bulletin.js";
import { usersCallbacks } from "./handlers/users.js";

const callbackRoutes = {
  ...homeCallbacks,
  ...membersCallbacks,
  ...templatesCallbacks,
  ...calendarCallbacks,
  ...exportCallbacks,
  ...upcomingCallbacks,
  ...statsCallbacks,
  ...settingsCallbacks,
  ...reviewCallbacks,
  ...eventsCallbacks,
  ...tasksCallbacks,
  ...bulletinCallbacks,
  ...usersCallbacks
};

const stateRoutes = {
  ...membersStateHandlers,
  ...templatesStateHandlers,
  ...settingsStateHandlers,
  ...reviewStateHandlers,
  ...eventsStateHandlers,
  ...tasksStateHandlers
};

import { captureError } from "../services/errorLogService.js";

export const resolveCallbackHandler = (callbackData, routes = callbackRoutes) => {
  if (!callbackData) return { handler: null, args: [] };

  // 1. Check exact full match (e.g., "events:add:start", "tasks:add:start", "auth:approve")
  if (routes[callbackData]) {
    return { handler: routes[callbackData], args: [] };
  }

  // 2. Progressive prefix matching from longest prefix to shortest
  const parts = callbackData.split(":");
  for (let i = parts.length - 1; i >= 1; i--) {
    const routeKey = parts.slice(0, i).join(":");
    if (routes[routeKey]) {
      return { handler: routes[routeKey], args: parts.slice(i) };
    }
  }

  return { handler: null, args: [] };
};

export const registerRouter = (bot) => {
  bot.on("callback_query", async (q) => {
    if (!q.data || !q.message) return;

    const chatId = q.message.chat.id;
    const messageId = q.message.message_id;

    // Allow public access request button; all other actions require admin privileges
    const isPublicCallback = q.data.startsWith("auth:request");
    if (!isPublicCallback && !isAdmin(q.from?.id)) {
      bot.answerCallbackQuery(q.id, { text: "❌ Unauthorized access", show_alert: true }).catch(() => {});
      return;
    }

    const { handler, args } = resolveCallbackHandler(q.data, callbackRoutes);
    if (!handler) {
      console.warn(`⚠️ Unhandled callback route: [${q.data}]`);
      bot.answerCallbackQuery(q.id, { text: "⚠️ Unknown or obsolete action" }).catch(() => {});
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
      if (!/message is not modified/i.test(err.message)) {
        console.error(`❌ Callback error [${q.data}]:`, err.message);
        captureError({
          error: err,
          source: "telegram",
          endpoint: `callback:${q.data}`,
          userId: String(q.from?.id || chatId),
          userName: [q.from?.first_name, q.from?.last_name].filter(Boolean).join(" ") || q.from?.username || "",
          context: {
            callbackData: q.data,
            chatId,
            messageId,
            user: q.from
          }
        }).catch(() => {});

        bot.sendMessage(chatId, "❌ Something went wrong while processing your request. Please try again or type /menu.").catch(() => {});
      }
      bot.answerCallbackQuery(q.id, { text: "⚠️ Error occurred" }).catch(() => {});
    }
  });

  bot.on("message", async (msg) => {
    if (!msg.text) return;
    if (!isAdmin(msg.from?.id)) {
      return;
    }

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
      captureError({
        error: err,
        source: "telegram",
        endpoint: `state:${state.type}`,
        userId: String(msg.from?.id || chatId),
        userName: [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || msg.from?.username || "",
        context: {
          state,
          text: msg.text?.slice(0, 200)
        }
      }).catch(() => {});

      clearState(chatId);
      bot.sendMessage(chatId, "❌ Something went wrong processing input.");
    }
  });

  bot.on("photo", async (msg) => {
    if (!isAdmin(msg.from?.id)) return;

    const chatId = msg.chat.id;
    const state = getState(chatId);
    if (!state || state.type !== "members.photo") return;

    try {
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      await handlePhotoUpload({ bot, chatId, fileId, state });
    } catch (err) {
      console.error("❌ Photo save error:", err.message);
      captureError({
        error: err,
        source: "telegram",
        endpoint: "photo:upload",
        userId: String(msg.from?.id || chatId),
        userName: [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || msg.from?.username || "",
        context: { state }
      }).catch(() => {});

      clearState(chatId);
      bot.sendMessage(chatId, "❌ Could not save photo");
    }
  });
};
