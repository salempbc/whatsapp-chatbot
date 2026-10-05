import mongoose from "mongoose";

const authorizedUserSchema = new mongoose.Schema(
  {
    telegramId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    username: { type: String, trim: true, default: "" },
    role: { type: String, enum: ["admin", "staff"], default: "admin" },
    status: { type: String, enum: ["active", "pending", "revoked"], default: "active", index: true },
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
