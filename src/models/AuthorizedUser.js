import mongoose from "mongoose";

const permissionsSchema = new mongoose.Schema(
  {
    canManageMembers: { type: Boolean, default: true },
    canDeleteMembers: { type: Boolean, default: false },
    canSendGreetings: { type: Boolean, default: true },
    canManageTemplates: { type: Boolean, default: true },
    canManageEvents: { type: Boolean, default: true },
    canManageTasks: { type: Boolean, default: true },
    canExportData: { type: Boolean, default: false },
    canManageUsers: { type: Boolean, default: false }
  },
  { _id: false }
);

const authorizedUserSchema = new mongoose.Schema(
  {
    telegramId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    username: { type: String, trim: true, default: "" },
    role: {
      type: String,
      enum: ["superadmin", "admin", "pastor", "staff", "volunteer"],
      default: "admin"
    },
    status: {
      type: String,
      enum: ["active", "pending", "suspended", "revoked"],
      default: "active",
      index: true
    },
    permissions: {
      type: permissionsSchema,
      default: () => ({})
    },
    notes: { type: String, default: "", trim: true },
    lastActiveAt: { type: Date, default: null },
    inviteToken: { type: String, default: null, index: true },
    inviteExpires: { type: Date, default: null },
    addedBy: { type: String, default: "Super Admin" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true
  }
);

const AuthorizedUser = mongoose.model("AuthorizedUser", authorizedUserSchema);

export default AuthorizedUser;
