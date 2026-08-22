import mongoose from "mongoose";

const bibleSchema = new mongoose.Schema({
  bookId: { type: Number, required: true },
  bookName: { type: String, required: true },
  chapter: { type: Number, required: true },
  verse: { type: Number, required: true },
  text: { type: String, required: true }
});

bibleSchema.index({ bookId: 1, chapter: 1, verse: 1 });
bibleSchema.index({ bookName: 1, chapter: 1, verse: 1 });
bibleSchema.index({ text: "text" });

export default mongoose.model("Bible", bibleSchema);
