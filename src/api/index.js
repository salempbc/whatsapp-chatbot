import express from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import fs from "fs";
import Member from "../models/Member.js";
import Template from "../models/Template.js";
import GreetingLog from "../models/GreetingLog.js";
import ChurchEvent from "../models/ChurchEvent.js";
import Task from "../models/Task.js";
import { handleWebhook, getWebhookSecret, getBotInstance } from "../bot/index.js";
import { verifyTelegramWebAppData, requirePermission } from "./middleware.js";
import { exportMembersToCSV } from "../services/exportService.js";
import { getSetting, setSetting } from "../models/Settings.js";
import { restartScheduler, triggerNow } from "../scheduler/dailyJob.js";
import { sendAdminMessage } from "../bot/index.js";
import { getUpcomingEvents } from "../services/eventService.js";
import {
  prepareTodayGreetings,
  regenerateGreeting,
  markGreetingAsShared,
  skipGreeting,
  updateGreetingText
} from "../services/greetingService.js";
import {
  checkDuplicates,
  archiveMember,
  restoreMember,
  validateStatusTransition,
  mergeMembers
} from "../services/memberService.js";
import {
  createChurchEvent,
  updateChurchEvent,
  cancelChurchEvent,
  getUnifiedEventsForRange,
  exportEventsToICS
} from "../services/churchCalendarService.js";
import {
  getTasks,
  getTaskStats,
  createTask,
  updateTask,
  deleteTask,
  toggleTaskComplete,
  toggleTaskPin,
  addSubtask,
  toggleSubtask,
  deleteSubtask,
  addNote,
  deleteNote,
  addAttachment,
  deleteAttachment,
  bulkActionTasks,
  reorderTasks,
  getTasksDueTodayOrOverdue,
  parseQuickAddTask
} from "../services/taskService.js";
import {
  getChurchStatistics,
  getDataQualityReport
} from "../services/reportService.js";
import {
  getAllUsers,
  getUserByTelegramId,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  approveUser,
  revokeUser,
  createInviteToken,
  getDefaultPermissions
} from "../services/userService.js";
import {
  getErrorLogs,
  resolveErrorLog,
  deleteErrorLog,
  clearErrorLogs,
  captureError
} from "../services/errorLogService.js";

const router = express.Router();

/* Express async handler error forwarding patch */
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

const escapeHtml = (str = "") =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const escapeRegex = (str = "") =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* Telegram Bot Webhook endpoint */
router.post("/bot-webhook", express.json({ limit: "1mb" }), (req, res) => {
  const provided = req.get("X-Telegram-Bot-Api-Secret-Token") || "";
  const expected = getWebhookSecret();
  const ok =
    expected.length > 0 &&
    provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));

  if (!ok) return res.sendStatus(401);

  handleWebhook(req.body);
  res.sendStatus(200);
});

/* Photo cache to prevent rate-limiting from Telegram getFile */
const photoCache = new Map();
const PHOTO_CACHE_TTL = 50 * 60 * 1000;
const PHOTO_CACHE_MAX = 500;

const prunePhotoCache = () => {
  const now = Date.now();
  for (const [key, val] of photoCache) if (now >= val.expires) photoCache.delete(key);
  while (photoCache.size > PHOTO_CACHE_MAX) {
    photoCache.delete(photoCache.keys().next().value);
  }
};

/* Support up to 15mb for base64 task attachments and member photos */
router.use(express.json({ limit: "15mb" }));
router.use(express.urlencoded({ extended: true, limit: "15mb" }));

/* 1. PUBLIC HEALTH & TELEMETRY */
router.get("/ping", (req, res) => res.status(200).send("pong"));

router.get("/diagnostics", async (req, res) => {
  const start = Date.now();
  let dbStatus = "connected";
  let dbLatency = 0;
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      dbLatency = Date.now() - start;
    } else {
      dbStatus = "disconnected";
    }
  } catch (e) {
    dbStatus = "error: " + e.message;
  }

  const mem = process.memoryUsage();
  res.json({
    status: dbStatus === "connected" ? "healthy" : "degraded",
    uptimeSeconds: Math.floor(process.uptime()),
    database: { status: dbStatus, latencyMs: dbLatency },
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024)
    },
    nodeVersion: process.version,
    platform: process.platform,
    timestamp: new Date().toISOString()
  });
});

/* Client-side telemetry & error reporting endpoint (Accessible without auth to report frontend crashes) */
router.post("/client-error", async (req, res) => {
  try {
    const { message, stack, info, userAgent, url } = req.body || {};
    await captureError({
      error: { message: message || "Unknown WebApp client error", stack: stack || "" },
      source: "client",
      endpoint: url || "webapp:browser",
      statusCode: 500,
      userId: req.headers["x-telegram-user-id"] || "client-user",
      context: { info, userAgent, url }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(200).json({ ok: false });
  }
});

/* 2. PROTECTED ADMIN ROUTES */
router.use(verifyTelegramWebAppData);

/* Auth verification ping for WebApp standalone browser sessions */
router.post("/auth/verify", (req, res) => {
  res.json({ success: true, user: req.user || { role: "admin" } });
});

/* Member Photo Proxy & Upload */
router.get("/members/:id/photo", async (req, res) => {
  const m = await Member.findById(req.params.id).catch(() => null);
  if (!m || !m.photo) return res.status(404).send("No photo");

  // If photo is stored directly as a base64 data URL
  if (m.photo.startsWith("data:image/")) {
    const parts = m.photo.split(",");
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const imgBuffer = Buffer.from(parts[1], "base64");
    res.setHeader("Content-Type", mime);
    return res.send(imgBuffer);
  }

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

router.post("/members/:id/photo", express.json({ limit: "10mb" }), async (req, res) => {
  const { photo } = req.body;
  if (!photo || typeof photo !== "string") {
    return res.status(400).json({ error: "Invalid photo payload" });
  }
  const m = await Member.findById(req.params.id);
  if (!m) return res.status(404).json({ error: "Member not found" });

  m.photo = photo;
  await m.save();
  res.json({ success: true, member: m });
});

/* ========================================================= */
/* MODULE A: MEMBER LIFECYCLE MANAGEMENT                     */
/* ========================================================= */
router.get("/members", async (req, res) => {
  const { status, includeArchived, search } = req.query;
  const filter = {};

  if (includeArchived !== "true") {
    filter.isDeleted = { $ne: true };
  }
  if (status && status !== "all") {
    filter.status = status;
  }
  if (search && search.trim()) {
    const s = escapeRegex(search.trim());
    filter.$or = [
      { name: new RegExp(s, "i") },
      { familyName: new RegExp(s, "i") },
      { phone: new RegExp(s, "i") },
      { role: new RegExp(s, "i") }
    ];
  }

  const members = await Member.find(filter).sort({ name: 1 }).lean();
  res.json(members);
});

router.post("/members/check-duplicate", async (req, res) => {
  const duplicates = await checkDuplicates(req.body);
  res.json({ duplicates });
});

router.post("/members", async (req, res) => {
  if (typeof req.body.dob === "string" && req.body.dob.length >= 5) {
    req.body.birthday = req.body.dob.substring(5);
  }
  if (typeof req.body.weddingDate === "string" && req.body.weddingDate.length >= 5) {
    req.body.wedding = req.body.weddingDate.substring(5);
  }
  const m = await Member.create(req.body);
  res.json(m);
});

router.put("/members/:id", async (req, res) => {
  const m = await Member.findById(req.params.id);
  if (!m) return res.status(404).json({ error: "Member not found" });

  if (req.body.dob !== undefined) {
    req.body.birthday = req.body.dob ? req.body.dob.substring(5) : "";
  }
  if (req.body.weddingDate !== undefined) {
    req.body.wedding = req.body.weddingDate ? req.body.weddingDate.substring(5) : "";
  }

  if (req.body.status && req.body.status !== m.status) {
    if (!validateStatusTransition(m.status, req.body.status)) {
      return res.status(400).json({
        error: `Invalid status transition from '${m.status}' to '${req.body.status}'`
      });
    }
  }

  Object.assign(m, req.body);
  await m.save();
  res.json(m);
});

router.post("/members/:id/archive", async (req, res) => {
  const m = await archiveMember(req.params.id);
  res.json({ success: true, member: m });
});

router.post("/members/:id/restore", async (req, res) => {
  const m = await restoreMember(req.params.id);
  res.json({ success: true, member: m });
});

router.post("/members/merge", async (req, res) => {
  const { targetId, sourceId } = req.body;
  if (!targetId || !sourceId) {
    return res.status(400).json({ error: "targetId and sourceId are required" });
  }
  const result = await mergeMembers(targetId, sourceId, req.user?.id ? `tg:${req.user.id}` : "admin");
  res.json({ success: true, ...result });
});

/* Export Roster to CSV */
router.get("/export", async (req, res) => {
  const members = await Member.find({ isDeleted: { $ne: true } }).sort({ name: 1 });
  const filePath = await exportMembersToCSV(members, "all");
  res.download(filePath, "church_database.csv", () => {
    fs.unlink(filePath, () => {});
  });
});

/* Church Directory HTML */
router.get("/directory", async (req, res) => {
  const members = await Member.find({ isDeleted: { $ne: true } }).sort({ familyName: 1, name: 1 });
  
  const families = {};
  for (const m of members) {
    const fam = m.familyName || "General Roster";
    if (!families[fam]) families[fam] = [];
    families[fam].push(m);
  }

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Church Directory - SPBC</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1e293b; max-width: 900px; margin: 0 auto; }
    h1 { color: #1e3a8a; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; font-size: 28px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
    .print-btn { background: #2563eb; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 8px; cursor: pointer; }
    @media print { .print-btn { display: none; } body { padding: 0; } }
    .family-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; page-break-inside: avoid; }
    .family-title { font-size: 20px; font-weight: bold; color: #0f172a; margin-bottom: 12px; border-bottom: 2px solid #cbd5e1; padding-bottom: 5px; }
    .member-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; }
    .member-item { background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
    .role-badge { background: #dbeafe; color: #1e40af; font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: bold; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>⛪ Salem PBC - Official Church Directory</h1>
      <p style="color: #64748b; margin-top: -15px;">Generated on ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}</p>
    </div>
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>`;

  for (const [famName, famMembers] of Object.entries(families)) {
    html += `<div class="family-card">
      <div class="family-title">🏡 ${escapeHtml(famName)} (${famMembers.length})</div>
      <div class="member-grid">`;
    
    for (const m of famMembers) {
      html += `<div class="member-item">
        <div style="display:flex; justify-content: space-between; align-items:center;">
          <strong style="font-size: 16px;">${escapeHtml(m.name)}</strong>
          ${m.role ? `<span class="role-badge">${escapeHtml(m.role)}</span>` : ""}
        </div>
        <div style="font-size: 13px; color: #475569; margin-top: 6px;">
          Gender: ${m.gender === "male" ? "♂ Male" : "♀ Female"}<br>
          ${m.dob ? `DOB: ${escapeHtml(m.dob)}<br>` : ""}
          ${m.isMarried ? `Spouse: ${escapeHtml(m.spouseName || "Married")}<br>` : ""}
          ${m.weddingDate ? `Anniversary: ${escapeHtml(m.weddingDate)}` : ""}
        </div>
      </div>`;
    }

    html += `</div></div>`;
  }

  html += `</body></html>`;
  res.send(html);
});

/* Bulk Member Import with validation */
router.post("/members/import", async (req, res) => {
  const { members } = req.body;
  if (!Array.isArray(members) || !members.length) {
    return res.status(400).json({ error: "Please provide an array of members to import." });
  }

  let created = 0;
  let skipped = 0;

  for (const item of members) {
    if (!item.name || !item.gender) {
      skipped++;
      continue;
    }

    const dob = item.dob || "";
    const weddingDate = item.weddingDate || "";

    const payload = {
      name: item.name.trim(),
      gender: item.gender.toLowerCase(),
      role: item.role || "",
      dob: dob,
      birthday: dob ? dob.substring(5) : "",
      weddingDate: weddingDate,
      wedding: weddingDate ? weddingDate.substring(5) : "",
      isMarried: Boolean(item.isMarried),
      spouseName: item.spouseName || "",
      spouseGender: item.spouseGender || "",
      familyName: item.familyName || "",
      isChild: Boolean(item.isChild),
      isPastor: Boolean(item.isPastor),
      status: item.status || "active",
      isActive: item.status ? item.status === "active" : item.isActive !== false,
      customData: item.customData || {}
    };

    await Member.findOneAndUpdate(
      { name: payload.name },
      payload,
      { upsert: true, new: true, runValidators: true }
    );
    created++;
  }

  res.json({ success: true, count: created, skipped });
});

/* Bulk Member Actions */
router.post("/members/bulk", async (req, res) => {
  const { ids, action, payload } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: "No ids provided" });
  }
  if (!ids.every((id) => mongoose.isValidObjectId(id))) {
    return res.status(400).json({ error: "Invalid id in list" });
  }

  if (action === "delete" || action === "archive") {
    await Member.updateMany({ _id: { $in: ids } }, { status: "archived", isDeleted: true, isActive: false });
  } else if (action === "restore") {
    await Member.updateMany({ _id: { $in: ids } }, { status: "active", isDeleted: false, isActive: true });
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

/* ========================================================= */
/* MODULE B: UNIFIED CHURCH CALENDAR & EVENTS                */
/* ========================================================= */
router.get("/events", async (req, res) => {
  const { startDate, endDate, category } = req.query;
  const filter = { status: { $ne: "cancelled" } };
  if (startDate && endDate) {
    filter.startDate = { $gte: startDate, $lte: endDate };
  }
  if (category && category !== "all") {
    filter.category = category;
  }
  const events = await ChurchEvent.find(filter).sort({ startDate: 1, startTime: 1 }).lean();
  res.json(events);
});

router.post("/events", async (req, res) => {
  const event = await createChurchEvent(req.body);
  res.json(event);
});

router.put("/events/:id", async (req, res) => {
  const event = await updateChurchEvent(req.params.id, req.body);
  res.json(event);
});

router.delete("/events/:id", async (req, res) => {
  const event = await cancelChurchEvent(req.params.id);
  res.json({ success: true, event });
});

router.get("/events/export/ics", async (req, res) => {
  const events = await ChurchEvent.find({ status: { $ne: "cancelled" } }).sort({ startDate: 1 });
  const ics = exportEventsToICS(events);
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="spbc_church_calendar.ics"');
  res.send(ics);
});

/* ========================================================= */
/* MODULE C: ADMINISTRATIVE TASK & FOLLOW-UP MANAGEMENT      */
/* ========================================================= */
router.get("/tasks", async (req, res) => {
  const { status, category, priority, tag, search, sortField, sortOrder } = req.query;
  const tasks = await getTasks({ status, category, priority, tag, search, sortField, sortOrder });
  res.json(tasks);
});

router.get("/tasks/stats", async (req, res) => {
  const stats = await getTaskStats();
  res.json(stats);
});

router.get("/tasks/overdue", async (req, res) => {
  const tasks = await getTasksDueTodayOrOverdue();
  res.json(tasks);
});

router.post("/tasks", async (req, res) => {
  let taskData = { ...req.body };
  if (req.body.quickAdd || (!req.body.title && req.body.text)) {
    const parsed = parseQuickAddTask(req.body.text || req.body.title || "");
    taskData = {
      ...parsed,
      ...req.body,
      title: parsed.title || req.body.title || "Untitled Task",
      description: parsed.description || req.body.description || "",
      dueDate: parsed.dueDate || req.body.dueDate || "",
      dueTime: parsed.dueTime || req.body.dueTime || "",
      tags: [...new Set([...(parsed.tags || []), ...(req.body.tags || [])])],
      priority: req.body.priority || parsed.priority || "medium"
    };
  }
  const task = await createTask(taskData, req.user?.name || "Admin");
  res.json(task);
});

router.post("/tasks/bulk", async (req, res) => {
  const result = await bulkActionTasks(req.body, req.user?.name || "Admin");
  res.json(result);
});

router.post("/tasks/reorder", async (req, res) => {
  await reorderTasks(req.body.orderedIds);
  res.json({ success: true });
});

router.put("/tasks/:id", async (req, res) => {
  const task = await updateTask(req.params.id, req.body, req.user?.name || "Admin");
  res.json(task);
});

router.delete("/tasks/:id", async (req, res) => {
  try {
    const task = await deleteTask(req.params.id, req.user?.name || "Admin");
    res.json({ success: true, task });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.post("/tasks/:id/toggle", async (req, res) => {
  try {
    const task = await toggleTaskComplete(req.params.id, req.user?.name || "Admin");
    res.json(task);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.post("/tasks/:id/pin", async (req, res) => {
  try {
    const task = await toggleTaskPin(req.params.id, req.user?.name || "Admin");
    res.json(task);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.post("/tasks/:id/subtasks", async (req, res) => {
  try {
    const task = await addSubtask(req.params.id, req.body.text);
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/tasks/:id/subtasks/:subId/toggle", async (req, res) => {
  try {
    const task = await toggleSubtask(req.params.id, req.params.subId);
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/tasks/:id/subtasks/:subId", async (req, res) => {
  try {
    const task = await deleteSubtask(req.params.id, req.params.subId);
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/tasks/:id/notes", async (req, res) => {
  try {
    const task = await addNote(req.params.id, {
      text: req.body.text,
      author: req.body.author || req.user?.name || "Admin"
    });
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/tasks/:id/notes/:noteId", async (req, res) => {
  try {
    const task = await deleteNote(req.params.id, req.params.noteId);
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/tasks/:id/attachments", async (req, res) => {
  try {
    const task = await addAttachment(req.params.id, req.body);
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/tasks/:id/attachments/:attId", async (req, res) => {
  try {
    const task = await deleteAttachment(req.params.id, req.params.attId);
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ========================================================= */
/* MODULE D: ADVANCED CHURCH STATISTICS & DATA QUALITY       */
/* ========================================================= */
router.get("/reports/stats", async (req, res) => {
  const stats = await getChurchStatistics();
  res.json(stats);
});

router.get("/reports/data-quality", async (req, res) => {
  const report = await getDataQualityReport();
  res.json(report);
});

/* Templates */
router.get("/templates", async (req, res) => {
  const templates = await Template.find().sort({ type: 1, category: 1 }).lean();
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

/* Settings */
router.get("/settings", async (req, res) => {
  const sendTime = await getSetting("sendTime", "06:00");
  const reminderTime = await getSetting("reminderTime", "20:00");
  const customFields = await getSetting("customFields", []);
  res.json({ sendTime, reminderTime, customFields });
});

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

  await restartScheduler();
  res.json({ success: true });
});

/* Upcoming Celebrations */
router.get("/upcoming", async (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    const data = await getUpcomingEvents(days);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* Greetings Review API for Dashboard */
router.get("/greetings/today", async (req, res) => {
  try {
    const logs = await prepareTodayGreetings();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/greetings/:id/regenerate", async (req, res) => {
  try {
    const log = await regenerateGreeting(req.params.id, req.body);
    res.json({ success: true, greeting: log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/greetings/:id/shared", async (req, res) => {
  try {
    const log = await markGreetingAsShared(req.params.id);
    res.json({ success: true, greeting: log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/greetings/:id/skip", async (req, res) => {
  try {
    const log = await skipGreeting(req.params.id);
    res.json({ success: true, greeting: log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/greetings/:id/text", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Text required" });
    const log = await updateGreetingText(req.params.id, text);
    res.json({ success: true, greeting: log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* User Management (Church Leaders & Staff - Full Access Control CRUD) */
router.get("/users", async (req, res) => {
  const users = await getAllUsers();
  res.json({
    superAdminId: process.env.ADMIN_ID || null,
    currentUser: req.user || null,
    users
  });
});

/* CRUD CREATE: Directly register a church leader / staff */
router.post("/users", requirePermission("canManageUsers"), async (req, res) => {
  const { telegramId, name, username, role = "admin", status = "active", permissions, notes } = req.body || {};
  if (!telegramId || !name) {
    return res.status(400).json({ error: "Telegram ID and Name are required" });
  }
  try {
    const user = await createUser({
      telegramId,
      name,
      username,
      role,
      status,
      permissions,
      notes,
      addedBy: req.user?.first_name || req.user?.name || req.user?.id || "Admin"
    });
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* CRUD UPDATE: Update a leader's details, role, status, or granular permissions */
router.put("/users/:telegramId", requirePermission("canManageUsers"), async (req, res) => {
  const { telegramId } = req.params;
  const updates = req.body || {};
  if (!telegramId) return res.status(400).json({ error: "Telegram ID required" });
  try {
    const user = await updateUser(telegramId, updates);
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* CRUD DELETE: Permanently delete or revoke an authorized user */
router.delete("/users/:telegramId", requirePermission("canManageUsers"), async (req, res) => {
  const { telegramId } = req.params;
  const { hard } = req.query;
  if (!telegramId) return res.status(400).json({ error: "Telegram ID required" });
  if (process.env.ADMIN_ID && String(telegramId).trim() === String(process.env.ADMIN_ID).trim()) {
    return res.status(400).json({ error: "Cannot delete or revoke primary Super Admin" });
  }
  try {
    if (hard === "true" || hard === "1") {
      const user = await deleteUser(telegramId);
      return res.json({ success: true, user, action: "deleted" });
    }
    const user = await revokeUser(telegramId);
    res.json({ success: true, user, action: "revoked" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* TOGGLE STATUS: Toggle active / suspended */
router.post("/users/:telegramId/toggle-status", requirePermission("canManageUsers"), async (req, res) => {
  const { telegramId } = req.params;
  if (!telegramId) return res.status(400).json({ error: "Telegram ID required" });
  try {
    const user = await toggleUserStatus(telegramId);
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/users/invite", requirePermission("canManageUsers"), async (req, res) => {
  const { role = "admin", permissions = null, hoursValid = 72 } = req.body || {};
  let botUsername = process.env.BOT_USERNAME || "";
  if (!botUsername) {
    const bot = getBotInstance();
    if (bot) {
      const me = await bot.getMe().catch(() => null);
      if (me?.username) botUsername = me.username;
    }
  }
  const invite = await createInviteToken({
    role,
    permissions,
    hoursValid,
    botUsername,
    createdBy: req.user?.first_name || req.user?.id || "Admin"
  });
  res.json(invite);
});

router.post("/users/approve", requirePermission("canManageUsers"), async (req, res) => {
  const { telegramId, role = "admin", permissions = null, name, username } = req.body || {};
  if (!telegramId) return res.status(400).json({ error: "Telegram ID required" });
  const user = await approveUser({
    telegramId,
    role,
    permissions,
    name,
    username,
    approvedBy: req.user?.first_name || req.user?.id || "Admin"
  });
  res.json({ success: true, user });
});

/* Actions */
router.post("/actions/ping", async (req, res) => {
  try {
    await sendAdminMessage("🔔 <b>CMS Ping Test</b>\n<i>If you see this, the Web App is successfully connected to the Admin Telegram channel.</i>");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/actions/trigger-today", async (req, res) => {
  try {
    const count = await triggerNow();
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ========================================================================= */
/* --- SYSTEM ERROR LOGS & AUDIT TRAIL ------------------------------------- */
/* ========================================================================= */
router.get("/errors", requirePermission("view_analytics"), async (req, res) => {
  try {
    const { source, resolved, search, page, limit } = req.query;
    const result = await getErrorLogs({ source, resolved, search, page, limit });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/errors/:id/resolve", requirePermission("edit_settings"), async (req, res) => {
  try {
    const user = req.user?.username || req.user?.first_name || "Admin";
    const updated = await resolveErrorLog(req.params.id, user);
    if (!updated) return res.status(404).json({ error: "Error log not found" });
    res.json({ success: true, log: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/errors/:id", requirePermission("edit_settings"), async (req, res) => {
  try {
    const deleted = await deleteErrorLog(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Error log not found" });
    res.json({ success: true, message: "Error log entry deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/errors/clear", requirePermission("edit_settings"), async (req, res) => {
  try {
    const { onlyResolved = true } = req.body;
    const count = await clearErrorLogs(onlyResolved);
    res.json({ success: true, deletedCount: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* Catch-all error handler */
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
