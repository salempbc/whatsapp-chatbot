import TelegramBot from "node-telegram-bot-api";

let bot;

export const initTelegram = () => {
  bot = new TelegramBot(process.env.BOT_TOKEN, {
    polling: false
  });

  console.log("🤖 Telegram bot ready");
};

export const sendMessage = async (text) => {
  try {
    await bot.sendMessage(process.env.CHAT_ID, text);
    console.log("✅ Telegram message sent");
  } catch (err) {
    console.error("❌ Telegram error:", err.message);
  }
};