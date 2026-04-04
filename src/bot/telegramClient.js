import TelegramBot from "node-telegram-bot-api";
import mongoose from "mongoose";
import fs from "fs";
import Member from "../models/Member.js";
import { ensureSpouse } from "../services/memberService.js";  
import Meta from "../models/Meta.js";
/* ---------------- INIT ---------------- */
let bot;
const S = new Map();

const isAdmin = (msg) => {
  if (!process.env.ADMIN_ID) return true;
  return String(msg.from.id) === String(process.env.ADMIN_ID);
};

const kb = (rows) => ({ reply_markup: { keyboard: rows, resize_keyboard: true } });
const ikb = (rows) => ({ reply_markup: { inline_keyboard: rows } });

const menu = kb([
  ["👥 Members", "➕ Add"],
  ["🔍 Search", "📤 Backup"],
  ["📥 Restore", "📊 Stats"],
  ["ℹ️ Help", "🆔 My ID"]
]);

/* ---------------- INIT ---------------- */
export const initTelegram = () => {
  bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

  bot.onText(/\/start/, (msg) => {
    if (!isAdmin(msg)) return bot.sendMessage(msg.chat.id, "❌ Unauthorized");
    bot.sendMessage(msg.chat.id, "📊 Church CMS", menu);
  });

  bot.onText(/🆔 My ID/, (msg) => {
    bot.sendMessage(msg.chat.id, `ID: ${msg.from.id}`);
  });

  bot.onText(/ℹ️ Help/, (msg) => {
    bot.sendMessage(msg.chat.id, "Fully button-driven CMS with backup/restore.");
  });

  /* ---------------- MEMBERS ---------------- */
  bot.onText(/👥 Members/, async (msg) => {
    renderList(msg.chat.id, 0);
  });

  const renderList = async (chatId, page = 0) => {
    const limit = 6;
    const total = await Member.countDocuments();

    const data = await Member.find()
      .sort({ name: 1 })
      .skip(page * limit)
      .limit(limit);

    const rows = data.map((m) => [
      { text: m.name, callback_data: `open_${m._id}` }
    ]);

    const nav = [];
    if (page > 0) nav.push({ text: "◀️", callback_data: `pg_${page - 1}` });
    if ((page + 1) * limit < total) nav.push({ text: "▶️", callback_data: `pg_${page + 1}` });

    if (nav.length) rows.push(nav);
    rows.push([{ text: "🔙 Menu", callback_data: "menu" }]);

    bot.sendMessage(chatId, `👥 Members (${total})`, ikb(rows));
  };

  /* ---------------- SEARCH ---------------- */
  bot.onText(/🔍 Search/, (msg) => {
    S.set(msg.chat.id, { step: "search" });
    bot.sendMessage(msg.chat.id, "Type name:");
  });

  /* ---------------- ADD ---------------- */
  bot.onText(/➕ Add/, (msg) => {
    S.set(msg.chat.id, { step: "add_name", data: {} });
    bot.sendMessage(msg.chat.id, "Enter name:");
  });

  /* ---------------- BACKUP ---------------- */
  bot.onText(/📤 Backup/, async (msg) => {
    const data = await Member.find();
    fs.writeFileSync("backup.json", JSON.stringify(data, null, 2));

    await bot.sendDocument(msg.chat.id, {
      source: "backup.json",
      filename: "backup.json"
    });
  });

  /* ---------------- RESTORE ---------------- */
  bot.onText(/📥 Restore/, (msg) => {
    bot.sendMessage(msg.chat.id, "Send backup.json file to restore DB");
    S.set(msg.chat.id, { step: "restore_wait" });
  });

  bot.on("document", async (msg) => {
    const st = S.get(msg.chat.id);
    if (!st || st.step !== "restore_wait") return;

    const fileId = msg.document.file_id;
    const file = await bot.getFile(fileId);
    const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    const res = await fetch(url);
    const json = await res.json();

    await Member.deleteMany({});
    await Member.insertMany(json);

    S.delete(msg.chat.id);

    bot.sendMessage(msg.chat.id, "✅ DB Restored");
  });

  /* ---------------- STATS ---------------- */
  bot.onText(/📊 Stats/, async (msg) => {
    const total = await Member.countDocuments();
    bot.sendMessage(msg.chat.id, `Total: ${total}`);
  });

  /* ---------------- CALLBACK ---------------- */
  bot.on("callback_query", async (q) => {
    const chatId = q.message.chat.id;
    const data = q.data;

    if (data === "menu") {
      return bot.sendMessage(chatId, "📊 CMS", menu);
    }

    if (data.startsWith("pg_")) {
      return renderList(chatId, Number(data.split("_")[1]));
    }

    /* OPEN PROFILE */
    if (data.startsWith("open_")) {
      const id = data.replace("open_", "");
      const m = await Member.findById(id);

      return bot.sendMessage(chatId,
        `👤 ${m.name}\nGender: ${m.gender}\nRole: ${m.role || "-"}`,
        ikb([
          [
            { text: "✏️ Edit", callback_data: `edit_${id}` },
            { text: "↩️ Undo", callback_data: `undo_${id}` }
          ],
          [
            { text: "📜 History", callback_data: `hist_${id}` }
          ]
        ])
      );
    }

    /* EDIT MENU */
    if (data.startsWith("edit_")) {
      const id = data.replace("edit_", "");

      return bot.sendMessage(chatId, "Edit Field:", ikb([
        [
          { text: "Gender", callback_data: `e_gender_${id}` },
          { text: "Role", callback_data: `e_role_${id}` }
        ],
        [
          { text: "Pastor", callback_data: `e_pastor_${id}` },
          { text: "Married", callback_data: `e_married_${id}` }
        ]
      ]));
    }

    /* EDIT HANDLERS */
    if (data.startsWith("e_gender_")) {
      const id = data.split("_")[2];

      return bot.sendMessage(chatId, "Select:", ikb([
        [
          { text: "Male", callback_data: `set_gender_${id}_male` },
          { text: "Female", callback_data: `set_gender_${id}_female` }
        ]
      ]));
    }

    if (data.startsWith("set_gender_")) {
      const [, , id, val] = data.split("_");

      const m = await Member.findById(id);
      const before = { ...m._doc };

      m.gender = val;
      await m.save();

      await Meta.create({ type: "history", memberId: id, action: "update", before, after: m });

      return bot.sendMessage(chatId, "✅ Updated");
    }

    if (data.startsWith("e_role_")) {
      const id = data.split("_")[2];

      return bot.sendMessage(chatId, "Role:", ikb([
        [
          { text: "Treasurer", callback_data: `set_role_${id}_treasurer` },
          { text: "Secretary", callback_data: `set_role_${id}_secretary` }
        ],
        [
          { text: "None", callback_data: `set_role_${id}_none` }
        ]
      ]));
    }

    if (data.startsWith("set_role_")) {
      const [, , id, val] = data.split("_");

      const m = await Member.findById(id);
      const before = { ...m._doc };

      m.role = val === "none" ? null : val;
      await m.save();

      await Meta.create({ type: "history", memberId: id, action: "update", before, after: m });

      return bot.sendMessage(chatId, "✅ Updated");
    }

    /* UNDO */
    if (data.startsWith("undo_")) {
      const id = data.replace("undo_", "");

      const last = await Meta.findOne({ memberId: id }).sort({ createdAt: -1 });

      if (!last) return bot.sendMessage(chatId, "No history");

      await Member.updateOne({ _id: id }, last.before);

      return bot.sendMessage(chatId, "↩️ Undo done");
    }

    /* HISTORY */
    if (data.startsWith("hist_")) {
      const id = data.replace("hist_", "");

      const logs = await Meta.find({ memberId: id }).limit(5).sort({ createdAt: -1 });

      let txt = "📜 History\n\n";
      logs.forEach((l, i) => {
        txt += `${i + 1}. ${l.action} @ ${l.createdAt.toLocaleString()}\n`;
      });

      return bot.sendMessage(chatId, txt);
    }
  });

  console.log("🤖 Full CMS (UI + Backup + History) ready");
};

/* ---------------- SENDER ---------------- */
export const sendMessage = async (text) => {
  if (!bot) return;
  await bot.sendMessage(process.env.CHAT_ID, text);
};