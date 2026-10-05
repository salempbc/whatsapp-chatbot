import fs from "fs";
import Member from "../../models/Member.js";
import { exportMembersToCSV } from "../../services/exportService.js";
import { createDatabaseDump } from "../../services/backupService.js";
import { renderScreen } from "../ui.js";

const exportOptionsScreen = () => ({
  text: "<b>📤 Database Export & Backup</b>\n<i>Download member rosters as CSV or generate a complete database backup.</i>\n\n<blockquote>Choose an export format or backup option:</blockquote>",
  keyboard: [
    [{ text: "✅ Active members only (CSV)", callback_data: "export:run:active" }],
    [{ text: "👥 All members (CSV)",         callback_data: "export:run:all"    }],
    [{ text: "💍 Married couples only (CSV)", callback_data: "export:run:married"}],
    [{ text: "📦 Full Database Backup (.json.gz)", callback_data: "export:backup" }],
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
  },

  "export:backup": async ({ bot, chatId, messageId }) => {
    await renderScreen(bot, chatId, messageId, {
      text: "<b>⏳ Generating Full Database Backup...</b>\n<i>Exporting all collections and compressing to .json.gz archive...</i>",
      keyboard: []
    });

    try {
      const dump = await createDatabaseDump();
      await bot.sendDocument(chatId, dump.filePath, {
        caption: `📦 <b>SPBC Database Backup</b>\n\n` +
                 `• <b>Collections:</b> ${dump.collectionsCount}\n` +
                 `• <b>Total Records:</b> ${dump.totalRecords}\n` +
                 `• <b>Size:</b> ${(dump.sizeBytes / 1024).toFixed(1)} KB\n` +
                 `• <b>Format:</b> Compressed JSON (.json.gz)\n\n` +
                 `<i>Keep this file secure. To restore, unpack and import using MongoDB tools.</i>`,
        parse_mode: "HTML"
      });

      await renderScreen(bot, chatId, messageId, {
        text: `<b>✅ Database Backup Complete!</b>\n<i>Archive sent directly to your chat (${(dump.sizeBytes / 1024).toFixed(1)} KB).</i>`,
        keyboard: [
          [{ text: "📤 Export Menu", callback_data: "export:run" }],
          [{ text: "🏠 Return to Dashboard", callback_data: "home:show" }]
        ]
      });

      fs.unlink(dump.filePath, () => {});
    } catch (err) {
      await renderScreen(bot, chatId, messageId, {
        text: `❌ <b>Backup failed:</b> ${err.message}`,
        keyboard: [[{ text: "🔙 Back", callback_data: "export:run" }]]
      });
    }
  }
};
