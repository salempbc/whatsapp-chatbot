import Memorial from "../../models/Memorial.js";
import { adminOnly } from "../guard.js";

export const buildMemorialsPage = async (page = 1) => {
  const PAGE_SIZE = 5;
  const total = await Memorial.countDocuments();
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const memorials = await Memorial.find()
    .sort({ date: 1 })
    .skip((currentPage - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE);

  let text = `🕊️ *Memorial Tracker*\n`;
  text += `_Page ${currentPage} of ${totalPages} (${total} tracked)_\n\n`;

  if (!memorials.length) {
    text += `_No memorials tracked currently._`;
  } else {
    memorials.forEach((m) => {
      text += `*${m.date}* - ${m.name}`;
      if (m.relation) text += ` (${m.relation})`;
      text += `\n_ID: ${m._id}_\n\n`;
    });
  }

  const keyboard = [];
  if (totalPages > 1) {
    const navRow = [];
    if (currentPage > 1) {
      navRow.push({ text: "◀️ Prev", callback_data: `memorial:page:${currentPage - 1}` });
    }
    navRow.push({ text: `Page ${currentPage}/${totalPages}`, callback_data: `memorial:page:${currentPage}` });
    if (currentPage < totalPages) {
      navRow.push({ text: "Next ▶️", callback_data: `memorial:page:${currentPage + 1}` });
    }
    keyboard.push(navRow);
  }

  return { text, keyboard };
};

export const memorialCallbacks = {
  "memorial:page": async ({ bot, chatId, messageId, args }) => {
    const page = parseInt(args[0], 10) || 1;
    const { text, keyboard } = await buildMemorialsPage(page);
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard }
    }).catch(() => {});
  }
};

export const registerMemorial = (bot) => {
  bot.onText(/^\/addmemorial\s+(\d{2}-\d{2})\s+([^,]+)(?:,\s*(.+))?$/i, adminOnly(async (msg, match) => {
    const chatId = msg.chat.id;
    const date = match[1];
    const name = match[2].trim();
    const relation = match[3] ? match[3].trim() : "";

    try {
      await Memorial.create({ date, name, relation });
      let text = `✅ *Memorial Saved*\n\nName: ${name}\nDate: ${date}`;
      if (relation) text += `\nNote: ${relation}`;
      await bot.sendMessage(chatId, text, { parse_mode: "Markdown" }).catch(() => {});
    } catch (err) {
      await bot.sendMessage(chatId, "⚠️ Failed to save memorial.").catch(() => {});
    }
  }));

  bot.onText(/^\/listmemorials$/i, adminOnly(async (msg) => {
    const chatId = msg.chat.id;
    const { text, keyboard } = await buildMemorialsPage(1);
    const opts = { parse_mode: "Markdown" };
    if (keyboard.length > 0) opts.reply_markup = { inline_keyboard: keyboard };
    await bot.sendMessage(chatId, text, opts).catch(() => {});
  }));

  bot.onText(/^\/delmemorial\s+([a-zA-Z0-9_]+)$/i, adminOnly(async (msg, match) => {
    const chatId = msg.chat.id;
    const id = match[1];

    try {
      await Memorial.findByIdAndDelete(id);
      await bot.sendMessage(chatId, "✅ Memorial deleted.").catch(() => {});
    } catch {
      await bot.sendMessage(chatId, "⚠️ Invalid ID.").catch(() => {});
    }
  }));
};
