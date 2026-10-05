"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import dbConnect from "@/lib/mongodb";
import Todo, { ITodo, ISubtask, INote, IAttachment } from "@/models/Todo";
import { getNextOccurrence } from "@/lib/dateUtils";

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const TodoCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  pinned: z.boolean().default(false),
  recurring: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
  estimatedTime: z.number().min(1).max(1440).optional().nullable(),
  subtasks: z
    .array(z.object({ text: z.string().min(1).max(300), done: z.boolean().default(false) }))
    .default([]),
});

const TodoUpdateSchema = TodoCreateSchema.partial();

// ─── Types ────────────────────────────────────────────────────────────────────

export type FilterStatus = "all" | "active" | "completed";
export type SortField = "createdAt" | "dueDate" | "priority" | "title" | "manual";
export type SortOrder = "asc" | "desc";

export interface GetTodosOptions {
  status?: FilterStatus;
  priority?: string;
  tag?: string;
  search?: string;
  sortField?: SortField;
  sortOrder?: SortOrder;
}

export interface ActionResult<T = null> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serializeSubtask(s: unknown): ISubtask {
  const sub = s as Record<string, unknown>;
  return {
    _id: String(sub._id),
    text: sub.text as string,
    done: sub.done as boolean,
    createdAt: new Date(sub.createdAt as string | Date),
  };
}

function serializeNote(n: unknown): INote {
  const note = n as Record<string, unknown>;
  return {
    _id: String(note._id),
    text: note.text as string,
    createdAt: new Date(note.createdAt as string | Date),
  };
}

function serializeAttachment(a: unknown): IAttachment {
  const att = a as Record<string, unknown>;
  return {
    _id: String(att._id),
    filename: att.filename as string,
    mimeType: att.mimeType as string,
    size: att.size as number,
    data: att.data as string,
    createdAt: new Date(att.createdAt as string | Date),
  };
}

function serializeTodo(doc: unknown): ITodo {
  const obj =
    typeof (doc as { toObject?: () => unknown }).toObject === "function"
      ? ((doc as { toObject: () => unknown }).toObject() as Record<string, unknown>)
      : (doc as Record<string, unknown>);

  return {
    _id: String(obj._id),
    userId: obj.userId as string,
    title: obj.title as string,
    description: obj.description as string | undefined,
    completed: obj.completed as boolean,
    priority: obj.priority as ITodo["priority"],
    dueDate: obj.dueDate ? new Date(obj.dueDate as string | Date) : null,
    tags: (obj.tags as string[]) || [],
    subtasks: ((obj.subtasks as unknown[]) || []).map(serializeSubtask),
    notes: ((obj.notes as unknown[]) || []).map(serializeNote),
    attachments: ((obj.attachments as unknown[]) || []).map((a) => ({
      ...serializeAttachment(a),
      data: "",
    })),
    completedAt: obj.completedAt ? new Date(obj.completedAt as string | Date) : null,
    pinned: (obj.pinned as boolean) || false,
    recurring: (obj.recurring as ITodo["recurring"]) || "none",
    estimatedTime: (obj.estimatedTime as number | null) ?? null,
    order: (obj.order as number) ?? 0,
    createdAt: new Date(obj.createdAt as string | Date),
    updatedAt: new Date(obj.updatedAt as string | Date),
  };
}

const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

// ─── CRUD Actions ─────────────────────────────────────────────────────────────

export async function getTodos(
  options: GetTodosOptions = {}
): Promise<ActionResult<ITodo[]>> {
  try {
    const userId = await requireUserId();
    await dbConnect();
    const {
      status = "all",
      priority,
      tag,
      search,
      sortField = "createdAt",
      sortOrder = "desc",
    } = options;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = { userId };
    if (status === "active") query.completed = false;
    if (status === "completed") query.completed = true;
    if (priority && priority !== "all") query.priority = priority;
    if (tag && tag !== "all") query.tags = { $in: [tag] };
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const mongoSortOrder = sortOrder === "asc" ? 1 : -1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sortQuery: Record<string, any> =
      sortField === "priority" || sortField === "manual"
        ? { createdAt: -1 }
        : { [sortField]: mongoSortOrder };
    if (sortField === "manual") sortQuery = { order: 1 };

    // Pinned items first
    sortQuery = { pinned: -1, ...sortQuery };

    const docs = await Todo.find(query).sort(sortQuery).lean();
    let todos = docs.map(serializeTodo);

    if (sortField === "priority") {
      todos = todos.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const diff = priorityOrder[a.priority] - priorityOrder[b.priority];
        return sortOrder === "asc" ? diff : -diff;
      });
    }

    return { success: true, data: todos };
  } catch (err) {
    console.error("getTodos error:", err);
    return { success: false, error: "Failed to fetch todos" };
  }
}

export async function getStats(): Promise<
  ActionResult<{
    total: number;
    completed: number;
    active: number;
    overdue: number;
    totalEstimatedMins: number;
    completedEstimatedMins: number;
  }>
> {
  try {
    const userId = await requireUserId();
    await dbConnect();
    const now = new Date();
    const [total, completed, overdue, allTodos] = await Promise.all([
      Todo.countDocuments({ userId }),
      Todo.countDocuments({ userId, completed: true }),
      Todo.countDocuments({ userId, completed: false, dueDate: { $lt: now } }),
      Todo.find({ userId }, { estimatedTime: 1, completed: 1 }).lean(),
    ]);
    const totalEstimatedMins = allTodos.reduce(
      (sum, t) => sum + ((t as { estimatedTime?: number }).estimatedTime || 0),
      0
    );
    const completedEstimatedMins = allTodos
      .filter((t) => (t as { completed: boolean }).completed)
      .reduce((sum, t) => sum + ((t as { estimatedTime?: number }).estimatedTime || 0), 0);

    return {
      success: true,
      data: {
        total,
        completed,
        active: total - completed,
        overdue,
        totalEstimatedMins,
        completedEstimatedMins,
      },
    };
  } catch (err) {
    console.error("getStats error:", err);
    return { success: false, error: "Failed to get stats" };
  }
}

export async function getAllTags(): Promise<ActionResult<string[]>> {
  try {
    const userId = await requireUserId();
    await dbConnect();
    const result = await Todo.distinct("tags", { userId });
    return { success: true, data: result as string[] };
  } catch (err) {
    return { success: false, error: "Failed to get tags" };
  }
}

export async function createTodo(
  formData: z.infer<typeof TodoCreateSchema>
): Promise<ActionResult<ITodo>> {
  try {
    const userId = await requireUserId();
    await dbConnect();
    const parsed = TodoCreateSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }
    const { dueDate, ...rest } = parsed.data;
    const todo = await Todo.create({
      ...rest,
      userId,
      dueDate: dueDate ? new Date(dueDate) : null,
      order: Date.now(),
    });
    revalidatePath("/");
    return { success: true, data: serializeTodo(todo) };
  } catch (err) {
    console.error("createTodo error:", err);
    return { success: false, error: "Failed to create todo" };
  }
}

export async function updateTodo(
  id: string,
  formData: z.infer<typeof TodoUpdateSchema>
): Promise<ActionResult<ITodo>> {
  try {
    const userId = await requireUserId();
    await dbConnect();
    const parsed = TodoUpdateSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }
    const { dueDate, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };
    if (dueDate !== undefined) {
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
    }
    const todo = await Todo.findOneAndUpdate({ _id: id, userId }, updateData, { new: true });
    if (!todo) return { success: false, error: "Todo not found" };
    revalidatePath("/");
    return { success: true, data: serializeTodo(todo) };
  } catch (err) {
    console.error("updateTodo error:", err);
    return { success: false, error: "Failed to update todo" };
  }
}

export async function toggleTodo(
  id: string,
  completed: boolean
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await dbConnect();
    const todo = await Todo.findOne({ _id: id, userId });
    if (!todo) return { success: false, error: "Todo not found" };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      completed,
      completedAt: completed ? new Date() : null,
    };

    await todo.updateOne(updateData);

    // Handle recurring: create next occurrence when completed
    if (completed && todo.recurring !== "none" && todo.dueDate) {
      const nextDate = getNextOccurrence(todo.dueDate, todo.recurring);
      if (nextDate) {
        await Todo.create({
          userId,
          title: todo.title,
          description: todo.description,
          priority: todo.priority,
          dueDate: nextDate,
          tags: todo.tags,
          subtasks: todo.subtasks.map((s) => ({ text: s.text, done: false })),
          recurring: todo.recurring,
          estimatedTime: todo.estimatedTime,
          pinned: todo.pinned,
        });
      }
    }

    revalidatePath("/");
    return { success: true };
  } catch (err) {
    console.error("toggleTodo error:", err);
    return { success: false, error: "Failed to toggle todo" };
  }
}

export async function deleteTodo(id: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await dbConnect();
    await Todo.findOneAndDelete({ _id: id, userId });
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: "Failed to delete todo" };
  }
}

export async function togglePin(id: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await dbConnect();
    const todo = await Todo.findOne({ _id: id, userId });
    if (!todo) return { success: false, error: "Not found" };
    await todo.updateOne({ pinned: !todo.pinned });
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: "Failed to pin todo" };
  }
}

// ─── Subtask Actions ──────────────────────────────────────────────────────────

export async function addSubtask(
  todoId: string,
  text: string
): Promise<ActionResult<ISubtask>> {
  try {
    const userId = await requireUserId();
    await dbConnect();
    const todo = await Todo.findOneAndUpdate(
      { _id: todoId, userId },
      { $push: { subtasks: { text: text.trim(), done: false } } },
      { new: true }
    );
    if (!todo) return { success: false, error: "Todo not found" };
    revalidatePath("/");
    const last = todo.subtasks[todo.subtasks.length - 1];
    return { success: true, data: serializeSubtask(last) };
  } catch (err) {
    return { success: false, error: "Failed to add subtask" };
  }
}

export async function toggleSubtask(
  todoId: string,
  subtaskId: string,
  done: boolean
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await dbConnect();
    await Todo.findOneAndUpdate(
      { _id: todoId, userId, "subtasks._id": subtaskId },
      { $set: { "subtasks.$.done": done } }
    );
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: "Failed to toggle subtask" };
  }
}

export async function deleteSubtask(
  todoId: string,
  subtaskId: string
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await dbConnect();
    await Todo.findOneAndUpdate({ _id: todoId, userId }, {
      $pull: { subtasks: { _id: subtaskId } },
    });
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: "Failed to delete subtask" };
  }
}

// ─── Note Actions ─────────────────────────────────────────────────────────────

export async function addNote(
  todoId: string,
  text: string
): Promise<ActionResult<INote>> {
  try {
    const userId = await requireUserId();
    await dbConnect();
    const todo = await Todo.findOneAndUpdate(
      { _id: todoId, userId },
      { $push: { notes: { text: text.trim() } } },
      { new: true }
    );
    if (!todo) return { success: false, error: "Todo not found" };
    revalidatePath("/");
    const last = todo.notes[todo.notes.length - 1];
    return { success: true, data: serializeNote(last) };
  } catch (err) {
    return { success: false, error: "Failed to add note" };
  }
}

export async function editNote(
  todoId: string,
  noteId: string,
  text: string
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await dbConnect();
    const trimmed = text.trim();
    if (!trimmed) return { success: false, error: "Note text is required" };
    await Todo.findOneAndUpdate(
      { _id: todoId, userId, "notes._id": noteId },
      { $set: { "notes.$.text": trimmed } }
    );
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: "Failed to edit note" };
  }
}

export async function deleteNote(
  todoId: string,
  noteId: string
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await dbConnect();
    await Todo.findOneAndUpdate({ _id: todoId, userId }, {
      $pull: { notes: { _id: noteId } },
    });
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: "Failed to delete note" };
  }
}

// ─── Attachment Actions ───────────────────────────────────────────────────────

const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

export async function addAttachment(
  todoId: string,
  file: { filename: string; mimeType: string; data: string }
): Promise<ActionResult<IAttachment>> {
  try {
    const userId = await requireUserId();
    await dbConnect();

    const sizeBytes = Math.ceil((file.data.length * 3) / 4);
    if (sizeBytes > MAX_ATTACHMENT_BYTES) {
      return { success: false, error: "File exceeds 3MB limit" };
    }

    const todo = await Todo.findOneAndUpdate(
      { _id: todoId, userId },
      {
        $push: {
          attachments: {
            filename: file.filename,
            mimeType: file.mimeType,
            size: sizeBytes,
            data: file.data,
          },
        },
      },
      { new: true }
    );
    if (!todo) return { success: false, error: "Todo not found" };
    revalidatePath("/");
    const last = todo.attachments[todo.attachments.length - 1];
    return { success: true, data: { ...serializeAttachment(last), data: "" } };
  } catch (err) {
    return { success: false, error: "Failed to add attachment" };
  }
}

export async function getAttachmentData(
  todoId: string,
  attachmentId: string
): Promise<ActionResult<IAttachment>> {
  try {
    const userId = await requireUserId();
    await dbConnect();
    const todo = await Todo.findOne(
      { _id: todoId, userId, "attachments._id": attachmentId },
      { "attachments.$": 1 }
    ).lean();
    const att = (todo as unknown as { attachments?: unknown[] })?.attachments?.[0];
    if (!att) return { success: false, error: "Attachment not found" };
    return { success: true, data: serializeAttachment(att) };
  } catch (err) {
    return { success: false, error: "Failed to fetch attachment" };
  }
}

export async function deleteAttachment(
  todoId: string,
  attachmentId: string
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await dbConnect();
    await Todo.findOneAndUpdate(
      { _id: todoId, userId },
      { $pull: { attachments: { _id: attachmentId } } }
    );
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: "Failed to delete attachment" };
  }
}

// ─── Bulk Actions ─────────────────────────────────────────────────────────────

export async function bulkDeleteTodos(ids: string[]): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await dbConnect();
    await Todo.deleteMany({ _id: { $in: ids }, userId });
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: "Failed to delete todos" };
  }
}

export async function reorderTodos(orderedIds: string[]): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await dbConnect();
    await Promise.all(
      orderedIds.map((id, index) =>
        Todo.updateOne({ _id: id, userId }, { order: index })
      )
    );
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: "Failed to reorder todos" };
  }
}

export async function bulkCompleteTodos(ids: string[]): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await dbConnect();
    await Todo.updateMany(
      { _id: { $in: ids }, userId },
      { completed: true, completedAt: new Date() }
    );
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: "Failed to complete todos" };
  }
}
