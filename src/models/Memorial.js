import mongoose from "mongoose";

const memorialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  relation: { type: String, trim: true, default: "" },
  date: { type: String, required: true }, // Format MM-DD
});

export default mongoose.model("Memorial", memorialSchema);
