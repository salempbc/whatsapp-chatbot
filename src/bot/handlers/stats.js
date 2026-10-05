import { getChurchStatistics, getDataQualityReport } from "../../services/reportService.js";
import { renderScreen } from "../ui.js";
import { adminOnly } from "../guard.js";

export const statsScreen = async () => {
  const stats = await getChurchStatistics();
  const m = stats.membership;
  const t = stats.tasks;
  const e = stats.events;
  const g = stats.greetings;

  const text =
`<b>📊 SPBC — Church Management & Ministry Analytics</b>

<blockquote><b>👥 Membership Base</b>
• Active Members : <b>${m.activeCount}</b>
• Inactive / Left : <b>${m.inactiveCount}</b>
• Transferred     : <b>${m.transferredCount}</b>
• Archived        : <b>${m.archivedCount}</b>
• Unique Families : <b>${m.familiesCount}</b>
• Married Couples : <b>${m.marriedCount}</b>
• Children        : <b>${m.childrenCount}</b>

<b>⚧ Gender Breakdown</b>
• Male : <b>${m.gender.male}</b> | Female : <b>${m.gender.female}</b>

<b>📅 Programs & Events</b>
• Upcoming Events : <b>${e.upcoming}</b>
• Total Scheduled : <b>${e.total}</b>

<b>📋 Administrative Tasks</b>
• Open Tasks      : <b>${t.open}</b>
• Overdue Tasks   : <b>${t.overdue}</b>
• Completed       : <b>${t.completed}</b> (${t.completionRate}%)

<b>💐 Celebrations (This Year)</b>
• Prepared Wishes : <b>${g.totalPrepared}</b>
• Shared to Groups: <b>${g.sharedCount}</b></blockquote>`;

  const keyboard = [
    [{ text: "🔍 Data Quality Audit", callback_data: "stats:quality" }],
    [{ text: "🏠 Return to Dashboard", callback_data: "home:show" }]
  ];

  return { text, keyboard };
};

export const registerStats = (bot) => {
  bot.onText(/\/stats/, adminOnly(async (msg) => {
    const screen = await statsScreen();
    await renderScreen(bot, msg.chat.id, null, screen);
  }));

  bot.onText(/\/dataquality/, adminOnly(async (msg) => {
    const report = await getDataQualityReport();
    let text = `<b>🔍 Congregation Data Quality Report</b>\n\n`;
    text += `• Total Records Audited: <b>${report.totalChecked}</b>\n`;
    text += `• Data Health Score: <b>${report.healthScore}%</b>\n`;
    text += `• Issues Identified: <b>${report.issuesFound}</b>\n\n`;

    if (report.issues.length) {
      text += `<b>Flagged Issues:</b>\n`;
      report.issues.slice(0, 5).forEach((iss, idx) => {
        text += `${idx + 1}. [${iss.severity}] ${iss.memberName}: ${iss.issue}\n`;
      });
      if (report.issues.length > 5) {
        text += `<i>...and ${report.issues.length - 5} more records.</i>\n`;
      }
    } else {
      text += `<blockquote>✅ <i>All congregational records are consistent and complete!</i></blockquote>`;
    }

    await bot.sendMessage(msg.chat.id, text, { parse_mode: "HTML" });
  }));
};

export const statsCallbacks = {
  "stats:show": async ({ bot, chatId, messageId }) => {
    const screen = await statsScreen();
    await renderScreen(bot, chatId, messageId, screen);
  },
  "stats:quality": async ({ bot, chatId, messageId }) => {
    const report = await getDataQualityReport();
    let text = `<b>🔍 Congregation Data Quality Report</b>\n\n`;
    text += `• Health Score: <b>${report.healthScore}%</b>\n`;
    text += `• Total Records: <b>${report.totalChecked}</b>\n`;
    text += `• Flagged Issues: <b>${report.issuesFound}</b>\n\n`;

    if (report.issues.length) {
      text += `<blockquote>`;
      report.issues.slice(0, 5).forEach((iss, idx) => {
        text += `${idx + 1}. [${iss.severity}] <b>${iss.memberName}</b>: ${iss.issue}\n`;
      });
      text += `</blockquote>`;
    } else {
      text += `<blockquote>✅ <i>All congregational records pass validation audits!</i></blockquote>`;
    }

    await renderScreen(bot, chatId, messageId, {
      text,
      keyboard: [
        [{ text: "📊 General Analytics", callback_data: "stats:show" }],
        [{ text: "🏠 Return to Dashboard", callback_data: "home:show" }]
      ]
    });
  }
};
