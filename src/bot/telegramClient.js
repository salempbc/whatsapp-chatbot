import TelegramBot from "node-telegram-bot-api";
import Member from "../models/Member.js";
import { ensureSpouse } from "../services/memberService.js";
import fs from "fs";

let bot;
const S = new Map();

const isAdmin = (msg) => {
  const envId = process.env.ADMIN_ID;
  if (!envId) return true;
  return String(msg.from.id).trim() === String(envId).trim();
};

const kb = (rows) => ({ reply_markup: { keyboard: rows, resize_keyboard: true } });
const ikb = (rows) => ({ reply_markup: { inline_keyboard: rows } });

const mainMenu = kb([
  ["👥 Members", "➕ Add"],
  ["🔍 Search", "📊 Stats"],
  ["📤 Export", "ℹ️ Help"],
  ["🆔 My ID"]
]);

const profileCard = (m) => {
  return (
`👤 *${m.name}*

📌 *Basic*
• Gender: ${m.gender}
• Role: ${m.role || "—"}
• Pastor: ${m.isPastor ? "Yes" : "No"}

🎂 *Dates*
• DOB: ${m.dob || "—"}
• Birthday: ${m.birthday || "—"}

💍 *Family*
• Married: ${m.isMarried ? "Yes" : "No"}
• Spouse: ${m.spouseName || "—"}`
  );
};

export const initTelegram = () => {
  bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

  bot.onText(/\/start/, (msg) => {
    if (!isAdmin(msg)) return bot.sendMessage(msg.chat.id, "❌ Unauthorized");
    bot.sendMessage(msg.chat.id, "📊 Church CMS", mainMenu);
  });

  bot.onText(/🆔 My ID/, (msg) => {
    bot.sendMessage(msg.chat.id, `Your ID: ${msg.from.id}`);
  });

  bot.onText(/ℹ️ Help/, (msg) => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, "Fully button-driven CMS. Use menu.");
  });

  // EXPORT
  bot.onText(/📤 Export/, async (msg) => {
    if (!isAdmin(msg)) return;

    const members = await Member.find();

    const csv = [
      ["Name","Gender","Role","DOB","Birthday","Married","Spouse","Pastor"],
      ...members.map(m => [
        m.name,
        m.gender,
        m.role || "",
        m.dob || "",
        m.birthday || "",
        m.isMarried ? "Yes" : "No",
        m.spouseName || "",
        m.isPastor ? "Yes" : "No"
      ])
    ].map(r => r.join(",")).join("\n");

    fs.writeFileSync("members.csv", csv);
    bot.sendDocument(msg.chat.id, "members.csv");
  });

  // MEMBERS LIST
  bot.onText(/👥 Members/, async (msg) => {
    if (!isAdmin(msg)) return;
    await renderList(msg.chat.id, 0);
  });

  const renderList = async (chatId, page = 0, q = "") => {
    const limit = 8;
    const filter = q ? { name: new RegExp(q, "i") } : {};

    const total = await Member.countDocuments(filter);
    const members = await Member.find(filter)
      .sort({ name: 1 })
      .skip(page * limit)
      .limit(limit);

    const rows = members.map((m) => [
      { text: m.name, callback_data: `open_${m._id}` }
    ]);

    const nav = [];
    if (page > 0) nav.push({ text: "◀️", callback_data: `pg_${page - 1}_${q}` });
    if ((page + 1) * limit < total)
      nav.push({ text: "▶️", callback_data: `pg_${page + 1}_${q}` });

    if (nav.length) rows.push(nav);
    rows.push([{ text: "🔙 Menu", callback_data: "menu" }]);

    bot.sendMessage(chatId, `👥 Members (${total})`, ikb(rows));
  };

  // SEARCH
  bot.onText(/🔍 Search/, (msg) => {
    if (!isAdmin(msg)) return;
    S.set(msg.chat.id, { step: "search" });
    bot.sendMessage(msg.chat.id, "Type name:");
  });

  // ADD
  bot.onText(/➕ Add/, (msg) => {
    if (!isAdmin(msg)) return;
    S.set(msg.chat.id, { step: "add_name", data: {} });
    bot.sendMessage(msg.chat.id, "Enter Name:");
  });

  // STATS
  bot.onText(/📊 Stats/, async (msg) => {
    if (!isAdmin(msg)) return;

    const total = await Member.countDocuments();
    const married = await Member.countDocuments({ isMarried: true });

    bot.sendMessage(msg.chat.id, `Total: ${total}\nMarried: ${married}`);
  });

  bot.on("message", async (msg) => {
    const st = S.get(msg.chat.id);
    if (!st || msg.text?.startsWith("/")) return;

    const t = msg.text;

    if (st.step === "search") {
      const results = await Member.find({
        name: new RegExp(t, "i")
      }).limit(10);

      const rows = results.map(m => [
        { text: m.name, callback_data: `open_${m._id}` }
      ]);

      return bot.sendMessage(msg.chat.id, "Results:", ikb(rows));
    }

    if (st.step === "add_name") {
      st.data.name = t;
      st.step = "add_gender";
      return bot.sendMessage(msg.chat.id, "Select Gender:", ikb([
        [
          { text: "Male", callback_data: "g_male" },
          { text: "Female", callback_data: "g_female" }
        ]
      ]));
    }

    if (st.step === "add_dob") {
      st.data.dob = t;
      st.data.birthday = `${t.split("-")[1]}-${t.split("-")[2]}`;
      st.step = "add_married";

      return bot.sendMessage(msg.chat.id, "Married?", ikb([
        [
          { text: "Yes", callback_data: "m_yes" },
          { text: "No", callback_data: "m_no" }
        ]
      ]));
    }

    if (st.step === "add_spouse") {
      st.data.spouseName = t;
      st.data.spouseGender = st.data.gender === "male" ? "female" : "male";

      const m = new Member(st.data);
      await m.save();
      await ensureSpouse(m);

      S.delete(msg.chat.id);
      return bot.sendMessage(msg.chat.id, "✅ Saved", mainMenu);
    }
  });

  bot.on("callback_query", async (q) => {
    const chatId = q.message.chat.id;
    const data = q.data;

    if (data === "menu") {
      return bot.sendMessage(chatId, "📊 Church CMS", mainMenu);
    }

    if (data.startsWith("pg_")) {
      const [, p, query] = data.split("_");
      return renderList(chatId, Number(p), query || "");
    }

    if (data.startsWith("open_")) {
      const id = data.replace("open_", "");
      const m = await Member.findById(id);

      return bot.sendMessage(chatId, profileCard(m), {
        parse_mode: "Markdown",
        ...ikb([
          [
            { text: "✏️ Edit", callback_data: `edit_${id}` },
            { text: "❌ Delete", callback_data: `del_${id}` }
          ]
        ])
      });
    }

    if (data.startsWith("del_")) {
      const id = data.replace("del_", "");
      await Member.deleteOne({ _id: id });
      return bot.sendMessage(chatId, "🗑️ Deleted", mainMenu);
    }

    if (data === "g_male" || data === "g_female") {
      const st = S.get(chatId);
      st.data.gender = data === "g_male" ? "male" : "female";
      st.step = "add_dob";
      return bot.sendMessage(chatId, "Enter DOB:");
    }

    if (data === "m_yes" || data === "m_no") {
      const st = S.get(chatId);
      st.data.isMarried = data === "m_yes";

      if (!st.data.isMarried) {
        const m = new Member(st.data);
        await m.save();
        await ensureSpouse(m);

        S.delete(chatId);
        return bot.sendMessage(chatId, "✅ Saved", mainMenu);
      }

      st.step = "add_spouse";
      return bot.sendMessage(chatId, "Enter Spouse Name:");
    }
  });

  console.log("🤖 Production CMS ready");
};

export const sendMessage = async (text) => {
  if (!bot) return;
  await bot.sendMessage(process.env.CHAT_ID, text);
};