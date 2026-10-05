import Task from "../models/Task.js";
import AuditLog from "../models/AuditLog.js";

/**
 * 📋 TASK MANAGEMENT SERVICE
 */
export const createTask = async (data, performedBy = "Admin") => {
  if (!data.title) throw new Error("Task title is required");

  const task = await Task.create({
    ...data,
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
  });

  return task;
};

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
    if (updates.status === "completed") {
      updates.completedAt = new Date();
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
  });

  return task;
};

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
