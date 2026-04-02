import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "whatsapp-chatbot" // 🔥 FORCE DB NAME
    });

    console.log("✅ MongoDB connected");

    // DEBUG (keep this)
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("📦 Collections:", collections.map(c => c.name));

  } catch (err) {
    console.error("❌ DB error:", err.message);
    process.exit(1);
  }
};