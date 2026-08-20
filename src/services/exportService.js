import fs from "fs";
import path from "path";

export const exportMembersToCSV = async (members) => {
  const headers = [
    "Name",
    "Gender",
    "Role",
    "IsActive",
    "IsChild",
    "IsPastor",
    "DOB",
    "Birthday (MM-DD)",
    "Married",
    "Spouse",
    "WeddingDate",
    "Wedding (MM-DD)"
  ];

  const rows = members.map((m) => [
    m.name,
    m.gender,
    m.role || "",
    m.isActive === false ? "No" : "Yes",
    m.isChild  ? "Yes" : "No",
    m.isPastor ? "Yes" : "No",
    m.dob || "",
    m.birthday || "",
    m.isMarried ? "Yes" : "No",
    m.spouseName || "",
    m.weddingDate || "",
    m.wedding || ""
  ]);

  const csv =
    [headers, ...rows]
      .map((r) => r.map((v) => `"${v || ""}"`).join(","))
      .join("\n");

  const filePath = path.join(process.cwd(), "members_export.csv");
  fs.writeFileSync(filePath, csv);

  return filePath;
};