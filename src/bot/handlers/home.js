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

  bot.onText(/\/backup/, adminOnly(async (msg) => {
    const { exportCallbacks } = await import("./export.js");
    await exportCallbacks["export:backup"]({ bot, chatId: msg.chat.id, messageId: null });
  }));

  bot.onText(/\/find(?:\s+(.+))?/, adminOnly(async (msg, match) => {
    const query = match[1]?.trim();
    if (!query) {
      return bot.sendMessage(msg.chat.id, "🔍 <b>Find Member</b>\n\nUsage: <code>/find &lt;name or phone&gt;</code>\nExample: <code>/find David</code> or <code>/find 9876543210</code>", { parse_mode: "HTML" });
    }

    const { default: Member } = await import("../../models/Member.js");
    const { renderScreen } = await import("../ui.js");

    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const members = await Member.find({
      isDeleted: { $ne: true },
      $or: [
        { name: new RegExp(escapeRegex(query), "i") },
        { phone: new RegExp(escapeRegex(query), "i") },
        { familyName: new RegExp(escapeRegex(query), "i") }
      ]
    }).limit(5);

    if (!members.length) {
      return bot.sendMessage(msg.chat.id, `❌ No member found matching: "<b>${query}</b>"`, { parse_mode: "HTML" });
    }

    if (members.length === 1) {
      const m = members[0];
      let text = `👤 <b>${m.name}</b> (${m.role || "Member"})\n`;
      text += `• <b>Status:</b> ${m.status || "active"}\n`;
      if (m.phone) text += `• <b>Phone:</b> <code>${m.phone}</code>\n`;
      if (m.familyName) text += `• <b>Family:</b> ${m.familyName}\n`;
      if (m.birthday) text += `• <b>Birthday:</b> ${m.birthday}\n`;
      if (m.isMarried && m.spouseName) text += `• <b>Spouse:</b> ${m.spouseName}\n`;

      const keyboard = [];
      const actionRow = [];
      if (m.phone) {
        const cleanPhone = m.phone.replace(/[^0-9]/g, "");
        actionRow.push({ text: "💬 WhatsApp", url: `https://wa.me/${cleanPhone}` });
        actionRow.push({ text: "📞 Call", url: `tel:${cleanPhone}` });
      }
      if (actionRow.length) keyboard.push(actionRow);
      keyboard.push([
        { text: "👤 Full Profile", callback_data: `members:open:${m._id}` },
        { text: "✏️ Edit", callback_data: `members:edit:${m._id}` }
      ]);
      keyboard.push([{ text: "🏠 Return to Dashboard", callback_data: "home:show" }]);

      return renderScreen(bot, msg.chat.id, null, { text, keyboard });
    }

    let text = `🔍 <b>Search results for "${query}":</b>\nSelect a member:\n`;
    const keyboard = members.map((m) => [{
      text: `${m.name} ${m.phone ? `(${m.phone})` : ""}`,
      callback_data: `members:open:${m._id}`
    }]);
    keyboard.push([{ text: "🏠 Return to Dashboard", callback_data: "home:show" }]);
    return renderScreen(bot, msg.chat.id, null, { text, keyboard });
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
