import { generateWeeklyBulletin } from "../../services/bulletinService.js";
import { renderScreen } from "../ui.js";
import { clearState } from "../session.js";
import { adminOnly } from "../guard.js";

export const bulletinScreen = async () => {
  const { htmlText, whatsappUrl, rawWhatsAppText } = await generateWeeklyBulletin();

  const keyboard = [
    [{ text: "📲 Share on WhatsApp", url: whatsappUrl }],
    [
      { text: "🔄 Refresh Bulletin", callback_data: "bulletin:refresh" },
      { text: "📋 Copyable Text", callback_data: "bulletin:raw" }
    ],
    [{ text: "🏠 Return to Dashboard", callback_data: "home:show" }]
  ];

  return {
    text: htmlText,
    keyboard,
    rawWhatsAppText
  };
};

export const registerBulletin = (bot) => {
  bot.onText(/\/bulletin/, adminOnly(async (msg) => {
    clearState(msg.chat.id);
    const screen = await bulletinScreen();
    await renderScreen(bot, msg.chat.id, null, screen);
  }));
};

export const bulletinCallbacks = {
  "bulletin:show": async ({ bot, chatId, messageId }) => {
    const screen = await bulletinScreen();
    await renderScreen(bot, chatId, messageId, screen);
  },
  "bulletin:refresh": async ({ bot, chatId, messageId }) => {
    const screen = await bulletinScreen();
    await renderScreen(bot, chatId, messageId, screen);
    return "✅ Bulletin updated";
  },
  "bulletin:raw": async ({ bot, chatId }) => {
    const { rawWhatsAppText } = await generateWeeklyBulletin();
    await bot.sendMessage(
      chatId,
      `<code>${rawWhatsAppText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>`,
      { parse_mode: "HTML" }
    );
    return "📋 Copyable text sent";
  }
};
