import express from "express";
import mongoose from "mongoose";
import fs from "fs";
import Member from "../../models/Member.js";
import { requirePermission } from "../middleware.js";
import { exportMembersToCSV } from "../../services/exportService.js";
import { checkDuplicates, archiveMember, restoreMember, validateStatusTransition, mergeMembers } from "../../services/memberService.js";
import { createRouter } from "../router.js";

const router = createRouter();

const escapeHtml = (str = "") =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const escapeRegex = (str = "") =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


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


/* Member Photo Proxy (Authenticated avatar serving with strict timeout & size checks) */
router.get("/members/:id/photo", requirePermission(["canManageMembers", "canSendGreetings"]), async (req, res) => {
  const m = await Member.findById(req.params.id).catch(() => null);
  if (!m || !m.photo) return res.status(404).send("No photo");

  // If photo is stored directly as a base64 data URL
  if (m.photo.startsWith("data:image/")) {
    const parts = m.photo.split(",");
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime.toLowerCase())) {
      return res.status(415).send("Unsupported image format");
    }
    const imgBuffer = Buffer.from(parts[1], "base64");
    if (imgBuffer.length > 10 * 1024 * 1024) {
      return res.status(413).send("Image too large");
    }
    res.setHeader("Content-Type", mime);
    return res.send(imgBuffer);
  }

  const cached = photoCache.get(m.photo);
  if (cached && Date.now() < cached.expires) {
    res.setHeader("Content-Type", cached.contentType || "image/jpeg");
    return res.send(cached.buffer);
  }

  try {
    const timeoutSignal = AbortSignal.timeout(6000);
    const resp = await fetch(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getFile?file_id=${encodeURIComponent(m.photo)}`,
      { signal: timeoutSignal }
    );
    const data = await resp.json().catch(() => ({}));
    if (!data.ok || !data.result?.file_path) return res.status(404).send("No photo");

    const filePath = String(data.result.file_path).replace(/\\/g, "/");
    if (filePath.includes("..")) return res.status(400).send("Invalid file path");

    const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;
    const imgResp = await fetch(url, { signal: timeoutSignal });
    if (!imgResp.ok) return res.status(404).send("No photo");

    const contentLength = Number(imgResp.headers.get("content-length"));
    if (contentLength && contentLength > 5 * 1024 * 1024) {
      return res.status(413).send("Photo exceeds 5MB size limit");
    }

    const contentType = imgResp.headers.get("content-type") || "image/jpeg";
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(contentType.toLowerCase())) {
      return res.status(415).send("Unsupported upstream image format");
    }

    const arrayBuffer = await imgResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(413).send("Photo exceeds 5MB size limit");
    }

    photoCache.set(m.photo, { buffer, contentType, expires: Date.now() + PHOTO_CACHE_TTL });
    prunePhotoCache();

    res.setHeader("Content-Type", contentType);
    return res.send(buffer);
  } catch (err) {
    return res.status(err?.name === "TimeoutError" ? 504 : 502).send("Photo unavailable");
  }
});

/* Member Photo Upload */
router.post("/members/:id/photo", requirePermission("canManageMembers"), express.json({ limit: "10mb" }), async (req, res) => {
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
router.get("/members", requirePermission("canManageMembers"), async (req, res) => {
  const { status, includeArchived, search } = req.query;
  const filter = {};

  if (includeArchived !== "true") {
    filter.isDeleted = { $ne: true };
  }
  if (typeof status === "string" && status.trim() && status !== "all") {
    filter.status = status.trim();
  }
  if (typeof search === "string" && search.trim()) {
    const s = escapeRegex(search.trim());
    filter.$or = [
      { name: new RegExp(s, "i") },
      { familyName: new RegExp(s, "i") },
      { phone: new RegExp(s, "i") },
      { role: new RegExp(s, "i") }
    ];
  }

  const members = await Member.find(filter).sort({ name: 1 }).lean();
  const normalized = members.map((m) => {
    const isAct = m.status ? m.status === "active" : m.isActive !== false;
    return {
      ...m,
      isActive: isAct,
      status: m.status || (isAct ? "active" : "inactive")
    };
  });
  res.json(normalized);
});

router.post("/members/check-duplicate", requirePermission("canManageMembers"), async (req, res) => {
  const duplicates = await checkDuplicates(req.body);
  res.json({ duplicates });
});

const sanitizeMemberPayload = (body = {}) => {
  const data = { ...body };
  delete data._id;
  delete data.__v;
  delete data.createdAt;
  delete data.updatedAt;

  if (typeof data.name !== "string" || !data.name.trim()) {
    data.name = "";
  } else {
    data.name = data.name.trim();
  }

  if (typeof data.dob === "string" && data.dob.length >= 5) {
    data.birthday = data.dob.substring(5);
  } else if (!data.dob) {
    data.dob = "";
    if (typeof data.birthday !== "string" || data.birthday.length < 4) {
      data.birthday = "";
    }
  }

  if (data.isMarried) {
    if (typeof data.weddingDate === "string" && data.weddingDate.length >= 5) {
      data.wedding = data.weddingDate.substring(5);
    } else if (!data.weddingDate) {
      data.weddingDate = "";
      if (typeof data.wedding !== "string" || data.wedding.length < 4) {
        data.wedding = "";
      }
    }
    if (!["male", "female"].includes(data.spouseGender)) {
      data.spouseGender = data.gender === "male" ? "female" : "male";
    }
  } else {
    data.isMarried = false;
    data.spouseName = "";
    data.spouseGender = null;
    data.spouseId = null;
    data.weddingDate = "";
    data.wedding = "";
  }

  if (!data.spouseId || data.spouseId === "" || !mongoose.Types.ObjectId.isValid(data.spouseId)) {
    data.spouseId = null;
  }
  if (!data.parentId || data.parentId === "" || !mongoose.Types.ObjectId.isValid(data.parentId)) {
    data.parentId = null;
  }

  return data;
};

router.post("/members", requirePermission("canManageMembers"), async (req, res) => {
  try {
    const cleanData = sanitizeMemberPayload(req.body);
    if (!cleanData.name || typeof cleanData.name !== "string") {
      return res.status(400).json({ error: "Full Name is required." });
    }

    const cleanMemberName = cleanData.name.trim();
    const existing = await Member.findOne({ name: cleanMemberName }).lean();
    if (existing) {
      return res.status(400).json({
        error: `A member named "${cleanMemberName}" already exists in church records.`
      });
    }

    const m = await Member.create(cleanData);
    res.json(m);
  } catch (err) {
    console.error("💥 [Member POST Error]:", err);
    if (err.code === 11000) {
      return res.status(400).json({ error: "A member with this name already exists in records." });
    }
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors || {}).map((e) => e.message).join(", ");
      return res.status(400).json({ error: messages || err.message || "Validation failed creating member profile." });
    }
    res.status(400).json({ error: err.message || "Failed to create member." });
  }
});

router.put("/members/:id", requirePermission("canManageMembers"), async (req, res) => {
  try {
    const m = await Member.findById(req.params.id);
    if (!m) return res.status(404).json({ error: "Member not found" });

    const cleanData = sanitizeMemberPayload(req.body);

    if (cleanData.status && cleanData.status !== m.status) {
      if (!validateStatusTransition(m.status, cleanData.status)) {
        return res.status(400).json({
          error: `Invalid status transition from '${m.status}' to '${cleanData.status}'`
        });
      }
    }

    if (typeof cleanData.name === "string" && cleanData.name.trim() && cleanData.name.trim() !== m.name) {
      const nameToCheck = cleanData.name.trim();
      const existing = await Member.findOne({
        name: nameToCheck,
        _id: { $ne: m._id }
      }).lean();
      if (existing) {
        return res.status(400).json({
          error: `A member named "${nameToCheck}" already exists in church records.`
        });
      }
    }

    Object.assign(m, cleanData);
    await m.save();
    res.json(m);
  } catch (err) {
    console.error("💥 [Member PUT Error]:", err);
    if (err.code === 11000) {
      return res.status(400).json({ error: "A member with this name already exists in records." });
    }
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors || {}).map((e) => e.message).join(", ");
      return res.status(400).json({ error: messages || err.message || "Validation failed saving member profile." });
    }
    res.status(400).json({ error: err.message || "Failed to update member." });
  }
});

router.post("/members/:id/archive", requirePermission("canDeleteMembers"), async (req, res) => {
  const m = await archiveMember(req.params.id);
  res.json({ success: true, member: m });
});

router.post("/members/:id/restore", requirePermission("canDeleteMembers"), async (req, res) => {
  const m = await restoreMember(req.params.id);
  res.json({ success: true, member: m });
});

router.post("/members/merge", requirePermission("canDeleteMembers"), async (req, res) => {
  const { targetId, sourceId } = req.body || {};
  const cleanTargetId = typeof targetId === "string" ? targetId.trim() : String(targetId || "");
  const cleanSourceId = typeof sourceId === "string" ? sourceId.trim() : String(sourceId || "");
  if (!cleanTargetId || !cleanSourceId || !mongoose.Types.ObjectId.isValid(cleanTargetId) || !mongoose.Types.ObjectId.isValid(cleanSourceId)) {
    return res.status(400).json({ error: "Valid targetId and sourceId are required" });
  }
  const result = await mergeMembers(cleanTargetId, cleanSourceId, req.user?.id ? `tg:${req.user.id}` : "admin");
  res.json({ success: true, ...result });
});

/* Export Roster to CSV */
router.get("/export", requirePermission("canExportData"), async (req, res) => {
  const members = await Member.find({ isDeleted: { $ne: true } }).sort({ name: 1 });
  const filePath = await exportMembersToCSV(members, "all");
  res.download(filePath, "church_database.csv", () => {
    fs.unlink(filePath, () => {});
  });
});

/* Church Directory HTML */
router.get("/directory", requirePermission("canExportData"), async (req, res) => {
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
router.post("/members/import", requirePermission("canManageMembers"), async (req, res) => {
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

    if (!item.name || typeof item.name !== "string" || !item.name.trim()) {
      skipped++;
      continue;
    }
    const cleanName = item.name.trim();
    payload.name = cleanName;

    await Member.findOneAndUpdate(
      { name: cleanName },
      { $set: payload },
      { upsert: true, new: true, runValidators: true }
    );
    created++;
  }

  res.json({ success: true, count: created, skipped });
});

/* Bulk Member Actions */
router.post("/members/bulk", requirePermission("canManageMembers"), async (req, res) => {
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
    const allowedFields = ["status", "role", "ministry", "address", "familyName", "isMarried", "isChild", "isPastor", "customData"];
    const sanitizedSet = {};
    for (const key of allowedFields) {
      if (payload[key] !== undefined) {
        sanitizedSet[key] = payload[key];
      }
    }
    if (Object.keys(sanitizedSet).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }
    await Member.updateMany({ _id: { $in: ids } }, { $set: sanitizedSet }, { runValidators: true });
  } else {
    return res.status(400).json({ error: "Unknown action" });
  }
  res.json({ success: true });
});


export default router;
