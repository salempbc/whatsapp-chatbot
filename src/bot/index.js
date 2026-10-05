import TelegramBot from "node-telegram-bot-api";
import crypto from "crypto";
import { registerHome } from "./handlers/home.js";
import { registerBible } from "./handlers/bible.js";
import { registerMemorial } from "./handlers/memorial.js";
import { registerReview } from "./handlers/review.js";
import { registerEvents } from "./handlers/events.js";
import { registerTasks } from "./handlers/tasks.js";
import { registerStats } from "./handlers/stats.js";
import { registerBulletin } from "./handlers/bulletin.js";
import { registerUsers } from "./handlers/users.js";
import { registerRouter } from "./router.js";

let bot;

export const getBotInstance = () => bot;

/* Shared secret Telegram echoes back in X-Telegram-Bot-Api-Secret-Token */
export const getWebhookSecret = () =>
  process.env.WEBHOOK_SECRET ||
  crypto.createHash("sha256").update("webhook:" + (process.env.BOT_TOKEN || "")).digest("hex").slice(0, 48);

/* 🛡️ Smart Queue (Anti-Ban 20 msgs/min limit) */
const messageQueue = [];
let isProcessingQueue = false;

const processQueue = async () => {
  if (isProcessingQueue || messageQueue.length === 0) return;
  isProcessingQueue = true;
  
  while (messageQueue.length > 0) {
    const task = messageQueue.shift();
    try { await task(); } catch (err) { console.error("❌ Queue send error:", err.message); }
    await new Promise(r => setTimeout(r, 3100));
  }
  isProcessingQueue = false;
};

export const initTelegram = () => {
  if (!process.env.BOT_TOKEN) {
    console.error("❌ BOT_TOKEN is missing! Bot cannot start.");
    return;
  }

  let domain = process.env.WEBAPP_URL || process.env.RENDER_EXTERNAL_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? "https://" + process.env.RAILWAY_PUBLIC_DOMAIN : "");
  if (domain && !domain.startsWith("http")) domain = "https://" + domain;
  
  if (domain) {
    bot = new TelegramBot(process.env.BOT_TOKEN);
    bot
      .setWebHook(`${domain}/api/bot-webhook`, { secret_token: getWebhookSecret() })
      .then(() => console.log(`🔗 Webhook set to ${domain}/api/bot-webhook`))
      .catch((err) => console.error("❌ setWebHook failed:", err.message));
  } else {
    bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
    bot.on("polling_error", (err) => console.error("❌ Telegram polling error:", err.message));
    console.log("⚠️ No domain found, falling back to polling");
  }

  // Resilient Telegram client error listeners
  bot.on("error", (err) => console.error("❌ Telegram client error:", err.message));
  bot.on("webhook_error", (err) => console.error("❌ Telegram webhook error:", err.message));

  bot.setMyCommands([
    { command: "start", description: "Open main menu" },
    { command: "menu", description: "Open main menu" },
    { command: "review", description: "Review today's greetings" },
    { command: "bulletin", description: "Generate weekly church bulletin & announcements" },
    { command: "events", description: "Browse church events & services" },
    { command: "addevent", description: "Schedule a church program" },
    { command: "tasks", description: "Manage administrative tasks" },
    { command: "addtask", description: "Create an administrative task" },
    { command: "users", description: "Manage authorized leaders & staff" },
    { command: "invite", description: "Generate 1-click leader invite link" },
    { command: "stats", description: "Church demographics & analytics" },
    { command: "dataquality", description: "Run data quality inspection" },
    { command: "help", description: "Show interactive administrator guide wizard" },
    { command: "cancel", description: "Cancel current action" },
    { command: "bible", description: "Search for a Bible verse" },
    { command: "addverse", description: "<type> <ref> - Add a custom event verse" },
    { command: "listverses", description: "List custom event verses" },
    { command: "addmemorial", description: "<MM-DD> <Name> [, Note] - Add memorial" },
    { command: "listmemorials", description: "List tracked memorials" },
    { command: "genwish", description: "<Name> - Preview AI-generated Tamil wish" }
  ]).catch((err) => console.error("❌ setMyCommands failed:", err.message));

  registerHome(bot);
  registerBulletin(bot);
  registerBible(bot);
  registerMemorial(bot);
  registerReview(bot);
  registerEvents(bot);
  registerTasks(bot);
  registerStats(bot);
  registerUsers(bot);
  registerRouter(bot);

  console.log("🚀 Telegram CMS READY (SPBC 2.1 Admin Engine)");
};

export const handleWebhook = (body) => {
  if (bot && body) {
    try {
      bot.processUpdate(body);
    } catch (err) {
      console.error("❌ Error processing webhook update:", err.message);
    }
  }
};

/* SEND to admin only (private interaction) */
export const sendAdminMessage = async (text, options = {}) => {
  if (!bot || !process.env.ADMIN_ID) return;
  try {
    await bot.sendMessage(process.env.ADMIN_ID, text, { parse_mode: "HTML", ...options });
  } catch (err) {
    console.error("❌ Failed to send admin message:", err.message);
  }
};

/* Explicit target send */
export const sendMessage = async (text, member = null) => {
  if (!bot) return;

  const targetChat = process.env.ADMIN_ID || process.env.CHAT_ID;
  if (!targetChat) return;

  return new Promise((resolve) => {
    messageQueue.push(async () => {
      try {
        if (member?.photo) {
          await bot.sendPhoto(targetChat, member.photo, { caption: text, parse_mode: "HTML" });
        } else {
          await bot.sendMessage(targetChat, text, { parse_mode: "HTML" });
        }
      } catch (e) {
        console.error("Message send failed:", e.message);
      }
      resolve();
    });
    processQueue();
  });
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
};
