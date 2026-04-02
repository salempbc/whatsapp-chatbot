import Member from "../models/Member.js";

/**
 * IST date (fixes Railway timezone issue)
 */
const getTodayKey = () => {
  const ist = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const mm = String(ist.getMonth() + 1).padStart(2, "0");
  const dd = String(ist.getDate()).padStart(2, "0");

  return `${mm}-${dd}`;
};

/**
 * Age calculation
 */
const getAge = (dob) => {
  if (!dob) return null;

  const today = new Date();
  const birth = new Date(dob);

  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
};

/**
 * Designation logic (FULL)
 */
const getDesignation = (m) => {
  const age = getAge(m.dob);

  // Child
  if (m.isChild) {
    if (m.gender === "male") return "மகன்";
    if (m.gender === "female") return "மகள்";
    return "குழந்தை";
  }

  // Elder
  if (age && age >= 60) {
    if (m.gender === "male") return "ஐயா";
    if (m.gender === "female") return "அம்மா";
  }

  // Pastor
  if (m.isPastor) return "போதகர்";

  // Evangelist (only Stalin)
  if (m.name?.toLowerCase().includes("stalin")) return "ஊழியர்";

  // Roles
  if (m.role === "treasurer") return "பொருளாளர்";
  if (m.role === "secretary") return "செயலாளர்";

  // Default
  if (m.gender === "male") return "சகோதரர்";
  if (m.gender === "female") return "சகோதரி";

  return "அன்புத்";
};

/**
 * Wedding year count
 */
const getWeddingYears = (date) => {
  if (!date) return null;

  const today = new Date();
  const wedding = new Date(date);

  let years = today.getFullYear() - wedding.getFullYear();

  const m = today.getMonth() - wedding.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < wedding.getDate())) {
    years--;
  }

  return years;
};

/**
 * Get events
 */
export const getTodayEvents = async () => {
  const todayKey = getTodayKey();
  console.log("📅 TODAY KEY:", todayKey);

  const members = await Member.find();

  const birthdays = [];
  const weddings = [];
  const processed = new Set();

  for (const m of members) {
    // Birthday
    if (m.birthday === todayKey) {
      birthdays.push(m);
    }

    // Wedding
    if (
      m.wedding === todayKey &&
      m.isMarried &&
      m.spouseName &&
      !processed.has(m.name)
    ) {
      weddings.push(m);
      processed.add(m.name);
      processed.add(m.spouseName);
    }
  }

  console.log("🎂 MATCHED BIRTHDAYS:", birthdays.length);
  console.log("💍 MATCHED WEDDINGS:", weddings.length);

  return { birthdays, weddings };
};

/**
 * Build message (FULL Tamil logic)
 */
export const buildMessage = ({ birthdays, weddings }) => {
  if (!birthdays.length && !weddings.length) return null;

  let msg = "";

  // 🎂 Birthdays
  birthdays.forEach((m) => {
    const des = getDesignation(m);

    const suffix = m.isChild ? "ஐ" : "அவர்களை";

    msg += `🎉 இன்று பிறந்தநாள் காணும் ${des} ${m.name}-${suffix} கர்த்தர் ஆசீர்வதித்து காத்து என்றென்றும் வழிநடத்துவாராக.\n\n`;
  });

  // 💍 Weddings
  weddings.forEach((m) => {
    const husband =
      m.gender === "male"
        ? `சகோதரர் ${m.name}`
        : `சகோதரர் ${m.spouseName}`;

    const wife =
      m.gender === "female"
        ? `சகோதரி ${m.name}`
        : `சகோதரி ${m.spouseName}`;

    const years = getWeddingYears(m.weddingDate);

    const yearText = years ? `${years}வது` : "";

    msg += `💍 இன்று ${yearText} திருமண நாளை காணும் ${husband} மற்றும் ${wife} அவர்களை கர்த்தர் ஆசீர்வதித்து காத்து வழிநடத்துவாராக.\n\n`;
  });

  return msg.trim();
};