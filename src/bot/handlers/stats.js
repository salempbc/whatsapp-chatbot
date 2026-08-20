import Member from "../../models/Member.js";
import { renderScreen } from "../ui.js";

export const statsCallbacks = {
  "stats:show": async ({ bot, chatId, messageId }) => {
    const all = await Member.find({ isDeleted: { $ne: true } });

    const active   = all.filter((m) => m.isActive !== false);
    const inactive = all.filter((m) => m.isActive === false);
    const male     = active.filter((m) => m.gender === "male");
    const female   = active.filter((m) => m.gender === "female");

    /* Count married couples without double-counting */
    const processed = new Set();
    let couples = 0;
    for (const m of active) {
      if (m.isMarried && m.spouseName && !processed.has(m.name)) {
        couples++;
        processed.add(m.name);
        processed.add(m.spouseName);
      }
    }

    const children    = active.filter((m) => m.isChild);
    const pastors     = active.filter((m) => m.isPastor);
    const treasurers  = active.filter((m) => m.role === "treasurer");
    const secretaries = active.filter((m) => m.role === "secretary");

    /* New members added this calendar month */
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const newThisMonth = all.filter((m) => new Date(m.createdAt) >= monthStart);

    const text =
`📊 SPBC — Statistics

👥 Members
  Active : ${active.length}
  Inactive (left) : ${inactive.length}
  Total : ${all.length}

⚧ Gender (active)
  Male   : ${male.length}
  Female : ${female.length}

💍 Married couples : ${couples}
👶 Children        : ${children.length}
⛪ Pastors         : ${pastors.length}

🏷 Roles (active)
  Treasurer : ${treasurers.length}
  Secretary : ${secretaries.length}

🆕 Added this month : ${newThisMonth.length}`;

    await renderScreen(bot, chatId, messageId, {
      text,
      keyboard: [[{ text: "🏠 Home", callback_data: "home:show" }]]
    });
  }
};
