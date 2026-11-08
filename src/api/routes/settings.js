import { requirePermission } from "../middleware.js";
import { getSetting, setSetting } from "../../models/Settings.js";
import { restartScheduler } from "../../scheduler/dailyJob.js";
import { verifyBackupIntegrity } from "../../services/backupService.js";
import { sendAdminMessage } from "../../bot/index.js";
import { createRouter } from "../router.js";
import { adminApiLimiter } from "../limiters.js";

const router = createRouter();
router.use(adminApiLimiter);

/* Settings */
router.get("/settings", requirePermission("canEditSettings"), async (req, res) => {
  const sendTime = await getSetting("sendTime", "06:00");
  const reminderTime = await getSetting("reminderTime", "20:00");
  const customFields = await getSetting("customFields", []);
  const enableBirthdays = await getSetting("enableBirthdays", true);
  const enableWeddings = await getSetting("enableWeddings", true);
  const geminiApiKey = await getSetting("geminiApiKey", "");
  res.json({
    sendTime,
    reminderTime,
    customFields,
    enableBirthdays,
    enableWeddings,
    geminiApiKey: geminiApiKey ? "configured" : ""
  });
});

const isHHMM = (v) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

router.post("/settings", requirePermission("canEditSettings"), async (req, res) => {
  const { sendTime, reminderTime, customFields, enableBirthdays, enableWeddings, geminiApiKey } = req.body;

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
  if (enableBirthdays !== undefined) await setSetting("enableBirthdays", Boolean(enableBirthdays));
  if (enableWeddings !== undefined) await setSetting("enableWeddings", Boolean(enableWeddings));
  if (geminiApiKey !== undefined && typeof geminiApiKey === "string" && geminiApiKey !== "configured") {
    await setSetting("geminiApiKey", geminiApiKey.trim());
  }

  await restartScheduler();
  res.json({ success: true });
});

/* Disaster Recovery & Automated Backup Health */
router.get("/backup/health", requirePermission("canEditSettings"), async (req, res) => {
  try {
    const health = await verifyBackupIntegrity();
    res.json({ success: true, health });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/backup/verify", requirePermission("canEditSettings"), async (req, res) => {
  try {
    const health = await verifyBackupIntegrity();
    res.json({ success: true, health, message: "Backup archive integrity verified healthy." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* Test Gemini API Key connectivity directly */
router.post("/actions/test-gemini", requirePermission("canEditSettings"), async (req, res) => {
  try {
    const { apiKey } = req.body || {};
    let keyToTest = apiKey;
    if (!keyToTest || keyToTest === "configured") {
      keyToTest = await getSetting("geminiApiKey", process.env.GEMINI_API_KEY || "");
    }
    if (!keyToTest) {
      return res.status(400).json({ success: false, error: "No Gemini API key provided or saved." });
    }

    const cleanKey = keyToTest.trim();

    // 1. First, query Google's ModelService to see which models this key has access to
    let availableModels = [];
    try {
      const listResp = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
        headers: { "x-goog-api-key": cleanKey }
      });
      if (listResp.ok) {
        const listData = await listResp.json();
        if (Array.isArray(listData.models)) {
          availableModels = listData.models
            .filter((m) => {
              const name = (m.name || "").toLowerCase();
              return m.supportedGenerationMethods?.includes("generateContent")
                && !name.includes("tts")
                && !name.includes("embedding")
                && !name.includes("image")
                && !name.includes("gemma");
            })
            .map((m) => m.name.replace(/^models\//, ""));
        }
      }
    } catch (_) {}

    // 2. Candidate priority list merged with discovered models
    const candidates = [
      "gemini-flash-lite-latest",
      "gemini-3.8-flash",
      "gemini-flash-latest",
      "gemini-2.5-flash-lite",
      ...availableModels
    ];
    const uniqueCandidates = [...new Set(candidates)];

    let lastErr = null;
    for (const model of uniqueCandidates) {
      try {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": cleanKey
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "Respond only with: Connected" }] }],
              generationConfig: { maxOutputTokens: 10 }
            })
          }
        );

        if (resp.ok) {
          const data = await resp.json();
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Connected";
          return res.json({ success: true, message: `Connected to Google Gemini (${model})! Reply: ${reply}` });
        } else {
          const errData = await resp.json().catch(() => ({}));
          lastErr = errData.error?.message || `HTTP ${resp.status} ${resp.statusText}`;
        }
      } catch (callErr) {
        lastErr = callErr.message;
      }
    }

    res.status(400).json({ success: false, error: lastErr || "Failed to connect to Google Gemini API." });
  } catch (err) {
    console.error("Gemini test connection failed:", err.message);
    res.status(400).json({ success: false, error: err.message || "Failed to connect to Gemini." });
  }
});


/* Actions */
router.post("/actions/ping", requirePermission("canEditSettings"), async (req, res) => {
  try {
    await sendAdminMessage("🔔 <b>CMS Ping Test</b>\n<i>If you see this, the Web App is successfully connected to the Admin Telegram channel.</i>");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
