import Member from "../models/Member.js";

/**
 * 🔍 DUPLICATE DETECTION (REQUIRED FOR TELEGRAM)
 */
export const findSimilar = async (name) => {
  if (!name) return [];

  const base = name.split(" ")[0];

  return await Member.find({
    name: new RegExp(base, "i"),
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