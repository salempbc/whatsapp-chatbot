import fs from "fs";
import os from "os";
import path from "path";

export const exportMembersToCSV = async (members, label = "export") => {
  const headers = [
    "Name", "Gender", "Role", "IsActive", "IsChild", "IsPastor",
    "FamilyName", "DOB", "Birthday (MM-DD)",
    "Married", "Spouse", "WeddingDate", "Wedding (MM-DD)"
  ];

  const rows = members.map((m) => [
    m.name,
    m.gender,
    m.role || "",
    m.isActive === false ? "No" : "Yes",
    m.isChild  ? "Yes" : "No",
    m.isPastor ? "Yes" : "No",
    m.familyName || "",
    m.dob || "",
    m.birthday || "",
    m.isMarried ? "Yes" : "No",
    m.spouseName || "",
    m.weddingDate || "",
    m.wedding || ""
  ]);

  /* Escape quotes by doubling (the CSV standard) rather than swapping them for
     apostrophes, and neutralise leading =, +, -, @ so Excel/Sheets treat a name
     as text instead of a formula. */
  const cell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };

  const csv = [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

  const fileName = `members_${label}_${Date.now()}.csv`;
  const filePath = path.join(os.tmpdir(), fileName);
  fs.writeFileSync(filePath, "\uFEFF" + csv); // BOM for Excel UTF-8

  return filePath;
};
