import mongoose from "mongoose";

const errorLogSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
      index: true
    },
    stack: {
      type: String,
      default: ""
    },
    source: {
      type: String,
      enum: ["express", "telegram", "scheduler", "client", "system"],
      default: "system",
      index: true
    },
    endpoint: {
      type: String,
      default: ""
    },
    method: {
      type: String,
      default: ""
    },
    statusCode: {
      type: Number,
      default: 500
    },
    userId: {
      type: String,
      default: "anonymous",
      index: true
    },
    userName: {
      type: String,
      default: ""
    },
    context: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    resolved: {
      type: Boolean,
      default: false,
      index: true
    },
    resolvedBy: {
      type: String,
      default: ""
    },
    resolvedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// 30-day automatic retention to prevent free-tier MongoDB storage growth
errorLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const ErrorLog = mongoose.model("ErrorLog", errorLogSchema);
export default ErrorLog;
