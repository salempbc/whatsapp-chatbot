import Member from "../models/Member.js";
import Meta from "../models/Meta.js";
import Template from "../models/Template.js";
import { enhanceTamil } from "./aiService.js";

/* ================= DATE ================= */
const getTodayKey = () => {
  const ist = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  return `${String(ist.getMonth() + 1).padStart(2, "0")}-${String(
    ist.getDate()
  ).padStart(2, "0")}`;
};

const getTomorrowKey = () => {
  const ist = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  ist.setDate(ist.getDate() + 1);
  return `${String(ist.getMonth() + 1).padStart(2, "0")}-${String(
    ist.getDate()
  ).padStart(2, "0")}`;
};

/* Returns every MM-DD key for the next `days` days (inclusive of today) */
const getUpcomingKeys = (days = 30) => {
  const ist = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const keys = new Set();
  for (let i = 0; i < days; i++) {
    const d = new Date(ist);
    d.setDate(ist.getDate() + i);
    keys.add(
      `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }
  return keys;
};

/* ================= AGE ================= */
const getAge = (dob) => {
  if (!dob) return null;

  const today = new Date();
  const birth = new Date(dob);

  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

  return age;
};

/* ================= DESIGNATION ================= */
const getDesignation = (m) => {
  const age = getAge(m.dob);

  if (m.isChild) return m.gender === "male" ? "à®®à®•à®©à¯" : "à®®à®•à®³à¯";

  if (age && age >= 60)
    return m.gender === "male" ? "à®à®¯à®¾" : "à®…à®®à¯à®®à®¾";

  if (m.isPastor) return "à®ªà¯‹à®¤à®•à®°à¯";

  if (m.role === "treasurer") return "à®ªà¯Šà®°à¯à®³à®¾à®³à®°à¯";
  if (m.role === "secretary") return "à®šà¯†à®¯à®²à®¾à®³à®°à¯";

  return m.gender === "male" ? "à®šà®•à¯‹à®¤à®°à®°à¯" : "à®šà®•à¯‹à®¤à®°à®¿";
};

/* ================= META ================= */
const getMeta = async (key) => {
  const doc = await Meta.findOne({ key });
  return doc?.value;
};

const setMeta = async (key, value) => {
  await Meta.updateOne({ key }, { value }, { upsert: true });
};

const pickTemplate = async (type, key) => {
  const templates = await Template.find({ type });

  if (!templates.length) return null;

  const lastUsed = await getMeta(key);

  let available = templates.filter(
    (t) => String(t._id) !== String(lastUsed)
  );

  if (!available.length) available = templates;

  /* ðŸ”¥ SMART SORT (least used first) */
  available.sort((a, b) => a.usageCount - b.usageCount);

  const chosen = available[0];

  /* âœ… UPDATE USAGE */
  chosen.usageCount += 1;
  chosen.lastUsedAt = new Date();
  await chosen.save();

  await setMeta(key, chosen._id);

  return chosen.content;
};

/* ================= EVENTS ================= */
export const getTodayEvents = async () => {
  const todayKey = getTodayKey();

  const members = await Member.find({
    isDeleted: { $ne: true },
    isActive:  { $ne: false }
  });

  const birthdays = [];
  const weddings = [];
  const processed = new Set();

  for (const m of members) {
    if ((m.birthday || "").trim() === todayKey) {
      birthdays.push(m);
    }

    if (
      (m.wedding || "").trim() === todayKey &&
      m.isMarried &&
      m.spouseName &&
      !processed.has(m.name)
    ) {
      weddings.push(m);
      processed.add(m.name);
      processed.add(m.spouseName);
    }
  }

  return { birthdays, weddings };
};

/* ================= UPCOMING ================= */
export const getUpcomingEvents = async (days = 30) => {
  const keys = getUpcomingKeys(days);
  const todayKey = getTodayKey();

  const members = await Member.find({ isDeleted: { $ne: true }, isActive: { $ne: false } });

  const birthdays = [];
  const weddings = [];
  const processed = new Set();

  for (const m of members) {
    const bKey = (m.birthday || "").trim();
    if (bKey && keys.has(bKey)) {
      birthdays.push({ member: m, mmdd: bKey, isToday: bKey === todayKey });
    }

    const wKey = (m.wedding || "").trim();
    if (
      wKey &&
      keys.has(wKey) &&
      m.isMarried &&
      m.spouseName &&
      !processed.has(m.name)
    ) {
      weddings.push({ member: m, mmdd: wKey, isToday: wKey === todayKey });
      processed.add(m.name);
      processed.add(m.spouseName);
    }
  }

  /* Sort by MM-DD so the list reads chronologically */
  const byKey = (a, b) => a.mmdd.localeCompare(b.mmdd);
  birthdays.sort(byKey);
  weddings.sort(byKey);

  return { birthdays, weddings };
};

/* ================= BUILD ================= */
export const buildMessages = async ({ birthdays, weddings }) => {
  const results = [];

  const bTpl = await pickTemplate("birthday", "b_tpl");
  const wTpl = await pickTemplate("wedding", "w_tpl");

  /* ===== BIRTHDAY ===== */
  for (const m of birthdays) {
    /* Under 18 (or flagged as child) â†’ à®, else â†’ à®…à®µà®°à¯à®•à®³à¯ˆ */
    const age = getAge(m.dob);
    const suffix = (m.isChild || (age !== null && age < 18)) ? "à®" : "à®…à®µà®°à¯à®•à®³à¯ˆ";

    let text = (bTpl || "{designation} {name} {suffix}")
      .replace("{designation}", getDesignation(m))
      .replace("{name}", m.name)
      .replace("{suffix}", suffix);

    text = await enhanceTamil(text, {
      type: "birthday",
      member: m
    });

    results.push({
      type: "birthday",
      text,
      photo: m.photo || null
    });
  }


  /* ===== WEDDING ===== */
  for (const m of weddings) {
    /* Look up spouse record so we can use their designation too */
    const spouseDoc = m.spouseName
      ? await Member.findOne({ name: m.spouseName, isDeleted: { $ne: true } })
      : null;

    /* Fallback designation for spouse if not found in DB */
    const spouseDesig = spouseDoc
      ? getDesignation(spouseDoc)
      : (m.spouseGender === "male" ? "à®šà®•à¯‹à®¤à®°à®°à¯" : "à®šà®•à¯‹à®¤à®°à®¿");

    const mDesig = getDesignation(m);

    const husband = m.gender === "male"
      ? `${mDesig} ${m.name}`
      : `${spouseDesig} ${m.spouseName}`;

    const wife = m.gender === "female"
      ? `${mDesig} ${m.name}`
      : `${spouseDesig} ${m.spouseName}`;

    /* Anniversary year suffix â€” only shown when weddingDate is known */
    let years = 0;
    let yearSuffix = "";
    if (m.weddingDate) {
      const weddingYear = new Date(m.weddingDate).getFullYear();
      const thisYear = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
      ).getFullYear();
      years = thisYear - weddingYear;
      if (years > 0) yearSuffix = ` (${years} ஆண்டுகள்)`;
    }

    let text = (wTpl || "{husband} மற்றும் {wife}")
      .replace("{husband}", husband)
      .replace("{wife}", wife)
      .replace("{years}", years > 0 ? `${years}வது` : "");

    if (yearSuffix) text = text + yearSuffix;

    text = await enhanceTamil(text, {
      type: "wedding",
      member: m
    });

    results.push({
      type: "wedding",
      text,
      photo: m.photo || null
    });
  }

  return results;
};

/* ================= TOMORROW EVENTS (admin reminder) ================= */
export const getTomorrowEvents = async () => {
  const tomorrowKey = getTomorrowKey();

  const members = await Member.find({
    isDeleted: { $ne: true },
    isActive:  { $ne: false }
  });

  const birthdays = members.filter(
    (m) => (m.birthday || "").trim() === tomorrowKey
  );

  const weddings = [];
  const processed = new Set();

  for (const m of members) {
    if (
      (m.wedding || "").trim() === tomorrowKey &&
      m.isMarried &&
      m.spouseName &&
      !processed.has(m.name)
    ) {
      weddings.push(m);
      processed.add(m.name);
      processed.add(m.spouseName);
    }
  }

  return { birthdays, weddings };
};

/* ================= CALENDAR ================= */
export const getMonthlyCalendar = async (month) => {
  const members = await Member.find({
    isDeleted: { $ne: true },
    isActive:  { $ne: false }
  });

  const result = {
    birthdays: {},
    weddings: {}
  };

  members.forEach((m) => {
    if (m.birthday) {
      const [mm, dd] = m.birthday.split("-");

      if (!month || mm === month) {
        if (!result.birthdays[dd]) result.birthdays[dd] = [];
        result.birthdays[dd].push(m.name);
      }
    }

    if (m.wedding) {
      const [mm, dd] = m.wedding.split("-");

      if (!month || mm === month) {
        if (!result.weddings[dd]) result.weddings[dd] = [];
        result.weddings[dd].push(`${m.name} & ${m.spouseName}`);
      }
    }
  });

  return result;
};