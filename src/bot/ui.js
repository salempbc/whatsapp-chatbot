export const PAGE_SIZE = 8;
export const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const currentMonthMM = () => {
  const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return String(ist.getMonth() + 1).padStart(2, "0");
};

export const shiftMonth = (mm, delta) => {
  let n = parseInt(mm, 10) + delta;
  if (n < 1) n = 12;
  if (n > 12) n = 1;
  return String(n).padStart(2, "0");
};

export const deriveMMDD = (dateStr) => (dateStr ? dateStr.slice(5) : undefined);

/**
 * Renders a {text, keyboard} screen in place when a messageId is available
 * (i.e. we're reacting to a button tap), falling back to a fresh message
 * otherwise (first open, or when the original message can't be edited —
 * e.g. it was a photo).
 */
export const renderScreen = async (bot, chatId, messageId, screen) => {
  const opts = { 
    reply_markup: { inline_keyboard: screen.keyboard },
    parse_mode: "HTML" 
  };
  let parseFailed = false;

  if (messageId) {
    try {
      await bot.editMessageText(screen.text, { chat_id: chatId, message_id: messageId, ...opts });
      return;
    } catch (err) {
      if (/message is not modified/i.test(err.message)) return;
      if (/can't parse entities/i.test(err.message)) {
        parseFailed = true;
        try {
          const plainText = screen.text.replace(/<[^>]*>/g, "");
          await bot.editMessageText(plainText, { chat_id: chatId, message_id: messageId, reply_markup: opts.reply_markup });
          return;
        } catch (_) {}
      }
      // fall through to sending a fresh message
    }
  }

  const textToSend = parseFailed ? screen.text.replace(/<[^>]*>/g, "") : screen.text;
  const sendOpts = parseFailed ? { reply_markup: opts.reply_markup } : opts;

  try {
    await bot.sendMessage(chatId, textToSend, sendOpts);
  } catch (err) {
    if (/can't parse entities/i.test(err.message)) {
      const plainText = screen.text.replace(/<[^>]*>/g, "");
      await bot.sendMessage(chatId, plainText, { reply_markup: opts.reply_markup }).catch((e) => console.error("renderScreen fallback failed:", e.message));
    } else {
      console.error("renderScreen sendMessage failed:", err.message);
    }
  }
};
