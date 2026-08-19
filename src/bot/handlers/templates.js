import Template from "../../models/Template.js";
import { renderScreen } from "../ui.js";
import { setState, clearState } from "../session.js";

/* ================= SCREENS ================= */

const homeScreen = () => ({
  text: "📝 Template Manager\n\nChoose a type:",
  keyboard: [
    [{ text: "🎂 Birthday", callback_data: "templates:type:birthday" }],
    [{ text: "💍 Wedding", callback_data: "templates:type:wedding" }],
    [{ text: "🏠 Home", callback_data: "home:show" }]
  ]
});

const categoryScreen = (type) => ({
  text: "Select category:",
  keyboard: [
    [{ text: "📘 Formal", callback_data: `templates:list:${type}:formal` }],
    [{ text: "🌸 Poetic", callback_data: `templates:list:${type}:poetic` }],
    [{ text: "⚡ Short", callback_data: `templates:list:${type}:short` }],
    [{ text: "🔙 Back", callback_data: "templates:show" }]
  ]
});

const listScreen = async (type, category) => {
  const templates = await Template.find({ type, category });

  const rows = templates.map((t) => [
    { text: t.content.slice(0, 30) + "...", callback_data: `templates:view:${t._id}` }
  ]);

  rows.push([{ text: "➕ Add", callback_data: `templates:add:${type}:${category}` }]);
  rows.push([{ text: "🔙 Back", callback_data: `templates:type:${type}` }]);

  return { text: templates.length ? "Templates:" : "No templates in this category yet.", keyboard: rows };
};

const viewScreen = (tpl) => ({
  text: tpl.content,
  keyboard: [
    [
      { text: "✏️ Edit", callback_data: `templates:edit:${tpl._id}` },
      { text: "🗑 Delete", callback_data: `templates:delconfirm:${tpl._id}` }
    ],
    [{ text: "🔙 Back", callback_data: `templates:list:${tpl.type}:${tpl.category}` }]
  ]
});

/* ================= CALLBACK ROUTES ================= */

export const templatesCallbacks = {
  "templates:show": async ({ bot, chatId, messageId }) => {
    await renderScreen(bot, chatId, messageId, homeScreen());
  },

  "templates:type": async ({ bot, chatId, messageId, args }) => {
    await renderScreen(bot, chatId, messageId, categoryScreen(args[0]));
  },

  "templates:list": async ({ bot, chatId, messageId, args }) => {
    const [type, category] = args;
    await renderScreen(bot, chatId, messageId, await listScreen(type, category));
  },

  "templates:view": async ({ bot, chatId, messageId, args }) => {
    const tpl = await Template.findById(args[0]);
    if (!tpl) return bot.sendMessage(chatId, "❌ Template not found");
    await renderScreen(bot, chatId, messageId, viewScreen(tpl));
  },

  "templates:add": async ({ bot, chatId, args }) => {
    const [type, category] = args;
    setState(chatId, { type: "templates.add", tplType: type, category });
    await bot.sendMessage(chatId, "Send template text:");
  },

  "templates:edit": async ({ bot, chatId, args }) => {
    setState(chatId, { type: "templates.edit", id: args[0] });
    await bot.sendMessage(chatId, "Send updated template text:");
  },

  "templates:delconfirm": async ({ bot, chatId, messageId, args }) => {
    const id = args[0];
    await renderScreen(bot, chatId, messageId, {
      text: "Delete this template?",
      keyboard: [[
        { text: "✅ Yes", callback_data: `templates:delyes:${id}` },
        { text: "❌ No", callback_data: `templates:view:${id}` }
      ]]
    });
  },

  "templates:delyes": async ({ bot, chatId, messageId, args }) => {
    await Template.deleteOne({ _id: args[0] });
    await renderScreen(bot, chatId, messageId, homeScreen());
  }
};

/* ================= TEXT-INPUT (STATE) ROUTES ================= */

export const templatesStateHandlers = {
  "templates.add": async ({ bot, chatId, text, state }) => {
    await Template.create({ type: state.tplType, category: state.category, content: text });
    clearState(chatId);
    await bot.sendMessage(chatId, "✅ Template added");
  },

  "templates.edit": async ({ bot, chatId, text, state }) => {
    await Template.updateOne({ _id: state.id }, { content: text });
    clearState(chatId);
    await bot.sendMessage(chatId, "✅ Updated");
  }
};
