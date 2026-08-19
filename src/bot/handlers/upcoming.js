import { getUpcomingEvents } from "../../services/eventService.js";
import { MONTH_NAMES, renderScreen } from "../ui.js";

/* Format MM-DD as "Aug 19" */
const fmtDate = (mmdd) => {
  const [mm, dd] = mmdd.split("-");
  return `${MONTH_NAMES[parseInt(mm, 10) - 1].slice(0, 3)} ${parseInt(dd, 10)}`;
};

const upcomingScreen = async (days) => {
  const { birthdays, weddings } = await getUpcomingEvents(days);

  const label = days === 7 ? "Next 7 days" : "Next 30 days";
  let text = `🗓 ${label}\n\n`;

  if (birthdays.length) {
    text += "🎂 Birthdays\n";
    for (const { member: m, mmdd, isToday } of birthdays) {
      text += `  ${isToday ? "📍 " : ""}${fmtDate(mmdd)} — ${m.name}\n`;
    }
    text += "\n";
  }

  if (weddings.length) {
    text += "💍 Anniversaries\n";
    for (const { member: m, mmdd, isToday } of weddings) {
      const spouse = m.spouseName || "?";
      const couple = m.gender === "male"
        ? `${m.name} & ${spouse}`
        : `${spouse} & ${m.name}`;
      text += `  ${isToday ? "📍 " : ""}${fmtDate(mmdd)} — ${couple}\n`;
    }
  }

  if (!birthdays.length && !weddings.length) {
    text += "No birthdays or anniversaries coming up.";
  }

  return {
    text,
    keyboard: [
      [
        { text: days === 7 ? "• 7 days" : "7 days",  callback_data: "upcoming:show:7" },
        { text: days === 30 ? "• 30 days" : "30 days", callback_data: "upcoming:show:30" }
      ],
      [{ text: "🏠 Home", callback_data: "home:show" }]
    ]
  };
};

export const upcomingCallbacks = {
  "upcoming:show": async ({ bot, chatId, messageId, args }) => {
    const days = parseInt(args[0], 10) || 7;
    await renderScreen(bot, chatId, messageId, await upcomingScreen(days));
  }
};
