import Member from "../../models/Member.js";
import { findSimilar, softDeleteMember } from "../../services/memberService.js";
import { PAGE_SIZE, DOB_RE, deriveMMDD, renderScreen } from "../ui.js";
import { getState, setState, clearState } from "../session.js";

/* ================= SCREENS ================= */

const FILTER_LABELS = { active: "✅ Active", inactive: "🚪 Inactive", all: "👥 All" };

const listScreen = async (page, filter = "active") => {
  let query = { isDeleted: { $ne: true } };
  if (filter === "active")   query.isActive = { $ne: false };
  if (filter === "inactive") query.isActive = false;

  const members = await Member.find(query).sort({ name: 1 });
  const total   = members.length;
  const start   = page * PAGE_SIZE;
  const slice   = members.slice(start, start + PAGE_SIZE);

  const rows = slice.map((m) => [{
    text: (m.isActive === false ? "🚪 " : "") + m.name,
    callback_data: `members:open:${m._id}`
  }]);

  const nav = [];
  if (page > 0) nav.push({ text: "◀ Prev", callback_data: `members:list:${page - 1}:${filter}` });
  nav.push({ text: "➕ Add",    callback_data: "addmember:start" });
  nav.push({ text: "🔍 Search", callback_data: "members:search" });
  if (start + PAGE_SIZE < total) nav.push({ text: "Next ▶", callback_data: `members:list:${page + 1}:${filter}` });

  /* Filter tabs */
  const filterRow = ["active", "inactive", "all"].map((f) => ({
    text: f === filter ? `• ${FILTER_LABELS[f]}` : FILTER_LABELS[f],
    callback_data: `members:list:0:${f}`
  }));

  rows.push(nav);
  rows.push(filterRow);
  rows.push([
    { text: "🆕 New Members",  callback_data: "members:new" },
    { text: "👨‍👩‍👧 Families",    callback_data: "members:family" },
    { text: "🗃 Trash",        callback_data: "members:trash" }
  ]);
  rows.push([{ text: "🏠 Home", callback_data: "home:show" }]);

  return { text: `<b>👥 Member Database</b>\n<i>View: ${FILTER_LABELS[filter]} (${total} records)</i>\n\nSelect a member to view or edit their profile:`, keyboard: rows };
};

const editMenuScreen = (id) => ({
  text: "Edit which field?",
  keyboard: [
    [{ text: "✏️ Name", callback_data: `members:editfield:${id}:name` }, { text: "🏷 Role", callback_data: `members:rolePicker:${id}` }],
    [{ text: "🎂 DOB", callback_data: `members:editfield:${id}:dob` }, { text: "💍 Wedding Date", callback_data: `members:editfield:${id}:wedding` }],
    [{ text: "👨‍👩‍👧 Family Name", callback_data: `members:editfield:${id}:family` }],
    [{ text: "👶 Toggle Child", callback_data: `members:toggle:${id}:child` }, { text: "⛪ Toggle Pastor", callback_data: `members:toggle:${id}:pastor` }],
    [{ text: "🔙 Back", callback_data: `members:open:${id}` }]
  ]
});

/* Role picker — inline buttons instead of free-text */
const rolePickerScreen = (id) => ({
  text: "Pick a role (or clear):",
  keyboard: [
    [
      { text: "💰 Treasurer", callback_data: `members:setrole:${id}:treasurer` },
      { text: "📋 Secretary", callback_data: `members:setrole:${id}:secretary` }
    ],
    [{ text: "❌ None", callback_data: `members:setrole:${id}:` }],
    [{ text: "🔙 Back", callback_data: `members:edit:${id}` }]
  ]
});

/* Profile may include a photo, so it's always sent fresh rather than edited in place. */
const sendProfile = async (bot, chatId, id) => {
  const m = await Member.findById(id);
  if (!m) return bot.sendMessage(chatId, "❌ Member not found");

  const flags = [];
  if (m.isChild)  flags.push("Child");
  if (m.isPastor) flags.push("Pastor");

  /* Active status label */
  const statusLabel = m.isActive === false ? "❌ Left Church" : "✅ Active";

  const text = `<b>👤 ${m.name}</b>
<i>${statusLabel}</i>

<blockquote><b>🧬 Demographics</b>
Gender: ${m.gender || "-"}
Role: ${m.role || "-"}${flags.length ? ` (${flags.join(", ")})` : ""}

<b>🎂 Birth Details</b>
DOB: ${m.dob || "-"}
Birthday: ${m.birthday || "-"}

<b>💍 Family & Marriage</b>
Family: ${m.familyName || "-"}
Married: ${m.isMarried ? "Yes" : "No"}
Spouse: ${m.spouseName || "-"}
Wedding: ${m.weddingDate ? `${m.weddingDate} (${m.wedding})` : "-"}</blockquote>`;

  const spouseRow = m.isMarried
    ? [{ text: "💔 Unlink", callback_data: `members:unlink:${id}` }]
    : [{ text: "💍 Link", callback_data: `members:link:${id}` }];

  /* Photo row: Upload always available; Delete only shown when photo exists */
  const photoRow = m.photo
    ? [
        { text: "📸 Change Photo", callback_data: `members:photo:${id}` },
        { text: "🗑 Delete Photo", callback_data: `members:photodel:${id}` }
      ]
    : [{ text: "📸 Add Photo", callback_data: `members:photo:${id}` }];

  /* Active toggle button */
  const activeToggle = m.isActive === false
    ? { text: "✅ Mark Active",      callback_data: `members:toggle:${id}:active` }
    : { text: "🚪 Mark Left Church", callback_data: `members:toggle:${id}:active` };

  const keyboard = [
    photoRow,
    spouseRow,
    [activeToggle],
    [{ text: "✏️ Edit", callback_data: `members:edit:${id}` }, { text: "🗑 Delete", callback_data: `members:delete:${id}` }],
    [{ text: "🔙 Back", callback_data: "members:list:0" }, { text: "🏠 Home", callback_data: "home:show" }]
  ];

  const opts = { reply_markup: { inline_keyboard: keyboard }, parse_mode: "HTML" };

  if (m.photo) {
    return bot.sendPhoto(chatId, m.photo, { caption: text, ...opts });
  }
  return bot.sendMessage(chatId, text, opts);
};

/* ================= ADD MEMBER FLOW ================= */

const askGender = async (bot, chatId) => {
  const state = getState(chatId);
  setState(chatId, { ...state, type: "members.addGender" });

  await bot.sendMessage(chatId, "<b>➕ Add New Member</b>\n\nPlease select their <b>Gender</b>:", { parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[
        { text: "♂ Male", callback_data: "addmember:gender:male" },
        { text: "♀ Female", callback_data: "addmember:gender:female" }
      ]]
    }
  });
};

const finishAddMember = async (bot, chatId, draft) => {
  try {
    const member = await Member.create({
      name: draft.name,
      gender: draft.gender,
      dob: draft.dob || undefined,
      birthday: deriveMMDD(draft.dob)
    });

    clearState(chatId);
    await bot.sendMessage(chatId, `✅ Added ${member.name}`);
    await sendProfile(bot, chatId, member._id);
  } catch (err) {
    clearState(chatId);
    const friendly = err.code === 11000 ? "a member with that name already exists" : err.message;
    await bot.sendMessage(chatId, `❌ Could not save member: ${friendly}`);
  }
};

/* ================= SPOUSE LINK / UNLINK ================= */

const linkSpouses = async (id, spouseId, weddingDate) => {
  const m1 = await Member.findById(id);
  const m2 = await Member.findById(spouseId);
  if (!m1 || !m2) throw new Error("Member not found");

  m1.isMarried = true;
  m2.isMarried = true;
  m1.spouseName = m2.name;
  m2.spouseName = m1.name;
  m1.spouseGender = m2.gender;
  m2.spouseGender = m1.gender;

  if (weddingDate) {
    const mmdd = deriveMMDD(weddingDate);
    m1.weddingDate = weddingDate;
    m2.weddingDate = weddingDate;
    m1.wedding = mmdd;
    m2.wedding = mmdd;
  }

  await m1.save();
  await m2.save();
};

const unlinkSpouse = async (id) => {
  const m = await Member.findById(id);
  if (!m) return;

  const spouseName = m.spouseName;

  m.isMarried = false;
  m.spouseName = undefined;
  m.spouseGender = undefined;
  m.wedding = undefined;
  m.weddingDate = undefined;
  await m.save();

  if (spouseName) {
    const spouse = await Member.findOne({ name: spouseName });
    if (spouse) {
      spouse.isMarried = false;
      spouse.spouseName = undefined;
      spouse.spouseGender = undefined;
      spouse.wedding = undefined;
      spouse.weddingDate = undefined;
      await spouse.save();
    }
  }
};

/* ================= CALLBACK ROUTES ================= */

export const membersCallbacks = {
  "members:list": async ({ bot, chatId, messageId, args }) => {
    const page = Number(args[0]) || 0;
    const filter = args[1] || "active";
    await renderScreen(bot, chatId, messageId, await listScreen(page, filter));
  },

  "members:new": async ({ bot, chatId, messageId }) => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const members = await Member.find({ createdAt: { $gte: monthStart } });
    if (!members.length) {
      return renderScreen(bot, chatId, messageId, {
        text: "❌ No members added this month",
        keyboard: [[{ text: "🔙 Back", callback_data: "members:list:0:active" }]]
      });
    }
    const rows = members.map((m) => [{ text: m.name, callback_data: `members:open:${m._id}` }]);
    rows.push([{ text: "🔙 Back", callback_data: "members:list:0:active" }]);
    await renderScreen(bot, chatId, messageId, { text: `<b>🆕 New Members</b>\n<i>Added this calendar month (${members.length})</i>`, keyboard: rows });
  },

  "members:family": async ({ bot, chatId, messageId }) => {
    const members = await Member.find({ isDeleted: { $ne: true }, isActive: { $ne: false }, familyName: { $exists: true, $ne: "" } });
    const families = [...new Set(members.map(m => m.familyName))].sort();
    
    if (!families.length) {
      return renderScreen(bot, chatId, messageId, {
        text: "❌ No families defined yet. Edit a member to set their Family Name.",
        keyboard: [[{ text: "🔙 Back", callback_data: "members:list:0:active" }]]
      });
    }
    const rows = families.map((f) => [{ text: `<b>👨‍👩‍👧 Family View</b>\n<i>${f}</i>`, callback_data: `members:famview:${f}` }]);
    rows.push([{ text: "🔙 Back", callback_data: "members:list:0:active" }]);
    await renderScreen(bot, chatId, messageId, { text: `<b>👨‍👩‍👧 Church Families</b>\n<i>Total grouped families: ${families.length}</i>`, keyboard: rows });
  },

  "members:famview": async ({ bot, chatId, messageId, args }) => {
    const f = args[0];
    const members = await Member.find({ familyName: f, isDeleted: { $ne: true }, isActive: { $ne: false } }).sort({ name: 1 });
    const rows = members.map((m) => [{ text: m.name, callback_data: `members:open:${m._id}` }]);
    rows.push([{ text: "🔙 Back", callback_data: "members:family" }]);
    await renderScreen(bot, chatId, messageId, { text: `<b>👨‍👩‍👧 Family View</b>\n<i>${f}</i>`, keyboard: rows });
  },

  "members:trash": async ({ bot, chatId, messageId }) => {
    const members = await Member.find({ isDeleted: true }).sort({ name: 1 });
    if (!members.length) {
      return renderScreen(bot, chatId, messageId, {
        text: "🗃 Trash is empty",
        keyboard: [[{ text: "🔙 Back", callback_data: "members:list:0:active" }]]
      });
    }
    const rows = members.map((m) => [{ text: m.name, callback_data: `members:trashed:${m._id}` }]);
    rows.push([{ text: "🔙 Back", callback_data: "members:list:0:active" }]);
    await renderScreen(bot, chatId, messageId, { text: `<b>🗃 Trash Bin</b>\n<i>Deleted members: ${members.length}</i>`, keyboard: rows });
  },

  "members:trashed": async ({ bot, chatId, messageId, args }) => {
    const id = args[0];
    const m = await Member.findById(id);
    if (!m) return bot.sendMessage(chatId, "❌ Not found");
    await renderScreen(bot, chatId, messageId, {
      text: `<b>🗃 Trashed Record</b>\n<i>${m.name}</i>\n\n<blockquote>Do you want to restore this member to the active roster?</blockquote>`,
      keyboard: [
        [{ text: "♻️ Restore", callback_data: `members:restore:${id}` }],
        [{ text: "🔙 Back", callback_data: "members:trash" }]
      ]
    });
  },

  "members:restore": async ({ bot, chatId, messageId, args }) => {
    const m = await Member.findById(args[0]);
    if (m) {
      m.isDeleted = false;
      await m.save();
    }
    await renderScreen(bot, chatId, messageId, {
      text: `✅ Restored ${m ? m.name : "Member"}`,
      keyboard: [[{ text: "🔙 Back", callback_data: "members:trash" }]]
    });
  },

  "members:search": async ({ bot, chatId }) => {
    setState(chatId, { type: "members.search" });
    await bot.sendMessage(chatId, "Enter name:");
  },

  "members:open": async ({ bot, chatId, args }) => {
    await sendProfile(bot, chatId, args[0]);
  },

  "members:edit": async ({ bot, chatId, messageId, args }) => {
    await renderScreen(bot, chatId, messageId, editMenuScreen(args[0]));
  },

  /* Role picker — inline buttons, no free text */
  "members:rolePicker": async ({ bot, chatId, messageId, args }) => {
    await renderScreen(bot, chatId, messageId, rolePickerScreen(args[0]));
  },

  "members:setrole": async ({ bot, chatId, args }) => {
    const [id, role] = args;
    const m = await Member.findById(id);
    if (!m) return "❌ Not found";

    m.role = role || undefined;
    await m.save();
    await sendProfile(bot, chatId, id);
    return "✅ Role updated";
  },

  "members:editfield": async ({ bot, chatId, args }) => {
    const [id, field] = args;
    const prompts = {
      name:    "Send new name:",
      dob:     "Send DOB as YYYY-MM-DD, or /clear to remove:",
      wedding: "Send wedding date as YYYY-MM-DD, or /clear to remove:",
      family:  "Send Family Name (e.g., 'Kumar Family'), or /clear to remove:"
    };

    setState(chatId, { type: "members.editField", id, field });
    await bot.sendMessage(chatId, prompts[field]);
    return "✏️ Type in chat";
  },

  "members:toggle": async ({ bot, chatId, args }) => {
    const [id, field] = args;
    const m = await Member.findById(id);
    if (!m) return "❌ Not found";

    if (field === "child")  m.isChild  = !m.isChild;
    if (field === "pastor") m.isPastor = !m.isPastor;
    if (field === "active") m.isActive = m.isActive === false ? true : false;
    await m.save();

    await sendProfile(bot, chatId, id);
    return `✅ Toggled ${field}`;
  },

  "members:delete": async ({ bot, chatId, messageId, args }) => {
    const id = args[0];
    await renderScreen(bot, chatId, messageId, {
      text: "Remove this member?",
      keyboard: [[
        { text: "✅ Yes", callback_data: `members:delyes:${id}` },
        { text: "❌ No",  callback_data: `members:open:${id}` }
      ]]
    });
  },

  "members:delyes": async ({ bot, chatId, messageId, args }) => {
    await softDeleteMember(args[0]);
    await renderScreen(bot, chatId, messageId, await listScreen(0));
  },

  "members:link": async ({ bot, chatId, args }) => {
    const id = args[0];
    const others = await Member.find({ _id: { $ne: id }, isDeleted: { $ne: true } });
    const rows = others.map((m) => [{ text: m.name, callback_data: `members:linksel:${id}:${m._id}` }]);
    rows.push([{ text: "🔙 Back", callback_data: `members:open:${id}` }]);
    await bot.sendMessage(chatId, "Select spouse:", { reply_markup: { inline_keyboard: rows } });
  },

  "members:linksel": async ({ bot, chatId, args }) => {
    const [id, spouseId] = args;
    setState(chatId, { type: "members.linkWedding", id, spouseId });
    await bot.sendMessage(chatId, "Enter wedding date as YYYY-MM-DD, or /skip:");
  },

  "members:unlink": async ({ bot, chatId, messageId, args }) => {
    const id = args[0];
    await renderScreen(bot, chatId, messageId, {
      text: "Unlink spouse?",
      keyboard: [[
        { text: "✅ Yes", callback_data: `members:unlinkyes:${id}` },
        { text: "❌ No",  callback_data: `members:open:${id}` }
      ]]
    });
  },

  "members:unlinkyes": async ({ bot, chatId, args }) => {
    await unlinkSpouse(args[0]);
    await sendProfile(bot, chatId, args[0]);
  },

  "members:photo": async ({ bot, chatId, args }) => {
    setState(chatId, { type: "members.photo", memberId: args[0] });
    await bot.sendMessage(chatId, "Send photo:");
  },

  "members:photodel": async ({ bot, chatId, args }) => {
    const id = args[0];
    await Member.updateOne({ _id: id }, { $unset: { photo: "" } });
    await bot.sendMessage(chatId, "✅ Photo removed");
    await sendProfile(bot, chatId, id);
  },

  "addmember:start": async ({ bot, chatId }) => {
    setState(chatId, { type: "members.addName" });
    await bot.sendMessage(chatId, "<b>➕ Add New Member</b>\n\nPlease type the <b>Full Name</b> of the new member below:", { parse_mode: "HTML" });
  },

  "addmember:continue": async ({ bot, chatId }) => {
    const state = getState(chatId);
    if (!state?.draft) return;
    await askGender(bot, chatId);
  },

  "addmember:cancel": async ({ bot, chatId }) => {
    clearState(chatId);
    await bot.sendMessage(chatId, "❌ Cancelled");
  },

  "addmember:gender": async ({ bot, chatId, args }) => {
    const state = getState(chatId);
    if (!state?.draft) return;

    state.draft.gender = args[0];
    state.type = "members.addDob";
    setState(chatId, state);

    await bot.sendMessage(chatId, "Enter DOB as YYYY-MM-DD, or send /skip:");
  }
};

/* ================= TEXT-INPUT (STATE) ROUTES ================= */

export const membersStateHandlers = {
  "members.search": async ({ bot, chatId, text }) => {
    const rgx = new RegExp(text, "i");
    const members = await Member.find({
      $or: [
        { name: rgx },
        { role: rgx },
        { familyName: rgx }
      ],
      isDeleted: { $ne: true }
    });

    clearState(chatId);

    if (!members.length) return bot.sendMessage(chatId, "❌ No results");

    const rows = members.map((m) => [{ text: m.name, callback_data: `members:open:${m._id}` }]);
    await bot.sendMessage(chatId, "Results:", { reply_markup: { inline_keyboard: rows } });
  },

  "members.addName": async ({ bot, chatId, text }) => {
    const similar = await findSimilar(text);

    if (similar.length) {
      setState(chatId, { type: "members.addConfirm", draft: { name: text } });

      return bot.sendMessage(
        chatId,
        `⚠️ Similar member(s) already exist: ${similar.map((m) => m.name).join(", ")}\n\nContinue adding "${text}"?`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Continue", callback_data: "addmember:continue" },
              { text: "❌ Cancel",   callback_data: "addmember:cancel" }
            ]]
          }
        }
      );
    }

    setState(chatId, { type: "members.addGender", draft: { name: text } });
    await askGender(bot, chatId);
  },

  /* Guard: if user types text while on the duplicate-confirm screen, remind them to tap a button */
  "members.addConfirm": async ({ bot, chatId }) => {
    await bot.sendMessage(chatId, "Please tap ✅ Continue or ❌ Cancel above.");
  },

  "members.addDob": async ({ bot, chatId, text, state }) => {
    if (text === "/skip") return finishAddMember(bot, chatId, state.draft);

    if (!DOB_RE.test(text)) {
      return bot.sendMessage(chatId, "❌ Invalid format. Use YYYY-MM-DD or /skip:");
    }

    state.draft.dob = text;
    await finishAddMember(bot, chatId, state.draft);
  },

  "members.linkWedding": async ({ bot, chatId, text, state }) => {
    const weddingDate = text === "/skip" ? null : text;

    if (weddingDate && !DOB_RE.test(weddingDate)) {
      return bot.sendMessage(chatId, "❌ Invalid format. Use YYYY-MM-DD or /skip:");
    }

    try {
      await linkSpouses(state.id, state.spouseId, weddingDate);
      clearState(chatId);
      await bot.sendMessage(chatId, "💍 Linked");
      await sendProfile(bot, chatId, state.id);
    } catch (err) {
      clearState(chatId);
      await bot.sendMessage(chatId, `❌ Could not link: ${err.message}`);
    }
  },

  "members.editField": async ({ bot, chatId, text, state }) => {
    const { id, field } = state;
    const m = await Member.findById(id);

    if (!m) {
      clearState(chatId);
      return bot.sendMessage(chatId, "❌ Member not found");
    }

    try {
      if (field === "name") {
        if (!text || text === "/clear") {
          return bot.sendMessage(chatId, "❌ Name can't be empty. Send a new name:");
        }

        const oldName = m.name;
        m.name = text;
        await m.save();
        /* Keep spouse's spouseName in sync */
        await Member.updateMany({ spouseName: oldName }, { spouseName: text });

      } else if (field === "dob") {
        if (text === "/clear") {
          m.dob = undefined;
          m.birthday = undefined;
        } else {
          if (!DOB_RE.test(text)) return bot.sendMessage(chatId, "❌ Invalid format. Use YYYY-MM-DD or /clear:");
          m.dob = text;
          m.birthday = deriveMMDD(text);
        }
        await m.save();

      } else if (field === "wedding") {
        if (text === "/clear") {
          m.weddingDate = undefined;
          m.wedding = undefined;
          await m.save();
          /* Mirror clear to spouse */
          if (m.spouseName) {
            await Member.updateOne(
              { name: m.spouseName },
              { $unset: { weddingDate: "", wedding: "" } }
            );
          }
        } else {
          if (!DOB_RE.test(text)) return bot.sendMessage(chatId, "❌ Invalid format. Use YYYY-MM-DD or /clear:");
          const mmdd = deriveMMDD(text);
          m.weddingDate = text;
          m.wedding = mmdd;
          await m.save();
          /* Mirror new date to spouse */
          if (m.spouseName) {
            await Member.updateOne(
              { name: m.spouseName },
              { weddingDate: text, wedding: mmdd }
            );
          }
        }
      } else if (field === "family") {
        if (text === "/clear") {
          m.familyName = undefined;
          await m.save();
        } else {
          m.familyName = text;
          await m.save();
        }
      }

      clearState(chatId);
      await bot.sendMessage(chatId, `✅ Updated ${field}`);
      await sendProfile(bot, chatId, id);
    } catch (err) {
      clearState(chatId);
      const friendly = err.code === 11000 ? "a member with that name already exists" : err.message;
      await bot.sendMessage(chatId, `❌ Could not update: ${friendly}`);
    }
  }
};

export const handlePhotoUpload = async ({ bot, chatId, fileId, state }) => {
  await Member.updateOne({ _id: state.memberId }, { photo: fileId });
  clearState(chatId);
  await bot.sendMessage(chatId, "✅ Photo saved");
  await sendProfile(bot, chatId, state.memberId);
};

