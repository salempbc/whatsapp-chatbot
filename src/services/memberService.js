import Member from "../models/Member.js";
import AuditLog from "../models/AuditLog.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 🔍 DUPLICATE DETECTION SERVICE
 * Checks normalized name, phone, family name, and date of birth
 */
export const checkDuplicates = async ({ name, phone, dob, familyName, currentId = null }) => {
  if (!name || typeof name !== "string") return [];

  const trimmedName = name.trim();
  const baseTokens = trimmedName.split(/\s+/).filter(t => t.length > 2);
  const regexConditions = baseTokens.map(t => ({
    name: new RegExp(escapeRegex(t), "i")
  }));

  const query = {
    isDeleted: { $ne: true },
    $or: [
      { name: new RegExp(`^${escapeRegex(trimmedName)}$`, "i") },
      ...(regexConditions.length > 0 ? [{ $or: regexConditions }] : []),
      ...(phone && phone.trim() ? [{ phone: phone.trim() }] : []),
      ...(dob && dob.trim() && familyName && familyName.trim()
        ? [{ dob: dob.trim(), familyName: new RegExp(`^${escapeRegex(familyName.trim())}$`, "i") }]
        : [])
    ]
  };

  if (currentId) {
    query._id = { $ne: currentId };
  }

  const matches = await Member.find(query).limit(5);

  return matches.map(m => {
    let matchReason = "Similar Name";
    if (m.name.toLowerCase() === trimmedName.toLowerCase()) {
      matchReason = "Exact Name Match";
    } else if (phone && m.phone === phone.trim()) {
      matchReason = "Same Phone Number";
    } else if (dob && m.dob === dob.trim()) {
      matchReason = "Same Date of Birth";
    }
    return {
      _id: m._id,
      name: m.name,
      role: m.role || "Member",
      status: m.status || "active",
      familyName: m.familyName || "",
      dob: m.dob || "",
      phone: m.phone || "",
      reason: matchReason
    };
  });
};

/**
 * Validates member status transitions
 */
export const validateStatusTransition = (currentStatus, newStatus) => {
  const validTransitions = {
    active: ["inactive", "transferred", "deceased", "archived"],
    inactive: ["active", "transferred", "deceased", "archived"],
    transferred: ["active", "archived"],
    deceased: ["archived"],
    archived: ["active", "inactive"]
  };

  if (!currentStatus) return true;
  if (currentStatus === newStatus) return true;

  const allowed = validTransitions[currentStatus] || ["active", "inactive", "archived"];
  return allowed.includes(newStatus);
};

/**
 * Soft delete / archive member
 */
export const archiveMember = async (id, performedBy = "Admin") => {
  const member = await Member.findById(id);
  if (!member) throw new Error("Member not found");

  const before = member.toObject();
  member.status = "archived";
  member.isActive = false;
  member.isDeleted = true;
  await member.save();

  await AuditLog.create({
    entity: "Member",
    entityId: String(member._id),
    action: "ARCHIVE",
    performedBy,
    details: `Archived member: ${member.name}`,
    changes: { before: { status: before.status }, after: { status: "archived" } }
  });

  return member;
};

/**
 * Restore archived member
 */
export const restoreMember = async (id, performedBy = "Admin") => {
  const member = await Member.findById(id);
  if (!member) throw new Error("Member not found");

  const before = member.toObject();
  member.status = "active";
  member.isActive = true;
  member.isDeleted = false;
  await member.save();

  await AuditLog.create({
    entity: "Member",
    entityId: String(member._id),
    action: "RESTORE",
    performedBy,
    details: `Restored member: ${member.name}`,
    changes: { before: { status: before.status }, after: { status: "active" } }
  });

  return member;
};

/**
 * Legacy search compatibility
 */
export const findSimilar = async (name) => {
  return await checkDuplicates({ name });
};

/**
 * Ensure spouse consistency
 */
export const ensureSpouse = async (member) => {
  if (!member.isMarried || !member.spouseName) return;

  const existing = await Member.findOne({ name: member.spouseName });

  if (existing) {
    if (!existing.gender && member.spouseGender) {
      existing.gender = member.spouseGender;
      await existing.save();
    }
    return existing;
  }

  const spouse = new Member({
    name: member.spouseName,
    gender: member.spouseGender || (member.gender === "male" ? "female" : "male"),
    isMarried: true,
    spouseName: member.name,
    spouseGender: member.gender,
    weddingDate: member.weddingDate,
    wedding: member.wedding,
    familyName: member.familyName || ""
  });

  await spouse.save();
  return spouse;
};

/**
 * Soft delete backwards compatibility
 */
export const softDeleteMember = async (id) => {
  return await archiveMember(id);
};