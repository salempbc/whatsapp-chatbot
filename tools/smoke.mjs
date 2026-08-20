/*
 * Import-graph smoke test: loads every module app.js pulls in, so missing
 * exports and bad imports surface without a database or a bot token.
 * Run with: node tools/smoke.mjs
 */
process.env.BOT_TOKEN ||= "0:test";
process.env.ADMIN_ID ||= "1";

const modules = [
  "../src/config/db.js",
  "../src/models/Member.js",
  "../src/models/Settings.js",
  "../src/models/Template.js",
  "../src/models/Meta.js",
  "../src/models/aiCache.js",
  "../src/services/aiService.js",
  "../src/services/eventService.js",
  "../src/services/exportService.js",
  "../src/services/memberService.js",
  "../src/scheduler/dailyJob.js",
  "../src/bot/index.js",
  "../src/api/index.js"
];

let failed = 0;

for (const m of modules) {
  try {
    await import(m);
    console.log("  ok    ", m.replace("../", ""));
  } catch (err) {
    failed++;
    console.log("  FAIL  ", m.replace("../", ""), "\n         ", err.message);
  }
}

/* Verify the named imports app.js expects are really exported. */
const bot = await import("../src/bot/index.js");
for (const name of ["initTelegram", "stopTelegram", "waitForQueueToDrain", "handleWebhook", "sendMessage", "getWebhookSecret"]) {
  if (typeof bot[name] !== "function") {
    failed++;
    console.log("  FAIL   bot/index.js missing export:", name);
  }
}

console.log(failed ? `\n❌ ${failed} problem(s)` : "\n✅ import graph clean");
process.exit(failed ? 1 : 0);
