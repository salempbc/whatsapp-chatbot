import ChurchEvent from "../../models/ChurchEvent.js";
import { requirePermission } from "../middleware.js";
import { createChurchEvent, updateChurchEvent, cancelChurchEvent, exportEventsToICS } from "../../services/churchCalendarService.js";
import { createRouter } from "../router.js";
import { adminApiLimiter } from "../limiters.js";

const router = createRouter();
router.use(adminApiLimiter);

/* ========================================================= */
/* MODULE B: UNIFIED CHURCH CALENDAR & EVENTS                */
/* ========================================================= */
router.get("/events", requirePermission("canManageEvents"), async (req, res) => {
  const { startDate, endDate, category } = req.query;
  const filter = { status: { $ne: "cancelled" } };
  if (typeof startDate === "string" && typeof endDate === "string" && startDate.trim() && endDate.trim()) {
    filter.startDate = { $gte: startDate.trim(), $lte: endDate.trim() };
  }
  if (typeof category === "string" && category.trim() && category !== "all") {
    filter.category = category.trim();
  }
  const events = await ChurchEvent.find(filter).sort({ startDate: 1, startTime: 1 }).lean();
  res.json(events);
});

router.post("/events", requirePermission("canManageEvents"), async (req, res) => {
  const event = await createChurchEvent(req.body);
  res.json(event);
});

router.put("/events/:id", requirePermission("canManageEvents"), async (req, res) => {
  const event = await updateChurchEvent(req.params.id, req.body);
  res.json(event);
});

router.delete("/events/:id", requirePermission("canManageEvents"), async (req, res) => {
  const event = await cancelChurchEvent(req.params.id);
  res.json({ success: true, event });
});

router.get("/events/export/ics", requirePermission("canManageEvents"), async (req, res) => {
  const events = await ChurchEvent.find({ status: { $ne: "cancelled" } }).sort({ startDate: 1 });
  const ics = exportEventsToICS(events);
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="spbc_church_calendar.ics"');
  res.send(ics);
});


export default router;
