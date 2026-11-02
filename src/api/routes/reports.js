import { requirePermission } from "../middleware.js";
import { getChurchStatistics, getDataQualityReport } from "../../services/reportService.js";
import { createRouter } from "../router.js";

const router = createRouter();

/* ========================================================= */
/* MODULE D: ADVANCED CHURCH STATISTICS & DATA QUALITY       */
/* ========================================================= */
router.get("/reports/stats", requirePermission("canViewAnalytics"), async (req, res) => {
  const stats = await getChurchStatistics();
  res.json(stats);
});

router.get("/reports/data-quality", requirePermission("canViewAnalytics"), async (req, res) => {
  const report = await getDataQualityReport();
  res.json(report);
});


export default router;
