import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import AuthorizedUser from "../src/models/AuthorizedUser.js";
import { ALL_PERMISSION_KEYS, resolveUserPermissions } from "../src/services/userService.js";

/**
 * Idempotent migration to ensure all AuthorizedUser records have complete,
 * explicit boolean permission keys matching the role matrix, preserving
 * any intentional custom overrides.
 *
 * RESTORATION & RECOVERY:
 * Before mutating any database records, this script creates a timestamped JSON snapshot
 * in the backups directory (e.g. backups/users_permissions_backup_<ISO>.json).
 * To restore in case of failure or unintended modifications, inspect the backup file
 * and restore using MongoDB Compass, mongoimport, or the following recovery snippet:
 *
 *   const backup = JSON.parse(fs.readFileSync('backups/users_permissions_backup_...json', 'utf8'));
 *   for (const u of backup) {
 *     await AuthorizedUser.updateOne({ telegramId: u.telegramId }, { $set: { permissions: u.permissions } });
 *   }
 *
 * @param {Object} options
 * @param {boolean} options.dryRun - When true (default), inspects and reports without writing.
 * @param {boolean} options.backup - When true and dryRun is false, creates a verified snapshot before writing.
 * @param {string} options.backupDir - Directory where snapshots are stored.
 * @returns {Promise<Object>} Migration statistics, diffs, and backup file info.
 */
export const migrateUserPermissions = async ({
  dryRun = true,
  backup = true,
  backupDir = "./backups"
} = {}) => {
  if (mongoose.connection?.readyState !== 1) {
    return {
      totalScanned: 0,
      modifiedCount: 0,
      dryRun,
      backupFile: null,
      reports: []
    };
  }
  const users = await AuthorizedUser.find({});
  let totalScanned = 0;
  let modifiedCount = 0;
  let backupFile = null;
  const reports = [];

  for (const user of users) {
    totalScanned++;
    const current = user.permissions ? (user.permissions.toObject ? user.permissions.toObject() : { ...user.permissions }) : {};
    const resolved = resolveUserPermissions(user.role || "admin", current);

    const missingKeys = [];
    const changedKeys = [];

    for (const key of ALL_PERMISSION_KEYS) {
      if (current[key] === undefined || current[key] === null) {
        missingKeys.push({ key, resolvedValue: resolved[key] });
      } else if (current[key] !== resolved[key]) {
        changedKeys.push({ key, from: current[key], to: resolved[key] });
      }
    }

    if (missingKeys.length > 0 || changedKeys.length > 0) {
      modifiedCount++;
      reports.push({
        userDoc: user,
        telegramId: user.telegramId,
        name: user.name,
        role: user.role,
        missingKeys,
        changedKeys,
        resolvedPermissions: resolved
      });
    }
  }

  // Pre-mutation snapshot backup (only if not a dry-run and updates are required)
  if (!dryRun && modifiedCount > 0 && backup) {
    try {
      const resolvedBackupDir = path.resolve(backupDir);
      fs.mkdirSync(resolvedBackupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `users_permissions_backup_${timestamp}.json`;
      const fullPath = path.join(resolvedBackupDir, filename);

      const snapshot = users.map((u) => ({
        _id: String(u._id),
        telegramId: u.telegramId,
        name: u.name,
        role: u.role,
        status: u.status,
        permissions: u.permissions ? (u.permissions.toObject ? u.permissions.toObject() : { ...u.permissions }) : {}
      }));

      fs.writeFileSync(fullPath, JSON.stringify(snapshot, null, 2), "utf8");

      // Verify the backup file was written and is not empty before proceeding to write
      if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size === 0) {
        throw new Error(`Backup file ${fullPath} is empty or missing`);
      }

      backupFile = fullPath;
      console.log(`💾 Pre-migration backup verified: ${fullPath}`);
    } catch (backupErr) {
      console.error("💥 Aborting migration: Pre-migration backup failed:", backupErr.message);
      throw new Error(`Migration aborted due to backup failure: ${backupErr.message}`, { cause: backupErr });
    }

    // Apply updates safely
    for (const r of reports) {
      r.userDoc.permissions = r.resolvedPermissions;
      r.userDoc.updatedAt = new Date();
      await r.userDoc.save();
    }
  }

  return {
    dryRun,
    totalScanned,
    modifiedCount,
    backupFile,
    reports: reports.map(({ userDoc, ...rest }) => rest)
  };
};

/* Standalone CLI runner */
const isMain = process.argv[1] && process.argv[1].endsWith("migrate_user_permissions.js");
if (isMain) {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  const isConfirm = args.includes("--confirm");
  const isDryRun = !isApply;

  if (isApply && !isConfirm) {
    console.error("❌ SAFETY CHECK FAILED: Running with --apply modifies live database records.");
    console.error("   To confirm live migration, pass both flags: --apply --confirm");
    console.error("   Example: node scripts/migrate_user_permissions.js --apply --confirm\n");
    process.exit(1);
  }

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("❌ MONGO_URI environment variable is required to run migration.");
    process.exit(1);
  }

  console.log(`🚀 Starting User Permissions Migration [Mode: ${isDryRun ? "DRY-RUN (Simulated)" : "APPLY (Live)"}]...`);

  mongoose
    .connect(mongoUri)
    .then(async () => {
      const stats = await migrateUserPermissions({ dryRun: isDryRun });
      console.log("--------------------------------------------------");
      console.log(`📊 Scanned Users: ${stats.totalScanned}`);
      console.log(`🔄 Users Requiring Update: ${stats.modifiedCount}`);
      if (stats.backupFile) {
        console.log(`💾 Pre-Migration Backup Saved: ${stats.backupFile}`);
      }
      console.log("--------------------------------------------------");

      for (const r of stats.reports) {
        console.log(`👤 User: ${r.name} (${r.telegramId}) | Role: ${r.role}`);
        if (r.missingKeys.length) {
          console.log(`   + Added missing keys: ${r.missingKeys.map((k) => `${k.key}=${k.resolvedValue}`).join(", ")}`);
        }
        if (r.changedKeys.length) {
          console.log(`   ~ Adjusted keys: ${r.changedKeys.map((k) => `${k.key}: ${k.from} -> ${k.to}`).join(", ")}`);
        }
      }

      if (isDryRun) {
        console.log("\n💡 Dry run complete. No records were modified.");
        console.log("   To apply changes to database, run: node scripts/migrate_user_permissions.js --apply --confirm");
      } else {
        console.log("\n✅ Migration applied successfully.");
      }

      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error("💥 Migration failed:", err.message);
      process.exit(1);
    });
}
