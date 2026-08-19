import fs from "fs";
import Member from "../../models/Member.js";
import { exportMembersToCSV } from "../../services/exportService.js";

export const exportCallbacks = {
  "export:run": async ({ bot, chatId }) => {
    const members = await Member.find({ isDeleted: { $ne: true } }).sort({ name: 1 });

    if (!members.length) {
      return bot.sendMessage(chatId, "❌ No members to export");
    }

    const filePath = await exportMembersToCSV(members);
    await bot.sendDocument(chatId, filePath);
    fs.unlink(filePath, () => {});
  }
};
