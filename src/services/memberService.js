import Member from "../models/Member.js";

/**
 * Ensure spouse exists
 */
export const ensureSpouse = async (member) => {
  if (!member.isMarried || !member.spouseName) return;

  const existing = await Member.findOne({ name: member.spouseName });

  if (existing) {
    // Sync gender if missing
    if (!existing.gender && member.spouseGender) {
      existing.gender = member.spouseGender;
      await existing.save();
    }
    return existing;
  }

  // Create spouse entry automatically
  const spouse = new Member({
    name: member.spouseName,
    gender: member.spouseGender || "female",
    isMarried: true,
    spouseName: member.name,
    spouseGender: member.gender,
    weddingDate: member.weddingDate,
    wedding: member.wedding
  });

  await spouse.save();

  return spouse;
};