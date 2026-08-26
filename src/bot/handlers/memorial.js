import Memorial from "../../models/Memorial.js";
import { adminOnly } from "../guard.js";

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
      bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
    } catch (err) {
      bot.sendMessage(chatId, "⚠️ Failed to save memorial.");
    }
  }));

  bot.onText(/^\/listmemorials$/i, adminOnly(async (msg) => {
    const chatId = msg.chat.id;
    const memorials = await Memorial.find().sort({ date: 1 });

    if (memorials.length === 0) {
      return bot.sendMessage(chatId, "No memorials tracked currently.");
    }

    let text = "🕊️ *Memorial Tracker*\n\n";
    memorials.forEach((m) => {
      text += `*${m.date}* - ${m.name}`;
      if (m.relation) text += ` (${m.relation})`;
      text += `\n_ID: ${m._id}_\n\n`;
    });

    bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  }));

  bot.onText(/^\/delmemorial\s+([a-zA-Z0-9_]+)$/i, adminOnly(async (msg, match) => {
    const chatId = msg.chat.id;
    const id = match[1];

    try {
      await Memorial.findByIdAndDelete(id);
      bot.sendMessage(chatId, "✅ Memorial deleted.");
    } catch {
      bot.sendMessage(chatId, "⚠️ Invalid ID.");
    }
  }));
};
