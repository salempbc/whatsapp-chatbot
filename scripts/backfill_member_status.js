import "dotenv/config";
import { connectDB } from "../src/config/db.js";
import Member from "../src/models/Member.js";

async function backfill() {
  await connectDB();
  console.log("Connected to MongoDB for member data normalization...");

  // 1. Members with isActive: false but no status -> set status: 'inactive'
  const r1 = await Member.updateMany(
    { status: { $exists: false }, isActive: false },
    { $set: { status: "inactive" } }
  );
  console.log(`Updated ${r1.modifiedCount} members with status: 'inactive'`);

  // 2. Members with undefined isActive or undefined status -> set active
  const r2 = await Member.updateMany(
    {
      $or: [
        { isActive: { $exists: false } },
        { status: { $exists: false } },
        { status: null }
      ],
      isActive: { $ne: false }
    },
    {
      $set: {
        isActive: true,
        status: "active",
        isDeleted: false
      }
    }
  );
  console.log(`Updated ${r2.modifiedCount} members with status: 'active' and isActive: true`);

  // 3. Normalize wedding, weddingDate, dob, and birthday
  const allMembers = await Member.find().lean();
  let normalizedWeddings = 0;
  let normalizedBirthdays = 0;

  for (const m of allMembers) {
    const update = {};

    // If wedding was stored as full YYYY-MM-DD (10 chars), set weddingDate = wedding and wedding = wedding.substring(5)
    if (typeof m.wedding === "string" && m.wedding.length === 10) {
      update.weddingDate = m.wedding;
      update.wedding = m.wedding.substring(5);
      normalizedWeddings++;
    } else if (typeof m.weddingDate === "string" && m.weddingDate.length >= 5 && (!m.wedding || m.wedding.length !== 5)) {
      update.wedding = m.weddingDate.substring(5);
      normalizedWeddings++;
    }

    // If dob is YYYY-MM-DD and birthday is missing or mismatched, sync birthday = dob.substring(5)
    if (typeof m.dob === "string" && m.dob.length >= 5 && m.birthday !== m.dob.substring(5)) {
      update.birthday = m.dob.substring(5);
      normalizedBirthdays++;
    }

    if (Object.keys(update).length > 0) {
      await Member.updateOne({ _id: m._id }, { $set: update });
    }
  }
  console.log(`Normalized ${normalizedWeddings} weddings and ${normalizedBirthdays} birthdays.`);

  // Verify
  const all = await Member.find().lean();
  console.log(`Total members: ${all.length}`);
  const statusCounts = {};
  const activeCounts = {};
  let validBdays = 0;
  let validWeddings = 0;
  let fullDobs = 0;
  let fullWeddingDates = 0;

  const mmddRegex = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

  for (const m of all) {
    statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
    activeCounts[String(m.isActive)] = (activeCounts[String(m.isActive)] || 0) + 1;
    if (m.birthday && mmddRegex.test(m.birthday)) validBdays++;
    if (m.wedding && mmddRegex.test(m.wedding)) validWeddings++;
    if (m.dob && m.dob.length === 10) fullDobs++;
    if (m.weddingDate && m.weddingDate.length === 10) fullWeddingDates++;
  }

  console.log("Status counts:", statusCounts);
  console.log("isActive counts:", activeCounts);
  console.log("Valid MM-DD birthdays:", validBdays);
  console.log("Full YYYY-MM-DD DOBs:", fullDobs);
  console.log("Valid MM-DD wedding anniversaries:", validWeddings);
  console.log("Full YYYY-MM-DD wedding dates:", fullWeddingDates);

  process.exit(0);
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
