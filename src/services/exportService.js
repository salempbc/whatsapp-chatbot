import fs from "fs";
import path from "path";

export const exportMembersToCSV = async (members) => {
  const headers = [
    "Name",
    "Gender",
    "Role",
    "DOB",
    "Birthday",
    "Married",
    "Spouse",
    "Pastor"
  ];

  const rows = members.map((m) => [
    m.name,
    m.gender,
    m.role || "",
    m.dob || "",
    m.birthday || "",
    m.isMarried ? "Yes" : "No",
    m.spouseName || "",
    m.isPastor ? "Yes" : "No"
  ]);

  const csv =
    [headers, ...rows]
      .map((r) => r.map((v) => `"${v || ""}"`).join(","))
      .join("\n");

  const filePath = path.join(process.cwd(), "members_export.csv");
  fs.writeFileSync(filePath, csv);

  return filePath;
};