import test from "node:test";
import assert from "node:assert/strict";

test("Cron Converter: Validates HH:MM and generates valid cron format", () => {
  const toCron = (value, fallback = "06:00") => {
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value ?? "")) ? String(value) : fallback;
    const [hh, mm] = time.split(":");
    return { cron: `${Number(mm)} ${Number(hh)} * * *`, time };
  };

  assert.deepEqual(toCron("06:30"), { cron: "30 6 * * *", time: "06:30" });
  assert.deepEqual(toCron("20:00"), { cron: "0 20 * * *", time: "20:00" });
  assert.deepEqual(toCron("invalid-time", "06:00"), { cron: "0 6 * * *", time: "06:00" });
});

test("Sanitization: Accusative Tamil name suffix generator", () => {
  const formatTamilName = (name, age) => {
    if (age !== null && age < 30) {
      return name + " -ஐ";
    }
    return name + " அவர்களை";
  };

  assert.equal(formatTamilName("யோவான்", 22), "யோவான் -ஐ");
  assert.equal(formatTamilName("தாவீது", 45), "தாவீது அவர்களை");
});

test("HTTP Endpoints: /ping, /api/ping, /api/diagnostics, webhook and auth", async () => {
  const express = (await import("express")).default;
  const http = (await import("http")).default;
  const apiRouter = (await import("../src/api/index.js")).default;
  const { getWebhookSecret } = await import("../src/bot/index.js");

  const origToken = process.env.BOT_TOKEN;
  const origAdmin = process.env.ADMIN_ID;
  process.env.BOT_TOKEN = "TEST_BOT_TOKEN_FOR_API";
  process.env.ADMIN_ID = "999888777";

  const app = express();
  app.get("/ping", (req, res) => res.status(200).send("pong"));
  app.use("/api", apiRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Root /ping
    const resPing = await fetch(`${baseUrl}/ping`);
    assert.equal(resPing.status, 200);
    assert.equal(await resPing.text(), "pong");

    // 2. /api/ping
    const resApiPing = await fetch(`${baseUrl}/api/ping`);
    assert.equal(resApiPing.status, 200);
    assert.equal(await resApiPing.text(), "pong");

    // 3. /api/diagnostics
    const resDiag = await fetch(`${baseUrl}/api/diagnostics`);
    assert.equal(resDiag.status, 200);
    const diagData = await resDiag.json();
    assert.ok(["healthy", "degraded"].includes(diagData.status));
    assert.ok(typeof diagData.uptimeSeconds === "number");
    assert.ok(typeof diagData.memory === "object");
    assert.ok(typeof diagData.nodeVersion === "string");
    const rawDiag = JSON.stringify(diagData);
    assert.equal(rawDiag.includes("TEST_BOT_TOKEN_FOR_API"), false, "Diagnostics must never leak BOT_TOKEN");
    assert.equal(rawDiag.includes("mongodb"), false, "Diagnostics must never leak MONGO_URI");
    assert.equal(rawDiag.includes("secret"), false, "Diagnostics must never leak secrets");

    // 4. /api/members without auth -> 401
    const resUnauth = await fetch(`${baseUrl}/api/members`);
    assert.equal(resUnauth.status, 401);

    // 5. /api/members with token missing hash -> 401
    const resNoHash = await fetch(`${baseUrl}/api/members`, {
      headers: { Authorization: "Bearer invalid_secret_token" }
    });
    assert.equal(resNoHash.status, 401);

    // 6. /api/members with forged HMAC signature -> 403
    const resForgedHash = await fetch(`${baseUrl}/api/members`, {
      headers: { Authorization: "Bearer auth_date=1700000000&hash=fakehash12345678" }
    });
    assert.equal(resForgedHash.status, 403);

    // 7. /api/bot-webhook with invalid secret -> 401
    const resBadWebhook = await fetch(`${baseUrl}/api/bot-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "bad_secret"
      },
      body: JSON.stringify({ update_id: 1 })
    });
    assert.equal(resBadWebhook.status, 401);

    // 7. /api/bot-webhook with valid secret -> 200
    const validSecret = getWebhookSecret();
    const resGoodWebhook = await fetch(`${baseUrl}/api/bot-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": validSecret
      },
      body: JSON.stringify({ update_id: 2 })
    });
    assert.equal(resGoodWebhook.status, 200);
  } finally {
    process.env.BOT_TOKEN = origToken;
    process.env.ADMIN_ID = origAdmin;
    await new Promise((resolve) => server.close(resolve));
  }
});
