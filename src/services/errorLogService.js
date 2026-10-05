import ErrorLog from "../models/ErrorLog.js";

/**
 * Redact sensitive fields (passwords, tokens, secrets) from error context before persisting
 */
export const sanitizeContext = (obj, depth = 0) => {
  if (!obj || typeof obj !== "object" || depth > 5) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeContext(item, depth + 1));
  }

  const SENSITIVE_KEYS = [
    "password",
    "pass",
    "token",
    "bot_token",
    "secret",
    "admin_secret",
    "authorization",
    "auth",
    "cookie",
    "session",
    "credential"
  ];

  const sanitized = {};
  for (const [k, v] of Object.entries(obj)) {
    const lowerKey = k.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((s) => lowerKey.includes(s));
    if (isSensitive) {
      sanitized[k] = "[REDACTED]";
    } else if (v && typeof v === "object") {
      sanitized[k] = sanitizeContext(v, depth + 1);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
};

/**
 * Capture and persist an error log in MongoDB
 */
export const captureError = async ({
  error,
  source = "system",
  endpoint = "",
  method = "",
  statusCode = 500,
  userId = "system",
  userName = "",
  context = {}
} = {}) => {
  try {
    const message = error?.message || (typeof error === "string" ? error : "Unknown error");
    const stack = error?.stack || "";
    const cleanContext = sanitizeContext(context);

    // Guard against spamming identical errors if needed, but always insert to preserve timeline
    const logEntry = await ErrorLog.create({
      message: String(message).slice(0, 1000),
      stack: String(stack).slice(0, 8000),
      source,
      endpoint: String(endpoint).slice(0, 255),
      method: String(method).slice(0, 10),
      statusCode: Number(statusCode) || 500,
      userId: String(userId || "system"),
      userName: String(userName || ""),
      context: cleanContext,
      resolved: false
    });

    return logEntry;
  } catch (err) {
    // Failsafe: never crash the server when logging fails
    console.error("⚠️ [ErrorLogService] Failed to record error log:", err?.message || err);
    return null;
  }
};

/**
 * Fetch error logs with filtering and pagination
 */
export const getErrorLogs = async ({
  source = "",
  resolved = "",
  search = "",
  page = 1,
  limit = 50
} = {}) => {
  const query = {};

  if (source && source !== "all") {
    query.source = source;
  }

  if (resolved === "true" || resolved === true) {
    query.resolved = true;
  } else if (resolved === "false" || resolved === false) {
    query.resolved = false;
  }

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { message: { $regex: escaped, $options: "i" } },
      { endpoint: { $regex: escaped, $options: "i" } },
      { userId: { $regex: escaped, $options: "i" } }
    ];
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (p - 1) * l;

  const [logs, total, unresolvedCount] = await Promise.all([
    ErrorLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(l).lean(),
    ErrorLog.countDocuments(query),
    ErrorLog.countDocuments({ resolved: false })
  ]);

  return {
    logs,
    total,
    unresolvedCount,
    page: p,
    limit: l,
    pages: Math.ceil(total / l)
  };
};

/**
 * Mark an error as resolved
 */
export const resolveErrorLog = async (id, resolvedBy = "Admin") => {
  return await ErrorLog.findByIdAndUpdate(
    id,
    {
      resolved: true,
      resolvedBy,
      resolvedAt: new Date()
    },
    { new: true }
  );
};

/**
 * Delete a specific error log
 */
export const deleteErrorLog = async (id) => {
  return await ErrorLog.findByIdAndDelete(id);
};

/**
 * Clear all resolved errors or all errors
 */
export const clearErrorLogs = async (onlyResolved = true) => {
  const filter = onlyResolved ? { resolved: true } : {};
  const res = await ErrorLog.deleteMany(filter);
  return res.deletedCount;
};
