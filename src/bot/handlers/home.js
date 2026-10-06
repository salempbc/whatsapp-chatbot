import { renderScreen } from "../ui.js";
import { clearState } from "../session.js";
import { adminOnly, isAdmin } from "../guard.js";
import { redeemInviteToken } from "../../services/userService.js";

export const HELP_TOPICS = {
  overview: {
    title: "📖 Church CMS 2.1 — Administrator Guide",
    text: `<b>📖 Church CMS 2.1 — Administrator Guide</b>
<i>Salem Primitive Baptist Church (SPBC)</i>

Welcome to the SPBC Administration Engine. Select any topic below for instant command syntax, shortcuts, and features:

• <b>👥 Members:</b> Roster management, search, family grouping & lifecycle
• <b>📋 Greetings:</b> Birthday/anniversary review deck & WhatsApp sharing
• <b>📜 Bulletin:</b> Weekly bulletin generator with Tamil O.V. BSI Scripture
• <b>📅 Events:</b> Services, prayer meetings, and monthly calendar
• <b>📝 Tasks:</b> Administrative follow-ups & Kanban task progress
• <b>📖 Scripture:</b> Canonical Tamil Bible O.V. BSI verse lookups
• <b>⚙️ System:</b> Automated backups, demographic analytics & health audits

<i>💡 Tip: Type <code>/help &lt;topic&gt;</code> anytime (e.g., <code>/help members</code> or <code>/help bulletin</code>).</i>`
  },
  members: {
    title: "👥 Members & Directory Guide",
    text: `<b>👥 Members & Directory Management</b>

<b>Commands & Shortcuts:</b>
• <code>/find &lt;name or phone&gt;</code>: Search any member instantly. Displays phone, family, and direct [💬 WhatsApp] / [📞 Call] buttons.
• <code>/members</code>: Complete congregational directory with status filters (Active, Inactive, Transferred, Archived).
• <b>Household Linking:</b> Members are organized into family units (Head, spouse, and children).
• <b>Web Dashboard:</b> Supports Excel/CSV bulk import and duplicate profile merging.`
  },
  greetings: {
    title: "📋 Celebrations & WhatsApp Greetings",
    text: `<b>📋 Celebrations & WhatsApp Greetings</b>

<b>Commands & Shortcuts:</b>
• <code>/review</code>: Open today's celebration review deck for pending birthdays and anniversaries.
• <code>/genwish &lt;name&gt;</code>: Preview an AI-generated Tamil Christian prayer blessing.
• <b>Tamil Scripture Guardrails:</b> All prayer blessings strictly use authentic phrasing faithful to the <b>Tamil Bible Old Version (BSI - பரிசுத்த வேதாகமம் O.V.)</b>.
• <b>One-Tap WhatsApp:</b> Tap [📲 Open in WhatsApp] to launch WhatsApp with the pre-formatted greeting.`
  },
  bulletin: {
    title: "📜 Weekly Church Bulletin Guide",
    text: `<b>📜 Weekly Church Bulletin Generator</b>

<b>Commands & Shortcuts:</b>
• <code>/bulletin</code>: Compiles the weekly SPBC church bulletin with one tap.
• <b>What's Included:</b>
  1. Canonical Tamil Bible O.V. BSI meditation verse for the week
  2. Weekly service timings (Sunday Worship, Wed Bible Study, Fri Fasting Prayer)
  3. Scheduled church events from calendar
  4. Upcoming birthdays and wedding anniversaries for the next 7 days
  5. Announcements
• <b>One-Tap Share:</b> Tap [📲 Share on WhatsApp] to broadcast to church WhatsApp groups.`
  },
  events: {
    title: "📅 Church Events & Calendar",
    text: `<b>📅 Church Events & Calendar Guide</b>

<b>Commands & Shortcuts:</b>
• <code>/events</code>: View scheduled church services, revival meetings, and cottage prayers for the next 30 days.
• <code>/addevent</code>: Interactive wizard to schedule a new church event with title, date, time, and venue.
• <code>/calendar</code>: Monthly grid roster tracking member milestones and church services.`
  },
  tasks: {
    title: "📝 Tasks & Follow-up Manager",
    text: `<b>📝 Administrative Tasks & Follow-ups</b>

<b>Commands & Shortcuts:</b>
• <code>/tasks</code>: Interactive task list with Kanban status indicators (To-Do, In-Progress, Waiting, Done).
• <code>/addtask</code>: Quickly create a follow-up task with priority (urgent/high/normal) and due date.
• <b>Quick Actions:</b> Tap [✅ Done] directly in Telegram to complete tasks without typing.
• <b>Overdue Tracking:</b> Highlights overdue tasks automatically.`
  },
  scripture: {
    title: "📖 Scripture & Memorials (Tamil O.V. BSI)",
    text: `<b>📖 Scripture & Memorials (Tamil Bible O.V. BSI)</b>

<b>Commands & Shortcuts:</b>
• <code>/bible &lt;query&gt;</code>: Search canonical verses from the Tamil Bible Old Version (BSI).
• <code>/addverse &lt;type&gt; &lt;ref&gt;</code>: Add a custom canonical verse for birthday, wedding, or youth.
• <code>/listverses</code>: View custom registered event verses.
• <code>/addmemorial &lt;MM-DD&gt; &lt;Name&gt; [, Note]</code>: Track memorial dates with comforting Tamil O.V. BSI Scripture verses.
• <code>/listmemorials</code>: Browse tracked family memorials.`
  },
  system: {
    title: "⚙️ System, Backups & Analytics",
    text: `<b>⚙️ System, Backups & Analytics</b>

<b>Commands & Shortcuts:</b>
• <code>/backup</code>: Instant full database backup sent directly to Telegram as a downloadable JSON document. 100% free forever.
• <b>Automated Backup Heartbeat:</b> Runs automatically on the 1st of every month at 06:15 IST.
• <code>/stats</code>: Church demographic statistics, age distribution visualizer, and gender ratio.
• <code>/dataquality</code>: Run data integrity audit checking for duplicate names, missing phones, or broken dates.
• <code>/ping</code>: Verify server responsiveness.
• <code>/cancel</code>: Abort any active conversational input.`
  }
};

export const helpScreen = (topicKey = "overview") => {
  const topic = HELP_TOPICS[topicKey] || HELP_TOPICS.overview;

  const keyboard = [
    [
      { text: "👥 Members", callback_data: "help:topic:members" },
      { text: "📋 Greetings", callback_data: "help:topic:greetings" }
    ],
    [
      { text: "📜 Bulletin", callback_data: "help:topic:bulletin" },
      { text: "📅 Events", callback_data: "help:topic:events" }
    ],
    [
      { text: "📝 Tasks", callback_data: "help:topic:tasks" },
      { text: "📖 Scripture", callback_data: "help:topic:scripture" }
    ],
    [
      { text: "⚙️ System & Backup", callback_data: "help:topic:system" }
    ]
  ];

  if (topicKey !== "overview") {
    keyboard.push([
      { text: "🔙 All Topics", callback_data: "help:topic:overview" },
      { text: "🏠 Return to Dashboard", callback_data: "home:show" }
    ]);
  } else {
    keyboard.push([
      { text: "🏠 Return to Dashboard", callback_data: "home:show" }
    ]);
  }

  return { text: topic.text, keyboard };
};

export const homeScreen = () => {
  let webAppUrl = process.env.WEBAPP_URL || process.env.RENDER_EXTERNAL_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? "https://" + process.env.RAILWAY_PUBLIC_DOMAIN : "");
  if (webAppUrl && !webAppUrl.startsWith("http")) webAppUrl = "https://" + webAppUrl;

  const keyboard = [
    [{ text: "📋 Today's Greeting Review (/review)", callback_data: "review:summary" }],
    [{ text: "📜 Weekly Church Bulletin (/bulletin)", callback_data: "bulletin:show" }]
  ];

  if (webAppUrl && webAppUrl.length > 8) {
    const authParam = process.env.ADMIN_ID && !webAppUrl.includes("auth=")
      ? (webAppUrl.includes("?") ? `&auth=${process.env.ADMIN_ID}` : `?auth=${process.env.ADMIN_ID}`)
      : "";
    keyboard.push([{ text: "🌐 Open Web Admin Dashboard", web_app: { url: `${webAppUrl}${authParam}` } }]);
  }

  keyboard.push(
    [{ text: "👥 Members", callback_data: "members:list:0:active" }, { text: "📅 Events", callback_data: "events:list" }],
    [{ text: "📋 Tasks", callback_data: "tasks:list" }, { text: "📊 Analytics", callback_data: "stats:show" }],
    [{ text: "🗓 Calendar", callback_data: "calendar:show:current" }, { text: "👥 Leaders & Invites", callback_data: "users:list" }],
    [{ text: "⚙️ Settings", callback_data: "settings:show" }, { text: "❓ Help Wizard (/help)", callback_data: "help:topic:overview" }]
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

  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const payload = match[1]?.trim();
    const userId = msg?.from?.id;

    // 1. Authorized leader: open menu
    if (isAdmin(userId)) {
      clearState(msg.chat.id);
      return await renderScreen(bot, msg.chat.id, null, homeScreen());
    }

    // 2. Invite token redemption: /start invite_<token>
    if (payload && payload.startsWith("invite_")) {
      const token = payload.replace("invite_", "").trim();
      const name = `${msg.from.first_name || ""} ${msg.from.last_name || ""}`.trim() || msg.from.username || "Church Leader";
      try {
        const user = await redeemInviteToken({
          token,
          telegramId: userId,
          name,
          username: msg.from.username || ""
        });

        clearState(msg.chat.id);
        const welcomeText = `🎉 <b>Welcome to Salem PBC!</b>\n\nவணக்கம் <b>${user.name}</b>!\nYour invitation has been accepted. You have been granted <b>${user.role === "staff" ? "Staff" : "Co-Admin"}</b> access to the church bot.\n\nTap below to open the main menu:`;
        await bot.sendMessage(msg.chat.id, welcomeText, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: "🏠 Open Main Menu", callback_data: "home:show" }]]
          }
        });

        if (process.env.ADMIN_ID) {
          await bot.sendMessage(
            process.env.ADMIN_ID,
            `🔔 <b>New Leader Joined via Invite Link:</b>\n👤 <b>${user.name}</b> (@${user.username || "N/A"})\nRole: <b>${user.role}</b>\nID: <code>${user.telegramId}</code>`,
            { parse_mode: "HTML" }
          ).catch(() => {});
        }
        return;
      } catch (err) {
        return await bot.sendMessage(
          msg.chat.id,
          `⚠️ <b>Invalid or Expired Invite Link</b>\n\n${err.message}.\nPlease ask the church administrator to send a fresh invite link.`,
          { parse_mode: "HTML" }
        );
      }
    }

    // 3. Unauthorized visitor: friendly access request prompt
    const name = `${msg.from?.first_name || ""} ${msg.from?.last_name || ""}`.trim() || msg.from?.username || "Friend";
    const promptText = `✝️ <b>Salem Primitive Baptist Church</b>\n<i>Church Management Bot (SPBC)</i>\n\nவணக்கம் <b>${name}</b>!\nThis bot is restricted to authorized church pastors, leaders, and staff.\n\nIf you are part of church leadership, tap below to request access. The administrator will be notified to approve you with a single tap.`;

    await bot.sendMessage(msg.chat.id, promptText, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🙋‍♂️ Request Access / அனுமதி கோரவும்", callback_data: "auth:request" }]
        ]
      }
    });
  });

  bot.onText(/\/menu/, openMenu);
  bot.onText(/\/(?:admin|dashboard)/, openMenu);

  bot.onText(/\/help(?:\s+(.+))?/, adminOnly(async (msg, match) => {
    const rawTopic = match[1]?.trim().toLowerCase();
    let topicKey = "overview";
    if (rawTopic) {
      if (rawTopic.includes("mem") || rawTopic.includes("find")) topicKey = "members";
      else if (rawTopic.includes("greet") || rawTopic.includes("wish") || rawTopic.includes("review")) topicKey = "greetings";
      else if (rawTopic.includes("bull") || rawTopic.includes("announc")) topicKey = "bulletin";
      else if (rawTopic.includes("event") || rawTopic.includes("cal")) topicKey = "events";
      else if (rawTopic.includes("task")) topicKey = "tasks";
      else if (rawTopic.includes("bib") || rawTopic.includes("vers") || rawTopic.includes("scrip") || rawTopic.includes("memo")) topicKey = "scripture";
      else if (rawTopic.includes("sys") || rawTopic.includes("back") || rawTopic.includes("stat") || rawTopic.includes("qual")) topicKey = "system";
    }
    const screen = helpScreen(topicKey);
    await renderScreen(bot, msg.chat.id, null, screen);
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
    await renderScreen(bot, chatId, messageId, helpScreen("overview"));
  },
  "help:topic": async ({ bot, chatId, messageId, args }) => {
    const topic = args[0] || "overview";
    await renderScreen(bot, chatId, messageId, helpScreen(topic));
  }
};
