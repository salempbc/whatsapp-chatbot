import Member from "../models/Member.js";
import Meta from "../models/Meta.js";

/**
 * IST date
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
 * Age
 */
const getAge = (dob) => {
  if (!dob) return null;

  const today = new Date();
  const birth = new Date(dob);

  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

  return age;
};

/**
 * Designation (FULL LOGIC PRESERVED)
 */
const getDesignation = (m) => {
  const age = getAge(m.dob);

  if (m.isChild) {
    if (m.gender === "male") return "மகன்";
    if (m.gender === "female") return "மகள்";
    return "குழந்தை";
  }

  if (age && age >= 60) {
    if (m.gender === "male") return "ஐயா";
    if (m.gender === "female") return "அம்மா";
  }

  if (m.isPastor) return "போதகர்";

  if (m.name?.toLowerCase().includes("stalin")) return "ஊழியர்";

  if (m.role === "treasurer") return "பொருளாளர்";
  if (m.role === "secretary") return "செயலாளர்";

  if (m.gender === "male") return "சகோதரர்";
  if (m.gender === "female") return "சகோதரி";

  return "அன்புத்";
};

/**
 * Wedding years
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
 * META HELPERS (DB STATE)
 */
const getMeta = async (key, def) => {
  const doc = await Meta.findOne({ key });
  if (!doc) return def;
  return doc.value;
};

const setMeta = async (key, value) => {
  await Meta.updateOne(
    { key },
    { $set: { value } },
    { upsert: true }
  );
};

/**
 * NON-REPEATING PICK
 */
const pickNonRepeating = (arr, lastIndex) => {
  let idx = Math.floor(Math.random() * arr.length);

  if (arr.length > 1 && idx === lastIndex) {
    idx = (idx + 1) % arr.length;
  }

  return { item: arr[idx], index: idx };
};

/**
 * MESSAGE TEMPLATES
 */
const birthdayTemplates = [
  (d, n, s) =>
    `🎉 இன்று பிறந்தநாள் காணும் ${d} ${n}-${s} கர்த்தர் ஆசீர்வதித்து காத்து என்றென்றும் வழிநடத்துவாராக.`,

  (d, n, s) =>
    `🎂 ${d} ${n}-${s} இன்று பிறந்தநாள் காண்கிறார். தேவனுடைய கிருபை அவர்களுடன் இருப்பதாக.`,

  (d, n, s) =>
    `✨ ${d} ${n}-${s} அவர்களுக்கு இனிய பிறந்தநாள் வாழ்த்துக்கள். கர்த்தர் அவர்களை ஆசீர்வதிப்பாராக.`
];

const weddingTemplates = [
  (y, h, w) =>
    `💍 இன்று ${y} திருமண நாளை காணும் ${h} மற்றும் ${w} அவர்களை கர்த்தர் ஆசீர்வதித்து காத்து வழிநடத்துவாராக.`,

  (y, h, w) =>
    `💑 ${h} மற்றும் ${w} தம்பதிகளுக்கு ${y} திருமண நாள் நல்வாழ்த்துக்கள். தேவன் உங்கள் குடும்பத்தை ஆசீர்வதிப்பாராக.`,

  (y, h, w) =>
    `🌸 ${y} திருமண நாளில் ${h} மற்றும் ${w} அவர்களுக்கு இனிய வாழ்த்துக்கள். சமாதானமும் அன்பும் நிலைத்திருக்கட்டும்.`
];

/**
 * GET EVENTS
 */
export const getTodayEvents = async () => {
  const todayKey = getTodayKey();
  console.log("📅 TODAY KEY:", todayKey);

  const members = await Member.find();
  console.log("👥 TOTAL MEMBERS:", members.length);

  const birthdays = [];
  const weddings = [];
  const processed = new Set();

  for (const m of members) {
    const bday = (m.birthday || "").trim();
    const wed = (m.wedding || "").trim();

    if (bday === todayKey) birthdays.push(m);

    if (
      wed === todayKey &&
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
 * BUILD MESSAGE (FINAL)
 */
export const buildMessage = async ({ birthdays, weddings }) => {
  if (!birthdays.length && !weddings.length) return null;

  let msg = "";

  let last = await getMeta("template_state", {
    birthdayIndex: -1,
    weddingIndex: -1
  });

  // 🎂 Birthdays
  if (birthdays.length) {
    msg += "🎉 *இன்றைய பிறந்தநாள் வாழ்த்துக்கள்*\n\n";

    const { item, index } = pickNonRepeating(
      birthdayTemplates,
      last.birthdayIndex
    );

    birthdays.forEach((m) => {
      const des = getDesignation(m);
      const suffix = m.isChild ? "ஐ" : "அவர்களை";

      msg += item(des, m.name, suffix) + "\n\n";
    });

    last.birthdayIndex = index;
  }

  // 💍 Weddings
  if (weddings.length) {
    msg += "💍 *திருமண நாள் வாழ்த்துக்கள்*\n\n";

    const { item, index } = pickNonRepeating(
      weddingTemplates,
      last.weddingIndex
    );

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

      msg += item(yearText, husband, wife) + "\n\n";
    });

    last.weddingIndex = index;
  }

  await setMeta("template_state", last);

  return msg.trim();
};

/**
 * 📅 MONTHLY CALENDAR (FOR TELEGRAM UI)
 */
export const getMonthlyCalendar = async () => {
  const members = await Member.find();

  const map = {};

  members.forEach((m) => {
    const b = (m.birthday || "").trim();
    const w = (m.wedding || "").trim();

    if (b) {
      map[b] = map[b] || [];
      map[b].push(`🎂 ${m.name}`);
    }

    if (w && m.isMarried) {
      map[w] = map[w] || [];
      map[w].push(`💍 ${m.name}`);
    }
  });

  return map;
};