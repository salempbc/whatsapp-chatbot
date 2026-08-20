import { renderScreen } from "../ui.js";
import { clearState } from "../session.js";
import { adminOnly } from "../guard.js";

const HELP_TEXT = `<b>📊 Church CMS — User Guide</b>

<b>👥 Members:</b> Browse, search, and manage your congregation. Add new members, link families, or restore deleted records from the trash.
<b>📅 Calendar:</b> View all birthdays and weddings grouped month by month.
<b>🗓 Coming Up:</b> See who has a special day in the next 7 or 30 days.
<b>📝 Templates:</b> Manage the messages the bot sends. <i>Supports variables like {name}, {husband}, {wife}, and {years}.</i>
<b>📤 Export:</b> Download clean CSV reports of active members, married couples, or the entire roster.
<b>📊 Stats:</b> View real-time demographics and growth metrics.
<b>⚙️ Settings:</b> Configure exactly when the daily message fires, or manually test the broadcast.

<i>Tip: Type /menu anytime to return to the dashboard, or /cancel to abort an action.</i>`;

export const homeScreen = () => ({
  text: `<b>✝️ SPBC Admin Dashboard</b>
<i>Welcome back to the Church Management System.</i>

<blockquote><b>System Status:</b> 🟢 Online & Listening
<b>Timezone:</b> 🇮🇳 Asia/Kolkata</blockquote>
What would you like to manage today?`,
  keyboard: [
    [{ text: "🚀 Open Web CMS (New!)", web_app: { url: process.env.WEBAPP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? "https://" + process.env.RAILWAY_PUBLIC_DOMAIN : "https://google.com") } }],
    [{ text: "👥 Member Roster", callback_data: "members:list:0:active" }, { text: "🔍 Global Search", callback_data: "members:search" }],
    [{ text: "📅 Monthly Calendar", callback_data: "calendar:show:current" }, { text: "🗓 Coming Up (Next 7 days)", callback_data: "upcoming:show:7" }],
    [{ text: "📝 Message Templates", callback_data: "templates:show" }, { text: "📤 Export Database", callback_data: "export:run" }],
    [{ text: "📊 Demographics & Stats", callback_data: "stats:show" }, { text: "⚙️ System Settings", callback_data: "settings:show" }],
    [{ text: "❓ Help & Documentation", callback_data: "help:show" }]
  ]
});

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

  bot.onText(/\/cancel/, adminOnly(async (msg) => {
    clearState(msg.chat.id);
    await bot.sendMessage(msg.chat.id, "✅ Action aborted. Type /menu to go back.", { parse_mode: "HTML" });
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
