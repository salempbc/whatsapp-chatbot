import crypto from "crypto";
import AuthorizedUser from "../models/AuthorizedUser.js";

/* In-memory synchronous cache for O(1) performance in guard checks */
const authorizedUsersCache = new Map();

/**
 * Initializes or refreshes the in-memory cache of authorized users.
 */
export const loadAuthorizedUsersCache = async () => {
  try {
    const activeUsers = await AuthorizedUser.find({ status: "active" }).lean();
    authorizedUsersCache.clear();
    for (const u of activeUsers) {
      if (u.telegramId) {
        authorizedUsersCache.set(String(u.telegramId).trim(), {
          telegramId: String(u.telegramId).trim(),
          name: u.name,
          username: u.username || "",
          role: u.role || "admin",
          status: "active"
        });
      }
    }
    return authorizedUsersCache.size;
  } catch (err) {
    // If database is not yet connected or during unit tests with mock DB, fail gracefully
    console.warn("⚠️ [USER_SERVICE] Could not preload authorized users cache:", err.message);
    return 0;
  }
};

/**
 * Synchronous check whether a Telegram ID is an active authorized user.
 */
export const isAuthorizedUser = (id) => {
  if (!id && id !== 0) return false;
  const key = String(id).trim();
  const cached = authorizedUsersCache.get(key);
  return Boolean(cached && cached.status === "active");
};

/**
 * Synchronous getter for a user's role.
 */
export const getCachedUserRole = (id) => {
  if (!id && id !== 0) return null;
  const key = String(id).trim();
  const superAdminId = process.env.ADMIN_ID ? String(process.env.ADMIN_ID).trim() : null;
  if (superAdminId && key === superAdminId) return "superadmin";
  const cached = authorizedUsersCache.get(key);
  return cached ? cached.role : null;
};

/**
 * Manually update the in-memory cache (useful for testing and instant sync).
 */
export const setAuthorizedUserCache = (telegramId, userData) => {
  if (!telegramId) return;
  const key = String(telegramId).trim();
  if (userData && userData.status === "active") {
    authorizedUsersCache.set(key, {
      telegramId: key,
      name: userData.name || "Leader",
      username: userData.username || "",
      role: userData.role || "admin",
      status: "active"
    });
  } else {
    authorizedUsersCache.delete(key);
  }
};

/**
 * Clear the cache (for testing)
 */
export const clearAuthorizedUserCache = () => {
  authorizedUsersCache.clear();
};

/**
 * Retrieve all users (active, pending, and superadmin details).
 */
export const getAllUsers = async () => {
  const users = await AuthorizedUser.find({}).sort({ createdAt: -1 }).lean().catch(() => []);
  return users;
};

/**
 * Record an access request from an unauthorized user.
 */
export const requestAccess = async ({ telegramId, name, username }) => {
  const tid = String(telegramId).trim();
  const existing = await AuthorizedUser.findOne({ telegramId: tid });
  if (existing) {
    if (existing.status === "active") return { status: "already_active", user: existing };
    existing.name = name || existing.name;
    existing.username = username || existing.username;
    existing.status = "pending";
    existing.updatedAt = new Date();
    await existing.save();
    return { status: "pending", user: existing };
  }

  const newUser = await AuthorizedUser.create({
    telegramId: tid,
    name: name || "Church Leader",
    username: username || "",
    role: "admin",
    status: "pending",
    addedBy: "Self-Requested"
  });

  return { status: "pending", user: newUser };
};

/**
 * Approve a pending user or add a new leader.
 */
export const approveUser = async ({ telegramId, role = "admin", approvedBy = "Super Admin", name, username }) => {
  const tid = String(telegramId).trim();
  const user = await AuthorizedUser.findOneAndUpdate(
    { telegramId: tid },
    {
      $set: {
        role: role === "staff" ? "staff" : "admin",
        status: "active",
        addedBy,
        ...(name ? { name } : {}),
        ...(username ? { username } : {}),
        updatedAt: new Date()
      }
    },
    { upsert: true, new: true }
  );

  setAuthorizedUserCache(tid, user);
  return user;
};

/**
 * Reject a pending access request.
 */
export const rejectUser = async (telegramId) => {
  const tid = String(telegramId).trim();
  const user = await AuthorizedUser.findOneAndUpdate(
    { telegramId: tid },
    { $set: { status: "revoked", updatedAt: new Date() } },
    { new: true }
  );
  setAuthorizedUserCache(tid, null);
  return user;
};

/**
 * Revoke an existing user's access.
 */
export const revokeUser = async (telegramId) => {
  const tid = String(telegramId).trim();
  const user = await AuthorizedUser.findOneAndUpdate(
    { telegramId: tid },
    { $set: { status: "revoked", updatedAt: new Date() } },
    { new: true }
  );
  setAuthorizedUserCache(tid, null);
  return user;
};

/**
 * Generate a shareable, one-click invite token.
 */
export const createInviteToken = async ({ role = "admin", createdBy = "Admin", hoursValid = 48, botUsername = "" }) => {
  const token = crypto.randomBytes(12).toString("hex");
  const expires = new Date(Date.now() + hoursValid * 60 * 60 * 1000);
  const placeholderTid = `pending_invite_${token}`;

  await AuthorizedUser.create({
    telegramId: placeholderTid,
    name: `Invited ${role === "staff" ? "Staff" : "Co-Admin"}`,
    role,
    status: "pending",
    inviteToken: token,
    inviteExpires: expires,
    addedBy: createdBy
  });

  const username = botUsername || process.env.BOT_USERNAME || "SalemPBC_Bot";
  const inviteUrl = `https://t.me/${username}?start=invite_${token}`;

  return { token, inviteUrl, expiresAt: expires, role };
};

/**
 * Redeem an invite token when a user starts the bot with /start invite_<token>.
 */
export const redeemInviteToken = async ({ token, telegramId, name, username }) => {
  if (!token) throw new Error("Invite token missing");
  const tid = String(telegramId).trim();

  // Find unused, unexpired invite
  const inviteRecord = await AuthorizedUser.findOne({
    inviteToken: token,
    inviteExpires: { $gt: new Date() },
    status: "pending"
  });

  if (!inviteRecord) {
    throw new Error("Invalid, expired, or already used invite link");
  }

  // Check if this telegramId is already registered
  const existingUser = await AuthorizedUser.findOne({ telegramId: tid });
  if (existingUser) {
    existingUser.role = inviteRecord.role;
    existingUser.status = "active";
    existingUser.name = name || existingUser.name;
    existingUser.username = username || existingUser.username;
    existingUser.updatedAt = new Date();
    await existingUser.save();
    // Delete placeholder record
    await AuthorizedUser.deleteOne({ _id: inviteRecord._id });
    setAuthorizedUserCache(tid, existingUser);
    return existingUser;
  }

  // Update placeholder with actual user information
  inviteRecord.telegramId = tid;
  inviteRecord.name = name || "Church Leader";
  inviteRecord.username = username || "";
  inviteRecord.status = "active";
  inviteRecord.inviteToken = null; // Mark as used
  inviteRecord.updatedAt = new Date();
  await inviteRecord.save();

  setAuthorizedUserCache(tid, inviteRecord);
  return inviteRecord;
};
