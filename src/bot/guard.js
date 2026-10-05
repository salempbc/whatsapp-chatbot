export const isAdmin = (id) => {
  const adminId = process.env.ADMIN_ID;
  if (!adminId || typeof adminId !== "string" || !adminId.trim()) {
    console.warn("⚠️ [SECURITY] ADMIN_ID is unset, missing or malformed. Rejecting access (fail-closed).");
    return false;
  }
  if (!id && id !== 0) return false;
  return String(id).trim() === adminId.trim();
};

export const adminOnly = (fn) => (msg, ...rest) => {
  const userId = msg?.from?.id;
  if (!isAdmin(userId)) {
    console.warn(`⚠️ [SECURITY] Denied unauthorized interaction from user ID: ${userId || "unknown"}`);
    return;
  }
  return fn(msg, ...rest);
};
