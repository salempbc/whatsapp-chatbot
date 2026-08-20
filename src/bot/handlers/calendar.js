import { getMonthlyCalendar } from "../../services/eventService.js";
import { MONTH_NAMES, currentMonthMM, shiftMonth, renderScreen } from "../ui.js";

const screen = async (mm) => {
  const cal = await getMonthlyCalendar(mm);
  const idx = parseInt(mm, 10) - 1;

  const bDays = Object.keys(cal.birthdays).sort();
  const wDays = Object.keys(cal.weddings).sort();

  let text = `<b>📅 Event Calendar</b>\n<i>Month: ${MONTH_NAMES[idx]}</i>\n\n`;
  if (!bDays.length && !wDays.length) {
    text += "<blockquote><i>No events scheduled for this month.</i></blockquote>";
  } else {
    text += "<blockquote>";
    if (bDays.length) {
      text += "<b>🎂 Birthdays:</b>\n";
      for (const d of bDays) text += ` • <b>${d}</b>: ${cal.birthdays[d].join(", ")}\n`;
    }
    if (wDays.length) {
      if (bDays.length) text += "\n";
      text += "<b>💍 Weddings:</b>\n";
      for (const d of wDays) text += ` • <b>${d}</b>: ${cal.weddings[d].join(", ")}\n`;
    }
    text += "</blockquote>";
  }

  return {
    text,
    keyboard: [
      [
        { text: "◀ Prev", callback_data: `calendar:show:${shiftMonth(mm, -1)}` },
        { text: "Next ▶", callback_data: `calendar:show:${shiftMonth(mm, 1)}` }
      ],
      [{ text: "🏠 Home", callback_data: "home:show" }]
    ]
  };
};

export const calendarCallbacks = {
  "calendar:show": async ({ bot, chatId, messageId, args }) => {
    const mm = args[0] === "current" ? currentMonthMM() : args[0];
    await renderScreen(bot, chatId, messageId, await screen(mm));
  }
};
