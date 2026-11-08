import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import { restoreDatabaseDump } from "../src/services/backupService.js";
import { renderScreen } from "../src/bot/ui.js";
import { adminOnly } from "../src/bot/guard.js";

test("Disaster Recovery: restoreDatabaseDump dryRun inspects archive safely", async () => {
  const dummyDump = {
    metadata: {
      exportedAt: new Date().toISOString(),
      databaseName: "spbc_test_db",
      collectionsCount: 2
    },
    collections: {
      members: [
        { name: "John Doe", gender: "male", status: "active" },
        { name: "Jane Doe", gender: "female", status: "active" }
      ],
      templates: [
        { name: "Default Birthday", type: "birthday", text: "Happy Birthday!" }
      ]
    }
  };

  const jsonStr = JSON.stringify(dummyDump);
  const compressed = zlib.gzipSync(Buffer.from(jsonStr, "utf-8"));
  const tmpFile = path.join(os.tmpdir(), `test_backup_${Date.now()}.json.gz`);

  try {
    fs.writeFileSync(tmpFile, compressed);

    // 1. Dry run inspection
    const summary = await restoreDatabaseDump(tmpFile, { dryRun: true });
    assert.equal(summary.dryRun, true);
    assert.equal(summary.collectionsCount, 2);
    assert.equal(summary.totalRecords, 3);
    assert.equal(summary.sourceDatabase, "spbc_test_db");
    assert.equal(summary.details.members.recordCount, 2);
    assert.equal(summary.details.members.status, "simulated");
    assert.equal(summary.details.templates.recordCount, 1);

    // 2. Missing archive throws
    await assert.rejects(
      async () => {
        await restoreDatabaseDump("nonexistent_path_xyz.json.gz", { dryRun: true });
      },
      /Backup file not found/,
      "Must throw when archive path does not exist"
    );

    // 3. Invalid JSON archive throws
    const badFile = path.join(os.tmpdir(), `bad_backup_${Date.now()}.json`);
    fs.writeFileSync(badFile, "NOT_VALID_JSON{{{");
    await assert.rejects(
      async () => {
        await restoreDatabaseDump(badFile, { dryRun: true });
      },
      /Invalid JSON format in backup file/,
      "Must throw when archive content is malformed"
    );
    fs.unlinkSync(badFile);
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
});

test("Bot UI Resilience: renderScreen handles null or empty screen objects without crashing", async () => {
  const mockBot = {
    editMessageText: async () => {},
    sendMessage: async () => {}
  };

  // Must not throw when screen is null or undefined
  await assert.doesNotReject(async () => {
    await renderScreen(mockBot, 12345, null, null);
  }, "renderScreen must safely ignore null screen");

  await assert.doesNotReject(async () => {
    await renderScreen(mockBot, 12345, null, { text: "" });
  }, "renderScreen must safely handle empty text");
});

test("Security Guard Resilience: adminOnly catches async errors and prevents unhandled rejections", async () => {
  const origAdmin = process.env.ADMIN_ID;
  process.env.ADMIN_ID = "99999";

  try {
    const faultyHandler = adminOnly(async () => {
      throw new Error("Simulated async failure in bot command");
    });

    // Calling the wrapped handler must catch the error internally and not throw unhandled rejection
    await assert.doesNotReject(async () => {
      await faultyHandler({ from: { id: 99999 } });
    }, "adminOnly must safely catch asynchronous handler exceptions");
  } finally {
    process.env.ADMIN_ID = origAdmin;
  }
});
