import mongoose, { Document, Schema, Model } from "mongoose";
import type { RecurringType } from "@/lib/dateUtils";

export type Priority = "low" | "medium" | "high";
export type { RecurringType };

// ─── Sub-document interfaces ───────────────────────────────────────────────

export interface ISubtask {
  _id: string;
  text: string;
  done: boolean;
  createdAt: Date;
}

export interface INote {
  _id: string;
  text: string;
  createdAt: Date;
}

export interface IAttachment {
  _id: string;
  filename: string;
  mimeType: string;
  size: number;
  /** Base64 file content. Omitted ("") in list views; fetched on demand via getAttachmentData. */
  data: string;
  createdAt: Date;
}

// ─── Main interface ────────────────────────────────────────────────────────

export interface ITodo {
  _id: string;
  userId: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: Priority;
  dueDate?: Date | null;
  tags: string[];
  // New fields
  subtasks: ISubtask[];
  notes: INote[];
  attachments: IAttachment[];
  completedAt?: Date | null;
  pinned: boolean;
  recurring: RecurringType;
  estimatedTime?: number | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITodoDocument
  extends Omit<ITodo, "_id" | "subtasks" | "notes" | "attachments">,
    Document {
  subtasks: Array<Omit<ISubtask, "_id"> & { _id: mongoose.Types.ObjectId }>;
  notes: Array<Omit<INote, "_id"> & { _id: mongoose.Types.ObjectId }>;
  attachments: Array<Omit<IAttachment, "_id"> & { _id: mongoose.Types.ObjectId }>;
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────

const SubtaskSchema = new Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 300 },
    done: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const NoteSchema = new Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const AttachmentSchema = new Schema(
  {
    filename: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// ─── Main schema ──────────────────────────────────────────────────────────

const TodoSchema = new Schema<ITodoDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    completed: { type: Boolean, default: false },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    dueDate: { type: Date, default: null },
    tags: { type: [String], default: [] },
    // New fields
    subtasks: { type: [SubtaskSchema], default: [] },
    notes: { type: [NoteSchema], default: [] },
    attachments: { type: [AttachmentSchema], default: [] },
    completedAt: { type: Date, default: null },
    pinned: { type: Boolean, default: false },
    recurring: {
      type: String,
      enum: ["none", "daily", "weekly", "monthly"],
      default: "none",
    },
    estimatedTime: { type: Number, default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Todo: Model<ITodoDocument> =
  mongoose.models.Todo || mongoose.model<ITodoDocument>("Todo", TodoSchema);

export default Todo;
