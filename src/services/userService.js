import crypto from "crypto";
import AuthorizedUser from "../models/AuthorizedUser.js";

/* In-memory synchronous cache for O(1) performance in guard checks */
const authorizedUsersCache = new Map();

/**
 * Returns default granular permissions based on church role.
 */
export const getDefaultPermissions = (role = "admin") => {
  switch (role) {
    case "superadmin":
    case "admin":
      return {
        canManageMembers: true,
        canDeleteMembers: true,
        canSendGreetings: true,
        canManageTemplates: true,
        canManageEvents: true,
        canManageTasks: true,
        canExportData: true,
        canManageUsers: true
      };
    case "pastor":
      return {
        canManageMembers: true,
        canDeleteMembers: true,
        canSendGreetings: true,
        canManageTemplates: true,
        canManageEvents: true,
        canManageTasks: true,
        canExportData: true,
        canManageUsers: false
      };
    case "staff":
      return {
        canManageMembers: true,
        canDeleteMembers: false,
        canSendGreetings: true,
        canManageTemplates: true,
        canManageEvents: true,
        canManageTasks: true,
        canExportData: false,
        canManageUsers: false
      };
    case "volunteer":
      return {
        canManageMembers: false,
        canDeleteMembers: false,
        canSendGreetings: true,
        canManageTemplates: false,
        canManageEvents: false,
        canManageTasks: false,
        canExportData: false,
        canManageUsers: false
      };
    default:
      return {
        canManageMembers: true,
        canDeleteMembers: false,
        canSendGreetings: true,
        canManageTemplates: false,
        canManageEvents: true,
        canManageTasks: true,
        canExportData: false,
        canManageUsers: false
      };
  }
};

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
          status: "active",
          permissions: {
            ...getDefaultPermissions(u.role || "admin"),
            ...(u.permissions || {})
          },
          notes: u.notes || ""
        });
      }
    }
    return authorizedUsersCache.size;
  } catch (err) {
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
 * Synchronous getter for user's granular permissions.
 */
export const getCachedUserPermissions = (id) => {
  if (!id && id !== 0) return null;
  const key = String(id).trim();
  const superAdminId = process.env.ADMIN_ID ? String(process.env.ADMIN_ID).trim() : null;
  if (superAdminId && key === superAdminId) {
    return getDefaultPermissions("superadmin");
  }
  const cached = authorizedUsersCache.get(key);
  if (!cached || cached.status !== "active") return null;
  return cached.permissions || getDefaultPermissions(cached.role);
};

/**
 * Synchronously checks if a user has a specific permission.
 */
export const hasUserPermission = (id, permissionKey) => {
  if (!id && id !== 0) return false;
  const key = String(id).trim();
  const superAdminId = process.env.ADMIN_ID ? String(process.env.ADMIN_ID).trim() : null;
  if (superAdminId && key === superAdminId) return true;

  const cached = authorizedUsersCache.get(key);
  if (!cached || cached.status !== "active") return false;

  // Superadmin role in cache also grants all permissions
  if (cached.role === "superadmin") return true;

  const perms = cached.permissions || getDefaultPermissions(cached.role);
  return Boolean(perms[permissionKey]);
};

/**
 * Manually update the in-memory cache (useful for testing and instant sync).
 */
export const setAuthorizedUserCache = (telegramId, userData) => {
  if (!telegramId) return;
  const key = String(telegramId).trim();
  if (userData && userData.status === "active") {
    const role = userData.role || "admin";
    authorizedUsersCache.set(key, {
      telegramId: key,
      name: userData.name || "Leader",
      username: userData.username || "",
      role,
      status: "active",
      permissions: {
        ...getDefaultPermissions(role),
        ...(userData.permissions || {})
      },
      notes: userData.notes || ""
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
 * Retrieve all users (active, pending, suspended, and placeholder invites).
 */
export const getAllUsers = async () => {
  const users = await AuthorizedUser.find({}).sort({ createdAt: -1 }).lean().catch(() => []);
  return users;
};

/**
 * Retrieve a specific user by Telegram ID.
 */
export const getUserByTelegramId = async (telegramId) => {
  if (!telegramId) return null;
  const tid = String(telegramId).trim();
  return await AuthorizedUser.findOne({ telegramId: tid }).lean().catch(() => null);
};

/**
 * CRUD CREATE: Directly create a new authorized leader / staff member.
 */
export const createUser = async ({
  telegramId,
  name,
  username = "",
  role = "admin",
  status = "active",
  permissions = null,
  addedBy = "Super Admin",
  notes = ""
}) => {
  if (!telegramId) throw new Error("Telegram ID is required");
  if (!name || !name.trim()) throw new Error("Name is required");

  const tid = String(telegramId).trim();
  const resolvedRole = ["superadmin", "admin", "pastor", "staff", "volunteer"].includes(role) ? role : "admin";
  const resolvedStatus = ["active", "pending", "suspended", "revoked"].includes(status) ? status : "active";
  const resolvedPermissions = {
    ...getDefaultPermissions(resolvedRole),
    ...(permissions || {})
  };

  const existing = await AuthorizedUser.findOne({ telegramId: tid });
  if (existing) {
    existing.name = name.trim();
    existing.username = (username || "").replace(/^@/, "").trim();
    existing.role = resolvedRole;
    existing.status = resolvedStatus;
    existing.permissions = resolvedPermissions;
    existing.addedBy = addedBy;
    existing.notes = notes || existing.notes;
    existing.updatedAt = new Date();
    await existing.save();

    setAuthorizedUserCache(tid, existing);
    return existing;
  }

  const newUser = await AuthorizedUser.create({
    telegramId: tid,
    name: name.trim(),
    username: (username || "").replace(/^@/, "").trim(),
    role: resolvedRole,
    status: resolvedStatus,
    permissions: resolvedPermissions,
    addedBy,
    notes: notes || ""
  });

  setAuthorizedUserCache(tid, newUser);
  return newUser;
};

/**
 * CRUD UPDATE: Update an existing leader's details, role, status, or permissions.
 */
export const updateUser = async (telegramId, updates = {}) => {
  if (!telegramId) throw new Error("Telegram ID is required");
  const tid = String(telegramId).trim();

  // Guard against demoting primary Super Admin via update
  if (process.env.ADMIN_ID && tid === String(process.env.ADMIN_ID).trim()) {
    if (updates.status && updates.status !== "active") {
      throw new Error("Cannot deactivate primary Super Admin");
    }
  }

  const user = await AuthorizedUser.findOne({ telegramId: tid });
  if (!user) throw new Error("User not found");

  if (updates.name !== undefined) user.name = String(updates.name).trim();
  if (updates.username !== undefined) user.username = String(updates.username).replace(/^@/, "").trim();
  if (updates.role !== undefined && ["superadmin", "admin", "pastor", "staff", "volunteer"].includes(updates.role)) {
    user.role = updates.role;
  }
  if (updates.status !== undefined && ["active", "pending", "suspended", "revoked"].includes(updates.status)) {
    user.status = updates.status;
  }
  if (updates.notes !== undefined) user.notes = String(updates.notes).trim();

  if (updates.permissions) {
    user.permissions = {
      ...(user.permissions ? user.permissions.toObject?.() || user.permissions : getDefaultPermissions(user.role)),
      ...updates.permissions
    };
  }

  user.updatedAt = new Date();
  await user.save();

  setAuthorizedUserCache(tid, user);
  return user;
};

/**
 * CRUD DELETE: Permanently delete an authorized user.
 */
export const deleteUser = async (telegramId) => {
  if (!telegramId) throw new Error("Telegram ID is required");
  const tid = String(telegramId).trim();

  if (process.env.ADMIN_ID && tid === String(process.env.ADMIN_ID).trim()) {
    throw new Error("Cannot delete primary Super Admin");
  }

  const user = await AuthorizedUser.findOneAndDelete({ telegramId: tid });
  setAuthorizedUserCache(tid, null);
  return user;
};

/**
 * Toggle user active/suspended state.
 */
export const toggleUserStatus = async (telegramId) => {
  if (!telegramId) throw new Error("Telegram ID is required");
  const tid = String(telegramId).trim();

  if (process.env.ADMIN_ID && tid === String(process.env.ADMIN_ID).trim()) {
    throw new Error("Cannot modify primary Super Admin status");
  }

  const user = await AuthorizedUser.findOne({ telegramId: tid });
  if (!user) throw new Error("User not found");

  user.status = user.status === "active" ? "suspended" : "active";
  user.updatedAt = new Date();
  await user.save();

  setAuthorizedUserCache(tid, user);
  return user;
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
    permissions: getDefaultPermissions("admin"),
    addedBy: "Self-Requested"
  });

  return { status: "pending", user: newUser };
};

/**
 * Approve a pending user or add a new leader.
 */
export const approveUser = async ({
  telegramId,
  role = "admin",
  permissions = null,
  approvedBy = "Super Admin",
  name,
  username
}) => {
  const tid = String(telegramId).trim();
  const resolvedRole = ["superadmin", "admin", "pastor", "staff", "volunteer"].includes(role) ? role : "admin";
  const resolvedPermissions = {
    ...getDefaultPermissions(resolvedRole),
    ...(permissions || {})
  };

  const user = await AuthorizedUser.findOneAndUpdate(
    { telegramId: tid },
    {
      $set: {
        role: resolvedRole,
        status: "active",
        permissions: resolvedPermissions,
        addedBy: approvedBy,
        ...(name ? { name: name.trim() } : {}),
        ...(username ? { username: username.replace(/^@/, "").trim() } : {}),
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
 * Generate a shareable, one-click invite token with specific role and permissions.
 */
export const createInviteToken = async ({
  role = "admin",
  permissions = null,
  createdBy = "Admin",
  hoursValid = 72,
  botUsername = ""
}) => {
  const token = crypto.randomBytes(12).toString("hex");
  const expires = new Date(Date.now() + hoursValid * 60 * 60 * 1000);
  const placeholderTid = `pending_invite_${token}`;
  const resolvedRole = ["superadmin", "admin", "pastor", "staff", "volunteer"].includes(role) ? role : "admin";
  const resolvedPermissions = {
    ...getDefaultPermissions(resolvedRole),
    ...(permissions || {})
  };

  await AuthorizedUser.create({
    telegramId: placeholderTid,
    name: `Invited ${resolvedRole.charAt(0).toUpperCase() + resolvedRole.slice(1)}`,
    role: resolvedRole,
    status: "pending",
    permissions: resolvedPermissions,
    inviteToken: token,
    inviteExpires: expires,
    addedBy: createdBy
  });

  const username = botUsername || process.env.BOT_USERNAME || "SalemPBC_Bot";
  const inviteUrl = `https://t.me/${username}?start=invite_${token}`;

  return { token, inviteUrl, expiresAt: expires, role: resolvedRole };
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
    existingUser.permissions = inviteRecord.permissions || getDefaultPermissions(inviteRecord.role);
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
