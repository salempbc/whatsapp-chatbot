import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "whatsapp-chatbot"
    });

    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ DB error:", err.message);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  await mongoose.connection.close();
};