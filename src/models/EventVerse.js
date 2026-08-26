import mongoose from "mongoose";

const eventVerseSchema = new mongoose.Schema({
  reference: { type: String, required: true },
  type: { type: String, enum: ["birthday", "youth", "elder", "wedding"], required: true }
});

export default mongoose.model("EventVerse", eventVerseSchema);
