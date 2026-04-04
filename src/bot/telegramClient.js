import TelegramBot from "node-telegram-bot-api";
import Member from "../models/Member.js";
import { ensureSpouse } from "../services/memberService.js";

let bot;
const ADMIN_ID = process.env.ADMIN_ID;

// per-user state
const userState = new Map();

/**
 * 🔒 ADMIN CHECK
 */
const isAdmin = (msg) =>
  String(msg.from.id) === String(ADMIN_ID);

/**
 * 🎛️ MAIN MENU
 */
const mainMenu = {
  reply_markup: {
    keyboard: [
      ["➕ Add Member", "✏️ Edit Member"],
      ["❌ Delete Member", "📋 List Members"],
      ["🔍 Search", "📊 Stats"],
      ["ℹ️ Help", "🆔 My ID"]
    ],
    resize_keyboard: true
  }
};

/**
 * 🚀 INIT
 */
export const initTelegram = () => {
  bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

  bot.onText(/\/start/, (msg) => {
    if (!isAdmin(msg)) return bot.sendMessage(msg.chat.id, "❌ Unauthorized");

    bot.sendMessage(
      msg.chat.id,
      "📊 Church Member Panel (Form Mode)",
      mainMenu
    );
  });

  /**
   * 🆔 ID
   */
  bot.onText(/🆔 My ID/, (msg) => {
    bot.sendMessage(msg.chat.id, `Your ID: ${msg.from.id}`);
  });

  /**
   * ➕ ADD FLOW START
   */
  bot.onText(/➕ Add Member/, (msg) => {
    if (!isAdmin(msg)) return;

    userState.set(msg.chat.id, { step: "name", data: {} });
    bot.sendMessage(msg.chat.id, "Enter Name:");
  });

  /**
   * 🔍 SEARCH
   */
  bot.onText(/🔍 Search/, (msg) => {
    if (!isAdmin(msg)) return;

    userState.set(msg.chat.id, { step: "search" });
    bot.sendMessage(msg.chat.id, "Enter name to search:");
  });

  /**
   * ❌ DELETE FLOW
   */
  bot.onText(/❌ Delete Member/, (msg) => {
    if (!isAdmin(msg)) return;

    userState.set(msg.chat.id, { step: "delete" });
    bot.sendMessage(msg.chat.id, "Enter name to delete:");
  });

  /**
   * 📋 LIST
   */
  bot.onText(/📋 List Members/, async (msg) => {
    if (!isAdmin(msg)) return;

    const members = await Member.find().limit(50);

    let text = "📋 Members:\n\n";
    members.forEach((m) => {
      text += `• ${m.name}\n`;
    });

    bot.sendMessage(msg.chat.id, text);
  });

  /**
   * 📊 STATS
   */
  bot.onText(/📊 Stats/, async (msg) => {
    if (!isAdmin(msg)) return;

    const total = await Member.countDocuments();
    bot.sendMessage(msg.chat.id, `Total Members: ${total}`);
  });

  /**
   * 🧠 MAIN MESSAGE HANDLER (FORM ENGINE)
   */
  bot.on("message", async (msg) => {
    const state = userState.get(msg.chat.id);
    if (!state || msg.text.startsWith("/")) return;

    const text = msg.text;

    // SEARCH
    if (state.step === "search") {
      const m = await Member.findOne({
        name: new RegExp(text, "i")
      });

      if (!m) return bot.sendMessage(msg.chat.id, "Not found");

      return bot.sendMessage(
        msg.chat.id,
        `Name: ${m.name}\nGender: ${m.gender}\nRole: ${m.role || "-"}`
      );
    }

    // DELETE
    if (state.step === "delete") {
      await Member.deleteOne({ name: text });
      userState.delete(msg.chat.id);
      return bot.sendMessage(msg.chat.id, `Deleted ${text}`);
    }

    // ADD FLOW
    if (state.step === "name") {
      state.data.name = text;
      state.step = "gender";

      return bot.sendMessage("Enter Gender (male/female):");
    }

    if (state.step === "gender") {
      state.data.gender = text.toLowerCase();
      state.step = "role";

      return bot.sendMessage("Enter Role (or '-' to skip):");
    }

    if (state.step === "role") {
      if (text !== "-") state.data.role = text;
      state.step = "dob";

      return bot.sendMessage("Enter DOB (YYYY-MM-DD):");
    }

    if (state.step === "dob") {
      state.data.dob = text;
      state.data.birthday = `${text.split("-")[1]}-${text.split("-")[2]}`;
      state.step = "married";

      return bot.sendMessage("Married? (yes/no):");
    }

    if (state.step === "married") {
      state.data.isMarried = text === "yes";

      if (!state.data.isMarried) {
        return saveMember(msg, state);
      }

      state.step = "spouseName";
      return bot.sendMessage("Enter Spouse Name:");
    }

    if (state.step === "spouseName") {
      state.data.spouseName = text;
      state.data.spouseGender =
        state.data.gender === "male" ? "female" : "male";

      return saveMember(msg, state);
    }
  });

  console.log("🤖 Telegram FORM UI initialized");
};

/**
 * 💾 SAVE
 */
const saveMember = async (msg, state) => {
  try {
    const member = new Member(state.data);
    await member.save();

    await ensureSpouse(member);

    userState.delete(msg.chat.id);

    bot.sendMessage(msg.chat.id, `✅ Saved: ${member.name}`);
  } catch (err) {
    bot.sendMessage(msg.chat.id, `❌ ${err.message}`);
  }
};

export const sendMessage = async (text) => {
  if (!bot) return;

  await bot.sendMessage(process.env.CHAT_ID, text);
};