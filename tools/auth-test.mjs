/*
 * Exercises the API auth boundary over real HTTP. No database or bot token
 * needed — every case here is rejected before any Mongoose query runs.
 * Run with: node tools/auth-test.mjs
 */
process.env.BOT_TOKEN = "123456:TEST-TOKEN";
process.env.ADMIN_ID = "42";
process.env.WEBHOOK_SECRET = "test-webhook-secret";

const express = (await import("express")).default;
const crypto = (await import("crypto")).default;
const apiRouter = (await import("../src/api/index.js")).default;

const app = express();
app.use("/api", apiRouter);
const server = app.listen(0);
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

/* Build a genuine Telegram initData string signed with the test bot token. */
const signInitData = ({ userId = 42, authDate = Math.floor(Date.now() / 1000) } = {}) => {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    user: JSON.stringify({ id: userId, first_name: "Test" })
  });
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(process.env.BOT_TOKEN).digest();
  params.set("hash", crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex"));
  return params.toString();
};

let failed = 0;

const check = async (name, expected, doRequest) => {
  const res = await doRequest();
  const ok = res.status === expected;
  if (!ok) failed++;
  console.log(`  ${ok ? "ok   " : "FAIL "} ${name.padEnd(46)} expected ${expected}, got ${res.status}`);
};

const get = (path, headers = {}) => fetch(base + path, { headers });
const post = (path, headers = {}, body = {}) =>
  fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });

console.log("\nWebhook:");
await check("no secret header is rejected", 401, () => post("/api/bot-webhook"));
await check("wrong secret is rejected", 401, () =>
  post("/api/bot-webhook", { "X-Telegram-Bot-Api-Secret-Token": "wrong" })
);
await check("correct secret is accepted", 200, () =>
  post("/api/bot-webhook", { "X-Telegram-Bot-Api-Secret-Token": "test-webhook-secret" })
);

console.log("\nWebApp auth:");
await check("no Authorization header is rejected", 401, () => get("/api/members"));
await check("forged signature is rejected", 403, () =>
  get("/api/members", { Authorization: "Bearer auth_date=1&user=%7B%22id%22%3A42%7D&hash=deadbeef" })
);
await check("expired auth_date is rejected", 403, () =>
  get("/api/members", {
    Authorization: "Bearer " + signInitData({ authDate: Math.floor(Date.now() / 1000) - 90000 })
  })
);
await check("valid signature, non-admin user is rejected", 403, () =>
  get("/api/members", { Authorization: "Bearer " + signInitData({ userId: 999 }) })
);

console.log("\nPhoto endpoint (was public before):");
await check("unauthenticated photo request is rejected", 401, () =>
  get("/api/members/507f1f77bcf86cd799439011/photo")
);
await check("forged ?auth= param is rejected", 403, () =>
  get("/api/members/507f1f77bcf86cd799439011/photo?auth=" + encodeURIComponent("auth_date=1&hash=bad"))
);
await check("non-admin ?auth= param is rejected", 403, () =>
  get(
    "/api/members/507f1f77bcf86cd799439011/photo?auth=" +
      encodeURIComponent(signInitData({ userId: 999 }))
  )
);

console.log("\nInput validation (authenticated as admin):");
const admin = { Authorization: "Bearer " + signInitData() };
await check("bad sendTime is rejected", 400, () => post("/api/settings", admin, { sendTime: "99:99" }));
await check("cron-injecting sendTime is rejected", 400, () =>
  post("/api/settings", admin, { sendTime: "* * * * *" })
);
await check("non-array customFields is rejected", 400, () =>
  post("/api/settings", admin, { customFields: "nope" })
);
await check("bulk with no ids is rejected", 400, () => post("/api/members/bulk", admin, { ids: [] }));
await check("bulk with invalid id is rejected", 400, () =>
  post("/api/members/bulk", admin, { ids: ["not-an-id"], action: "delete" })
);
await check("bulk with unknown action is rejected", 400, () =>
  post("/api/members/bulk", admin, { ids: ["507f1f77bcf86cd799439011"], action: "drop-table" })
);

server.close();
console.log(failed ? `\n❌ ${failed} check(s) failed` : "\n✅ all auth checks passed");
process.exit(failed ? 1 : 0);
