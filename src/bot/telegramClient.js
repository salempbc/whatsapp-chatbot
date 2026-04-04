import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import Member from "../models/Member.js";
import Meta from "../models/Meta.js";
import { ensureSpouse, findSimilar } from "../services/memberService.js";
import { getMonthlyCalendar } from "../services/eventService.js";

let bot;
const STATE = new Map();

const isAdmin = (msg) => {
  if (!process.env.ADMIN_ID) return true;
  return String(msg.from.id) === String(process.env.ADMIN_ID);
};

const kb = (rows) => ({ reply_markup: { keyboard: rows, resize_keyboard: true } });
const ikb = (rows) => ({ reply_markup: { inline_keyboard: rows } });

const menu = kb([
  ["👥 Members", "➕ Add"],
  ["🔍 Search", "📊 Stats"],
  ["📅 Calendar", "📤 Backup"],
  ["📥 Restore", "🗑 Trash"],
  ["ℹ️ Help", "🆔 My ID"]
]);

export const initTelegram = () => {
  bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

  bot.onText(/\/start/, (msg) => {
    if (!isAdmin(msg)) return bot.sendMessage(msg.chat.id, "❌ Unauthorized");
    bot.sendMessage(msg.chat.id, "📊 Church CMS", menu);
  });

  bot.onText(/🆔 My ID/, (msg) => {
    bot.sendMessage(msg.chat.id, `🆔 ${msg.from.id}`);
  });

  /* ---------------- MEMBERS LIST ---------------- */
  bot.onText(/👥 Members/, async (msg) => {
    renderList(msg.chat.id, 0);
  });

  const renderList = async (chatId, page = 0) => {
    const limit = 5;

    const members = await Member.find({ isDeleted: { $ne: true } })
      .skip(page * limit)
      .limit(limit);

    const rows = members.map((m) => [
      { text: m.name, callback_data: `open_${m._id}` }
    ]);

    rows.push([
      { text: "◀️", callback_data: `pg_${page - 1}` },
      { text: "▶️", callback_data: `pg_${page + 1}` }
    ]);

    rows.push([{ text: "🔙 Menu", callback_data: "menu" }]);

    bot.sendMessage(chatId, "👥 Members", ikb(rows));
  };

  /* ---------------- ADD (AI DUP CHECK) ---------------- */
  bot.onText(/➕ Add/, (msg) => {
    STATE.set(msg.chat.id, { step: "add_name" });
    bot.sendMessage(msg.chat.id, "Enter name:");
  });

  bot.on("message", async (msg) => {
    const state = STATE.get(msg.chat.id);
    if (!state) return;

    if (state.step === "add_name") {
      const similar = await findSimilar(msg.text);

      if (similar.length) {
        return bot.sendMessage(
          msg.chat.id,
          `⚠️ Possible duplicates:\n${similar.map(s => s.name).join("\n")}`
        );
      }

      const m = new Member({ name: msg.text });
      await m.save();

      STATE.delete(msg.chat.id);
      bot.sendMessage(msg.chat.id, "✅ Added");
    }
  });

  /* ---------------- PROFILE ---------------- */
  bot.on("callback_query", async (q) => {
    const id = q.data;

    if (id.startsWith("open_")) {
      const m = await Member.findById(id.replace("open_", ""));

      return bot.sendMessage(
        q.message.chat.id,
        `👤 ${m.name}
Gender: ${m.gender || "-"}
Role: ${m.role || "-"}
DOB: ${m.dob || "-"}`,
        ikb([
          [
            { text: "✏️ Edit", callback_data: `edit_${m._id}` },
            { text: "🗑 Delete", callback_data: `del_${m._id}` }
          ],
          [
            { text: "↩️ Undo", callback_data: `undo_${m._id}` },
            { text: "📜 History", callback_data: `hist_${m._id}` }
          ]
        ])
      );
    }

    /* ---------------- EDIT FORM ---------------- */
    if (id.startsWith("edit_")) {
      const mid = id.replace("edit_", "");

      return bot.sendMessage(q.message.chat.id, "Edit:", ikb([
        [
          { text: "Gender", callback_data: `set_gender_${mid}` },
          { text: "Role", callback_data: `set_role_${mid}` }
        ],
        [
          { text: "Marriage", callback_data: `set_marriage_${mid}` }
        ]
      ]));
    }

    if (id.startsWith("set_gender_")) {
      const mid = id.split("_")[2];

      return bot.sendMessage(q.message.chat.id, "Select:", ikb([
        [
          { text: "Male", callback_data: `g_${mid}_male` },
          { text: "Female", callback_data: `g_${mid}_female` }
        ]
      ]));
    }

    if (id.startsWith("g_")) {
      const [, mid, val] = id.split("_");

      const m = await Member.findById(mid);
      const before = { ...m._doc };

      m.gender = val;
      await m.save();

      await Meta.create({ memberId: mid, before, after: m });

      return bot.sendMessage(q.message.chat.id, "✅ Updated");
    }

    /* ---------------- SOFT DELETE ---------------- */
    if (id.startsWith("del_")) {
      const mid = id.replace("del_", "");

      await Member.updateOne({ _id: mid }, { isDeleted: true });

      return bot.sendMessage(q.message.chat.id, "🗑 Moved to trash");
    }

    /* ---------------- UNDO ---------------- */
    if (id.startsWith("undo_")) {
      const mid = id.replace("undo_", "");

      const last = await Meta.findOne({ memberId: mid })
        .sort({ createdAt: -1 });

      if (!last) return bot.sendMessage(q.message.chat.id, "No history");

      await Member.updateOne({ _id: mid }, last.before);

      return bot.sendMessage(q.message.chat.id, "↩️ Undo success");
    }

    /* ---------------- HISTORY ---------------- */
    if (id.startsWith("hist_")) {
      const mid = id.replace("hist_", "");

      const logs = await Meta.find({ memberId: mid }).limit(5);

      let txt = "📜 History\n\n";
      logs.forEach((l, i) => {
        txt += `${i + 1}. ${l.createdAt.toLocaleString()}\n`;
      });

      return bot.sendMessage(q.message.chat.id, txt);
    }

    if (id === "menu") {
      return bot.sendMessage(q.message.chat.id, "Menu", menu);
    }
  });

  /* ---------------- CALENDAR ---------------- */
  bot.onText(/📅 Calendar/, async (msg) => {
    const map = await getMonthlyCalendar();

    let text = "📅 Calendar\n\n";
    Object.keys(map).forEach(k => {
      text += `${k}: ${map[k].join(", ")}\n`;
    });

    bot.sendMessage(msg.chat.id, text);
  });

  /* ---------------- STATS ---------------- */
  bot.onText(/📊 Stats/, async (msg) => {
    const total = await Member.countDocuments();
    const male = await Member.countDocuments({ gender: "male" });
    const female = await Member.countDocuments({ gender: "female" });

    bot.sendMessage(msg.chat.id,
      `📊 Stats
Total: ${total}
Male: ${male}
Female: ${female}`);
  });

  /* ---------------- BACKUP ---------------- */
  bot.onText(/📤 Backup/, async (msg) => {
    const data = await Member.find();
    fs.writeFileSync("backup.json", JSON.stringify(data));

    bot.sendDocument(msg.chat.id, "backup.json");
  });

  console.log("🤖 FULL CMS READY");
};

export const sendMessage = async (text) => {
  if (!bot) return;
  await bot.sendMessage(process.env.CHAT_ID, text);
};