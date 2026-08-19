import TelegramBot from "node-telegram-bot-api";
import { registerHome } from "./handlers/home.js";
import { registerRouter } from "./router.js";

let bot;

export const initTelegram = () => {
  bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

  bot.on("polling_error", (err) => {
    console.error("❌ Telegram polling error:", err.message);
  });

  bot.setMyCommands([
    { command: "start", description: "Open main menu" },
    { command: "menu", description: "Open main menu" },
    { command: "help", description: "Show help" },
    { command: "cancel", description: "Cancel current action" }
  ]).catch((err) => console.error("❌ setMyCommands failed:", err.message));

  registerHome(bot);
  registerRouter(bot);

  console.log("🤖 Telegram CMS READY");
};

/* SEND */
export const sendMessage = async (text, member = null) => {
  if (!bot) return;

  if (member?.photo) {
    await bot.sendPhoto(process.env.CHAT_ID, member.photo, { caption: text });
  } else {
    await bot.sendMessage(process.env.CHAT_ID, text);
  }
};

/* STOP */
export const stopTelegram = async () => {
  if (!bot) return;
  await bot.stopPolling();
};
