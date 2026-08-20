import { renderScreen } from "../ui.js";
import { clearState } from "../session.js";
import { adminOnly } from "../guard.js";

const HELP_TEXT = `📊 Church CMS — Help

👥 Members — browse/search the roster, add new members, open a profile to edit details, link/unlink a spouse, upload a photo, or remove a member.
📅 Calendar — browse birthdays & weddings month by month.
📝 Templates — manage birthday/wedding message templates by category.
📤 Export — download the member list as CSV.

/menu — open the main menu
/cancel — abandon whatever you're in the middle of`;

export const homeScreen = () => ({
  text: "📊 Church CMS\n\nChoose an option:",
  keyboard: [
    [{ text: "👥 Members", callback_data: "members:list:0:active" }, { text: "🔍 Search", callback_data: "members:search" }],
    [{ text: "📅 Calendar", callback_data: "calendar:show:current" }, { text: "🗓 Coming Up", callback_data: "upcoming:show:7" }],
    [{ text: "📝 Templates", callback_data: "templates:show" }, { text: "📤 Export", callback_data: "export:run" }],
    [{ text: "📊 Stats", callback_data: "stats:show" }, { text: "⚙️ Settings", callback_data: "settings:show" }],
    [{ text: "❓ Help", callback_data: "help:show" }]
  ]
});

export const registerHome = (bot) => {
  const openMenu = adminOnly(async (msg) => {
    clearState(msg.chat.id);
    await renderScreen(bot, msg.chat.id, null, homeScreen());
  });

  bot.onText(/\/start/, openMenu);
  bot.onText(/\/menu/, openMenu);

  bot.onText(/\/help/, adminOnly((msg) => {
    bot.sendMessage(msg.chat.id, HELP_TEXT);
  }));

  bot.onText(/\/cancel/, adminOnly((msg) => {
    clearState(msg.chat.id);
    bot.sendMessage(msg.chat.id, "✅ Cancelled");
  }));
};

export const homeCallbacks = {
  "home:show": async ({ bot, chatId, messageId }) => {
    await renderScreen(bot, chatId, messageId, homeScreen());
  },
  "help:show": async ({ bot, chatId }) => {
    await bot.sendMessage(chatId, HELP_TEXT);
  }
};
