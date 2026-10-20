import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  /* Mixed, not String — customFields is stored here as an array, which a
     String path refuses to cast. */
  value: { type: mongoose.Schema.Types.Mixed, required: true }
});

const Settings = mongoose.model("Settings", settingsSchema);

export const getSetting = async (key, defaultValue = null) => {
  const cleanKey = typeof key === "string" ? key.trim() : String(key || "");
  const doc = await Settings.findOne({ key: cleanKey });
  return doc ? doc.value : defaultValue;
};

export const setSetting = async (key, value) => {
  const cleanKey = typeof key === "string" ? key.trim() : String(key || "");
  await Settings.findOneAndUpdate(
    { key: cleanKey },
    { value },
    { upsert: true, new: true }
  );
};

export default Settings;
