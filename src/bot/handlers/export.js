import fs from "fs";
import Member from "../../models/Member.js";
import { exportMembersToCSV } from "../../services/exportService.js";
import { renderScreen } from "../ui.js";

const exportOptionsScreen = () => ({
  text: "📤 Export — choose filter:",
  keyboard: [
    [{ text: "✅ Active members only", callback_data: "export:run:active" }],
    [{ text: "👥 All members",         callback_data: "export:run:all"    }],
    [{ text: "💍 Married couples only", callback_data: "export:run:married"}],
    [{ text: "🏠 Home",                callback_data: "home:show"         }]
  ]
});

export const exportCallbacks = {
  "export:run": async ({ bot, chatId, messageId, args }) => {
    /* No filter arg → show options */
    if (!args[0]) {
      return renderScreen(bot, chatId, messageId, exportOptionsScreen());
    }

    const filter = args[0]; // "active" | "all" | "married"

    let query = { isDeleted: { $ne: true } };
    if (filter === "active")  query.isActive = { $ne: false };
    if (filter === "married") { query.isActive = { $ne: false }; query.isMarried = true; }

    const members = await Member.find(query).sort({ name: 1 });

    if (!members.length) {
      return renderScreen(bot, chatId, messageId, {
        text: "❌ No members found for this filter.",
        keyboard: [[{ text: "🔙 Back", callback_data: "export:run" }]]
      });
    }

    await renderScreen(bot, chatId, messageId, {
      text: `⏳ Generating CSV for ${members.length} members...`,
      keyboard: []
    });

    const filePath = await exportMembersToCSV(members, filter);
    await bot.sendDocument(chatId, filePath, { caption: `📄 Export — ${filter} (${members.length} members)` });
    fs.unlink(filePath, () => {});
  }
};
