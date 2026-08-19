import mongoose from "mongoose";

const TemplateSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["birthday", "wedding"],
    required: true
  },

  category: {
    type: String,
    enum: ["formal", "poetic", "short"],
    default: "formal"
  },

  content: {
    type: String,
    required: true
  },

  usageCount: {
    type: Number,
    default: 0
  },

  lastUsedAt: Date
});

export default mongoose.models.Template ||
  mongoose.model("Template", TemplateSchema);