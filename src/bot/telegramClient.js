import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import Member from "../models/Member.js";
import Meta from "../models/Meta.js";
import { ensureSpouse, findSimilar } from "../services/memberService.js";
import { getMonthlyCalendar } from "../services/eventService.js";
import { detectDuplicateAI } from "../services/aiService.js";

let bot;
const STATE = new Map();

const isAdmin = (msg) => {
  if (!process.env.ADMIN_ID) return true;
  return String(msg.from.id) === String(process.env.ADMIN_ID);
};

const kb = (rows) => ({
  reply_markup: { keyboard: rows, resize_keyboard: true }
});

const ikb = (rows) => ({
  reply_markup: { inline_keyboard: rows }
});

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

  /* ================= START ================= */
  bot.onText(/\/start/, (msg) => {
    if (!isAdmin(msg)) return bot.sendMessage(msg.chat.id, "❌ Unauthorized");
    bot.sendMessage(msg.chat.id, "📊 Church CMS", menu);
  });

  bot.onText(/🆔 My ID/, (msg) => {
    bot.sendMessage(msg.chat.id, `🆔 ${msg.from.id}`);
  });

  /* ================= MEMBERS LIST ================= */
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

  /* ================= SEARCH ================= */
  bot.onText(/🔍 Search/, (msg) => {
    STATE.set(msg.chat.id, { step: "search" });
    bot.sendMessage(msg.chat.id, "Enter name to search:");
  });

  /* ================= ADD ================= */
  bot.onText(/➕ Add/, (msg) => {
    STATE.set(msg.chat.id, { step: "add_name" });
    bot.sendMessage(msg.chat.id, "Enter name:");
  });

  /* ================= MESSAGE HANDLER ================= */
  bot.on("message", async (msg) => {
    const state = STATE.get(msg.chat.id);
    if (!state || !msg.text) return;

    /* SEARCH */
    if (state.step === "search") {
      const members = await Member.find({
        name: { $regex: msg.text, $options: "i" }
      });

      if (!members.length) {
        return bot.sendMessage(msg.chat.id, "No results");
      }

      const rows = members.map((m) => [
        { text: m.name, callback_data: `open_${m._id}` }
      ]);

      STATE.delete(msg.chat.id);
      return bot.sendMessage(msg.chat.id, "Results:", ikb(rows));
    }

    /* ADD NAME */
    if (state.step === "add_name") {
      const all = await Member.find().select("name");
      const names = all.map((n) => n.name);

      const aiMatch = await detectDuplicateAI(msg.text, names);

      if (aiMatch && aiMatch.length > 3) {
        return bot.sendMessage(
          msg.chat.id,
          `⚠️ Possible duplicates:\n${aiMatch}`
        );
      }

      const m = new Member({ name: msg.text });
      await m.save();

      STATE.delete(msg.chat.id);
      return bot.sendMessage(msg.chat.id, "✅ Member added");
    }

    /* EDIT FIELD */
    if (state.step === "edit_value") {
      const member = await Member.findById(state.id);

      const before = { ...member.toObject() };

      member[state.field] = msg.text;
      await member.save();

      await Meta.create({
        memberId: member._id,
        action: "update",
        before,
        after: member
      });

      STATE.delete(msg.chat.id);
      return bot.sendMessage(msg.chat.id, "✅ Updated");
    }
  });

  /* ================= CALLBACK ================= */
  bot.on("callback_query", async (q) => {
    const chatId = q.message.chat.id;
    const data = q.data;

    /* MENU */
    if (data === "menu") {
      return bot.sendMessage(chatId, "📊 CMS", menu);
    }

    /* PAGINATION */
    if (data.startsWith("pg_")) {
      return renderList(chatId, Number(data.split("_")[1]));
    }

    /* OPEN PROFILE */
    if (data.startsWith("open_")) {
      const id = data.replace("open_", "");
      const m = await Member.findById(id);

      return bot.sendMessage(
        chatId,
        `👤 ${m.name}

Gender: ${m.gender || "-"}
Role: ${m.role || "-"}
DOB: ${m.dob || "-"}
Birthday: ${m.birthday || "-"}
Married: ${m.isMarried ? "Yes" : "No"}
Spouse: ${m.spouseName || "-"}

Wedding: ${m.wedding || "-"}`,
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

    /* EDIT MENU */
    if (data.startsWith("edit_")) {
      const id = data.replace("edit_", "");

      return bot.sendMessage(
        chatId,
        "Select field:",
        ikb([
          [
            { text: "Name", callback_data: `ef_${id}_name` },
            { text: "Gender", callback_data: `ef_${id}_gender` }
          ],
          [
            { text: "Role", callback_data: `ef_${id}_role` },
            { text: "DOB", callback_data: `ef_${id}_dob` }
          ]
        ])
      );
    }

    /* EDIT FIELD SELECT */
    if (data.startsWith("ef_")) {
      const [, id, field] = data.split("_");

      STATE.set(chatId, {
        step: "edit_value",
        id,
        field
      });

      return bot.sendMessage(chatId, `Enter new ${field}:`);
    }

    /* DELETE */
    if (data.startsWith("del_")) {
      const id = data.replace("del_", "");
      await Member.updateOne({ _id: id }, { isDeleted: true });
      return bot.sendMessage(chatId, "🗑 Deleted");
    }

    /* UNDO */
    if (data.startsWith("undo_")) {
      const id = data.replace("undo_", "");

      const last = await Meta.findOne({ memberId: id })
        .sort({ createdAt: -1 });

      if (!last) return bot.sendMessage(chatId, "No history");

      await Member.updateOne({ _id: id }, last.before);

      return bot.sendMessage(chatId, "↩️ Undo done");
    }

    /* HISTORY */
    if (data.startsWith("hist_")) {
      const id = data.replace("hist_", "");

      const logs = await Meta.find({ memberId: id }).limit(5);

      let txt = "📜 History\n\n";
      logs.forEach((l, i) => {
        txt += `${i + 1}. ${l.createdAt.toLocaleString()}\n`;
      });

      return bot.sendMessage(chatId, txt);
    }

    /* CALENDAR */
    if (data.startsWith("cal_")) {
      const [, month] = data.split("_");

      const map = await getMonthlyCalendar();
      const days = map[month] || {};

      let text = `📅 ${monthNames[month]}\n\n`;

      Object.keys(days)
        .sort()
        .forEach((dd) => {
          text += `${dd}:\n`;
          days[dd].forEach((e) => {
            if (e.type === "birthday") {
              text += `🎂 ${e.name}\n`;
            } else {
              text += `💍 ${e.husband} & ${e.wife}\n`;
            }
          });
          text += "\n";
        });

      return bot.sendMessage(chatId, text);
    }
  });

  /* CALENDAR START */
  bot.onText(/📅 Calendar/, async (msg) => {
    bot.sendMessage(
      msg.chat.id,
      "📅 Select Month",
      ikb([
        [{ text: "Jan", callback_data: "cal_01" }],
        [{ text: "Feb", callback_data: "cal_02" }],
        [{ text: "Mar", callback_data: "cal_03" }],
        [{ text: "Apr", callback_data: "cal_04" }],
        [{ text: "May", callback_data: "cal_05" }],
        [{ text: "Jun", callback_data: "cal_06" }]
      ])
    );
  });

  /* STATS */
  bot.onText(/📊 Stats/, async (msg) => {
    const total = await Member.countDocuments();
    const male = await Member.countDocuments({ gender: "male" });
    const female = await Member.countDocuments({ gender: "female" });

    bot.sendMessage(
      msg.chat.id,
      `📊 Stats\nTotal: ${total}\nMale: ${male}\nFemale: ${female}`
    );
  });

  /* BACKUP */
  bot.onText(/📤 Backup/, async (msg) => {
    const data = await Member.find();
    fs.writeFileSync("backup.json", JSON.stringify(data, null, 2));
    bot.sendDocument(msg.chat.id, "backup.json");
  });

  console.log("🤖 Telegram CMS Ready");
};

/* ================= SEND ================= */
export const sendMessage = async (text) => {
  if (!bot) return;

  await bot.sendMessage(process.env.CHAT_ID, text, {
    parse_mode: "Markdown"
  });
};