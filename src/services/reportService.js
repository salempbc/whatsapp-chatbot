import Member from "../models/Member.js";
import ChurchEvent from "../models/ChurchEvent.js";
import Task from "../models/Task.js";
import GreetingLog from "../models/GreetingLog.js";

/**
 * 📊 ADVANCED REPORTING & ANALYTICS SERVICE
 */
export const getChurchStatistics = async () => {
  const allMembers = await Member.find();
  const totalRecords = allMembers.length;
  const activeMembers = allMembers.filter(m => m.status === "active" && !m.isDeleted);
  const inactiveMembers = allMembers.filter(m => m.status === "inactive" && !m.isDeleted);
  const transferredMembers = allMembers.filter(m => m.status === "transferred" && !m.isDeleted);
  const deceasedMembers = allMembers.filter(m => m.status === "deceased");
  const archivedMembers = allMembers.filter(m => m.status === "archived" || m.isDeleted);

  // Demographic breakdowns
  const maleCount = activeMembers.filter(m => m.gender === "male").length;
  const femaleCount = activeMembers.filter(m => m.gender === "female").length;
  const marriedCount = activeMembers.filter(m => m.isMarried).length;
  const childrenCount = activeMembers.filter(m => m.isChild).length;

  // Family counting without duplicates
  const familyNames = new Set(activeMembers.map(m => m.familyName?.trim()).filter(Boolean));

  // Role distribution
  const roles = {};
  for (const m of activeMembers) {
    const r = m.role || "Member";
    roles[r] = (roles[r] || 0) + 1;
  }

  // Ministries
  const ministries = {};
  for (const m of activeMembers) {
    if (m.ministry) {
      ministries[m.ministry] = (ministries[m.ministry] || 0) + 1;
    }
  }

  // Tasks analytics
  const allTasks = await Task.find();
  const openTasks = allTasks.filter(t => ["todo", "in_progress", "waiting"].includes(t.status));
  const completedTasks = allTasks.filter(t => t.status === "completed");
  const cancelledTasks = allTasks.filter(t => t.status === "cancelled");

  const todayStr = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
    .toISOString()
    .slice(0, 10);
  const overdueTasks = openTasks.filter(t => t.dueDate && t.dueDate < todayStr);

  // Events analytics
  const allEvents = await ChurchEvent.find();
  const upcomingEvents = allEvents.filter(e => e.status !== "cancelled" && e.startDate >= todayStr);

  // Greetings analytics
  const currentYear = new Date().getFullYear();
  const greetings = await GreetingLog.find({ year: currentYear });
  const greetingsShared = greetings.filter(g => g.status === "MARKED_AS_SHARED").length;
  const greetingsEdited = greetings.filter(g => g.status === "EDITED").length;
  const greetingsSkipped = greetings.filter(g => g.status === "SKIPPED").length;

  const membership = {
    totalRecords,
    activeCount: activeMembers.length,
    inactiveCount: inactiveMembers.length,
    transferredCount: transferredMembers.length,
    deceasedCount: deceasedMembers.length,
    archivedCount: archivedMembers.length,
    familiesCount: familyNames.size,
    gender: { male: maleCount, female: femaleCount },
    marriedCount,
    childrenCount,
    roles,
    ministries
  };

  return {
    membership,
    members: membership, // WebApp compatibility alias
    tasks: {
      total: allTasks.length,
      open: openTasks.length,
      completed: completedTasks.length,
      cancelled: cancelledTasks.length,
      overdue: overdueTasks.length,
      completionRate: allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0
    },
    events: {
      total: allEvents.length,
      upcoming: upcomingEvents.length
    },
    greetings: {
      totalPrepared: greetings.length,
      sharedCount: greetingsShared,
      editedCount: greetingsEdited,
      skippedCount: greetingsSkipped
    }
  };
};

/**
 * 🛡️ DATA QUALITY AUDIT REPORT
 */
export const getDataQualityReport = async () => {
  const members = await Member.find({ isDeleted: { $ne: true } });
  const issues = [];

  for (const m of members) {
    if (!m.name || m.name.trim().length < 2) {
      issues.push({ id: m._id, memberName: m.name || "Unknown", severity: "HIGH", issue: "Missing or truncated name" });
    }
    if (m.dob && !/^\d{4}-\d{2}-\d{2}$/.test(m.dob)) {
      issues.push({ id: m._id, memberName: m.name, severity: "MEDIUM", issue: `Invalid DOB format (${m.dob})` });
    }
    if (m.weddingDate && !/^\d{4}-\d{2}-\d{2}$/.test(m.weddingDate)) {
      issues.push({ id: m._id, memberName: m.name, severity: "MEDIUM", issue: `Invalid wedding date format (${m.weddingDate})` });
    }
    if (m.isMarried && !m.spouseName) {
      issues.push({ id: m._id, memberName: m.name, severity: "HIGH", issue: "Marked as married but missing spouse name" });
    }
    if (m.isMarried && m.spouseGender && m.gender === m.spouseGender) {
      issues.push({ id: m._id, memberName: m.name, severity: "CRITICAL", issue: "Inconsistent marital gender pairing" });
    }
  }

  const inconsistencies = issues.map(i => ({
    id: i.id,
    name: i.memberName,
    memberName: i.memberName,
    type: i.severity,
    severity: i.severity,
    issue: i.issue
  }));

  return {
    totalChecked: members.length,
    issuesFound: issues.length,
    healthScore: members.length > 0 ? Math.max(0, Math.round(((members.length - issues.length) / members.length) * 100)) : 100,
    issues,
    inconsistencies // WebApp compatibility alias
  };
};
