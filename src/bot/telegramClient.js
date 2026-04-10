import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import Member from "../models/Member.js";
import Template from "../models/Template.js";
import { getMonthlyCalendar } from "../services/eventService.js";

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
  ["👥 Members", "🔍 Search"],
  ["📝 Templates", "📅 Calendar"],
  ["📊 Stats", "📤 Backup"]
]);

export const initTelegram = () => {
  bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

  /* START */
  bot.onText(/\/start/, (msg) => {
    if (!isAdmin(msg)) return bot.sendMessage(msg.chat.id, "❌ Unauthorized");
    bot.sendMessage(msg.chat.id, "📊 CMS", menu);
  });

  /* ================= SEARCH ================= */
  bot.onText(/🔍 Search/, (msg) => {
    STATE.set(msg.chat.id, { action: "search" });
    bot.sendMessage(msg.chat.id, "Enter name:");
  });

  bot.on("message", async (msg) => {
    const state = STATE.get(msg.chat.id);
    if (!state || !msg.text) return;

    if (state.action === "search") {
      const members = await Member.find({
        name: { $regex: msg.text, $options: "i" }
      });

      if (!members.length) {
        STATE.delete(msg.chat.id);
        return bot.sendMessage(msg.chat.id, "❌ No results");
      }

      const rows = members.map((m) => [
        { text: m.name, callback_data: `open_${m._id}` }
      ]);

      STATE.delete(msg.chat.id);
      return bot.sendMessage(msg.chat.id, "Results:", ikb(rows));
    }

    /* TEMPLATE ADD */
    if (state.action === "tpl_add") {
      await Template.create({
        type: state.type,
        content: msg.text
      });

      STATE.delete(msg.chat.id);
      return bot.sendMessage(msg.chat.id, "✅ Template added");
    }

    /* TEMPLATE EDIT */
    if (state.action === "tpl_edit") {
      await Template.updateOne(
        { _id: state.id },
        { content: msg.text }
      );

      STATE.delete(msg.chat.id);
      return bot.sendMessage(msg.chat.id, "✅ Updated");
    }
  });

  /* ================= MEMBERS ================= */
  bot.onText(/👥 Members/, async (msg) => {
    const members = await Member.find({ isDeleted: { $ne: true } });

    const rows = members.map((m) => [
      { text: m.name, callback_data: `open_${m._id}` }
    ]);

    bot.sendMessage(msg.chat.id, "Members:", ikb(rows));
  });

  /* ================= CALLBACK ================= */
  bot.on("callback_query", async (q) => {
    const chatId = q.message.chat.id;
    const data = q.data;

    /* PROFILE */
    if (data.startsWith("open_")) {
      const id = data.split("_")[1];
      const m = await Member.findById(id);

      const text = `
👤 ${m.name}

Gender: ${m.gender || "-"}
Role: ${m.role || "-"}
DOB: ${m.dob || "-"}
Birthday: ${m.birthday || "-"}

Married: ${m.isMarried ? "Yes" : "No"}
Spouse: ${m.spouseName || "-"}
`;

      const buttons = [
        [
          { text: "📸 Photo", callback_data: `photo_${id}` },
          { text: "💍 Link", callback_data: `link_${id}` }
        ]
      ];

      if (m.photo) {
        return bot.sendPhoto(chatId, m.photo, {
          caption: text,
          ...ikb(buttons)
        });
      }

      return bot.sendMessage(chatId, text, ikb(buttons));
    }

    /* PHOTO */
    if (data.startsWith("photo_")) {
      const id = data.split("_")[1];

      STATE.set(chatId, {
        action: "photo",
        memberId: id
      });

      return bot.sendMessage(chatId, "Send photo");
    }

    /* TEMPLATE UI */
    if (data === "tpl_bday" || data === "tpl_wed") {
      const type = data === "tpl_bday" ? "birthday" : "wedding";

      const list = await Template.find({ type });

      const rows = list.map((t) => [
        { text: t.content.slice(0, 25), callback_data: `tpl_edit_${t._id}` }
      ]);

      rows.push([{ text: "➕ Add", callback_data: `tpl_add_${type}` }]);

      return bot.sendMessage(chatId, "Templates", ikb(rows));
    }

    if (data.startsWith("tpl_add_")) {
      STATE.set(chatId, {
        action: "tpl_add",
        type: data.split("_")[2]
      });

      return bot.sendMessage(chatId, "Send template text");
    }

    if (data.startsWith("tpl_edit_")) {
      STATE.set(chatId, {
        action: "tpl_edit",
        id: data.split("_")[2]
      });

      return bot.sendMessage(chatId, "Send new content");
    }

    /* TEMPLATE MENU */
    if (data === "tpl_menu") {
      return bot.sendMessage(chatId, "Choose", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎂 Birthday", callback_data: "tpl_bday" }],
            [{ text: "💍 Wedding", callback_data: "tpl_wed" }]
          ]
        }
      });
    }

    /* WEDDING LINK */
    if (data.startsWith("link_")) {
      const id = data.split("_")[1];

      const others = await Member.find({
        _id: { $ne: id },
        isDeleted: { $ne: true }
      });

      const rows = others.map((m) => [
        { text: m.name, callback_data: `linksel_${id}_${m._id}` }
      ]);

      return bot.sendMessage(chatId, "Select spouse:", ikb(rows));
    }

    if (data.startsWith("linksel_")) {
      const [, id, spouseId] = data.split("_");

      const m1 = await Member.findById(id);
      const m2 = await Member.findById(spouseId);

      m1.isMarried = true;
      m2.isMarried = true;

      m1.spouseName = m2.name;
      m2.spouseName = m1.name;

      m1.spouseGender = m2.gender;
      m2.spouseGender = m1.gender;

      await m1.save();
      await m2.save();

      return bot.sendMessage(chatId, "💍 Linked");
    }
  });

  /* ================= PHOTO HANDLER ================= */
  bot.on("photo", async (msg) => {
    const state = STATE.get(msg.chat.id);
    if (!state || state.action !== "photo") return;

    const fileId = msg.photo[msg.photo.length - 1].file_id;

    await Member.updateOne(
      { _id: state.memberId },
      { photo: fileId }
    );

    STATE.delete(msg.chat.id);

    bot.sendMessage(msg.chat.id, "✅ Photo saved");
  });

  /* ================= TEMPLATE MENU BUTTON ================= */
  bot.onText(/📝 Templates/, (msg) => {
    bot.sendMessage(msg.chat.id, "Template Manager", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🎂 Birthday", callback_data: "tpl_bday" }],
          [{ text: "💍 Wedding", callback_data: "tpl_wed" }]
        ]
      }
    });
  });

  console.log("🤖 FULL CMS READY");
};

/* ================= SEND ================= */
export const sendMessage = async (text, member = null) => {
  if (!bot) return;

  if (member?.photo) {
    await bot.sendPhoto(process.env.CHAT_ID, member.photo, {
      caption: text
    });
  } else {
    await bot.sendMessage(process.env.CHAT_ID, text);
  }
};