import GreetingLog, { GREETING_STATUS } from "../../models/GreetingLog.js";
import { getTodayKey } from "../../services/eventService.js";
import {
  prepareTodayGreetings,
  regenerateGreeting,
  markGreetingAsShared,
  skipGreeting,
  updateGreetingText
} from "../../services/greetingService.js";
import { renderScreen } from "../ui.js";
import { setState, clearState } from "../session.js";
import { adminOnly } from "../guard.js";

const escapeHtml = (text = "") => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

/**
 * Summary screen showing today's celebrants and their greeting review status
 */
export const reviewSummaryScreen = async () => {
  const dateKey = getTodayKey();
  const year = new Date().getFullYear();
  const greetings = await GreetingLog.find({ dateKey, year }).sort({ createdAt: 1 });

  let text = `<b>📋 Today's Greeting Review & WhatsApp Prep</b>\n`;
  text += `<i>Date: ${dateKey} | Authorized Admin Dashboard</i>\n\n`;

  if (!greetings.length) {
    text += `<blockquote>🎉 <b>No celebrations detected for today.</b>\nNo birthdays or anniversaries require review today.</blockquote>`;
    return {
      text,
      keyboard: [
        [{ text: "🔄 Refresh / Scan Today", callback_data: "review:refresh" }],
        [{ text: "🏠 Return to Dashboard", callback_data: "home:show" }]
      ]
    };
  }

  const rows = [];
  let index = 1;
  for (const g of greetings) {
    const icon = g.type === "wedding" ? "💍" : "🎂";
    const statusBadge =
      g.status === GREETING_STATUS.MARKED_AS_SHARED
        ? "✅ Shared"
        : g.status === GREETING_STATUS.SKIPPED
        ? "⏭ Skipped"
        : g.status === GREETING_STATUS.EDITED
        ? "✏️ Edited"
        : "⏳ Pending";

    text += `${index}. ${icon} <b>${escapeHtml(g.memberName)}</b> [${statusBadge}]\n`;

    rows.push([
      {
        text: `${index}. ${icon} Review ${g.memberName} (${statusBadge})`,
        callback_data: `review:item:${g._id}`
      }
    ]);
    index++;
  }

  text += `\n<blockquote>Tap any member below to review, copy, edit, or regenerate their greeting card before sharing to WhatsApp.</blockquote>`;

  rows.push([{ text: "🔄 Refresh List", callback_data: "review:refresh" }]);
  rows.push([{ text: "🏠 Return to Dashboard", callback_data: "home:show" }]);

  return { text, keyboard: rows };
};

/**
 * Individual greeting card review screen
 */
export const reviewItemScreen = async (logId) => {
  const log = await GreetingLog.findById(logId);
  if (!log) {
    return {
      text: "❌ <b>Greeting card not found.</b>",
      keyboard: [[{ text: "🔙 Back to Summary", callback_data: "review:summary" }]]
    };
  }

  const icon = log.type === "wedding" ? "💍 Wedding Anniversary" : "🎂 Birthday";
  const statusLabel =
    log.status === GREETING_STATUS.MARKED_AS_SHARED
      ? "✅ Marked as Shared to WhatsApp"
      : log.status === GREETING_STATUS.SKIPPED
      ? "⏭ Skipped for today"
      : log.status === GREETING_STATUS.EDITED
      ? "✏️ Manually Edited"
      : "⏳ Ready for Review";

  let text = `<b>${icon} — Admin Review</b>\n`;
  text += `<b>Celebrant:</b> ${escapeHtml(log.memberName)}${log.spouseName ? ` & ${escapeHtml(log.spouseName)}` : ""}\n`;
  text += `<b>Status:</b> ${statusLabel}\n`;
  text += `<b>Style:</b> <i>${log.style || "pastoral"}</i>\n\n`;
  text += `👇 <b>Greeting Message (Tap to Copy below):</b>\n\n`;
  text += `<code>${escapeHtml(log.text)}</code>\n\n`;
  text += `<i>💡 Tip: Tap the block above on mobile to copy directly, then paste into church WhatsApp group!</i>`;

  const encodedText = encodeURIComponent(log.text || "");
  const waUrl = `https://api.whatsapp.com/send?text=${encodedText}`;

  const keyboard = [
    [
      { text: "📲 Open in WhatsApp", url: waUrl },
      { text: "✅ Mark as Shared", callback_data: `review:share:${log._id}` }
    ],
    [
      { text: "📋 Show Copyable Text", callback_data: `review:copy:${log._id}` },
      { text: "🔄 Regenerate", callback_data: `review:regen:${log._id}` }
    ],
    [
      { text: "🎨 Style", callback_data: `review:style:${log._id}` },
      { text: "✏️ Edit Text", callback_data: `review:edit:${log._id}` }
    ],
    [
      { text: "⏭ Skip", callback_data: `review:skip:${log._id}` },
      { text: "📋 Back to Summary", callback_data: "review:summary" }
    ]
  ];

  return { text, keyboard };
};

/**
 * Style picker screen
 */
const stylePickerScreen = (logId) => ({
  text: "<b>🎨 Choose Greeting Prayer Style:</b>\n\nSelect a tone for AI regeneration:",
  keyboard: [
    [
      { text: "🕊 Pastoral (Default)", callback_data: `review:applystyle:${logId}:pastoral` },
      { text: "❤️ Heartfelt", callback_data: `review:applystyle:${logId}:heartfelt` }
    ],
    [
      { text: "⚡ Short & Simple", callback_data: `review:applystyle:${logId}:short` },
      { text: "🏛 Formal", callback_data: `review:applystyle:${logId}:formal` }
    ],
    [{ text: "🔙 Cancel", callback_data: `review:item:${logId}` }]
  ]
});

export const registerReview = (bot) => {
  bot.onText(/\/review/, adminOnly(async (msg) => {
    clearState(msg.chat.id);
    await prepareTodayGreetings();
    const screen = await reviewSummaryScreen();
    await renderScreen(bot, msg.chat.id, null, screen);
  }));
};

export const reviewCallbacks = {
  "review:summary": async ({ bot, chatId, messageId }) => {
    const screen = await reviewSummaryScreen();
    await renderScreen(bot, chatId, messageId, screen);
  },

  "review:refresh": async ({ bot, chatId, messageId }) => {
    await prepareTodayGreetings();
    const screen = await reviewSummaryScreen();
    await renderScreen(bot, chatId, messageId, screen);
    return "✅ Refreshed today's greetings";
  },

  "review:item": async ({ bot, chatId, messageId, args }) => {
    const logId = args[0];
    const screen = await reviewItemScreen(logId);
    await renderScreen(bot, chatId, messageId, screen);
  },

  "review:copy": async ({ bot, chatId, args }) => {
    const logId = args[0];
    const log = await GreetingLog.findById(logId);
    if (!log) return;

    // Send as clean selectable text in a dedicated message
    await bot.sendMessage(
      chatId,
      `📋 <b>Copy Message for WhatsApp:</b>\n\n<code>${escapeHtml(log.text)}</code>`,
      { parse_mode: "HTML" }
    );
    return "Message displayed in copyable box above";
  },

  "review:share": async ({ bot, chatId, messageId, args }) => {
    const logId = args[0];
    await markGreetingAsShared(logId);
    const screen = await reviewItemScreen(logId);
    await renderScreen(bot, chatId, messageId, screen);
    return "✅ Marked as shared to WhatsApp!";
  },

  "review:skip": async ({ bot, chatId, messageId, args }) => {
    const logId = args[0];
    await skipGreeting(logId);
    const screen = await reviewItemScreen(logId);
    await renderScreen(bot, chatId, messageId, screen);
    return "⏭ Marked as skipped";
  },

  "review:regen": async ({ bot, chatId, messageId, args }) => {
    const logId = args[0];
    await regenerateGreeting(logId);
    const screen = await reviewItemScreen(logId);
    await renderScreen(bot, chatId, messageId, screen);
    return "✨ Regenerated greeting!";
  },

  "review:style": async ({ bot, chatId, messageId, args }) => {
    const logId = args[0];
    await renderScreen(bot, chatId, messageId, stylePickerScreen(logId));
  },

  "review:applystyle": async ({ bot, chatId, messageId, args }) => {
    const [logId, style] = args;
    await regenerateGreeting(logId, { style });
    const screen = await reviewItemScreen(logId);
    await renderScreen(bot, chatId, messageId, screen);
    return `🎨 Applied ${style} style!`;
  },

  "review:edit": async ({ bot, chatId, args }) => {
    const logId = args[0];
    const log = await GreetingLog.findById(logId);
    if (!log) return;

    setState(chatId, { type: "review.editText", logId });
    await bot.sendMessage(
      chatId,
      `✏️ <b>Edit Greeting Text for ${escapeHtml(log.memberName)}</b>\n\n` +
      `Current text:\n<blockquote>${escapeHtml(log.text)}</blockquote>\n\n` +
      `Send your new message text below (or send /cancel to abort):`,
      { parse_mode: "HTML" }
    );
  }
};

export const reviewStateHandlers = {
  "review.editText": async ({ bot, chatId, text, state }) => {
    const { logId } = state;
    if (!logId) return;

    await updateGreetingText(logId, text);
    clearState(chatId);

    await bot.sendMessage(chatId, "✅ Greeting text updated successfully!");
    const screen = await reviewItemScreen(logId);
    await renderScreen(bot, chatId, null, screen);
  }
};
