import Member from "../models/Member.js";

/**
 * Date key
 */
const getTodayKey = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Age
 */
const getAge = (dob) => {
  if (!dob) return null;

  const birth = new Date(dob);
  const today = new Date();

  let age = today.getFullYear() - birth.getFullYear();

  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
};

/**
 * Wedding years
 */
const getWeddingYears = (date) => {
  if (!date) return null;

  const d = new Date(date);
  const today = new Date();

  let years = today.getFullYear() - d.getFullYear();

  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
    years--;
  }

  return years;
};

/**
 * Tamil ordinal (வது)
 */
const ordinalTamil = (n) => {
  if (!n) return "";
  return `${n}வது`;
};

/**
 * Prefix logic (same as before)
 */
const roleMap = {
  treasurer: "பொருளாளர்",
  secretary: "செயலாளர்"
};

const getPrefix = (m, age) => {
  const name = m.name.toLowerCase();

  if (name.includes("stalin")) return "ஊழியர்";
  if (m.isPastor) return "போதகர்";

  if (m.isChild) {
    return m.gender === "male" ? "மகன்" : "மகள்";
  }

  if (m.role && roleMap[m.role]) {
    return roleMap[m.role];
  }

  if (age !== null && age >= 60) {
    return m.gender === "male" ? "ஐயா" : "அம்மா";
  }

  return m.gender === "male" ? "சகோதரர்" : "சகோதரி";
};

const getSuffix = (m) => (m.isChild ? "ஐ" : "அவர்களை");

/**
 * Fetch
 */
export const getTodayEvents = async () => {
  const todayKey = getTodayKey();
  const members = await Member.find();

  const birthdays = [];
  const weddings = [];
  const processed = new Set();

  for (const m of members) {
    if (m.birthday === todayKey) birthdays.push(m);

    if (m.wedding === todayKey && m.isMarried && !processed.has(m.name)) {
      weddings.push(m);
      processed.add(m.name);
      processed.add(m.spouseName);
    }
  }

  return { birthdays, weddings };
};

/**
 * Build message
 */
export const buildMessage = ({ birthdays, weddings }) => {
  if (!birthdays.length && !weddings.length) return null;

  let msg = "";

  // 🎂 Birthday
  birthdays.forEach(m => {
    const age = getAge(m.dob);
    const prefix = getPrefix(m, age);
    const suffix = getSuffix(m);

    let line = `${prefix} ${m.name} ${suffix}`;
    if (age) line += ` (${age} வயது)`;

    msg += `🎉 இன்று பிறந்தநாள் காணும் ${line} கர்த்தர் ஆசீர்வதித்து காத்து வழிநடத்துவாராக.\n\n`;
  });

  // 💍 Wedding
  weddings.forEach(m => {
    const years = getWeddingYears(m.weddingDate);
    const ordinal = ordinalTamil(years);

    const h = `சகோதரர் ${m.gender === "male" ? m.name : m.spouseName}`;
    const w = `சகோதரி ${m.gender === "female" ? m.name : m.spouseName}`;

    let line = `${h} மற்றும் ${w}`;

    if (ordinal) {
      msg += `💍 இன்று ${ordinal} திருமண நாளை காணும் ${line} கர்த்தர் ஆசீர்வதித்து காத்து வழிநடத்துவாராக.\n\n`;
    } else {
      msg += `💍 இன்று திருமண நாளை காணும் ${line} கர்த்தர் ஆசீர்வதித்து காத்து வழிநடத்துவாராக.\n\n`;
    }
  });

  return msg.trim();
};