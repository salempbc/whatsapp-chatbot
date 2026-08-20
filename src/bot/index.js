import TelegramBot from "node-telegram-bot-api";
import { registerHome } from "./handlers/home.js";
import { registerRouter } from "./router.js";

let bot;

/* 🛡️ Smart Queue (Anti-Ban 20 msgs/min limit) */
const messageQueue = [];
let isProcessingQueue = false;

const processQueue = async () => {
  if (isProcessingQueue || messageQueue.length === 0) return;
  isProcessingQueue = true;
  
  while (messageQueue.length > 0) {
    const task = messageQueue.shift();
    try { await task(); } catch (err) { console.error("❌ Queue send error:", err.message); }
    // 3.1 second delay between group messages (safely under 20/min)
    await new Promise(r => setTimeout(r, 3100));
  }
  isProcessingQueue = false;
};

export const initTelegram = () => {
  const domain = process.env.WEBAPP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? "https://" + process.env.RAILWAY_PUBLIC_DOMAIN : null);
  
  if (domain) {
    bot = new TelegramBot(process.env.BOT_TOKEN);
    bot.setWebHook(`${domain}/api/bot-webhook`);
    console.log(`🔗 Webhook set to ${domain}/api/bot-webhook`);
  } else {
    bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
    bot.on("polling_error", (err) => console.error("❌ Telegram polling error:", err.message));
    console.log("⚠️ No domain found, falling back to polling");
  }

  bot.setMyCommands([
    { command: "start", description: "Open main menu" },
    { command: "menu", description: "Open main menu" },
    { command: "help", description: "Show help" },
    { command: "cancel", description: "Cancel current action" }
  ]).catch((err) => console.error("❌ setMyCommands failed:", err.message));

  registerHome(bot);
  registerRouter(bot);

  console.log("🚀 Telegram CMS READY");
};

export const handleWebhook = (body) => {
  if (bot) bot.processUpdate(body);
};

/* SEND to group (Queued) */
export const sendMessage = async (text, member = null) => {
  if (!bot) return;

  return new Promise((resolve) => {
    messageQueue.push(async () => {
      try {
        if (member?.photo) {
          await bot.sendPhoto(process.env.CHAT_ID, member.photo, { caption: text, parse_mode: "HTML" });
        } else {
          await bot.sendMessage(process.env.CHAT_ID, text, { parse_mode: "HTML" });
        }
      } catch (e) {
        console.error("Message send failed:", e.message);
      }
      resolve();
    });
    processQueue();
  });
};

/* SEND to admin only (private reminder, unqueued because direct DMs have higher limits) */
export const sendAdminMessage = async (text) => {
  if (!bot || !process.env.ADMIN_ID) return;
  await bot.sendMessage(process.env.ADMIN_ID, text);
};

export const waitForQueueToDrain = async () => {
  if (messageQueue.length === 0 && !isProcessingQueue) return;
  console.log("⏳ Waiting for message queue to drain before shutdown...");
  while (messageQueue.length > 0 || isProcessingQueue) {
    await new Promise(r => setTimeout(r, 500));
  }
  console.log("✅ Message queue drained.");
};

/* STOP */
export const stopTelegram = async () => {
  if (!bot) return;
  if (bot.isPolling()) await bot.stopPolling();
  else await bot.deleteWebHook();
};
