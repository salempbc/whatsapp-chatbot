import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    entity: {
      type: String, // "Member", "ChurchEvent", "Task", "Settings", "Greeting"
      required: true,
      index: true
    },
    entityId: {
      type: String,
      default: ""
    },
    action: {
      type: String, // "CREATE", "UPDATE", "ARCHIVE", "RESTORE", "STATUS_CHANGE", "DELETE"
      required: true,
      index: true
    },
    performedBy: {
      type: String,
      default: "Admin"
    },
    details: {
      type: String,
      default: ""
    },
    changes: {
      before: mongoose.Schema.Types.Mixed,
      after: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
