import TelegramBot from "node-telegram-bot-api";
import Member from "../models/Member.js";
import { ensureSpouse } from "../services/memberService.js";

let bot;
const S = new Map(); // per-chat state

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
  ["ℹ️ Help", "🆔 My ID"]
]);

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
    bot.sendMessage(
      msg.chat.id,
      "Use buttons only.\nMembers → browse\nSearch → find\nAdd → create\nOpen member → View/Edit/Delete"
    );
  });

  // -------- LIST / PAGINATION --------
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

    await bot.sendMessage(chatId, `👥 Members (${total})`, ikb(rows));
  };

  // -------- SEARCH (button-driven prompt) --------
  bot.onText(/🔍 Search/, (msg) => {
    if (!isAdmin(msg)) return;
    S.set(msg.chat.id, { step: "search_query" });
    bot.sendMessage(msg.chat.id, "Type name to search:");
  });

  // -------- ADD FLOW (buttons) --------
  bot.onText(/➕ Add/, (msg) => {
    if (!isAdmin(msg)) return;
    S.set(msg.chat.id, { step: "add_name", data: {} });
    bot.sendMessage(msg.chat.id, "Enter Name:");
  });

  // -------- STATS --------
  bot.onText(/📊 Stats/, async (msg) => {
    if (!isAdmin(msg)) return;
    const total = await Member.countDocuments();
    const married = await Member.countDocuments({ isMarried: true });
    const pastors = await Member.countDocuments({ isPastor: true });
    bot.sendMessage(
      msg.chat.id,
      `📊 Stats\nTotal: ${total}\nMarried: ${married}\nPastors: ${pastors}`
    );
  });

  // -------- MESSAGE HANDLER (minimal typing only where needed) --------
  bot.on("message", async (msg) => {
    const st = S.get(msg.chat.id);
    if (!st || msg.text?.startsWith("/")) return;

    const t = msg.text;

    // SEARCH
    if (st.step === "search_query") {
      S.delete(msg.chat.id);
      return renderList(msg.chat.id, 0, t);
    }

    // ADD NAME
    if (st.step === "add_name") {
      st.data.name = t;
      st.step = "add_gender";
      return bot.sendMessage(
        msg.chat.id,
        "Select Gender:",
        ikb([
          [
            { text: "Male", callback_data: "g_male" },
            { text: "Female", callback_data: "g_female" }
          ]
        ])
      );
    }

    // DOB (typed)
    if (st.step === "add_dob") {
      st.data.dob = t;
      st.data.birthday = `${t.split("-")[1]}-${t.split("-")[2]}`;
      st.step = "add_married";
      return bot.sendMessage(
        msg.chat.id,
        "Married?",
        ikb([
          [
            { text: "Yes", callback_data: "m_yes" },
            { text: "No", callback_data: "m_no" }
          ]
        ])
      );
    }

    // SPOUSE NAME (typed)
    if (st.step === "add_spouse") {
      st.data.spouseName = t;
      st.data.spouseGender =
        st.data.gender === "male" ? "female" : "male";
      await saveMember(msg.chat.id, st.data);
      S.delete(msg.chat.id);
      return bot.sendMessage(msg.chat.id, "✅ Saved", mainMenu);
    }
  });

  // -------- CALLBACKS --------
  bot.on("callback_query", async (q) => {
    const chatId = q.message.chat.id;
    const data = q.data;

    // menu
    if (data === "menu") {
      await bot.sendMessage(chatId, "📊 Church CMS", mainMenu);
      return;
    }

    // pagination
    if (data.startsWith("pg_")) {
      const [, p, query] = data.split("_");
      return renderList(chatId, Number(p), query || "");
    }

    // open member
    if (data.startsWith("open_")) {
      const id = data.replace("open_", "");
      const m = await Member.findById(id);
      if (!m) return bot.sendMessage(chatId, "Not found");

      const txt =
        `👤 ${m.name}\n` +
        `Gender: ${m.gender}\n` +
        `Role: ${m.role || "-"}\n` +
        `DOB: ${m.dob || "-"}\n` +
        `Birthday: ${m.birthday || "-"}\n` +
        `Married: ${m.isMarried ? "Yes" : "No"}\n` +
        `Spouse: ${m.spouseName || "-"}`;

      return bot.sendMessage(
        chatId,
        txt,
        ikb([
          [
            { text: "✏️ Edit", callback_data: `edit_${id}` },
            { text: "❌ Delete", callback_data: `del_${id}` }
          ],
          [{ text: "🔙 Back", callback_data: "menu" }]
        ])
      );
    }

    // delete confirm
    if (data.startsWith("del_")) {
      const id = data.replace("del_", "");
      return bot.sendMessage(
        chatId,
        "Confirm delete?",
        ikb([
          [
            { text: "Yes", callback_data: `delc_${id}` },
            { text: "No", callback_data: "menu" }
          ]
        ])
      );
    }

    if (data.startsWith("delc_")) {
      const id = data.replace("delc_", "");
      await Member.deleteOne({ _id: id });
      return bot.sendMessage(chatId, "🗑️ Deleted", mainMenu);
    }

    // edit menu
    if (data.startsWith("edit_")) {
      const id = data.replace("edit_", "");
      S.set(chatId, { step: "edit_pick", id });
      return bot.sendMessage(
        chatId,
        "Select field:",
        ikb([
          [
            { text: "Gender", callback_data: "ef_gender" },
            { text: "Role", callback_data: "ef_role" }
          ],
          [
            { text: "DOB", callback_data: "ef_dob" },
            { text: "Marriage", callback_data: "ef_married" }
          ],
          [{ text: "🔙", callback_data: "menu" }]
        ])
      );
    }

    // add gender
    if (data === "g_male" || data === "g_female") {
      const st = S.get(chatId);
      if (!st) return;
      st.data.gender = data === "g_male" ? "male" : "female";
      st.step = "add_role";
      return bot.sendMessage(
        chatId,
        "Select Role:",
        ikb([
          [
            { text: "Pastor", callback_data: "r_pastor" },
            { text: "Treasurer", callback_data: "r_treasurer" }
          ],
          [
            { text: "Secretary", callback_data: "r_secretary" },
            { text: "None", callback_data: "r_none" }
          ]
        ])
      );
    }

    // add role
    if (data.startsWith("r_")) {
      const st = S.get(chatId);
      if (!st) return;

      const map = {
        r_pastor: { isPastor: true },
        r_treasurer: { role: "treasurer" },
        r_secretary: { role: "secretary" },
        r_none: {}
      };

      Object.assign(st.data, map[data]);
      st.step = "add_dob";
      return bot.sendMessage(chatId, "Enter DOB (YYYY-MM-DD):");
    }

    // married
    if (data === "m_yes" || data === "m_no") {
      const st = S.get(chatId);
      if (!st) return;

      st.data.isMarried = data === "m_yes";
      if (!st.data.isMarried) {
        await saveMember(chatId, st.data);
        S.delete(chatId);
        return bot.sendMessage(chatId, "✅ Saved", mainMenu);
      }

      st.step = "add_spouse";
      return bot.sendMessage(chatId, "Enter Spouse Name:");
    }

    // edit fields
    if (data.startsWith("ef_")) {
      const st = S.get(chatId);
      if (!st) return;

      if (data === "ef_gender") {
        st.step = "edit_gender";
        return bot.sendMessage(
          chatId,
          "Select Gender:",
          ikb([
            [
              { text: "Male", callback_data: "eg_male" },
              { text: "Female", callback_data: "eg_female" }
            ]
          ])
        );
      }

      if (data === "ef_role") {
        st.step = "edit_role";
        return bot.sendMessage(
          chatId,
          "Select Role:",
          ikb([
            [
              { text: "Pastor", callback_data: "er_pastor" },
              { text: "Treasurer", callback_data: "er_treasurer" }
            ],
            [
              { text: "Secretary", callback_data: "er_secretary" },
              { text: "None", callback_data: "er_none" }
            ]
          ])
        );
      }

      if (data === "ef_dob") {
        st.step = "edit_dob";
        return bot.sendMessage(chatId, "Enter DOB (YYYY-MM-DD):");
      }

      if (data === "ef_married") {
        st.step = "edit_married";
        return bot.sendMessage(
          chatId,
          "Married?",
          ikb([
            [
              { text: "Yes", callback_data: "em_yes" },
              { text: "No", callback_data: "em_no" }
            ]
          ])
        );
      }
    }

    // edit gender
    if (data === "eg_male" || data === "eg_female") {
      const st = S.get(chatId);
      if (!st) return;
      const val = data === "eg_male" ? "male" : "female";
      await Member.updateOne({ _id: st.id }, { gender: val });
      return bot.sendMessage(chatId, "✅ Updated", mainMenu);
    }

    // edit role
    if (data.startsWith("er_")) {
      const st = S.get(chatId);
      if (!st) return;

      const map = {
        er_pastor: { isPastor: true, role: null },
        er_treasurer: { role: "treasurer", isPastor: false },
        er_secretary: { role: "secretary", isPastor: false },
        er_none: { role: null, isPastor: false }
      };

      await Member.updateOne({ _id: st.id }, map[data]);
      return bot.sendMessage(chatId, "✅ Updated", mainMenu);
    }

    // edit married
    if (data === "em_yes" || data === "em_no") {
      const st = S.get(chatId);
      if (!st) return;

      const isMarried = data === "em_yes";
      await Member.updateOne({ _id: st.id }, { isMarried });
      if (isMarried) {
        st.step = "edit_spouse";
        return bot.sendMessage(chatId, "Enter Spouse Name:");
      }
      return bot.sendMessage(chatId, "✅ Updated", mainMenu);
    }
  });

  console.log("🤖 Telegram CMS UI ready");
};

const saveMember = async (chatId, data) => {
  const m = new Member(data);
  await m.save();
  await ensureSpouse(m);
};

export const sendMessage = async (text) => {
  if (!bot) return;
  await bot.sendMessage(process.env.CHAT_ID, text);
};