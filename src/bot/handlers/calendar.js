import { getMonthlyCalendar } from "../../services/eventService.js";
import { MONTH_NAMES, currentMonthMM, shiftMonth, renderScreen } from "../ui.js";

const screen = async (mm) => {
  const cal = await getMonthlyCalendar(mm);
  const idx = parseInt(mm, 10) - 1;

  const bDays = Object.keys(cal.birthdays).sort();
  const wDays = Object.keys(cal.weddings).sort();

  let text = `📅 ${MONTH_NAMES[idx]}\n\n`;
  for (const d of bDays) text += `🎂 ${d}: ${cal.birthdays[d].join(", ")}\n`;
  for (const d of wDays) text += `💍 ${d}: ${cal.weddings[d].join(", ")}\n`;
  if (!bDays.length && !wDays.length) text += "No events this month";

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
