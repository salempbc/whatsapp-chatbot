import fs from "fs";
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

  const csv =
    [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v || "").replace(/"/g, "'")}"`).join(","))
      .join("\n");

  const fileName = `members_${label}_${Date.now()}.csv`;
  const filePath = path.join(process.cwd(), fileName);
  fs.writeFileSync(filePath, "\uFEFF" + csv); // BOM for Excel UTF-8

  return filePath;
};
