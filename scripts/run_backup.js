import mongoose from "mongoose";
import path from "path";
import dotenv from "dotenv";
import { createDatabaseDump } from "../src/services/backupService.js";

dotenv.config();

const run = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("❌ Error: MONGO_URI environment variable is missing.");
    process.exit(1);
  }

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
    console.log("✅ Connected successfully. Generating database dump...");

    const backupsDir = path.resolve(process.cwd(), "backups");
    const result = await createDatabaseDump(backupsDir);

    console.log(`✅ Backup successfully created: ${result.fileName}`);
    console.log(`📁 File path: ${result.filePath}`);
    console.log(`📊 Size: ${(result.sizeBytes / 1024).toFixed(2)} KB`);
    console.log(`📚 Collections dumped: ${result.collectionsCount}`);
    console.log(`📝 Total Records: ${result.totalRecords}`);

    await mongoose.disconnect();
    console.log("🔌 Disconnected cleanly from MongoDB.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Backup failed:", err.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
    process.exit(1);
  }
};

run();
