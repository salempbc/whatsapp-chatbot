import { requirePermission } from "../middleware.js";
import { getTasks, getTaskStats, createTask, updateTask, deleteTask, toggleTaskComplete, toggleTaskPin, addSubtask, toggleSubtask, deleteSubtask, addNote, deleteNote, addAttachment, deleteAttachment, bulkActionTasks, reorderTasks, getTasksDueTodayOrOverdue, parseQuickAddTask } from "../../services/taskService.js";
import { createRouter } from "../router.js";

const router = createRouter();

/* ========================================================= */
/* MODULE C: ADMINISTRATIVE TASK & FOLLOW-UP MANAGEMENT      */
/* ========================================================= */
router.get("/tasks", requirePermission("canManageTasks"), async (req, res) => {
  const { status, category, priority, tag, search, sortField, sortOrder } = req.query;
  const tasks = await getTasks({
    status: typeof status === "string" ? status.trim() : undefined,
    category: typeof category === "string" ? category.trim() : undefined,
    priority: typeof priority === "string" ? priority.trim() : undefined,
    tag: typeof tag === "string" ? tag.trim() : undefined,
    search: typeof search === "string" ? search.trim() : undefined,
    sortField: typeof sortField === "string" ? sortField.trim() : "manual",
    sortOrder: typeof sortOrder === "string" ? sortOrder.trim() : "asc"
  });
  res.json(tasks);
});

router.get("/tasks/stats", requirePermission("canManageTasks"), async (req, res) => {
  const stats = await getTaskStats();
  res.json(stats);
});

router.get("/tasks/overdue", requirePermission("canManageTasks"), async (req, res) => {
  const tasks = await getTasksDueTodayOrOverdue();
  res.json(tasks);
});

router.post("/tasks", requirePermission("canManageTasks"), async (req, res) => {
  let taskData = { ...req.body };
  if (req.body.quickAdd || (!req.body.title && req.body.text)) {
    const parsed = parseQuickAddTask(req.body.text || req.body.title || "");
    taskData = {
      ...parsed,
      ...req.body,
      title: parsed.title || req.body.title || "Untitled Task",
      description: parsed.description || req.body.description || "",
      dueDate: parsed.dueDate || req.body.dueDate || "",
      dueTime: parsed.dueTime || req.body.dueTime || "",
      tags: [...new Set([...(parsed.tags || []), ...(req.body.tags || [])])],
      priority: req.body.priority || parsed.priority || "medium"
    };
  }
  const task = await createTask(taskData, req.user?.name || "Admin");
  res.json(task);
});

router.post("/tasks/bulk", requirePermission("canManageTasks"), async (req, res) => {
  const result = await bulkActionTasks(req.body, req.user?.name || "Admin");
  res.json(result);
});

router.post("/tasks/reorder", requirePermission("canManageTasks"), async (req, res) => {
  await reorderTasks(req.body.orderedIds);
  res.json({ success: true });
});

router.put("/tasks/:id", requirePermission("canManageTasks"), async (req, res) => {
  const task = await updateTask(req.params.id, req.body, req.user?.name || "Admin");
  res.json(task);
});

router.delete("/tasks/:id", requirePermission("canManageTasks"), async (req, res) => {
  try {
    const task = await deleteTask(req.params.id, req.user?.name || "Admin");
    res.json({ success: true, task });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.post("/tasks/:id/toggle", requirePermission("canManageTasks"), async (req, res) => {
  try {
    const task = await toggleTaskComplete(req.params.id, req.user?.name || "Admin");
    res.json(task);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.post("/tasks/:id/pin", requirePermission("canManageTasks"), async (req, res) => {
  try {
    const task = await toggleTaskPin(req.params.id, req.user?.name || "Admin");
    res.json(task);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.post("/tasks/:id/subtasks", requirePermission("canManageTasks"), async (req, res) => {
  try {
    const task = await addSubtask(req.params.id, req.body.text);
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/tasks/:id/subtasks/:subId/toggle", requirePermission("canManageTasks"), async (req, res) => {
  try {
    const task = await toggleSubtask(req.params.id, req.params.subId);
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/tasks/:id/subtasks/:subId", requirePermission("canManageTasks"), async (req, res) => {
  try {
    const task = await deleteSubtask(req.params.id, req.params.subId);
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/tasks/:id/notes", requirePermission("canManageTasks"), async (req, res) => {
  try {
    const task = await addNote(req.params.id, {
      text: req.body.text,
      author: req.body.author || req.user?.name || "Admin"
    });
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/tasks/:id/notes/:noteId", requirePermission("canManageTasks"), async (req, res) => {
  try {
    const task = await deleteNote(req.params.id, req.params.noteId);
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/tasks/:id/attachments", requirePermission("canManageTasks"), async (req, res) => {
  try {
    const task = await addAttachment(req.params.id, req.body);
    res.json(task);
  } catch (err) {
    const status = err.message.includes("exceeds maximum limit") ? 413 : 400;
    res.status(status).json({ error: err.message });
  }
});

router.delete("/tasks/:id/attachments/:attId", requirePermission("canManageTasks"), async (req, res) => {
  try {
    const task = await deleteAttachment(req.params.id, req.params.attId);
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


export default router;
