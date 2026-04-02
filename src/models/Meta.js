import mongoose from "mongoose";

const metaSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed }
});

export default mongoose.model("Meta", metaSchema);