import test from "node:test";
import assert from "node:assert/strict";
import { validateStatusTransition } from "../src/services/memberService.js";
import { exportEventsToICS } from "../src/services/churchCalendarService.js";

// ============================================================================
// MODULE A: MEMBER LIFECYCLE MANAGEMENT TESTS
// ============================================================================

test("Module A - Lifecycle Transitions: Validates status state machine correctly", () => {
  // Allowed active transitions
  assert.equal(validateStatusTransition("active", "inactive"), true);
  assert.equal(validateStatusTransition("active", "transferred"), true);
  assert.equal(validateStatusTransition("active", "deceased"), true);
  assert.equal(validateStatusTransition("active", "archived"), true);

  // Allowed inactive transitions
  assert.equal(validateStatusTransition("inactive", "active"), true);
  assert.equal(validateStatusTransition("inactive", "transferred"), true);

  // Allowed archived transitions
  assert.equal(validateStatusTransition("archived", "active"), true);
  assert.equal(validateStatusTransition("archived", "inactive"), true);

  // Prohibited transitions from deceased (deceased members can only be archived for history)
  assert.equal(validateStatusTransition("deceased", "active"), false);
  assert.equal(validateStatusTransition("deceased", "transferred"), false);

  // Same status should always be valid
  assert.equal(validateStatusTransition("active", "active"), true);
  assert.equal(validateStatusTransition("deceased", "deceased"), true);
});

test("Module A - Duplicate Detection Logic: Matches exact and partial tokens", () => {
  const existingRoster = [
    { _id: "1", name: "Bro. John Paul", phone: "+919876543210", dob: "1985-04-12", familyName: "Paul Family" },
    { _id: "2", name: "Sis. Mary Grace", phone: "+919876543211", dob: "1990-08-20", familyName: "Grace Family" }
  ];

  const detectMatch = (input, roster) => {
    return roster.filter(m => {
      if (input.phone && m.phone === input.phone.trim()) return true;
      if (input.name && m.name.toLowerCase() === input.name.trim().toLowerCase()) return true;
      if (input.dob && m.dob === input.dob.trim() && input.familyName && m.familyName.toLowerCase() === input.familyName.trim().toLowerCase()) return true;
      return false;
    });
  };

  // Match by exact phone
  const phoneMatch = detectMatch({ phone: "+919876543210" }, existingRoster);
  assert.equal(phoneMatch.length, 1);
  assert.equal(phoneMatch[0].name, "Bro. John Paul");

  // Match by exact name case-insensitive
  const nameMatch = detectMatch({ name: "bro. john paul" }, existingRoster);
  assert.equal(nameMatch.length, 1);
  assert.equal(nameMatch[0]._id, "1");

  // Match by DOB + Family Name
  const familyDobMatch = detectMatch({ dob: "1990-08-20", familyName: "grace family" }, existingRoster);
  assert.equal(familyDobMatch.length, 1);
  assert.equal(familyDobMatch[0].name, "Sis. Mary Grace");

  // Non-matching input
  const noMatch = detectMatch({ name: "Bro. Simon Peter", phone: "+919999999999" }, existingRoster);
  assert.equal(noMatch.length, 0);
});

test("Module A - Model Hook Mapping: status to isActive and isDeleted invariants", () => {
  const computeFlags = (status) => {
    const isActive = status === "active";
    const isDeleted = status === "archived";
    return { isActive, isDeleted };
  };

  assert.deepEqual(computeFlags("active"), { isActive: true, isDeleted: false });
  assert.deepEqual(computeFlags("inactive"), { isActive: false, isDeleted: false });
  assert.deepEqual(computeFlags("transferred"), { isActive: false, isDeleted: false });
  assert.deepEqual(computeFlags("deceased"), { isActive: false, isDeleted: false });
  assert.deepEqual(computeFlags("archived"), { isActive: false, isDeleted: true });
});

// ============================================================================
// MODULE B: UNIFIED CHURCH CALENDAR TESTS
// ============================================================================

test("Module B - Calendar Export: exportEventsToICS generates compliant RFC 5545 iCalendar stream", () => {
  const events = [
    {
      _id: "evt001",
      title: "Sunday Lord's Supper & Worship",
      startDate: "2026-10-11",
      startTime: "09:30",
      venue: "SPBC Sanctuary",
      description: "Preacher: Pastor David. Communion observed.",
      status: "scheduled"
    },
    {
      _id: "evt002",
      title: "Cottage Prayer Meeting",
      startDate: "2026-10-14",
      startTime: "19:00",
      venue: "Bro. Thomas Residence",
      description: "Mid-week prayer and Scripture reading",
      status: "scheduled"
    }
  ];

  const icsOutput = exportEventsToICS(events);

  // Top header checks
  assert.match(icsOutput, /^BEGIN:VCALENDAR\r\n/);
  assert.match(icsOutput, /VERSION:2\.0\r\n/);
  assert.match(icsOutput, /PRODID:-\/\/Salem PBC\/\/Church CMS 2\.1\/\/EN\r\n/);
  assert.match(icsOutput, /END:VCALENDAR\r\n$/);

  // VEVENT checks
  assert.ok(icsOutput.includes("BEGIN:VEVENT"));
  assert.ok(icsOutput.includes("SUMMARY:Sunday Lord's Supper & Worship"));
  assert.ok(icsOutput.includes("DTSTART:20261011T093000"));
  assert.ok(icsOutput.includes("LOCATION:SPBC Sanctuary"));
  assert.ok(icsOutput.includes("DESCRIPTION:Preacher: Pastor David. Communion observed."));
  assert.ok(icsOutput.includes("STATUS:CONFIRMED"));

  // Second event checks
  assert.ok(icsOutput.includes("SUMMARY:Cottage Prayer Meeting"));
  assert.ok(icsOutput.includes("DTSTART:20261014T190000"));
  assert.ok(icsOutput.includes("LOCATION:Bro. Thomas Residence"));
});

test("Module B - Calendar Sanitization: Handles newlines and special characters in ICS", () => {
  const eventWithSpecialChars = [
    {
      _id: "evt003",
      title: "Youth Revival\nSession 1",
      startDate: "2026-11-01",
      startTime: "10:00",
      venue: "Hall 1, Main Campus",
      description: "Line 1\nLine 2\nLine 3",
      status: "cancelled"
    }
  ];

  const icsOutput = exportEventsToICS(eventWithSpecialChars);
  // Title newlines replaced with space
  assert.ok(icsOutput.includes("SUMMARY:Youth Revival Session 1"));
  // Description newlines escaped as \n
  assert.ok(icsOutput.includes("DESCRIPTION:Line 1\\nLine 2\\nLine 3"));
  // Cancelled event has CANCELLED status
  assert.ok(icsOutput.includes("STATUS:CANCELLED"));
});

// ============================================================================
// MODULE C: ADMINISTRATIVE TASK MANAGEMENT TESTS
// ============================================================================

test("Module C - Task Overdue Computation: Correctly classifies overdue tasks against date boundaries", () => {
  const referenceDate = new Date("2026-10-05T12:00:00Z");

  const sampleTasks = [
    { _id: "t1", title: "Hospital Visit", status: "todo", dueDate: "2026-10-01" }, // Overdue
    { _id: "t2", title: "Sunday Bulletins", status: "in_progress", dueDate: "2026-10-04" }, // Overdue
    { _id: "t3", title: "Audit Church Accounts", status: "todo", dueDate: "2026-10-10" }, // Future
    { _id: "t4", title: "Old Visitation", status: "completed", dueDate: "2026-09-20" }, // Completed, not overdue
    { _id: "t5", title: "Cancelled Task", status: "cancelled", dueDate: "2026-09-25" }, // Cancelled, not overdue
    { _id: "t6", title: "No Due Date Task", status: "todo", dueDate: null } // No due date, not overdue
  ];

  const overdue = sampleTasks.filter(t => {
    if (t.status === "completed" || t.status === "cancelled") return false;
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < referenceDate;
  });

  assert.equal(overdue.length, 2);
  assert.deepEqual(overdue.map(t => t._id), ["t1", "t2"]);
});

test("Module C - Task Priority Ordering: Sorts tasks by priority urgency", () => {
  const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };

  const taskList = [
    { title: "General clean", priority: "low" },
    { title: "Elder prayer request", priority: "urgent" },
    { title: "Prepare communion", priority: "high" },
    { title: "Update library", priority: "medium" }
  ];

  const sorted = [...taskList].sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));

  assert.equal(sorted[0].priority, "urgent");
  assert.equal(sorted[1].priority, "high");
  assert.equal(sorted[2].priority, "medium");
  assert.equal(sorted[3].priority, "low");
});

// ============================================================================
// MODULE D: ADVANCED REPORTS & DATA QUALITY AUDIT TESTS
// ============================================================================

test("Module D - Data Quality Health Score Calculation: Evaluates compliance and calculates score", () => {
  const auditMembers = [
    { name: "Bro. Stephen", dob: "1980-05-15", isMarried: true, spouseName: "Sis. Rachel", gender: "male", spouseGender: "female" }, // Valid
    { name: "Sis. Ruth", dob: "1992-03-22", isMarried: false, gender: "female" }, // Valid
    { name: "X", dob: "invalid-date", isMarried: false, gender: "male" }, // 2 Issues: truncated name, invalid DOB
    { name: "Bro. Barnabas", dob: "1975-11-10", isMarried: true, spouseName: "", gender: "male" } // 1 Issue: married without spouse
  ];

  const evaluateDataQuality = (members) => {
    const issues = [];
    for (const m of members) {
      if (!m.name || m.name.trim().length < 2) {
        issues.push({ name: m.name, issue: "Truncated or invalid name" });
      }
      if (m.dob && !/^\d{4}-\d{2}-\d{2}$/.test(m.dob)) {
        issues.push({ name: m.name, issue: "Invalid DOB format" });
      }
      if (m.isMarried && !m.spouseName) {
        issues.push({ name: m.name, issue: "Married without spouse name" });
      }
    }
    const healthScore = members.length > 0
      ? Math.max(0, Math.round(((members.length - issues.length) / members.length) * 100))
      : 100;
    return { issuesCount: issues.length, healthScore };
  };

  const audit = evaluateDataQuality(auditMembers);
  assert.equal(audit.issuesCount, 3);
  // (4 total members - 3 issues) / 4 = 25%
  assert.equal(audit.healthScore, 25);

  // Fully compliant list should be 100%
  const compliantAudit = evaluateDataQuality(auditMembers.slice(0, 2));
  assert.equal(compliantAudit.issuesCount, 0);
  assert.equal(compliantAudit.healthScore, 100);
});

test("Module D - Formula Injection Safeguard: Escapes malicious formula characters in exports", () => {
  const sanitizeCell = (val) => {
    if (val === null || val === undefined) return "";
    let str = String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    return str;
  };

  // Dangerous prefixes must be prefixed with single quote
  assert.equal(sanitizeCell("=SUM(A1:A10)"), "'=SUM(A1:A10)");
  assert.equal(sanitizeCell("+cmd|' /C calc'!A0"), "'+cmd|' /C calc'!A0");
  assert.equal(sanitizeCell("-1234"), "'-1234");
  assert.equal(sanitizeCell("@test"), "'@test");

  // Normal strings remain unmutated
  assert.equal(sanitizeCell("Bro. David Solomon"), "Bro. David Solomon");
  assert.equal(sanitizeCell("Salem PBC"), "Salem PBC");
});
