import mongoose from "mongoose";

export const GREETING_STATUS = {
  PENDING: "PENDING",
  GENERATING: "GENERATING",
  READY_FOR_REVIEW: "READY_FOR_REVIEW",
  EDITED: "EDITED",
  SKIPPED: "SKIPPED",
  MARKED_AS_SHARED: "MARKED_AS_SHARED",
  FAILED: "FAILED"
};

const greetingLogSchema = new mongoose.Schema(
  {
    dateKey: {
      type: String, // MM-DD
      required: true,
      index: true
    },
    year: {
      type: Number,
      required: true,
      default: () => new Date().getFullYear(),
      index: true
    },
    type: {
      type: String,
      enum: ["birthday", "wedding"],
      required: true
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
      index: true
    },
    memberName: {
      type: String,
      required: true
    },
    spouseName: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: Object.values(GREETING_STATUS),
      default: GREETING_STATUS.READY_FOR_REVIEW,
      index: true
    },
    text: {
      type: String,
      required: true
    },
    originalText: {
      type: String,
      default: ""
    },
    style: {
      type: String,
      default: "pastoral"
    },
    verseReference: {
      type: String,
      default: ""
    },
    verseText: {
      type: String,
      default: ""
    },
    photo: {
      type: String,
      default: null
    },
    reviewMessageId: {
      type: Number,
      default: null
    },
    reviewChatId: {
      type: String,
      default: null
    },
    sharedAt: {
      type: Date,
      default: null
    },
    error: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

greetingLogSchema.index({ dateKey: 1, year: 1, memberId: 1, type: 1 }, { unique: true });

const GreetingLog = mongoose.models.GreetingLog || mongoose.model("GreetingLog", greetingLogSchema);

export default GreetingLog;
