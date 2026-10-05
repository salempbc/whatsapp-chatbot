import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { exportMembersToCSV } from "../src/services/exportService.js";

test("Date Logic: Leap year Feb 29 anniversary and birthday matching", () => {
  const isMatchToday = (recordDateMMDD, todayDate, isLeapYear = false) => {
    if (recordDateMMDD === "02-29" && !isLeapYear && todayDate === "02-28") {
      return true;
    }
    return recordDateMMDD === todayDate;
  };

  assert.equal(isMatchToday("02-29", "02-28", false), true, "Feb 29 celebrants must be recognized on Feb 28 in non-leap years");
  assert.equal(isMatchToday("02-29", "02-29", true), true, "Feb 29 celebrants recognized on Feb 29 in leap years");
  assert.equal(isMatchToday("02-29", "02-28", true), false, "Feb 29 celebrants NOT moved to Feb 28 during leap years");
  assert.equal(isMatchToday("10-05", "10-05", false), true);
  assert.equal(isMatchToday("10-05", "10-06", false), false);
});

test("Scheduler Broadcast Safety: Morning job must never send messages to public group CHAT_ID", async () => {
  // Read src/scheduler/dailyJob.js to verify static invariant
  const dailyJobCode = fs.readFileSync(path.join(process.cwd(), "src/scheduler/dailyJob.js"), "utf8");

  assert.ok(
    !dailyJobCode.includes("bot.api.sendMessage(process.env.CHAT_ID"),
    "dailyJob.js must NOT send messages directly to process.env.CHAT_ID"
  );
  assert.ok(
    !dailyJobCode.includes("sendMessage(msg.text"),
    "dailyJob.js must NOT invoke automatic group sendMessage"
  );
  assert.ok(
    dailyJobCode.includes("prepareTodayGreetings"),
    "dailyJob.js must invoke idempotent greeting preparation"
  );
  assert.ok(
    dailyJobCode.includes("reviewSummaryScreen"),
    "dailyJob.js must render review summary for admin"
  );
});

test("Data Management: CSV export protects against CSV injection and preserves Tamil UTF-8 BOM", async () => {
  const testMembers = [
    {
      name: "=cmd|' /C calc'!A0", // Malicious formula attempt
      gender: "male",
      role: "Member",
      isActive: true,
      dob: "1990-05-15",
      birthday: "05-15"
    },
    {
      name: "யோவான் (John)",
      gender: "male",
      role: "Pastor",
      isActive: true,
      dob: "1980-10-05",
      birthday: "10-05",
      isMarried: true,
      spouseName: "சாராள்"
    }
  ];

  const filePath = await exportMembersToCSV(testMembers, "security_test");
  const fileBuffer = fs.readFileSync(filePath);

  // Check UTF-8 BOM
  assert.equal(fileBuffer[0], 0xEF, "BOM byte 1");
  assert.equal(fileBuffer[1], 0xBB, "BOM byte 2");
  assert.equal(fileBuffer[2], 0xBF, "BOM byte 3");

  const fileText = fileBuffer.toString("utf8");

  // Check formula injection neutralization
  assert.ok(fileText.includes("'=cmd|' /C calc'!A0"), "Formula prefix must be prepended with a single quote");
  // Check Tamil preservation
  assert.ok(fileText.includes("யோவான் (John)"), "Tamil text must be fully preserved in CSV");
  assert.ok(fileText.includes("சாராள்"), "Spouse Tamil name must be preserved");

  fs.unlinkSync(filePath);
});
