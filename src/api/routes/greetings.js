import mongoose from "mongoose";
import Member from "../../models/Member.js";
import { requirePermission } from "../middleware.js";
import { triggerNow } from "../../scheduler/dailyJob.js";
import { getUpcomingEvents, generateTemplateMessage } from "../../services/eventService.js";
import { getCanonicalVerse, formatGreetingCard } from "../../services/aiService.js";
import { prepareTodayGreetings, regenerateGreeting, markGreetingAsShared, skipGreeting, updateGreetingText } from "../../services/greetingService.js";
import { createRouter } from "../router.js";

const router = createRouter();

/* Upcoming Celebrations */
router.get("/upcoming", requirePermission("canSendGreetings"), async (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    const data = await getUpcomingEvents(days);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* Greetings Review API for Dashboard */
router.get("/greetings/today", requirePermission("canSendGreetings"), async (req, res) => {
  try {
    const logs = await prepareTodayGreetings();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/greetings/:id/regenerate", requirePermission("canSendGreetings"), async (req, res) => {
  try {
    const log = await regenerateGreeting(req.params.id, req.body);
    res.json({ success: true, greeting: log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/greetings/:id/shared", requirePermission("canSendGreetings"), async (req, res) => {
  try {
    const log = await markGreetingAsShared(req.params.id);
    res.json({ success: true, greeting: log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/greetings/:id/skip", requirePermission("canSendGreetings"), async (req, res) => {
  try {
    const log = await skipGreeting(req.params.id);
    res.json({ success: true, greeting: log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/greetings/:id/text", requirePermission("canSendGreetings"), async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Text required" });
    const log = await updateGreetingText(req.params.id, text);
    res.json({ success: true, greeting: log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post("/actions/trigger-today", requirePermission("canSendGreetings"), async (req, res) => {
  try {
    const count = await triggerNow();
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* Live Wish Preview & Regenerate */
router.post("/actions/preview-wish", requirePermission("canSendGreetings"), async (req, res) => {
  try {
    const { memberId, type = "birthday" } = req.body || {};
    const cleanMemberId = typeof memberId === "string" ? memberId.trim() : String(memberId || "");
    if (!cleanMemberId || !mongoose.Types.ObjectId.isValid(cleanMemberId)) {
      return res.status(400).json({ error: "Valid memberId is required" });
    }

    const member = await Member.findById(cleanMemberId);
    if (!member) return res.status(404).json({ error: "Member not found" });

    const cleanType = typeof type === "string" ? type.trim() : "birthday";
    const verseObj = await getCanonicalVerse(cleanType, member);
    const templateMsg = await generateTemplateMessage(member, cleanType);

    const preview = formatGreetingCard({
      eventType: cleanType,
      member,
      verseText: verseObj.text,
      verseRef: verseObj.reference,
      templateText: templateMsg
    });

    res.json({
      success: true,
      preview,
      photo: member.photo || null,
      verse: verseObj
    });
  } catch (err) {
    console.error("❌ preview-wish error:", err);
    res.status(500).json({ error: err.message });
  }
});


export default router;
