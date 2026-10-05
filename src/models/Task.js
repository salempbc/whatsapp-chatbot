import mongoose from "mongoose";

const subtaskSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 300 },
    done: { type: Boolean, default: false }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    author: { type: String, default: "Admin" }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const attachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: String, required: true } // Base64
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000
    },
    category: {
      type: String,
      default: "general",
      index: true
    },
    status: {
      type: String,
      enum: ["todo", "in_progress", "waiting", "completed", "cancelled"],
      default: "todo",
      index: true
    },
    completed: {
      type: Boolean,
      default: false,
      index: true
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true
    },
    dueDate: {
      type: String, // YYYY-MM-DD or ISO string
      default: "",
      index: true
    },
    dueTime: {
      type: String, // HH:MM
      default: ""
    },
    pinned: {
      type: Boolean,
      default: false,
      index: true
    },
    recurring: {
      type: String,
      enum: ["none", "daily", "weekly", "monthly"],
      default: "none"
    },
    estimatedTime: {
      type: Number,
      default: null // In minutes
    },
    tags: {
      type: [String],
      default: []
    },
    order: {
      type: Number,
      default: 0
    },
    subtasks: {
      type: [subtaskSchema],
      default: []
    },
    notes: {
      type: [noteSchema],
      default: []
    },
    attachments: {
      type: [attachmentSchema],
      default: []
    },
    assignee: {
      type: String,
      default: "Admin",
      trim: true
    },
    linkedMemberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      default: null
    },
    linkedEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChurchEvent",
      default: null
    },
    followUpDetails: {
      contactPerson: { type: String, default: "" },
      contactMethod: { type: String, default: "" },
      nextAction: { type: String, default: "" },
      resolutionNotes: { type: String, default: "" }
    },
    reminderConfig: {
      enabled: { type: Boolean, default: true },
      remindOnDueDate: { type: Boolean, default: true },
      lastRemindedAt: { type: Date, default: null }
    },
    history: [
      {
        action: String,
        performedBy: String,
        details: String,
        timestamp: { type: Date, default: Date.now }
      }
    ],
    completedAt: {
      type: Date,
      default: null
    },
    createdBy: {
      type: String,
      default: "Admin"
    }
  },
  {
    timestamps: true
  }
);

taskSchema.index({ status: 1, dueDate: 1 });
taskSchema.index({ category: 1, priority: 1 });
taskSchema.index({ pinned: 1, order: 1 });

const Task = mongoose.models.Task || mongoose.model("Task", taskSchema);

export default Task;
