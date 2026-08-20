import Member from "../models/Member.js";

/**
 * 🔍 DUPLICATE DETECTION (REQUIRED FOR TELEGRAM)
 */
/* Names come from chat input, so regex metacharacters must be escaped —
   otherwise "a(" throws and "(a+)+$" is a ReDoS. */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const findSimilar = async (name) => {
  if (!name) return [];

  const base = name.trim().split(/\s+/)[0];
  if (!base) return [];

  return await Member.find({
    name: new RegExp(escapeRegex(base), "i"),
    isDeleted: { $ne: true }
  }).limit(5);
};

/**
 * 💍 ENSURE SPOUSE EXISTS
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
    wedding: member.wedding
  });

  await spouse.save();

  return spouse;
};

/**
 * 🗑 SOFT DELETE
 */
export const softDeleteMember = async (id) => {
  await Member.updateOne({ _id: id }, { isDeleted: true });
};