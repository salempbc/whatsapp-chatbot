import ChurchEvent from "../../models/ChurchEvent.js";
import { getUnifiedEventsForRange, createChurchEvent, cancelChurchEvent } from "../../services/churchCalendarService.js";
import { renderScreen } from "../ui.js";
import { setState, clearState } from "../session.js";
import { adminOnly } from "../guard.js";

const escapeHtml = (str = "") => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const calendarListScreen = async () => {
  const todayStr = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
    .toISOString()
    .slice(0, 10);
  const next30Str = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const events = await getUnifiedEventsForRange(todayStr, next30Str);

  let text = `<b>⛪ Church Events & Services</b>\n`;
  text += `<i>Scheduled programs for the next 30 days</i>\n\n`;

  if (!events.length) {
    text += `<blockquote><i>No custom events currently scheduled.</i></blockquote>`;
  } else {
    for (const e of events) {
      const timeStr = e.startTime ? ` at ${e.startTime}` : "";
      text += `📅 <b>${e.startDate}${timeStr}</b>\n`;
      text += `<b>${escapeHtml(e.title)}</b> (${e.category})\n`;
      text += `📍 ${escapeHtml(e.venue || "Church")}\n\n`;
    }
  }

  const keyboard = [
    [{ text: "➕ Add Church Event", callback_data: "events:add:start" }],
    [{ text: "📅 Monthly Roster", callback_data: "calendar:show:current" }],
    [{ text: "🏠 Return to Dashboard", callback_data: "home:show" }]
  ];

  return { text, keyboard };
};

export const registerEvents = (bot) => {
  bot.onText(/\/events/, adminOnly(async (msg) => {
    clearState(msg.chat.id);
    const screen = await calendarListScreen();
    await renderScreen(bot, msg.chat.id, null, screen);
  }));

  bot.onText(/\/addevent/, adminOnly(async (msg) => {
    clearState(msg.chat.id);
    setState(msg.chat.id, { type: "events.addTitle", draft: {} });
    await bot.sendMessage(msg.chat.id, "<b>➕ Add New Church Event</b>\n\nEnter event title (e.g., 'Youth Revival Meeting'):", { parse_mode: "HTML" });
  }));
};

export const eventsCallbacks = {
  "events:list": async ({ bot, chatId, messageId }) => {
    const screen = await calendarListScreen();
    await renderScreen(bot, chatId, messageId, screen);
  },
  "events:add:start": async ({ bot, chatId }) => {
    setState(chatId, { type: "events.addTitle", draft: {} });
    await bot.sendMessage(chatId, "<b>➕ Add New Church Event</b>\n\nEnter event title (e.g. 'Youth Revival Meeting'):", { parse_mode: "HTML" });
    return "Enter event title";
  }
};

export const eventsStateHandlers = {
  "events.addTitle": async ({ bot, chatId, text, state }) => {
    state.draft.title = text;
    state.type = "events.addDate";
    setState(chatId, state);
    await bot.sendMessage(chatId, `Event: <b>${escapeHtml(text)}</b>\n\nEnter event date as <code>YYYY-MM-DD</code>:`, { parse_mode: "HTML" });
  },
  "events.addDate": async ({ bot, chatId, text, state }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return bot.sendMessage(chatId, "❌ Invalid format. Please enter date as YYYY-MM-DD (e.g., 2026-10-15):");
    }
    state.draft.startDate = text;
    state.type = "events.addTime";
    setState(chatId, state);
    await bot.sendMessage(chatId, "Enter event time as <code>HH:MM</code> (24-hour e.g. 18:30) or send /skip for default 09:30:", { parse_mode: "HTML" });
  },
  "events.addTime": async ({ bot, chatId, text, state }) => {
    if (text !== "/skip" && !/^\d{2}:\d{2}$/.test(text)) {
      return bot.sendMessage(chatId, "❌ Invalid format. Enter HH:MM e.g. 18:30 or /skip:");
    }
    state.draft.startTime = text === "/skip" ? "09:30" : text;
    state.draft.category = "special_service";

    try {
      const created = await createChurchEvent(state.draft);
      clearState(chatId);
      await bot.sendMessage(chatId, `✅ <b>Event Created!</b>\n\n<b>${escapeHtml(created.title)}</b>\n📅 Date: ${created.startDate} at ${created.startTime}`, { parse_mode: "HTML" });
      const screen = await calendarListScreen();
      await renderScreen(bot, chatId, null, screen);
    } catch (err) {
      clearState(chatId);
      await bot.sendMessage(chatId, `❌ Failed to create event: ${err.message}`);
    }
  }
};
