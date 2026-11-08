import { requirePermission } from "../middleware.js";
import { getErrorLogs, resolveErrorLog, deleteErrorLog, clearErrorLogs } from "../../services/errorLogService.js";
import { createRouter } from "../router.js";
import { adminApiLimiter } from "../limiters.js";

const router = createRouter();
router.use(adminApiLimiter);

/* ========================================================================= */
/* --- SYSTEM ERROR LOGS & AUDIT TRAIL ------------------------------------- */
/* ========================================================================= */
router.get("/errors", requirePermission("canViewAnalytics"), async (req, res) => {
  try {
    const { source, resolved, search, page, limit } = req.query;
    const result = await getErrorLogs({
      source: typeof source === "string" ? source.trim() : undefined,
      resolved: typeof resolved === "string" ? resolved.trim() : undefined,
      search: typeof search === "string" ? search.trim() : undefined,
      page,
      limit
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/errors/:id/resolve", requirePermission("canEditSettings"), async (req, res) => {
  try {
    const user = req.user?.username || req.user?.first_name || "Admin";
    const updated = await resolveErrorLog(req.params.id, user);
    if (!updated) return res.status(404).json({ error: "Error log not found" });
    res.json({ success: true, log: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/errors/:id", requirePermission("canEditSettings"), async (req, res) => {
  try {
    const deleted = await deleteErrorLog(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Error log not found" });
    res.json({ success: true, message: "Error log entry deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/errors/clear", requirePermission("canEditSettings"), async (req, res) => {
  try {
    const { onlyResolved = true } = req.body;
    const count = await clearErrorLogs(onlyResolved);
    res.json({ success: true, deletedCount: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
