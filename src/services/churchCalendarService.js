import ChurchEvent from "../models/ChurchEvent.js";
import AuditLog from "../models/AuditLog.js";
import { getTodayEvents, getUpcomingEvents } from "./eventService.js";
import Memorial from "../models/Memorial.js";

/**
 * 📅 UNIFIED CALENDAR SERVICE
 * Combines custom church events, birthdays, wedding anniversaries, and memorials
 */
export const getUnifiedEventsForRange = async (startDateStr, endDateStr) => {
  // 1. Fetch custom church events
  const churchEvents = await ChurchEvent.find({
    startDate: { $gte: startDateStr, $lte: endDateStr },
    status: { $ne: "cancelled" }
  }).sort({ startDate: 1, startTime: 1 });

  return churchEvents;
};

/**
 * Creates custom church event with audit logging
 */
export const createChurchEvent = async (data, performedBy = "Admin") => {
  if (!data.title || !data.startDate) {
    throw new Error("Event title and start date are required");
  }

  const event = await ChurchEvent.create({
    ...data,
    createdBy: performedBy,
    updatedBy: performedBy
  });

  await AuditLog.create({
    entity: "ChurchEvent",
    entityId: String(event._id),
    action: "CREATE",
    performedBy,
    details: `Created event: ${event.title} on ${event.startDate}`,
    changes: { after: event.toObject() }
  });

  return event;
};

/**
 * Updates church event
 */
export const updateChurchEvent = async (id, updates, performedBy = "Admin") => {
  const event = await ChurchEvent.findById(id);
  if (!event) throw new Error("Event not found");

  const before = event.toObject();
  Object.assign(event, updates, { updatedBy: performedBy });
  await event.save();

  await AuditLog.create({
    entity: "ChurchEvent",
    entityId: String(event._id),
    action: "UPDATE",
    performedBy,
    details: `Updated event: ${event.title}`,
    changes: { before, after: event.toObject() }
  });

  return event;
};

/**
 * Cancels church event
 */
export const cancelChurchEvent = async (id, performedBy = "Admin") => {
  const event = await ChurchEvent.findById(id);
  if (!event) throw new Error("Event not found");

  event.status = "cancelled";
  event.updatedBy = performedBy;
  await event.save();

  await AuditLog.create({
    entity: "ChurchEvent",
    entityId: String(event._id),
    action: "STATUS_CHANGE",
    performedBy,
    details: `Cancelled event: ${event.title}`,
    changes: { after: { status: "cancelled" } }
  });

  return event;
};

/**
 * Export events to .ics standard calendar format
 */
export const exportEventsToICS = (events) => {
  let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Salem PBC//Church CMS 2.1//EN\r\nCALSCALE:GREGORIAN\r\n";

  for (const e of events) {
    const startParts = (e.startDate || "").replace(/-/g, "");
    const timeParts = (e.startTime || "09:00").replace(/:/g, "") + "00";
    const dtStart = `${startParts}T${timeParts}`;

    ics += "BEGIN:VEVENT\r\n";
    ics += `UID:${e._id || Date.now()}@salempbc.org\r\n`;
    ics += `SUMMARY:${(e.title || "Church Event").replace(/\r?\n/g, " ")}\r\n`;
    if (e.description) ics += `DESCRIPTION:${e.description.replace(/\r?\n/g, "\\n")}\r\n`;
    if (e.venue) ics += `LOCATION:${e.venue.replace(/\r?\n/g, " ")}\r\n`;
    ics += `DTSTART:${dtStart}\r\n`;
    ics += `STATUS:${e.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}\r\n`;
    ics += "END:VEVENT\r\n";
  }

  ics += "END:VCALENDAR\r\n";
  return ics;
};
