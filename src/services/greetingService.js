import Member from "../models/Member.js";
import GreetingLog, { GREETING_STATUS } from "../models/GreetingLog.js";
import { getTodayKey, getTomorrowKey, getTodayEvents } from "./eventService.js";
import { getCanonicalVerse, generateGreetingPrayer, formatGreetingCard } from "./aiService.js";

/**
 * Prepares and generates greeting records for today's celebrants idempotently.
 * Never broadcasts to groups. Persists state in GreetingLog.
 */
export const prepareTodayGreetings = async () => {
  const dateKey = getTodayKey();
  const year = new Date().getFullYear();
  const { birthdays, weddings } = await getTodayEvents();

  const prepared = [];

  // 1. Process birthdays
  for (const m of birthdays) {
    let log = await GreetingLog.findOne({
      dateKey,
      year,
      memberId: m._id,
      type: "birthday"
    });

    if (!log) {
      const verseObj = await getCanonicalVerse("birthday", m);
      const prayer = await generateGreetingPrayer({
        member: m,
        eventType: "birthday",
        style: "pastoral",
        verseText: verseObj.text,
        verseRef: verseObj.reference
      });
      const formatted = formatGreetingCard({
        eventType: "birthday",
        member: m,
        verseText: verseObj.text,
        verseRef: verseObj.reference,
        prayerText: prayer
      });

      log = await GreetingLog.create({
        dateKey,
        year,
        type: "birthday",
        memberId: m._id,
        memberName: m.name,
        spouseName: m.spouseName || "",
        status: GREETING_STATUS.READY_FOR_REVIEW,
        text: formatted,
        originalText: formatted,
        style: "pastoral",
        verseReference: verseObj.reference,
        verseText: verseObj.text,
        photo: m.photo || null
      });
    }

    prepared.push(log);
  }

  // 2. Process weddings (deduplicated per couple)
  for (const m of weddings) {
    let log = await GreetingLog.findOne({
      dateKey,
      year,
      memberId: m._id,
      type: "wedding"
    });

    if (!log) {
      const verseObj = await getCanonicalVerse("wedding", m);
      const prayer = await generateGreetingPrayer({
        member: m,
        eventType: "wedding",
        style: "pastoral",
        verseText: verseObj.text,
        verseRef: verseObj.reference
      });
      const formatted = formatGreetingCard({
        eventType: "wedding",
        member: m,
        verseText: verseObj.text,
        verseRef: verseObj.reference,
        prayerText: prayer
      });

      log = await GreetingLog.create({
        dateKey,
        year,
        type: "wedding",
        memberId: m._id,
        memberName: m.name,
        spouseName: m.spouseName || "",
        status: GREETING_STATUS.READY_FOR_REVIEW,
        text: formatted,
        originalText: formatted,
        style: "pastoral",
        verseReference: verseObj.reference,
        verseText: verseObj.text,
        photo: m.photo || null
      });
    }

    prepared.push(log);
  }

  return prepared;
};

/**
 * Regenerate greeting with new style or newly selected verse
 */
export const regenerateGreeting = async (logId, { style, verseReference, verseText } = {}) => {
  const log = await GreetingLog.findById(logId);
  if (!log) throw new Error("Greeting record not found");

  const member = await Member.findById(log.memberId);
  const targetStyle = style || log.style || "pastoral";
  const targetRef = verseReference || log.verseReference;
  const targetVerse = verseText || log.verseText;

  const prayer = await generateGreetingPrayer({
    member: member || { name: log.memberName, spouseName: log.spouseName },
    eventType: log.type,
    style: targetStyle,
    verseText: targetVerse,
    verseRef: targetRef
  });

  const formatted = formatGreetingCard({
    eventType: log.type,
    member: member || { name: log.memberName, spouseName: log.spouseName },
    verseText: targetVerse,
    verseRef: targetRef,
    prayerText: prayer
  });

  log.style = targetStyle;
  log.verseReference = targetRef;
  log.verseText = targetVerse;
  log.text = formatted;
  log.status = GREETING_STATUS.READY_FOR_REVIEW;
  await log.save();

  return log;
};

/**
 * Mark a greeting as manually shared to WhatsApp
 */
export const markGreetingAsShared = async (logId) => {
  const log = await GreetingLog.findById(logId);
  if (!log) throw new Error("Greeting not found");

  log.status = GREETING_STATUS.MARKED_AS_SHARED;
  log.sharedAt = new Date();
  await log.save();
  return log;
};

/**
 * Skip a greeting for today
 */
export const skipGreeting = async (logId) => {
  const log = await GreetingLog.findById(logId);
  if (!log) throw new Error("Greeting not found");

  log.status = GREETING_STATUS.SKIPPED;
  await log.save();
  return log;
};

/**
 * Update edited text for a greeting
 */
export const updateGreetingText = async (logId, newText) => {
  const log = await GreetingLog.findById(logId);
  if (!log) throw new Error("Greeting not found");

  log.text = newText;
  log.status = GREETING_STATUS.EDITED;
  await log.save();
  return log;
};
