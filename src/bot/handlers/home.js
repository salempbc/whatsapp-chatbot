import { renderScreen } from "../ui.js";
import { clearState } from "../session.js";
import { adminOnly } from "../guard.js";

const HELP_TEXT = `<b>📊 Church CMS 2.1 — Administrator Guide</b>

<b>📋 /review:</b> Open today's celebrations review deck. Copy personalized Tamil greetings before sharing to WhatsApp.
<b>👥 /members:</b> Manage congregational records, family links, lifecycle statuses, archive and restoration.
<b>📅 /events:</b> Browse and schedule church services, prayer meetings, and special programs.
<b>📝 /tasks:</b> Track church follow-ups, event preparations, and assigned tasks.
<b>📊 /stats:</b> Church demographic analytics, growth metrics, and data quality audits.
<b>🗓 /calendar:</b> Monthly celebration roster (birthdays, wedding anniversaries, memorials).
<b>📤 /export:</b> Download member database spreadsheets.
<b>⚙️ Settings:</b> Configure daily review schedules and notifications.

<i>Note: WhatsApp remains your manual destination for all finalized greetings.</i>`;

export const homeScreen = () => {
  let webAppUrl = process.env.WEBAPP_URL || process.env.RENDER_EXTERNAL_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? "https://" + process.env.RAILWAY_PUBLIC_DOMAIN : "");
  if (webAppUrl && !webAppUrl.startsWith("http")) webAppUrl = "https://" + webAppUrl;

  const keyboard = [
    [{ text: "📋 Today's Greeting Review (/review)", callback_data: "review:summary" }]
  ];

  if (webAppUrl && webAppUrl.length > 8) {
    keyboard.push([{ text: "🌐 Open Web Admin Dashboard", web_app: { url: webAppUrl } }]);
  }

  keyboard.push(
    [{ text: "👥 Members", callback_data: "members:list:0:active" }, { text: "📅 Events", callback_data: "events:list" }],
    [{ text: "📋 Tasks", callback_data: "tasks:list" }, { text: "📊 Analytics", callback_data: "stats:show" }],
    [{ text: "🗓 Calendar", callback_data: "calendar:show:current" }, { text: "⚙️ Settings", callback_data: "settings:show" }],
    [{ text: "❓ Help Guide", callback_data: "help:show" }]
  );

  return {
    text: `<b>✝️ Salem Primitive Baptist Church (SPBC)</b>
<i>Church Operating System 2.1</i>

<blockquote><b>System Mode:</b> 🔒 Private Admin Mode
<b>Timezone:</b> 🇮🇳 Asia/Kolkata (IST)</blockquote>
Select an administrative module:`,
    keyboard
  };
};

export const registerHome = (bot) => {
  const openMenu = adminOnly(async (msg) => {
    clearState(msg.chat.id);
    await renderScreen(bot, msg.chat.id, null, homeScreen());
  });

  bot.onText(/\/start/, openMenu);
  bot.onText(/\/menu/, openMenu);

  bot.onText(/\/help/, adminOnly(async (msg) => {
    await bot.sendMessage(msg.chat.id, HELP_TEXT, { parse_mode: "HTML" });
  }));

  bot.onText(/^\/ping$/, adminOnly(async (msg) => {
    await bot.sendMessage(msg.chat.id, "pong");
  }));

  bot.onText(/\/cancel/, adminOnly(async (msg) => {
    clearState(msg.chat.id);
    await bot.sendMessage(msg.chat.id, "✅ Action aborted. Type /menu to return to main dashboard.", { parse_mode: "HTML" });
  }));
};

export const homeCallbacks = {
  "home:show": async ({ bot, chatId, messageId }) => {
    await renderScreen(bot, chatId, messageId, homeScreen());
  },
  "help:show": async ({ bot, chatId, messageId }) => {
    await renderScreen(bot, chatId, messageId, {
      text: HELP_TEXT,
      keyboard: [[{ text: "🔙 Return to Dashboard", callback_data: "home:show" }]]
    });
  }
};
