import { getUpcomingEvents } from "../../services/eventService.js";
import { renderScreen } from "../ui.js";

const screen = async (days) => {
  const { birthdays, weddings } = await getUpcomingEvents(days);

  let text = `<b>🗓 Coming Up</b>\n<i>Events in the next ${days} days</i>\n\n`;

  if (!birthdays.length && !weddings.length) {
    text += "<blockquote><i>Nothing coming up soon!</i></blockquote>";
  } else {
    text += "<blockquote>";
    
    const grouped = {};
    
    for (const b of birthdays) {
      if (!grouped[b.mmdd]) grouped[b.mmdd] = [];
      grouped[b.mmdd].push(`🎂 ${b.member.name}`);
    }
    for (const w of weddings) {
      if (!grouped[w.mmdd]) grouped[w.mmdd] = [];
      grouped[w.mmdd].push(`💍 ${w.member.name} & ${w.member.spouseName || "Spouse"}`);
    }
    
    const sortedDates = Object.keys(grouped).sort();
    
    for (const date of sortedDates) {
      text += `<b>${date}</b>: ${grouped[date].join(", ")}\n`;
    }
    
    text += "</blockquote>";
  }

  const otherDays = days === 7 ? 30 : 7;

  return {
    text,
    keyboard: [
      [{ text: `🔄 Switch to next ${otherDays} days`, callback_data: `upcoming:show:${otherDays}` }],
      [{ text: "🏠 Return to Dashboard", callback_data: "home:show" }]
    ]
  };
};

export const upcomingCallbacks = {
  "upcoming:show": async ({ bot, chatId, messageId, args }) => {
    const days = Number(args[0]) || 7;
    await renderScreen(bot, chatId, messageId, await screen(days));
  }
};