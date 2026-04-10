import mongoose from "mongoose";

const AICacheSchema = new mongoose.Schema({
  input: { type: String, unique: true },
  output: String,
  createdAt: { type: Date, default: Date.now }
});

AICacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export default mongoose.models.AICache ||
  mongoose.model("AICache", AICacheSchema);