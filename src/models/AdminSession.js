import mongoose from "mongoose";

const adminSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: ["superadmin", "admin", "pastor", "staff", "volunteer"],
      default: "admin"
    },
    csrfToken: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 } // MongoDB automatic TTL cleanup
    },
    userAgent: {
      type: String,
      default: ""
    },
    ip: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.models.AdminSession ||
  mongoose.model("AdminSession", adminSessionSchema);
