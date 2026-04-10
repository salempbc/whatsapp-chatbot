import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import Member from "../models/Member.js";
import Meta from "../models/Meta.js";
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
  ["👥 Members", "➕ Add"],
  ["📅 Calendar", "📊 Stats"],
  ["📤 Backup"]
]);

export const initTelegram = () => {
  bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

  /* ================= START ================= */
  bot.onText(/\/start/, (msg) => {
    if (!isAdmin(msg)) return bot.sendMessage(msg.chat.id, "❌ Unauthorized");
    bot.sendMessage(msg.chat.id, "📊 Church CMS", menu);
  });

  /* ================= MEMBERS ================= */
  bot.onText(/👥 Members/, async (msg) => {
    const members = await Member.find({ isDeleted: { $ne: true } });

    const rows = members.map((m) => [
      { text: m.name, callback_data: `open_${m._id}` }
    ]);

    bot.sendMessage(msg.chat.id, "👥 Members", ikb(rows));
  });

  /* ================= CALLBACK ================= */
  bot.on("callback_query", async (q) => {
    const chatId = q.message.chat.id;
    const data = q.data;

    /* ================= PROFILE VIEW ================= */
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

Wedding: ${m.wedding || "-"}
`;

      const buttons = [
        [
          { text: "✏️ Edit", callback_data: `edit_${id}` },
          { text: "📸 Photo", callback_data: `photo_${id}` }
        ],
        [
          { text: "💍 Link Spouse", callback_data: `link_${id}` },
          { text: "🗑 Delete", callback_data: `del_${id}` }
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

    /* ================= PHOTO ================= */
    if (data.startsWith("photo_")) {
      const id = data.split("_")[1];

      STATE.set(chatId, {
        action: "upload_photo",
        memberId: id
      });

      return bot.sendMessage(chatId, "📸 Send photo");
    }

    /* ================= WEDDING LINKER ================= */
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

    /* ================= LINK CONFIRM ================= */
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

      return bot.sendMessage(chatId, "💍 Linked successfully");
    }

    /* ================= DELETE ================= */
    if (data.startsWith("del_")) {
      const id = data.split("_")[1];
      await Member.updateOne({ _id: id }, { isDeleted: true });
      return bot.sendMessage(chatId, "🗑 Deleted");
    }

    /* ================= EDIT ================= */
    if (data.startsWith("edit_")) {
      const id = data.split("_")[1];

      return bot.sendMessage(
        chatId,
        "Edit options",
        ikb([
          [
            { text: "Toggle Pastor", callback_data: `toggle_${id}_pastor` },
            { text: "Toggle Child", callback_data: `toggle_${id}_child` }
          ]
        ])
      );
    }

    /* ================= TOGGLE ================= */
    if (data.startsWith("toggle_")) {
      const [, id, field] = data.split("_");

      const m = await Member.findById(id);

      if (field === "pastor") m.isPastor = !m.isPastor;
      if (field === "child") m.isChild = !m.isChild;

      await m.save();

      return bot.sendMessage(chatId, "🔁 Updated");
    }
  });

  /* ================= PHOTO HANDLER ================= */
  bot.on("photo", async (msg) => {
    if (!isAdmin(msg)) return;

    const state = STATE.get(msg.chat.id);
    if (!state || state.action !== "upload_photo") return;

    const fileId = msg.photo[msg.photo.length - 1].file_id;

    await Member.updateOne(
      { _id: state.memberId },
      { photo: fileId }
    );

    STATE.delete(msg.chat.id);

    bot.sendMessage(msg.chat.id, "✅ Photo saved");
  });

  /* ================= CALENDAR ================= */
  bot.onText(/📅 Calendar/, async (msg) => {
    const data = await getMonthlyCalendar();

    let text = "📅 Calendar\n\n";

    Object.keys(data.birthdays).forEach((d) => {
      text += `🎂 ${d}: ${data.birthdays[d].join(", ")}\n`;
    });

    Object.keys(data.weddings).forEach((d) => {
      text += `💍 ${d}: ${data.weddings[d].join(", ")}\n`;
    });

    bot.sendMessage(msg.chat.id, text);
  });

  /* ================= STATS ================= */
  bot.onText(/📊 Stats/, async (msg) => {
    const total = await Member.countDocuments();
    const male = await Member.countDocuments({ gender: "male" });
    const female = await Member.countDocuments({ gender: "female" });

    bot.sendMessage(
      msg.chat.id,
      `📊 Stats\nTotal: ${total}\nMale: ${male}\nFemale: ${female}`
    );
  });

  /* ================= BACKUP ================= */
  bot.onText(/📤 Backup/, async (msg) => {
    const data = await Member.find();
    fs.writeFileSync("backup.json", JSON.stringify(data, null, 2));
    bot.sendDocument(msg.chat.id, "backup.json");
  });

  console.log("🤖 Telegram CMS READY");
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