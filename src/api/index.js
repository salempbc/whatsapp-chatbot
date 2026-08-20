import express from "express";
import crypto from "crypto";
import Member from "../models/Member.js";
import Template from "../models/Template.js";

const router = express.Router();

// Middleware to verify Telegram WebApp initData
const verifyTelegramWebAppData = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization" });
  }

  const initData = authHeader.split(" ")[1];
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get("hash");
  urlParams.delete("hash");

  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(process.env.BOT_TOKEN).digest();
  const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (calculatedHash !== hash) {
    return res.status(403).json({ error: "Invalid signature" });
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

router.get("/members", async (req, res) => {
  const members = await Member.find({ isDeleted: { $ne: true } }).sort({ name: 1 });
  res.json(members);
});

router.post("/members", async (req, res) => {
  const m = await Member.create(req.body);
  res.json(m);
});

router.put("/members/:id", async (req, res) => {
  const m = await Member.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(m);
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
  const t = await Template.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(t);
});

router.delete("/templates/:id", async (req, res) => {
  await Template.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* BULK MEMBER ACTIONS */
router.post("/members/bulk", async (req, res) => {
  const { ids, action, payload } = req.body;
  if (!ids || !ids.length) return res.status(400).json({ error: "No ids provided" });

  if (action === "delete") {
    await Member.updateMany({ _id: { $in: ids } }, { isDeleted: true });
  } else if (action === "update") {
    await Member.updateMany({ _id: { $in: ids } }, { $set: payload });
  }
  res.json({ success: true });
});

/* SETTINGS & ACTIONS API */
import { getSetting, setSetting } from "../models/Settings.js";
import { restartScheduler, triggerNow } from "../scheduler/dailyJob.js";
import { sendMessage } from "../bot/index.js";

router.get("/settings", async (req, res) => {
  const sendTime = await getSetting("sendTime", "06:00");
  const reminderTime = await getSetting("reminderTime", "20:00"); // Not fully dynamic in dailyJob yet but we'll store it
  res.json({ sendTime, reminderTime });
});

router.post("/settings", async (req, res) => {
  const { sendTime, reminderTime } = req.body;
  if (sendTime) await setSetting("sendTime", sendTime);
  if (reminderTime) await setSetting("reminderTime", reminderTime);
  
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

export default router;
