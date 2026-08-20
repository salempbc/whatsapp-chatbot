import fs from "fs";
import Member from "../../models/Member.js";
import { exportMembersToCSV } from "../../services/exportService.js";
import { renderScreen } from "../ui.js";

const exportOptionsScreen = () => ({
  text: "<b>📤 Database Export</b>\n<i>Download the member roster as a CSV file.</i>\n\n<blockquote>Choose a filter to generate your report:</blockquote>",
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
        text: "<blockquote>❌ <i>No members found matching this filter.</i></blockquote>",
        keyboard: [[{ text: "🔙 Back", callback_data: "export:run" }]]
      });
    }

    await renderScreen(bot, chatId, messageId, {
      text: `<b>⏳ Generating Report...</b>\n<i>Processing ${members.length} records. Please wait.</i>`,
      keyboard: []
    });

    const filePath = await exportMembersToCSV(members, filter);
    await bot.sendDocument(chatId, filePath, { caption: `📄 Export — ${filter} (${members.length} members)` });
    
    // Clean up loading text
    await renderScreen(bot, chatId, messageId, {
      text: `<b>✅ Report Generated</b>\n<i>Exported ${members.length} records.</i>`,
      keyboard: [[{ text: "🔙 Back", callback_data: "export:run" }]]
    });

    fs.unlink(filePath, () => {});
  }
};
