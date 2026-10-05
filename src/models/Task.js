import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    category: {
      type: String,
      enum: [
        "general",
        "pastoral",
        "pastoral_care",
        "event_prep",
        "follow_up",
        "volunteer",
        "maintenance",
        "facility",
        "administrative",
        "admin"
      ],
      default: "general",
      index: true
    },
    status: {
      type: String,
      enum: ["todo", "in_progress", "waiting", "completed", "cancelled"],
      default: "todo",
      index: true
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true
    },
    dueDate: {
      type: String, // YYYY-MM-DD
      default: "",
      index: true
    },
    dueTime: {
      type: String, // HH:MM
      default: ""
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

const Task = mongoose.models.Task || mongoose.model("Task", taskSchema);

export default Task;
