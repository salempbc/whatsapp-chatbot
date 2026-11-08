import mongoose from "mongoose";
import Template from "../../models/Template.js";
import { requirePermission } from "../middleware.js";
import { createRouter } from "../router.js";
import { adminApiLimiter } from "../limiters.js";

const router = createRouter();
router.use(adminApiLimiter);

/* Templates */
router.get("/templates", requirePermission("canManageTemplates"), async (req, res) => {
  const templates = await Template.find().sort({ type: 1, category: 1 }).lean();
  res.json(templates);
});

router.post("/templates", requirePermission("canManageTemplates"), async (req, res) => {
  const t = await Template.create(req.body);
  res.json(t);
});

router.put("/templates/:id", requirePermission("canManageTemplates"), async (req, res) => {
  const cleanId = typeof req.params.id === "string" ? req.params.id.trim() : String(req.params.id || "");
  if (!mongoose.Types.ObjectId.isValid(cleanId)) {
    return res.status(400).json({ error: "Invalid template ID" });
  }
  const { title, text, type } = req.body || {};
  const updateFields = {};
  if (typeof title === "string") updateFields.title = title;
  if (typeof text === "string") updateFields.text = text;
  if (typeof type === "string") updateFields.type = type;

  const t = await Template.findByIdAndUpdate(cleanId, { $set: updateFields }, {
    new: true,
    runValidators: true
  });
  if (!t) return res.status(404).json({ error: "Template not found" });
  res.json(t);
});

router.delete("/templates/:id", requirePermission("canManageTemplates"), async (req, res) => {
  const cleanId = typeof req.params.id === "string" ? req.params.id.trim() : String(req.params.id || "");
  if (!mongoose.Types.ObjectId.isValid(cleanId)) {
    return res.status(400).json({ error: "Invalid template ID" });
  }
  const t = await Template.findByIdAndDelete(cleanId);
  if (!t) return res.status(404).json({ error: "Template not found" });
  res.json({ success: true });
});


export default router;
