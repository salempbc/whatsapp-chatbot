const fs = require("fs");
let code = fs.readFileSync("src/services/eventService.js", "utf8");

const helper = `
/* ================= TEMPLATE ENGINE ================= */
const processConditionals = (str, ctx) => {
  if (!str) return str;
  let res = str;
  for (const [k, v] of Object.entries(ctx)) {
    res = res.replace(new RegExp("\\\\{" + k + "\\\\}", "gi"), v === null || v === undefined ? "" : v);
  }
  
  res = res.replace(/\\{if\\s+([a-zA-Z0-9_]+)\\s*(==|=|!=|>|<|>=|<=)\\s*(\\d+)\\}([\\s\\S]*?)\\{endif\\}/gi, (match, varName, op, val, content) => {
    const contextVal = ctx[varName];
    if (contextVal === undefined || contextVal === null) return "";
    const left = Number(contextVal);
    const right = Number(val);
    let isTrue = false;
    
    switch (op) {
      case "==":
      case "=": isTrue = left === right; break;
      case "!=": isTrue = left !== right; break;
      case ">": isTrue = left > right; break;
      case "<": isTrue = left < right; break;
      case ">=": isTrue = left >= right; break;
      case "<=": isTrue = left <= right; break;
    }
    
    return isTrue ? content : "";
  });
  
  return res;
};
`;

const startIdx = code.indexOf("/* ================= BUILD ================= */");
const endIdx = code.indexOf("/* ================= TOMORROW EVENTS", startIdx);

const newBuild = `/* ================= BUILD ================= */
export const buildMessages = async ({ birthdays, weddings }) => {
  const results = [];

  const bTpl = await pickTemplate("birthday", "b_tpl");
  const wTpl = await pickTemplate("wedding", "w_tpl");

  /* ===== BIRTHDAY ===== */
  for (const m of birthdays) {
    const age = getAge(m.dob);
    const suffix = (m.isChild || (age !== null && age < 18)) ? "👧👦" : "🎉🎂💐";

    let text = bTpl || "{designation} {name} {suffix}";
    text = processConditionals(text, {
      designation: getDesignation(m),
      name: m.name,
      suffix: suffix,
      age: age
    });

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
    const spouseDoc = m.spouseName
      ? await Member.findOne({ name: m.spouseName, isDeleted: { $ne: true } })
      : null;

    const spouseDesig = spouseDoc
      ? getDesignation(spouseDoc)
      : (m.spouseGender === "male" ? "சகோதரன்" : "சகோதரி");

    const mDesig = getDesignation(m);

    const husband = m.gender === "male"
      ? \`\${mDesig} \${m.name}\`
      : \`\${spouseDesig} \${m.spouseName}\`;

    const wife = m.gender === "female"
      ? \`\${mDesig} \${m.name}\`
      : \`\${spouseDesig} \${m.spouseName}\`;

    const years = getAge(m.weddingDate);

    let text = wTpl || "{husband} {wife}";
    text = processConditionals(text, {
      husband: husband,
      wife: wife,
      years: years,
      age: years
    });

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
`;

code = code.substring(0, startIdx) + helper + "\\n" + newBuild + "\\n" + code.substring(endIdx);
fs.writeFileSync("src/services/eventService.js", code, "utf8");
