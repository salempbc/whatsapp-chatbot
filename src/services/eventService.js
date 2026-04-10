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

  if (m.isChild) return m.gender === "male" ? "மகன்" : "மகள்";

  if (age >= 60) return m.gender === "male" ? "ஐயா" : "அம்மா";

  if (m.isPastor) return "போதகர்";

  if (m.role === "treasurer") return "பொருளாளர்";
  if (m.role === "secretary") return "செயலாளர்";

  return m.gender === "male" ? "சகோதரர்" : "சகோதரி";
};

/* ================= META ================= */
const getMeta = async (key) => {
  const doc = await Meta.findOne({ key });
  return doc?.value;
};

const setMeta = async (key, value) => {
  await Meta.updateOne({ key }, { value }, { upsert: true });
};

/* ================= TEMPLATE ================= */
const pickTemplate = async (type, key) => {
  const templates = await Template.find({ type });

  if (!templates.length) return null;

  const last = await getMeta(key);

  let filtered = templates;
  if (last) {
    filtered = templates.filter((t) => String(t._id) !== String(last));
  }

  const chosen =
    filtered[Math.floor(Math.random() * filtered.length)];

  await setMeta(key, chosen._id);

  return chosen.content;
};

/* ================= EVENTS ================= */
export const getTodayEvents = async () => {
  const todayKey = getTodayKey();

  const members = await Member.find({ isDeleted: { $ne: true } });

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

/* ================= BUILD ================= */
export const buildMessage = async ({ birthdays, weddings }) => {
  if (!birthdays.length && !weddings.length) return null;

  let msg = "";

  const bTpl = await pickTemplate("birthday", "b_tpl");
  const wTpl = await pickTemplate("wedding", "w_tpl");

  if (birthdays.length) {
    msg += "🎉 *இன்றைய பிறந்தநாள் வாழ்த்துக்கள்*\n\n";

    for (const m of birthdays) {
      let line = (bTpl || "{designation} {name}-{suffix}")
        .replace("{designation}", getDesignation(m))
        .replace("{name}", m.name)
        .replace("{suffix}", m.isChild ? "ஐ" : "அவர்களை");

      line = await enhanceTamil(line);

      msg += line + "\n\n";
    }
  }

  if (weddings.length) {
    msg += "💍 *திருமண நாள் வாழ்த்துக்கள்*\n\n";

    for (const m of weddings) {
      const husband =
        m.gender === "male"
          ? `சகோதரர் ${m.name}`
          : `சகோதரர் ${m.spouseName}`;

      const wife =
        m.gender === "female"
          ? `சகோதரி ${m.name}`
          : `சகோதரி ${m.spouseName}`;

      let line = (wTpl || "{husband} {wife}")
        .replace("{husband}", husband)
        .replace("{wife}", wife);

      line = await enhanceTamil(line);

      msg += line + "\n\n";
    }
  }

  return msg.trim();
};