import mongoose from "mongoose";

const churchEventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      enum: [
        "worship",
        "worship_service",
        "prayer",
        "prayer_meeting",
        "bible_study",
        "fasting",
        "youth",
        "choir",
        "committee",
        "conference",
        "special_service",
        "fellowship",
        "administrative",
        "meeting",
        "member_milestone",
        "custom",
        "other"
      ],
      default: "special_service",
      index: true
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    startDate: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true
    },
    startTime: {
      type: String, // HH:MM (24h)
      default: "09:30"
    },
    endDate: {
      type: String, // YYYY-MM-DD
      default: ""
    },
    endTime: {
      type: String, // HH:MM
      default: ""
    },
    isAllDay: {
      type: Boolean,
      default: false
    },
    timezone: {
      type: String,
      default: "Asia/Kolkata"
    },
    venue: {
      type: String,
      default: "SPBC Church Hall",
      trim: true
    },
    organizer: {
      type: String,
      default: "",
      trim: true
    },
    ministry: {
      type: String,
      default: "",
      trim: true
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "completed", "cancelled"],
      default: "scheduled",
      index: true
    },
    recurrence: {
      type: {
        type: String,
        enum: ["none", "daily", "weekly", "monthly", "annually"],
        default: "none"
      },
      interval: { type: Number, default: 1 },
      daysOfWeek: [{ type: Number }], // 0 = Sun, 1 = Mon ...
      until: { type: String, default: "" } // YYYY-MM-DD
    },
    reminderConfig: {
      enabled: { type: Boolean, default: true },
      advanceHours: { type: Number, default: 24 }, // e.g. 24h before
      sameDayReminder: { type: Boolean, default: true },
      lastRemindedAt: { type: Date, default: null }
    },
    linkedMemberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      default: null
    },
    createdBy: {
      type: String,
      default: "admin"
    },
    updatedBy: {
      type: String,
      default: "admin"
    }
  },
  {
    timestamps: true
  }
);

churchEventSchema.index({ startDate: 1, status: 1 });
churchEventSchema.index({ category: 1, startDate: 1 });

const ChurchEvent = mongoose.models.ChurchEvent || mongoose.model("ChurchEvent", churchEventSchema);

export default ChurchEvent;
