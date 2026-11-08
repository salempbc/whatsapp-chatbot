import "dotenv/config";
import mongoose from "mongoose";
import { restoreDatabaseDump } from "../src/services/backupService.js";

/**
 * 🛠️ DISASTER RECOVERY & BACKUP RESTORATION TOOL
 *
 * Usage:
 *   node scripts/restore_backup.js <archive-path>           # Dry run (inspect only)
 *   node scripts/restore_backup.js <archive-path> --confirm  # Live restoration
 *   node scripts/restore_backup.js <archive-path> --confirm --drop # Drop existing collections first
 */
const main = async () => {
  const args = process.argv.slice(2);
  const archivePath = args.find((a) => !a.startsWith("--"));

  if (!archivePath) {
    console.error("❌ Error: Path to backup file (.json.gz or .json) is required.");
    console.error("   Usage: node scripts/restore_backup.js <archive-path> [--confirm] [--drop]\n");
    process.exit(1);
  }

  const isConfirm = args.includes("--confirm");
  const isDrop = args.includes("--drop");
  const isDryRun = !isConfirm;

  console.log("--------------------------------------------------");
  console.log("🛡️  SPBC CHURCH CMS — BACKUP RESTORATION UTILITY");
  console.log("--------------------------------------------------");
  console.log(`📦 Target Archive: ${archivePath}`);
  console.log(`⚙️  Execution Mode: ${isDryRun ? "DRY-RUN (Inspection Only)" : "LIVE RESTORATION"}`);
  console.log(`🗑️  Drop Existing: ${isDrop ? "YES (Destructive)" : "NO (Append/Merge)"}`);
  console.log("--------------------------------------------------");

  if (isDryRun) {
    console.log("💡 Inspecting archive contents without connecting to database...\n");
    try {
      const summary = await restoreDatabaseDump(archivePath, { dryRun: true });
      console.log(`📅 Backup Export Date: ${summary.exportedAt}`);
      console.log(`🗄️  Source Database:   ${summary.sourceDatabase}`);
      console.log(`📚 Total Collections: ${summary.collectionsCount}`);
      console.log(`📄 Total Records:     ${summary.totalRecords}\n`);
      console.log("Breakdown by collection:");
      for (const [col, info] of Object.entries(summary.details)) {
        console.log(`   - ${col.padEnd(20)}: ${info.recordCount} records`);
      }
      console.log("\n✅ Dry run completed successfully. No database writes were performed.");
      console.log("   To perform live restoration, append --confirm:");
      console.log(`   node scripts/restore_backup.js "${archivePath}" --confirm\n`);
      process.exit(0);
    } catch (err) {
      console.error("💥 Archive inspection failed:", err.message);
      process.exit(1);
    }
  }

  // Live Restoration requires MONGO_URI
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("❌ MONGO_URI environment variable is required to restore database.");
    process.exit(1);
  }

  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("🚀 Executing restoration into database...");

    const result = await restoreDatabaseDump(archivePath, { dryRun: false, dropExisting: isDrop });

    console.log("--------------------------------------------------");
    console.log("✅ RESTORATION COMPLETE");
    console.log("--------------------------------------------------");
    console.log(`📚 Collections Processed: ${result.collectionsCount}`);
    console.log(`📄 Records Processed:     ${result.totalRecords}`);
    for (const [col, info] of Object.entries(result.details)) {
      console.log(`   - ${col.padEnd(20)}: ${info.recordCount} records [${info.status}]`);
    }
    console.log("--------------------------------------------------");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("💥 Restoration failed:", err.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect().catch(() => {});
    }
    process.exit(1);
  }
};

main();
