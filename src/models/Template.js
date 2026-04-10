import mongoose from "mongoose";

const TemplateSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["birthday", "wedding"],
    required: true
  },

  content: {
    type: String,
    required: true
  },

  usageCount: {
    type: Number,
    default: 0
  },

  lastUsedAt: {
    type: Date
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.models.Template ||
  mongoose.model("Template", TemplateSchema);