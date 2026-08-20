import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true },
  value: { type: String, required: true }
});

const Settings = mongoose.model("Settings", settingsSchema);

export const getSetting = async (key, defaultValue = null) => {
  const doc = await Settings.findOne({ key });
  return doc ? doc.value : defaultValue;
};

export const setSetting = async (key, value) => {
  await Settings.findOneAndUpdate(
    { key },
    { value },
    { upsert: true, new: true }
  );
};

export default Settings;
