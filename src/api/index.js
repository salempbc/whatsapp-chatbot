import express from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import Member from "../models/Member.js";
import Template from "../models/Template.js";

const router = express.Router();

/* Express 4 does not catch rejections from async handlers — an unhandled one
   leaves the request hanging until the client times out. Patch the verb methods
   once so every route registered below forwards failures to the error handler. */
for (const verb of ["get", "post", "put", "patch", "delete"]) {
  const register = router[verb].bind(router);
  router[verb] = (path, ...handlers) =>
    register(
      path,
      ...handlers.map((h) =>
        typeof h === "function" && h.length < 4
          ? (req, res, next) => Promise.resolve(h(req, res, next)).catch(next)
          : h
      )
    );
}

import { handleWebhook, getWebhookSecret } from "../bot/index.js";

/* Telegram echoes the secret we registered with setWebHook. Without this check
   anyone who knows the URL can POST forged updates straight into the bot. */
router.post("/bot-webhook", express.json({ limit: "1mb" }), (req, res) => {
  const provided = req.get("X-Telegram-Bot-Api-Secret-Token") || "";
  const expected = getWebhookSecret();
  const ok =
    provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));

  if (!ok) return res.sendStatus(401);

  handleWebhook(req.body);
  res.sendStatus(200);
});

/* file_id -> { url, expires }. Telegram file links are valid ~1h. */
const photoCache = new Map();
const PHOTO_CACHE_TTL = 50 * 60 * 1000;
const PHOTO_CACHE_MAX = 500;

const prunePhotoCache = () => {
  const now = Date.now();
  for (const [key, val] of photoCache) if (now >= val.expires) photoCache.delete(key);
  /* Map iterates in insertion order, so the front entries are the oldest. */
  while (photoCache.size > PHOTO_CACHE_MAX) {
    photoCache.delete(photoCache.keys().next().value);
  }
};

// Middleware to verify Telegram WebApp initData
const verifyTelegramWebAppData = (req, res, next) => {
  const authHeader = req.headers.authorization;

  /* <img src> cannot set an Authorization header, so the photo route passes the
     same signed initData as a query param. It is verified identically. */
  const initData =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : typeof req.query.auth === "string"
        ? req.query.auth
        : null;

  if (!initData) {
    return res.status(401).json({ error: "Missing authorization" });
  }

  if (!process.env.BOT_TOKEN || !process.env.ADMIN_ID) {
    return res.status(500).json({ error: "Server auth not configured" });
  }

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get("hash") || "";
  urlParams.delete("hash");

  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(process.env.BOT_TOKEN).digest();
  const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const hashOk =
    hash.length === calculatedHash.length &&
    crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(calculatedHash));

  if (!hashOk) {
    return res.status(403).json({ error: "Invalid signature" });
  }

  /* Without an auth_date window a captured initData string is a permanent
     credential, so expire it after 24h. */
  const authDate = Number(urlParams.get("auth_date"));
  if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > 86400) {
    return res.status(403).json({ error: "Session expired, please reopen the app" });
  }

  // Ensure it's the admin
  try {
    const user = JSON.parse(urlParams.get("user"));
    if (String(user.id) !== process.env.ADMIN_ID) {
      return res.status(403).json({ error: "Not authorized (Admin only)" });
    }
  } catch (e) {
    return res.status(400).json({ error: "Invalid user data" });
  }

  next();
};

router.use(express.json());
router.use(verifyTelegramWebAppData);

/* Behind the auth middleware — member photos are private data. */
router.get("/members/:id/photo", async (req, res) => {
  const m = await Member.findById(req.params.id).catch(() => null);
  if (!m || !m.photo) return res.status(404).send("No photo");

  const cached = photoCache.get(m.photo);
  if (cached && Date.now() < cached.expires) return res.redirect(cached.url);

  const resp = await fetch(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getFile?file_id=${encodeURIComponent(m.photo)}`
  );
  const data = await resp.json();
  if (!data.ok || !data.result?.file_path) return res.status(404).send("No photo");

  const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${data.result.file_path}`;
  photoCache.set(m.photo, { url, expires: Date.now() + PHOTO_CACHE_TTL });
  prunePhotoCache();
  res.redirect(url);
});

router.get("/members", async (req, res) => {
  const members = await Member.find({ isDeleted: { $ne: true } }).sort({ name: 1 });
  res.json(members);
});

router.post("/members", async (req, res) => {
  const m = await Member.create(req.body);
  res.json(m);
});

router.put("/members/:id", async (req, res) => {
  /* runValidators — otherwise schema rules (gender enum, required name) are
     skipped entirely on updates. */
  const m = await Member.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!m) return res.status(404).json({ error: "Member not found" });
  res.json(m);
});

import { exportMembersToCSV } from "../services/exportService.js";
import fs from "fs";

router.get("/export", async (req, res) => {
  const members = await Member.find({ isDeleted: { $ne: true } }).sort({ name: 1 });
  const filePath = await exportMembersToCSV(members, "all");
  res.download(filePath, "church_database.csv", () => {
    fs.unlink(filePath, () => {});
  });
});

/* TEMPLATES API */
router.get("/templates", async (req, res) => {
  const templates = await Template.find().sort({ type: 1, category: 1 });
  res.json(templates);
});

router.post("/templates", async (req, res) => {
  const t = await Template.create(req.body);
  res.json(t);
});

router.put("/templates/:id", async (req, res) => {
  const t = await Template.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!t) return res.status(404).json({ error: "Template not found" });
  res.json(t);
});

router.delete("/templates/:id", async (req, res) => {
  const t = await Template.findByIdAndDelete(req.params.id);
  if (!t) return res.status(404).json({ error: "Template not found" });
  res.json({ success: true });
});

/* BULK MEMBER ACTIONS */
router.post("/members/bulk", async (req, res) => {
  const { ids, action, payload } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: "No ids provided" });
  }
  if (!ids.every((id) => mongoose.isValidObjectId(id))) {
    return res.status(400).json({ error: "Invalid id in list" });
  }

  if (action === "delete") {
    await Member.updateMany({ _id: { $in: ids } }, { isDeleted: true });
  } else if (action === "update") {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return res.status(400).json({ error: "Invalid payload" });
    }
    await Member.updateMany({ _id: { $in: ids } }, { $set: payload }, { runValidators: true });
  } else {
    return res.status(400).json({ error: "Unknown action" });
  }
  res.json({ success: true });
});

/* SETTINGS & ACTIONS API */
import { getSetting, setSetting } from "../models/Settings.js";
import { restartScheduler, triggerNow } from "../scheduler/dailyJob.js";
import { sendMessage } from "../bot/index.js";

router.get("/settings", async (req, res) => {
  const sendTime = await getSetting("sendTime", "06:00");
  const reminderTime = await getSetting("reminderTime", "20:00");
  const customFields = await getSetting("customFields", []);
  res.json({ sendTime, reminderTime, customFields });
});

/* These values are interpolated into a cron expression, so a malformed one
   would throw inside startScheduler and leave both daily jobs stopped. */
const isHHMM = (v) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

router.post("/settings", async (req, res) => {
  const { sendTime, reminderTime, customFields } = req.body;

  if (sendTime !== undefined && !isHHMM(sendTime)) {
    return res.status(400).json({ error: "sendTime must be HH:MM (24-hour)" });
  }
  if (reminderTime !== undefined && !isHHMM(reminderTime)) {
    return res.status(400).json({ error: "reminderTime must be HH:MM (24-hour)" });
  }
  if (customFields !== undefined && !Array.isArray(customFields)) {
    return res.status(400).json({ error: "customFields must be an array" });
  }

  if (sendTime) await setSetting("sendTime", sendTime);
  if (reminderTime) await setSetting("reminderTime", reminderTime);
  if (customFields) await setSetting("customFields", customFields);

  // Restart scheduler to apply new cron times
  await restartScheduler();
  res.json({ success: true });
});

router.post("/actions/ping", async (req, res) => {
  try {
    await sendMessage("🔔 <b>CMS Ping Test</b>\n<i>If you see this, the Web App is successfully connected to the Telegram Group.</i>");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/actions/trigger-today", async (req, res) => {
  try {
    const sent = await triggerNow();
    res.json({ success: true, count: sent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* Catch-all so a thrown handler returns JSON instead of hanging or leaking a
   stack trace. Must stay last. */
router.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err?.name === "ValidationError") {
    return res.status(400).json({ error: err.message });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: "A record with that name already exists" });
  }
  if (err?.name === "CastError") {
    return res.status(400).json({ error: "Invalid id" });
  }

  console.error("❌ API error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export default router;
