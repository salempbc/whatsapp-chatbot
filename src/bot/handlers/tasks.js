import Task from "../../models/Task.js";
import { createTask, updateTask, toggleTaskPin, getTasksDueTodayOrOverdue, parseQuickAddTask } from "../../services/taskService.js";
import { renderScreen } from "../ui.js";
import { setState, clearState } from "../session.js";
import { adminOnly } from "../guard.js";

const escapeHtml = (str = "") => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const taskListScreen = async () => {
  const tasks = await Task.find({ status: { $in: ["todo", "in_progress", "waiting"] } })
    .sort({ pinned: -1, dueDate: 1, priority: -1 })
    .limit(10);

  let text = `<b>📋 Church Administrative Tasks & Follow-ups</b>\n\n`;

  const keyboard = [];

  if (!tasks.length) {
    text += `<blockquote><i>No pending tasks! All caught up.</i></blockquote>`;
  } else {
    for (const t of tasks) {
      const pinIcon = t.pinned ? "📌 " : "";
      const priorityBadge = t.priority === "urgent" ? "🔴 Urgent" : t.priority === "high" ? "🟠 High" : "🟡 Normal";
      const dueStr = t.dueDate ? ` | Due: ${t.dueDate}` : "";
      const subtaskStr = (t.subtasks && t.subtasks.length > 0)
        ? ` [☑️ ${t.subtasks.filter(s => s.done).length}/${t.subtasks.length}]`
        : "";
      const estStr = t.estimatedTime ? ` [⏱ ${t.estimatedTime}m]` : "";

      text += `${pinIcon}▫️ <b>${escapeHtml(t.title)}</b>${subtaskStr}${estStr} [${priorityBadge}${dueStr}]\n`;
      if (t.tags && t.tags.length > 0) {
        text += `<i>Tags: #${t.tags.join(" #")}</i>\n`;
      }
      text += `<i>Status: ${t.status} | Assignee: ${escapeHtml(t.assignee || "Admin")}</i>\n\n`;
      
      const shortTitle = t.title.length > 20 ? t.title.slice(0, 18) + "..." : t.title;
      const row = [
        { text: `✅ Done: "${shortTitle}"`, callback_data: `tasks:done:${t._id}` },
        { text: t.pinned ? "Unpin" : "📌 Pin", callback_data: `tasks:pin:${t._id}` }
      ];
      keyboard.push(row);
    }
  }

  keyboard.push(
    [{ text: "➕ Add Task", callback_data: "tasks:add:start" }],
    [{ text: "⚠️ Overdue & Due Today", callback_data: "tasks:overdue" }],
    [{ text: "🏠 Return to Dashboard", callback_data: "home:show" }]
  );

  return { text, keyboard };
};

export const registerTasks = (bot) => {
  bot.onText(/\/tasks/, adminOnly(async (msg) => {
    clearState(msg.chat.id);
    const screen = await taskListScreen();
    await renderScreen(bot, msg.chat.id, null, screen);
  }));

  bot.onText(/\/addtask(?:\s+(.+))?/, adminOnly(async (msg, match) => {
    clearState(msg.chat.id);
    const inlineInput = (match && match[1]) ? match[1].trim() : "";
    if (inlineInput) {
      // Natural language parser
      const parsed = parseQuickAddTask(inlineInput);
      try {
        const created = await createTask({
          ...parsed,
          title: parsed.title || inlineInput,
          status: "todo",
          assignee: "Admin"
        }, msg.from?.first_name || "Admin");

        await bot.sendMessage(
          msg.chat.id,
          `✅ <b>Task Created!</b>\n\n📌 <b>${escapeHtml(created.title)}</b>${created.dueDate ? `\n📅 Due: ${created.dueDate}${created.dueTime ? ` at ${created.dueTime}` : ""}` : ""}${created.tags?.length ? `\n🏷 Tags: #${created.tags.join(" #")}` : ""}${created.description ? `\n📝 ${escapeHtml(created.description)}` : ""}`,
          { parse_mode: "HTML" }
        );
        const screen = await taskListScreen();
        return await renderScreen(bot, msg.chat.id, null, screen);
      } catch (err) {
        return bot.sendMessage(msg.chat.id, `❌ Failed to create task: ${err.message}`);
      }
    }

    setState(msg.chat.id, { type: "tasks.addTitle", draft: {} });
    await bot.sendMessage(msg.chat.id, "<b>➕ Add New Task</b>\n\nEnter task title or command (e.g. <i>visit elder tomorrow at 4pm #visitation - bring communion</i>):", { parse_mode: "HTML" });
  }));
};

export const tasksCallbacks = {
  "tasks:list": async ({ bot, chatId, messageId }) => {
    const screen = await taskListScreen();
    await renderScreen(bot, chatId, messageId, screen);
  },
  "tasks:done": async ({ bot, chatId, messageId, args }) => {
    const taskId = args[0];
    if (taskId) {
      await updateTask(taskId, { status: "completed" });
    }
    const screen = await taskListScreen();
    await renderScreen(bot, chatId, messageId, screen);
    return "✅ Task marked completed!";
  },
  "tasks:pin": async ({ bot, chatId, messageId, args }) => {
    const taskId = args[0];
    if (taskId) {
      await toggleTaskPin(taskId);
    }
    const screen = await taskListScreen();
    await renderScreen(bot, chatId, messageId, screen);
    return "📌 Pin status updated!";
  },
  "tasks:overdue": async ({ bot, chatId, messageId }) => {
    const overdue = await getTasksDueTodayOrOverdue();
    let text = `<b>⚠️ Tasks Due Today or Overdue</b>\n\n`;
    const keyboard = [];

    if (!overdue.length) {
      text += `<blockquote><i>No overdue tasks! Everything is on schedule.</i></blockquote>`;
    } else {
      for (const t of overdue) {
        text += `🚨 <b>${escapeHtml(t.title)}</b> (Due: ${t.dueDate || "Today"})\n`;
        const shortTitle = t.title.length > 25 ? t.title.slice(0, 22) + "..." : t.title;
        keyboard.push([{ text: `✅ Done: "${shortTitle}"`, callback_data: `tasks:done:${t._id}` }]);
      }
    }

    keyboard.push(
      [{ text: "📋 All Pending Tasks", callback_data: "tasks:list" }],
      [{ text: "🏠 Return to Dashboard", callback_data: "home:show" }]
    );

    await renderScreen(bot, chatId, messageId, { text, keyboard });
  },
  "tasks:add:start": async ({ bot, chatId }) => {
    setState(chatId, { type: "tasks.addTitle", draft: {} });
    await bot.sendMessage(chatId, "<b>➕ Add New Task</b>\n\nEnter task description or title (supports smart tags and dates):", { parse_mode: "HTML" });
    return "Enter task title";
  }
};

export const tasksStateHandlers = {
  "tasks.addTitle": async ({ bot, chatId, text, state, msg }) => {
    const parsed = parseQuickAddTask(text);
    if (parsed.dueDate || parsed.tags.length > 0 || parsed.description) {
      // Natural language input detected with rich metadata
      try {
        const created = await createTask({
          ...parsed,
          title: parsed.title || text,
          status: "todo",
          assignee: "Admin"
        }, msg?.from?.first_name || "Admin");
        clearState(chatId);
        await bot.sendMessage(chatId, `✅ <b>Task Created!</b>\n\n<b>${escapeHtml(created.title)}</b>${created.dueDate ? `\n📅 Due: ${created.dueDate}${created.dueTime ? ` at ${created.dueTime}` : ""}` : ""}${created.tags?.length ? `\n🏷 Tags: #${created.tags.join(" #")}` : ""}`, { parse_mode: "HTML" });
        const screen = await taskListScreen();
        return await renderScreen(bot, chatId, null, screen);
      } catch (err) {
        clearState(chatId);
        return await bot.sendMessage(chatId, `❌ Failed to create task: ${err.message}`);
      }
    }

    state.draft.title = text;
    state.type = "tasks.addDueDate";
    setState(chatId, state);
    await bot.sendMessage(chatId, `Task: <b>${escapeHtml(text)}</b>\n\nEnter due date as <code>YYYY-MM-DD</code> or send /skip:`, { parse_mode: "HTML" });
  },
  "tasks.addDueDate": async ({ bot, chatId, text, state, msg }) => {
    if (text !== "/skip" && !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return bot.sendMessage(chatId, "❌ Invalid format. Please enter YYYY-MM-DD or /skip:");
    }
    state.draft.dueDate = text === "/skip" ? "" : text;
    state.draft.priority = "medium";
    state.draft.status = "todo";

    try {
      const created = await createTask(state.draft, msg?.from?.first_name || "Admin");
      clearState(chatId);
      await bot.sendMessage(chatId, `✅ <b>Task Created!</b>\n\n<b>${escapeHtml(created.title)}</b>${created.dueDate ? `\n📅 Due: ${created.dueDate}` : ""}`, { parse_mode: "HTML" });
      const screen = await taskListScreen();
      await renderScreen(bot, chatId, null, screen);
    } catch (err) {
      clearState(chatId);
      await bot.sendMessage(chatId, `❌ Failed to create task: ${err.message}`);
    }
  }
};
