import TelegramBot from "node-telegram-bot-api";
import Member from "../models/Member.js";
import { ensureSpouse } from "../services/memberService.js";

let bot; // ✅ shared instance

const ADMIN_ID = process.env.ADMIN_ID;

/**
 * 🔒 ADMIN CHECK
 */
const isAdmin = (msg) => {
  return String(msg.from.id) === String(ADMIN_ID);
};

/**
 * 🎛️ MAIN MENU
 */
const mainMenu = {
  reply_markup: {
    keyboard: [
      ["➕ Add Member", "✏️ Update Member"],
      ["❌ Delete Member", "📋 List Members"],
      ["ℹ️ Help", "🆔 My ID"]
    ],
    resize_keyboard: true
  }
};

/**
 * 🚀 INIT TELEGRAM (FIXES YOUR ERROR)
 */
export const initTelegram = () => {
  bot = new TelegramBot(process.env.BOT_TOKEN, {
    polling: true
  });

  /**
   * START
   */
  bot.onText(/\/start/, (msg) => {
    if (!isAdmin(msg)) {
      return bot.sendMessage(msg.chat.id, "❌ Unauthorized");
    }

    bot.sendMessage(
      msg.chat.id,
      `📊 *Church Member Control Panel*

Use buttons below or commands.`,
      { parse_mode: "Markdown", ...mainMenu }
    );
  });

  /**
   * 🆔 GET ADMIN ID
   */
  bot.onText(/🆔 My ID/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      `🆔 Your Telegram ID:\n\n${msg.from.id}\n\n👉 Put this as ADMIN_ID`
    );
  });

  /**
   * ℹ️ HELP
   */
  bot.onText(/ℹ️ Help/, (msg) => {
    if (!isAdmin(msg)) return;

    bot.sendMessage(
      msg.chat.id,
      `📖 *Usage Guide*

➕ Add:
\`\`\`
/add name,gender,role(optional),dob(YYYY-MM-DD),married(true/false),spouseName
\`\`\`

✏️ Update:
/update name field=value

❌ Delete:
/delete name

📋 List:
/list`,
      { parse_mode: "Markdown" }
    );
  });

  /**
   * ➕ ADD
   */
  bot.onText(/\/add (.+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    try {
      const [name, gender, role, dob, married, spouseName] =
        match[1].split(",");

      const birthday = dob
        ? `${dob.split("-")[1]}-${dob.split("-")[2]}`
        : "";

      const member = new Member({
        name: name.trim(),
        gender: gender.trim(),
        role: role || null,
        dob: dob || null,
        birthday,
        isMarried: married === "true",
        spouseName: spouseName || null,
        spouseGender: gender === "male" ? "female" : "male"
      });

      await member.save();
      await ensureSpouse(member);

      bot.sendMessage(msg.chat.id, `✅ Added: ${name}`);
    } catch (err) {
      bot.sendMessage(msg.chat.id, `❌ ${err.message}`);
    }
  });

  /**
   * ✏️ UPDATE
   */
  bot.onText(/\/update (.+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    try {
      const [name, update] = match[1].split(" ");
      const [field, value] = update.split("=");

      const member = await Member.findOne({ name });

      if (!member) {
        return bot.sendMessage(msg.chat.id, "❌ Member not found");
      }

      member[field] = value;
      await member.save();

      await ensureSpouse(member);

      bot.sendMessage(msg.chat.id, `✅ Updated: ${name}`);
    } catch (err) {
      bot.sendMessage(msg.chat.id, `❌ ${err.message}`);
    }
  });

  /**
   * ❌ DELETE
   */
  bot.onText(/\/delete (.+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    try {
      const name = match[1].trim();

      await Member.deleteOne({ name });

      bot.sendMessage(msg.chat.id, `🗑️ Deleted: ${name}`);
    } catch (err) {
      bot.sendMessage(msg.chat.id, `❌ ${err.message}`);
    }
  });

  /**
   * 📋 LIST
   */
  bot.onText(/📋 List Members|\/list/, async (msg) => {
    if (!isAdmin(msg)) return;

    const members = await Member.find().limit(30);

    let text = "📋 *Members*\n\n";

    members.forEach((m) => {
      text += `• ${m.name} (${m.gender})\n`;
    });

    bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
  });

  console.log("🤖 Telegram bot initialized");
};

/**
 * 📤 SEND MESSAGE (USED BY SCHEDULER)
 */
export const sendMessage = async (text) => {
  try {
    if (!bot) {
      console.error("❌ Bot not initialized");
      return;
    }

    await bot.sendMessage(process.env.CHAT_ID, text, {
      parse_mode: "Markdown"
    });

    console.log("📤 Telegram message sent");
  } catch (err) {
    console.error("❌ Telegram send error:", err.message);
  }
};