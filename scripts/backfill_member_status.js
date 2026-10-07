import "dotenv/config";
import { connectDB } from "../src/config/db.js";
import Member from "../src/models/Member.js";

async function backfill() {
  await connectDB();
  console.log("Connected to MongoDB for member status backfill...");

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

  // Verify
  const all = await Member.find().lean();
  console.log(`Total members: ${all.length}`);
  const statusCounts = {};
  const activeCounts = {};
  for (const m of all) {
    statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
    activeCounts[String(m.isActive)] = (activeCounts[String(m.isActive)] || 0) + 1;
  }
  console.log("Status counts:", statusCounts);
  console.log("isActive counts:", activeCounts);

  process.exit(0);
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
