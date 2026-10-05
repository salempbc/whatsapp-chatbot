import { isAdmin, isSuperAdmin, adminOnly } from "../guard.js";
import { renderScreen } from "../ui.js";
import {
  getAllUsers,
  requestAccess,
  approveUser,
  rejectUser,
  revokeUser,
  createInviteToken,
  redeemInviteToken
} from "../../services/userService.js";

/**
 * Screen displaying currently authorized church leaders & pending users.
 */
export const usersScreen = async () => {
  const allUsers = await getAllUsers();
  const superAdminId = process.env.ADMIN_ID || "Not Configured";
  const activeLeaders = allUsers.filter((u) => u.status === "active" && !u.telegramId.startsWith("pending_invite_"));
  const pendingRequests = allUsers.filter((u) => u.status === "pending" && !u.telegramId.startsWith("pending_invite_"));

  let text = `<b>👥 Church Bot Leadership & Access</b>\n\n`;
  text += `👑 <b>Primary Super Admin:</b> <code>${superAdminId}</code>\n\n`;

  if (activeLeaders.length === 0) {
    text += `<i>No additional co-admins or staff added yet. Tap below to invite leaders via WhatsApp or Telegram.</i>\n\n`;
  } else {
    text += `<b>Active Leaders (${activeLeaders.length}):</b>\n`;
    activeLeaders.forEach((u, i) => {
      const handle = u.username ? ` (@${u.username})` : "";
      const roleBadge = u.role === "staff" ? "👤 Staff" : "👑 Co-Admin";
      text += `${i + 1}. <b>${u.name}</b>${handle}\n   Role: ${roleBadge} | Added by: ${u.addedBy || "Admin"}\n`;
    });
    text += `\n`;
  }

  if (pendingRequests.length > 0) {
    text += `⚠️ <b>Pending Access Requests (${pendingRequests.length}):</b>\n`;
    pendingRequests.forEach((u) => {
      text += `• <b>${u.name}</b> (${u.username ? "@" + u.username : "No handle"}) — ID: <code>${u.telegramId}</code>\n`;
    });
    text += `\n`;
  }

  text += `<i>💡 Tip: Co-admins have access to member directory, celebration reviews, events, tasks, and bulletins.</i>`;

  const keyboard = [
    [{ text: "➕ Generate 1-Click Invite Link", callback_data: "users:invite" }]
  ];

  // Action buttons for each active leader to allow instant revocation
  if (activeLeaders.length > 0) {
    activeLeaders.slice(0, 5).forEach((u) => {
      keyboard.push([
        { text: `🗑 Revoke ${u.name.slice(0, 15)}`, callback_data: `users:revoke:${u.telegramId}` }
      ]);
    });
  }

  // Pending approval buttons
  if (pendingRequests.length > 0) {
    pendingRequests.slice(0, 3).forEach((u) => {
      keyboard.push([
        { text: `✅ Approve ${u.name.slice(0, 10)} (Admin)`, callback_data: `auth:approve:${u.telegramId}:admin` },
        { text: `❌ Reject`, callback_data: `auth:reject:${u.telegramId}` }
      ]);
    });
  }

  keyboard.push([{ text: "🏠 Return to Dashboard", callback_data: "home:show" }]);

  return { text, keyboard };
};

/**
 * Screen displaying the newly generated one-click invite link.
 */
export const inviteScreen = async (bot) => {
  let botUsername = process.env.BOT_USERNAME || "";
  if (!botUsername && bot) {
    try {
      const me = await bot.getMe();
      botUsername = me.username;
    } catch (_) {}
  }
  botUsername = botUsername || "SalemPBC_Bot";

  const { inviteUrl, expiresAt } = await createInviteToken({
    role: "admin",
    createdBy: "Church Admin",
    hoursValid: 72,
    botUsername
  });

  const shareText = `✝️ Greetings! You are invited to join the Salem Primitive Baptist Church (SPBC) Bot as an authorized church leader.\n\nTap this link to activate your access:\n${inviteUrl}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;

  const text = `<b>🔗 One-Click Leader Invite Link</b>

Share this link with your co-pastor, church secretary, or staff member:

👉 <code>${inviteUrl}</code>

<b>Why this is easy:</b>
• The recipient does <b>NOT</b> need to know their numeric Telegram ID.
• When they tap the link and press <b>Start</b>, they are authorized instantly!
• Link expires in 72 hours (on ${new Date(expiresAt).toLocaleDateString()}).`;

  const keyboard = [
    [{ text: "📲 Share on WhatsApp", url: whatsappUrl }],
    [{ text: "👥 View Authorized Leaders", callback_data: "users:list" }],
    [{ text: "🏠 Return to Dashboard", callback_data: "home:show" }]
  ];

  return { text, keyboard };
};

export const usersCallbacks = {
  // Public access request handler (triggered by non-admin tapping "Request Access")
  "auth:request": async ({ bot, chatId, messageId, query }) => {
    const from = query.from || {};
    const telegramId = from.id;
    const name = `${from.first_name || ""} ${from.last_name || ""}`.trim() || from.username || "Church Member";
    const username = from.username || "";

    const { status } = await requestAccess({ telegramId, name, username });

    if (status === "already_active") {
      await bot.answerCallbackQuery(query.id, {
        text: "✅ You are already an authorized leader! Type /menu to open.",
        show_alert: true
      }).catch(() => {});
      return;
    }

    // Acknowledge user
    await bot.answerCallbackQuery(query.id, {
      text: "✅ Request submitted! The church admin has been notified.",
      show_alert: true
    }).catch(() => {});

    try {
      await bot.editMessageText(
        `⏳ <b>Request Submitted</b>\n\nவணக்கம் <b>${name}</b>!\nYour access request has been sent to the church administrator. You will receive an instant notification here as soon as they approve you.`,
        { chat_id: chatId, message_id: messageId, parse_mode: "HTML" }
      );
    } catch (_) {}

    // Send instant approval notification card to Super Admin
    const superAdminChat = process.env.ADMIN_ID;
    if (superAdminChat) {
      const handleStr = username ? `@${username}` : "None";
      const adminText = `🔔 <b>New Church Bot Access Request</b>

👤 <b>Name:</b> ${name}
💬 <b>Username:</b> ${handleStr}
🆔 <b>Telegram ID:</b> <code>${telegramId}</code>
⏰ <b>Time:</b> ${new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata" })} IST

Tap an action below to grant instant access:`;

      const adminKeyboard = [
        [
          { text: "👑 Approve as Co-Admin", callback_data: `auth:approve:${telegramId}:admin` },
          { text: "👤 Approve as Staff", callback_data: `auth:approve:${telegramId}:staff` }
        ],
        [{ text: "❌ Reject Request", callback_data: `auth:reject:${telegramId}` }]
      ];

      await bot.sendMessage(superAdminChat, adminText, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: adminKeyboard }
      }).catch((e) => console.error("Could not notify admin of access request:", e.message));
    }
  },

  // Admin approves a pending user
  "auth:approve": async ({ bot, chatId, messageId, args, query }) => {
    const [targetTid, role] = args;
    if (!targetTid) return;
    const adminName = query.from?.first_name || "Admin";

    const user = await approveUser({
      telegramId: targetTid,
      role: role || "admin",
      approvedBy: adminName
    });

    const roleName = user.role === "staff" ? "Staff" : "Co-Admin";

    try {
      await bot.editMessageText(
        `✅ <b>User Approved!</b>\n\n<b>${user.name}</b> (${user.username ? "@" + user.username : "ID: " + targetTid}) has been granted <b>${roleName}</b> privileges by ${adminName}.`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: "👥 View All Leaders", callback_data: "users:list" }]]
          }
        }
      );
    } catch (_) {}

    // Notify the approved user directly
    try {
      await bot.sendMessage(
        targetTid,
        `🎉 <b>Access Approved!</b>\n\nவணக்கம் <b>${user.name}</b>!\nYour request for the <b>Salem PBC Church Bot</b> has been approved with <b>${roleName}</b> access.\n\nTap below to open your church dashboard:`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: "🏠 Open Main Menu", callback_data: "home:show" }]]
          }
        }
      );
    } catch (e) {
      console.warn("Could not message approved user directly:", e.message);
    }

    return `Approved ${user.name} as ${roleName}!`;
  },

  // Admin rejects a pending request
  "auth:reject": async ({ bot, chatId, messageId, args }) => {
    const [targetTid] = args;
    if (!targetTid) return;

    await rejectUser(targetTid);

    try {
      await bot.editMessageText(`❌ Access request for ID <code>${targetTid}</code> was rejected.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "👥 View All Leaders", callback_data: "users:list" }]]
        }
      });
    } catch (_) {}

    // Politely notify user
    try {
      await bot.sendMessage(
        targetTid,
        `Church access request update: We are unable to approve this request at this time. Please contact the church pastor if you believe this is an error.`,
        { parse_mode: "HTML" }
      );
    } catch (_) {}

    return "Access request rejected";
  },

  // View users screen
  "users:list": async ({ bot, chatId, messageId }) => {
    const screen = await usersScreen();
    await renderScreen(bot, chatId, messageId, screen);
  },

  // Generate invite screen
  "users:invite": async ({ bot, chatId, messageId }) => {
    const screen = await inviteScreen(bot);
    await renderScreen(bot, chatId, messageId, screen);
  },

  // Revoke user
  "users:revoke": async ({ bot, chatId, messageId, args }) => {
    const [targetTid] = args;
    if (!targetTid) return;

    await revokeUser(targetTid);
    const screen = await usersScreen();
    await renderScreen(bot, chatId, messageId, screen);
    return "Leader access revoked";
  }
};

/**
 * Register command listeners for /users and /invite
 */
export const registerUsers = (bot) => {
  bot.onText(/\/users/, adminOnly(async (msg) => {
    const screen = await usersScreen();
    await renderScreen(bot, msg.chat.id, null, screen);
  }));

  bot.onText(/\/invite/, adminOnly(async (msg) => {
    const screen = await inviteScreen(bot);
    await renderScreen(bot, msg.chat.id, null, screen);
  }));
};
