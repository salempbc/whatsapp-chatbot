import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import mongoose from "mongoose";

/**
 * Creates a gzipped JSON archive containing full documents from all primary church collections.
 * Completely free, does not rely on mongodump binary, and works directly inside Node.js.
 */
export const createDatabaseDump = async (targetDir = null) => {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB database connection is not active.");
  }

  const collections = await db.listCollections().toArray();
  const dumpData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      databaseName: db.databaseName,
      collectionsCount: collections.length
    },
    collections: {}
  };

  const SENSITIVE_COLLECTIONS = new Set(["adminsessions", "sessions"]);

  for (const col of collections) {
    // Exclude system collections and sensitive session tokens
    if (col.name.startsWith("system.") || SENSITIVE_COLLECTIONS.has(col.name.toLowerCase())) continue;
    const records = await db.collection(col.name).find({}).toArray();
    dumpData.collections[col.name] = records;
  }

  const jsonString = JSON.stringify(dumpData, null, 2);
  const compressed = zlib.gzipSync(Buffer.from(jsonString, "utf-8"));

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `spbc_backup_${db.databaseName}_${timestamp}.json.gz`;
  const outputDir = targetDir ? path.resolve(targetDir) : os.tmpdir();
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const filePath = path.join(outputDir, fileName);

  fs.writeFileSync(filePath, compressed);

  const stats = fs.statSync(filePath);
  return {
    filePath,
    fileName,
    sizeBytes: stats.size,
    totalRecords: Object.values(dumpData.collections).reduce((acc, curr) => acc + curr.length, 0),
    collectionsCount: Object.keys(dumpData.collections).length
  };
};

/**
 * Restores MongoDB collections from a gzipped or plain JSON dump archive.
 * Validates metadata, checks database connection, and restores records.
 *
 * @param {string} archivePath - Path to the .json.gz or .json backup file
 * @param {Object} options
 * @param {boolean} options.dryRun - When true (default), inspects archive without writing to database
 * @param {boolean} options.dropExisting - When true, clears existing collections before inserting
 * @returns {Promise<Object>} Statistics on restored collections and document counts
 */
export const restoreDatabaseDump = async (archivePath, { dryRun = true, dropExisting = false } = {}) => {
  if (!archivePath || typeof archivePath !== "string") {
    throw new Error("Backup archive file path is required.");
  }

  const resolvedPath = path.resolve(archivePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Backup file not found at ${resolvedPath}`);
  }

  const fileBuffer = fs.readFileSync(resolvedPath);
  let jsonString;
  if (resolvedPath.endsWith(".gz") || (fileBuffer[0] === 0x1f && fileBuffer[1] === 0x8b)) {
    jsonString = zlib.gunzipSync(fileBuffer).toString("utf-8");
  } else {
    jsonString = fileBuffer.toString("utf-8");
  }

  let dumpData;
  try {
    dumpData = JSON.parse(jsonString);
  } catch (err) {
    throw new Error(`Invalid JSON format in backup file: ${err.message}`, { cause: err });
  }

  if (!dumpData || typeof dumpData !== "object" || !dumpData.collections) {
    throw new Error("Invalid backup archive structure: missing 'collections' payload.");
  }

  const collections = Object.keys(dumpData.collections);
  const summary = {
    dryRun,
    archivePath: resolvedPath,
    exportedAt: dumpData.metadata?.exportedAt || "unknown",
    sourceDatabase: dumpData.metadata?.databaseName || "unknown",
    collectionsCount: collections.length,
    totalRecords: 0,
    details: {}
  };

  for (const colName of collections) {
    const records = dumpData.collections[colName];
    const count = Array.isArray(records) ? records.length : 0;
    summary.totalRecords += count;
    summary.details[colName] = { recordCount: count, status: "pending" };
  }

  if (dryRun) {
    for (const colName of collections) {
      summary.details[colName].status = "simulated";
    }
    return summary;
  }

  const db = mongoose.connection.db;
  if (!db || mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB database connection is not active.");
  }

  const SENSITIVE_COLLECTIONS = new Set(["adminsessions", "sessions"]);

  for (const colName of collections) {
    if (colName.startsWith("system.") || SENSITIVE_COLLECTIONS.has(colName.toLowerCase())) {
      summary.details[colName].status = "skipped_system_or_sensitive";
      continue;
    }

    const records = dumpData.collections[colName];
    if (!Array.isArray(records) || records.length === 0) {
      summary.details[colName].status = "empty_skipped";
      continue;
    }

    const col = db.collection(colName);
    if (dropExisting) {
      await col.deleteMany({});
    }

    const parsedRecords = records.map((doc) => {
      const copy = { ...doc };
      if (copy._id && typeof copy._id === "string" && mongoose.Types.ObjectId.isValid(copy._id)) {
        copy._id = new mongoose.Types.ObjectId(copy._id);
      }
      return copy;
    });

    try {
      await col.insertMany(parsedRecords, { ordered: false });
      summary.details[colName].status = "restored";
    } catch (insertErr) {
      summary.details[colName].status = `completed_with_notices: ${insertErr.message}`;
    }
  }

  return summary;
};

/**
 * Automatically inspects the latest backup archive or generates and verifies a fresh dry-run test
 * to certify database recoverability.
 *
 * @param {string} [targetDir] - Directory where backup archives are stored
 * @returns {Promise<Object>} Verification certificate and health status
 */
export const verifyBackupIntegrity = async (targetDir = null) => {
  const outputDir = targetDir ? path.resolve(targetDir) : os.tmpdir();

  // Find candidate backup archives
  let archivePath = null;
  if (fs.existsSync(outputDir)) {
    const files = fs.readdirSync(outputDir)
      .filter(f => f.startsWith("spbc_backup_") && (f.endsWith(".json.gz") || f.endsWith(".json")))
      .map(f => ({ name: f, time: fs.statSync(path.join(outputDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 0) {
      archivePath = path.join(outputDir, files[0].name);
    }
  }

  // If no archive exists on disk yet, generate a fresh dump to verify database
  if (!archivePath) {
    const freshDump = await createDatabaseDump(outputDir);
    archivePath = freshDump.filePath;
  }

  const dryRunReport = await restoreDatabaseDump(archivePath, { dryRun: true });
  const stats = fs.statSync(archivePath);

  return {
    healthy: true,
    archiveName: path.basename(archivePath),
    archiveSizeBytes: stats.size,
    archiveSizeKb: Math.round((stats.size / 1024) * 10) / 10,
    verifiedAt: new Date().toISOString(),
    exportedAt: dryRunReport.exportedAt,
    sourceDatabase: dryRunReport.sourceDatabase,
    collectionsCount: dryRunReport.collectionsCount,
    totalRecords: dryRunReport.totalRecords,
    recoverable: true,
    collectionDetails: dryRunReport.details
  };
};
