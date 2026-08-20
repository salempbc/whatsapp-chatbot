import { getUpcomingEvents } from "../../services/eventService.js";
import { renderScreen } from "../ui.js";

const screen = async (days) => {
  const events = await getUpcomingEvents(days);

  let text = `<b>🗓 Coming Up</b>\n<i>Events in the next ${days} days</i>\n\n`;

  if (!events.length) {
    text += "<blockquote><i>Nothing coming up soon!</i></blockquote>";
  } else {
    text += "<blockquote>";
    for (const e of events) {
      const icon = e.type === "birthday" ? "🎂" : "💍";
      text += `<b>${e.date}</b>: ${icon} ${e.members.join(", ")}\n`;
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
