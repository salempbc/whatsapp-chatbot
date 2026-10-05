import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import mongoose from "mongoose";

/**
 * Creates a gzipped JSON archive containing full documents from all primary church collections.
 * Completely free, does not rely on mongodump binary, and works directly inside Node.js.
 */
export const createDatabaseDump = async () => {
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

  for (const col of collections) {
    // Exclude system collections
    if (col.name.startsWith("system.")) continue;
    const records = await db.collection(col.name).find({}).toArray();
    dumpData.collections[col.name] = records;
  }

  const jsonString = JSON.stringify(dumpData, null, 2);
  const compressed = zlib.gzipSync(Buffer.from(jsonString, "utf-8"));

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `spbc_backup_${db.databaseName}_${timestamp}.json.gz`;
  const filePath = path.join(os.tmpdir(), fileName);

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
