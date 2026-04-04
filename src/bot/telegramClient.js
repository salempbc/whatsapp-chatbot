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

const monthNames = {
  "01": "January","02": "February","03": "March","04": "April",
  "05": "May","06": "June","07": "July","08": "August",
  "09": "September","10": "October","11": "November","12": "December"
};

export const initTelegram = () => {
  bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

  bot.onText(/\/start/, (msg) => {
    if (!isAdmin(msg)) return bot.sendMessage(msg.chat.id, "❌ Unauthorized");
    bot.sendMessage(msg.chat.id, "📊 Church CMS", menu);
  });

  bot.onText(/🆔 My ID/, (msg) => {
    bot.sendMessage(msg.chat.id, `🆔 ${msg.from.id}`);
  });

  /* ---------------- MEMBERS ---------------- */
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

  /* ---------------- ADD ---------------- */
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

  /* ---------------- CALLBACK ---------------- */
  bot.on("callback_query", async (q) => {
    const chatId = q.message.chat.id;
    const data = q.data;

    /* ---------- MENU ---------- */
    if (data === "menu") {
      return bot.sendMessage(chatId, "📊 CMS", menu);
    }

    /* ---------- PAGINATION ---------- */
    if (data.startsWith("pg_")) {
      return renderList(chatId, Number(data.split("_")[1]));
    }

    /* ---------- PROFILE ---------- */
    if (data.startsWith("open_")) {
      const id = data.replace("open_", "");
      const m = await Member.findById(id);

      return bot.sendMessage(chatId,
        `👤 ${m.name}
Gender: ${m.gender || "-"}
Role: ${m.role || "-"}`,
        ikb([
          [
            { text: "✏️ Edit", callback_data: `edit_${id}` },
            { text: "🗑 Delete", callback_data: `del_${id}` }
          ],
          [
            { text: "↩️ Undo", callback_data: `undo_${id}` },
            { text: "📜 History", callback_data: `hist_${id}` }
          ]
        ])
      );
    }

    /* ---------- DELETE ---------- */
    if (data.startsWith("del_")) {
      const id = data.replace("del_", "");
      await Member.updateOne({ _id: id }, { isDeleted: true });
      return bot.sendMessage(chatId, "🗑 Deleted");
    }

    /* ---------- UNDO ---------- */
    if (data.startsWith("undo_")) {
      const id = data.replace("undo_", "");

      const last = await Meta.findOne({ memberId: id })
        .sort({ createdAt: -1 });

      if (!last) return bot.sendMessage(chatId, "No history");

      await Member.updateOne({ _id: id }, last.before);

      return bot.sendMessage(chatId, "↩️ Undo done");
    }

    /* ---------- HISTORY ---------- */
    if (data.startsWith("hist_")) {
      const id = data.replace("hist_", "");

      const logs = await Meta.find({ memberId: id }).limit(5);

      let txt = "📜 History\n\n";
      logs.forEach((l, i) => {
        txt += `${i + 1}. ${l.createdAt.toLocaleString()}\n`;
      });

      return bot.sendMessage(chatId, txt);
    }

    /* ================= CALENDAR ================= */

    if (data.startsWith("cal_")) {
      const [, month, filter] = data.split("_");

      const map = await getMonthlyCalendar();
      const days = map[month] || {};

      let text = `📅 *${monthNames[month]}*\n\n`;

      Object.keys(days).sort().forEach((dd) => {
        const entries = days[dd].filter(e => {
          if (filter === "bday") return e.includes("🎂");
          if (filter === "wed") return e.includes("💍");
          return true;
        });

        if (!entries.length) return;

        text += `${dd}:\n`;
        entries.forEach(e => text += `  ${e}\n`);
        text += "\n";
      });

      const prev = String(Number(month) - 1).padStart(2, "0");
      const next = String(Number(month) + 1).padStart(2, "0");

      return bot.sendMessage(chatId, text, ikb([
        [
          { text: "◀️", callback_data: `cal_${prev}_${filter}` },
          { text: "▶️", callback_data: `cal_${next}_${filter}` }
        ],
        [
          { text: "🎂", callback_data: `cal_${month}_bday` },
          { text: "💍", callback_data: `cal_${month}_wed` },
          { text: "📊", callback_data: `cal_${month}_all` }
        ]
      ]));
    }
  });

  /* ---------------- CALENDAR START ---------------- */
  bot.onText(/📅 Calendar/, async (msg) => {
    const currentMonth = new Date()
      .toLocaleString("en-US", { timeZone: "Asia/Kolkata", month: "2-digit" });

    bot.sendMessage(msg.chat.id, "📅 Calendar", ikb([
      [
        { text: "January", callback_data: "cal_01_all" },
        { text: "February", callback_data: "cal_02_all" }
      ],
      [
        { text: "March", callback_data: "cal_03_all" },
        { text: "April", callback_data: "cal_04_all" }
      ],
      [
        { text: "May", callback_data: "cal_05_all" },
        { text: "June", callback_data: "cal_06_all" }
      ],
      [
        { text: "July", callback_data: "cal_07_all" },
        { text: "August", callback_data: "cal_08_all" }
      ],
      [
        { text: "September", callback_data: "cal_09_all" },
        { text: "October", callback_data: "cal_10_all" }
      ],
      [
        { text: "November", callback_data: "cal_11_all" },
        { text: "December", callback_data: "cal_12_all" }
      ]
    ]));
  });

  /* ---------------- STATS ---------------- */
  bot.onText(/📊 Stats/, async (msg) => {
    const total = await Member.countDocuments();
    const male = await Member.countDocuments({ gender: "male" });
    const female = await Member.countDocuments({ gender: "female" });

    bot.sendMessage(msg.chat.id,
      `📊 Stats\nTotal: ${total}\nMale: ${male}\nFemale: ${female}`);
  });

  /* ---------------- BACKUP ---------------- */
  bot.onText(/📤 Backup/, async (msg) => {
    const data = await Member.find();
    fs.writeFileSync("backup.json", JSON.stringify(data, null, 2));
    bot.sendDocument(msg.chat.id, "backup.json");
  });

  console.log("🤖 FULL TELEGRAM CMS READY");
};

export const sendMessage = async (text) => {
  if (!bot) return;
  await bot.sendMessage(process.env.CHAT_ID, text);
};