import Task from "../models/Task.js";
import AuditLog from "../models/AuditLog.js";

/**
 * Natural language Quick Add parser (ported from TaskFlow)
 * Parses: "meet Pastor John tomorrow at 4pm #visitation - discuss communion"
 */
export const parseQuickAddTask = (text) => {
  if (!text || typeof text !== "string") {
    return { title: "", description: "", dueDate: "", dueTime: "", tags: [], priority: "medium" };
  }

  let str = text.trim();
  const tags = [];

  // 1. Extract #tags
  str = str.replace(/#([\w-]+)/g, (_, tag) => {
    tags.push(tag.toLowerCase());
    return "";
  });

  // 2. Extract description after " - "
  let description = "";
  const dashIdx = str.indexOf(" - ");
  if (dashIdx !== -1) {
    description = str.slice(dashIdx + 3).trim();
    str = str.slice(0, dashIdx).trim();
  }

  // 3. Extract Date (today, tomorrow, in N days)
  let dueDate = "";
  const now = new Date();
  const todayStr = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
    .toISOString()
    .slice(0, 10);

  if (/\btoday\b/i.test(str)) {
    dueDate = todayStr;
    str = str.replace(/\btoday\b/i, "").trim();
  } else if (/\btomorrow\b/i.test(str)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    dueDate = d.toISOString().slice(0, 10);
    str = str.replace(/\btomorrow\b/i, "").trim();
  } else {
    const inDaysMatch = str.match(/\bin\s+(\d+)\s+days?\b/i);
    if (inDaysMatch) {
      const days = parseInt(inDaysMatch[1], 10);
      const d = new Date(now);
      d.setDate(d.getDate() + days);
      dueDate = d.toISOString().slice(0, 10);
      str = str.replace(inDaysMatch[0], "").trim();
    }
  }

  // 4. Extract Time (at 3pm, at 14:00, 10am, 10:30pm)
  let dueTime = "";
  const timeMatch = str.match(/\b(?:at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?|(\d{1,2}):(\d{2})\s*(am|pm)?|(\d{1,2})\s*(am|pm))\b/i);
  if (timeMatch) {
    let h = parseInt(timeMatch[1] || timeMatch[4] || timeMatch[7], 10);
    const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : (timeMatch[5] ? parseInt(timeMatch[5], 10) : 0);
    const meridiem = (timeMatch[3] || timeMatch[6] || timeMatch[8] || "").toLowerCase();

    if (meridiem === "pm" && h < 12) h += 12;
    if (meridiem === "am" && h === 12) h = 0;

    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      dueTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      str = str.replace(timeMatch[0], "").trim();
    }
  }

  // Clean title
  const title = str.replace(/\s{2,}/g, " ").trim();

  return {
    title,
    description,
    dueDate,
    dueTime,
    tags,
    priority: "medium"
  };
};

/**
 * Retrieves tasks with full TaskFlow filter and sorting options
 */
export const getTasks = async (options = {}) => {
  const { status, priority, tag, category, search, sortField = "manual", sortOrder = "asc" } = options;
  const filter = {};

  const todayStr = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
    .toISOString()
    .slice(0, 10);

  if (status === "active" || status === "pending") {
    filter.status = { $in: ["todo", "in_progress", "waiting"] };
  } else if (status === "completed") {
    filter.status = "completed";
  } else if (status === "overdue") {
    filter.status = { $in: ["todo", "in_progress", "waiting"] };
    filter.dueDate = { $ne: "", $lt: todayStr };
  } else if (status && status !== "all") {
    filter.status = status;
  }

  if (category && category !== "all") {
    filter.category = category;
  }

  if (priority && priority !== "all") {
    filter.priority = priority;
  }

  if (tag && tag !== "all") {
    filter.tags = tag;
  }

  if (search && search.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    filter.$or = [{ title: regex }, { description: regex }, { tags: regex }, { assignee: regex }];
  }

  // Sort: Pinned tasks always float to top!
  const sort = { pinned: -1 };
  if (sortField === "dueDate") {
    sort.dueDate = sortOrder === "desc" ? -1 : 1;
  } else if (sortField === "priority") {
    sort.priority = sortOrder === "desc" ? -1 : 1;
  } else if (sortField === "createdAt") {
    sort.createdAt = sortOrder === "desc" ? -1 : 1;
  } else if (sortField === "title") {
    sort.title = sortOrder === "desc" ? -1 : 1;
  } else {
    // Manual order
    sort.order = 1;
    sort.createdAt = -1;
  }

  return await Task.find(filter).sort(sort).lean();
};

/**
 * Computes TaskFlow stats
 */
export const getTaskStats = async () => {
  const todayStr = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
    .toISOString()
    .slice(0, 10);

  const tasks = await Task.find({}).lean();

  const total = tasks.length;
  let completed = 0;
  let active = 0;
  let overdue = 0;
  let totalEstimatedMins = 0;
  let completedEstimatedMins = 0;

  for (const t of tasks) {
    const isDone = t.status === "completed" || t.completed === true;
    if (isDone) {
      completed++;
      if (t.estimatedTime) completedEstimatedMins += t.estimatedTime;
    } else if (t.status !== "cancelled") {
      active++;
      if (t.dueDate && t.dueDate < todayStr) {
        overdue++;
      }
    }
    if (t.estimatedTime) totalEstimatedMins += t.estimatedTime;
  }

  return {
    total,
    active,
    completed,
    overdue,
    totalEstimatedMins,
    completedEstimatedMins
  };
};

/**
 * Creates a new task with full TaskFlow options
 */
export const createTask = async (data, performedBy = "Admin") => {
  if (!data.title) throw new Error("Task title is required");

  const task = await Task.create({
    ...data,
    completed: data.status === "completed",
    createdBy: performedBy,
    history: [
      {
        action: "CREATED",
        performedBy,
        details: `Task created: ${data.title}`
      }
    ]
  });

  await AuditLog.create({
    entity: "Task",
    entityId: String(task._id),
    action: "CREATE",
    performedBy,
    details: `Created task: ${task.title}`,
    changes: { after: task.toObject() }
  }).catch(() => null);

  return task;
};

/**
 * Updates a task
 */
export const updateTask = async (id, updates, performedBy = "Admin") => {
  const task = await Task.findById(id);
  if (!task) throw new Error("Task not found");

  const before = task.toObject();
  const historyEntries = [];

  if (updates.status && updates.status !== task.status) {
    historyEntries.push({
      action: "STATUS_CHANGE",
      performedBy,
      details: `Status changed from ${task.status} to ${updates.status}`
    });
    updates.completed = updates.status === "completed";
    if (updates.status === "completed") {
      updates.completedAt = new Date();
    } else {
      updates.completedAt = null;
    }
  }

  if (updates.assignee && updates.assignee !== task.assignee) {
    historyEntries.push({
      action: "REASSIGNED",
      performedBy,
      details: `Reassigned from ${task.assignee} to ${updates.assignee}`
    });
  }

  Object.assign(task, updates);
  if (historyEntries.length > 0) {
    task.history.push(...historyEntries);
  }
  await task.save();

  await AuditLog.create({
    entity: "Task",
    entityId: String(task._id),
    action: "UPDATE",
    performedBy,
    details: `Updated task: ${task.title}`,
    changes: { before, after: task.toObject() }
  }).catch(() => null);

  return task;
};

/**
 * Deletes a task
 */
export const deleteTask = async (id, performedBy = "Admin") => {
  const task = await Task.findByIdAndDelete(id);
  if (!task) throw new Error("Task not found");

  await AuditLog.create({
    entity: "Task",
    entityId: String(task._id),
    action: "DELETE",
    performedBy,
    details: `Deleted task: ${task.title}`,
    changes: { before: task.toObject() }
  }).catch(() => null);

  return task;
};

/**
 * Toggles task complete status
 */
export const toggleTaskComplete = async (id, performedBy = "Admin") => {
  const task = await Task.findById(id);
  if (!task) throw new Error("Task not found");

  const wasCompleted = task.status === "completed" || task.completed === true;
  task.completed = !wasCompleted;
  task.status = wasCompleted ? "todo" : "completed";
  task.completedAt = wasCompleted ? null : new Date();

  task.history.push({
    action: wasCompleted ? "UNCOMPLETED" : "COMPLETED",
    performedBy,
    details: wasCompleted ? "Task marked active" : "Task marked complete"
  });

  await task.save();
  return task;
};

/**
 * Toggles task pinned status
 */
export const toggleTaskPin = async (id, performedBy = "Admin") => {
  const task = await Task.findById(id);
  if (!task) throw new Error("Task not found");

  task.pinned = !task.pinned;
  await task.save();
  return task;
};

/**
 * Subtasks management
 */
export const addSubtask = async (taskId, text) => {
  if (!text || !text.trim()) throw new Error("Subtask text required");
  const task = await Task.findById(taskId);
  if (!task) throw new Error("Task not found");

  task.subtasks.push({ text: text.trim(), done: false });
  await task.save();
  return task;
};

export const toggleSubtask = async (taskId, subtaskId) => {
  const task = await Task.findById(taskId);
  if (!task) throw new Error("Task not found");

  const sub = task.subtasks.id(subtaskId);
  if (!sub) throw new Error("Subtask not found");

  sub.done = !sub.done;
  await task.save();
  return task;
};

export const deleteSubtask = async (taskId, subtaskId) => {
  const task = await Task.findById(taskId);
  if (!task) throw new Error("Task not found");

  task.subtasks.pull(subtaskId);
  await task.save();
  return task;
};

/**
 * Notes management
 */
export const addNote = async (taskId, { text, author = "Admin" }) => {
  if (!text || !text.trim()) throw new Error("Note text required");
  const task = await Task.findById(taskId);
  if (!task) throw new Error("Task not found");

  task.notes.push({ text: text.trim(), author });
  await task.save();
  return task;
};

export const deleteNote = async (taskId, noteId) => {
  const task = await Task.findById(taskId);
  if (!task) throw new Error("Task not found");

  task.notes.pull(noteId);
  await task.save();
  return task;
};

/**
 * Attachments management
 */
export const addAttachment = async (taskId, { filename, mimeType, size, data }) => {
  if (!filename || !data) throw new Error("File attachment data required");
  const task = await Task.findById(taskId);
  if (!task) throw new Error("Task not found");

  const cleanFilename = String(filename).replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
  task.attachments.push({
    filename: cleanFilename,
    mimeType: mimeType || "application/octet-stream",
    size: size || 0,
    data
  });
  await task.save();
  return task;
};

export const deleteAttachment = async (taskId, attachmentId) => {
  const task = await Task.findById(taskId);
  if (!task) throw new Error("Task not found");

  task.attachments.pull(attachmentId);
  await task.save();
  return task;
};

/**
 * Bulk action on tasks
 */
export const bulkActionTasks = async ({ ids, action, value }, performedBy = "Admin") => {
  if (!Array.isArray(ids) || ids.length === 0) return { count: 0 };

  if (action === "complete") {
    const res = await Task.updateMany(
      { _id: { $in: ids } },
      { $set: { status: "completed", completed: true, completedAt: new Date() } }
    );
    return { count: res.modifiedCount };
  }

  if (action === "delete") {
    const res = await Task.deleteMany({ _id: { $in: ids } });
    return { count: res.deletedCount };
  }

  if (action === "priority" && value) {
    const res = await Task.updateMany({ _id: { $in: ids } }, { $set: { priority: value } });
    return { count: res.modifiedCount };
  }

  if (action === "addTag" && value) {
    const res = await Task.updateMany({ _id: { $in: ids } }, { $addToSet: { tags: value } });
    return { count: res.modifiedCount };
  }

  return { count: 0 };
};

/**
 * Reorder tasks array
 */
export const reorderTasks = async (orderedIds) => {
  if (!Array.isArray(orderedIds)) return;
  const bulkOps = orderedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { order: index } }
    }
  }));
  if (bulkOps.length > 0) {
    await Task.bulkWrite(bulkOps);
  }
};

/**
 * Daily reminder check (preserved for backward compatibility)
 */
export const getTasksDueTodayOrOverdue = async () => {
  const todayStr = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
    .toISOString()
    .slice(0, 10);

  const tasks = await Task.find({
    status: { $in: ["todo", "in_progress", "waiting"] },
    dueDate: { $ne: "", $lte: todayStr }
  }).sort({ dueDate: 1, priority: -1 });

  return tasks;
};
