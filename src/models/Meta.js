import mongoose from "mongoose";

const MetaSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed,

  type: String,
  memberId: String,
  action: String,
  before: Object,
  after: Object,

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Meta || mongoose.model("Meta", MetaSchema);