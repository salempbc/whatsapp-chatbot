import TelegramBot from "node-telegram-bot-api";

let bot = null;

export const initTelegram = () => {
  bot = new TelegramBot(process.env.BOT_TOKEN);

  console.log("🤖 Telegram bot ready");
};

export const sendMessage = async (text) => {
  if (!bot) {
    console.error("❌ Bot not initialized");
    return;
  }

  try {
    const res = await bot.sendMessage(process.env.CHAT_ID, text);
    console.log("✅ Telegram sent:", res.message_id);
  } catch (err) {
    console.error("❌ Telegram error:", err);
  }
};