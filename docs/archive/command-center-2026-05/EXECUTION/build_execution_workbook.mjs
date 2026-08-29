import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(repoRoot, "outputs", "execution");
const outputPath = `${outputDir}/TMMT_Three_Business_Command_Center.xlsx`;

const workbook = Workbook.create();

function writeSheet(name, rows, widths = []) {
  const sheet = workbook.worksheets.add(name);
  const rowCount = rows.length;
  const colCount = Math.max(...rows.map((row) => row.length));
  const range = sheet.getRangeByIndexes(0, 0, rowCount, colCount);
  range.values = rows.map((row) => {
    const padded = [...row];
    while (padded.length < colCount) padded.push("");
    return padded;
  });
  range.format = {
    font: { name: "Aptos", size: 11, color: "#111827" },
    verticalAlignment: "top",
    wrapText: true,
  };
  sheet.getRangeByIndexes(0, 0, 1, colCount).format = {
    fill: "#111827",
    font: { name: "Aptos", size: 12, color: "#FFFFFF", bold: true },
    verticalAlignment: "center",
    wrapText: true,
  };
  sheet.freezePanes.freezeRows(1);
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, rowCount, 1).format.columnWidthPx = width;
  });
  return sheet;
}

const dashboard = writeSheet(
  "Dashboard",
  [
    ["Metric", "Value", "What It Means", "Today"],
    ["Open Tasks", "", "Tasks not marked Done", "Pick 3 only"],
    ["Due Today", "", "Tasks dated today", "Do these first"],
    ["Hot Leads", "", "Leads marked Hot", "Follow up today"],
    ["This Month Income", "", "All income entered in Money Tracker", "Update daily"],
    ["This Month Expenses", "", "All expenses entered in Money Tracker", "Keep receipts"],
    ["Estimated Profit", "", "Income minus expenses", "Protect profit"],
    ["Content To Publish", "", "Content not posted yet", "Batch it"],
    ["", "", "", ""],
    ["Business", "Daily Focus", "First Action", "Done?"],
    ["TMMT Rentals", "Leads, fleet, payments", "Check follow-ups and maintenance", ""],
    ["Ecommerce", "Products, orders, content", "Pick one product to push", ""],
    ["Credit Education", "Leads, lessons, compliance", "Create one education asset", ""],
  ],
  [160, 120, 300, 220]
);

dashboard.getRange("B2:B8").formulas = [
  ['=COUNTIF(\'Task Board\'!F:F,"<>Done")-1'],
  [`=COUNTIFS('Task Board'!D:D,TODAY(),'Task Board'!F:F,"<>Done")`],
  [`=COUNTIF('Leads CRM'!D:D,"Hot")`],
  [`=SUMIFS('Money Tracker'!D:D,'Money Tracker'!A:A,">="&EOMONTH(TODAY(),-1)+1,'Money Tracker'!A:A,"<="&EOMONTH(TODAY(),0),'Money Tracker'!C:C,"Income")`],
  [`=SUMIFS('Money Tracker'!D:D,'Money Tracker'!A:A,">="&EOMONTH(TODAY(),-1)+1,'Money Tracker'!A:A,"<="&EOMONTH(TODAY(),0),'Money Tracker'!C:C,"Expense")`],
  ["=B5-B6"],
  [`=COUNTIF('Content Calendar'!F:F,"<>Posted")-1`],
];
dashboard.getRange("A10:D10").format = {
  fill: "#1F6F8B",
  font: { color: "#FFFFFF", bold: true },
  wrapText: true,
};
dashboard.getRange("B5:B7").format.numberFormat = '"$"#,##0.00';
dashboard.getRange("A1:D13").format.borders = { preset: "inside", style: "thin", color: "#D1D5DB" };
dashboard.getRange("A1:D13").format.borders = { preset: "outside", style: "thin", color: "#9CA3AF" };

const taskRows = [
  ["Business", "Priority", "Task", "Due Date", "Next Action", "Status", "Owner", "Notes"],
  ["TMMT Rentals", "High", "Follow up with all open rental leads", new Date("2026-05-16"), "Send saved follow-up message", "Not Started", "Me", ""],
  ["TMMT Rentals", "High", "Update maintenance and fleet trackers", new Date("2026-05-16"), "Review FLEET folder", "Not Started", "Me", ""],
  ["TMMT Rentals", "Medium", "Enter rental income and expenses", new Date("2026-05-16"), "Open Money Tracker", "Not Started", "Me", ""],
  ["Ecommerce", "High", "Choose 3 products or offers to focus on", new Date("2026-05-17"), "List product names and prices", "Not Started", "Me", ""],
  ["Ecommerce", "High", "Write 5 product descriptions", new Date("2026-05-18"), "Draft first description", "Not Started", "Me", ""],
  ["Ecommerce", "Medium", "Create 5 content posts", new Date("2026-05-19"), "Pick product photos or topics", "Not Started", "Me", ""],
  ["Credit Education", "High", "Create beginner credit education checklist", new Date("2026-05-17"), "Outline 7 checklist steps", "Not Started", "Me", "Educational only"],
  ["Credit Education", "High", "Create business funding readiness checklist", new Date("2026-05-18"), "List documents needed", "Not Started", "Me", "No approval promises"],
  ["Credit Education", "Medium", "Write lead follow-up script", new Date("2026-05-19"), "Draft friendly message", "Not Started", "Me", ""],
];
const taskBoard = writeSheet("Task Board", taskRows, [170, 95, 300, 120, 260, 120, 100, 220]);
taskBoard.getRange("D2:D200").format.numberFormat = "yyyy-mm-dd";
taskBoard.getRange("A1:H200").format.borders = { preset: "inside", style: "thin", color: "#E5E7EB" };
taskBoard.getRange("F2:F200").conditionalFormats.add("containsText", {
  text: "Done",
  format: { fill: "#DCFCE7", font: { color: "#166534", bold: true } },
});
taskBoard.getRange("B2:B200").conditionalFormats.add("containsText", {
  text: "High",
  format: { fill: "#FEE2E2", font: { color: "#991B1B", bold: true } },
});

const leads = writeSheet(
  "Leads CRM",
  [
    ["Date Added", "Business", "Lead Name", "Temperature", "Need", "Contact Info", "Last Follow Up", "Next Follow Up", "Status", "Notes"],
    [new Date("2026-05-16"), "TMMT Rentals", "", "Hot", "Rental inquiry", "", "", "", "New", ""],
    [new Date("2026-05-16"), "Ecommerce", "", "Warm", "Product question", "", "", "", "New", ""],
    [new Date("2026-05-16"), "Credit Education", "", "Warm", "Credit or funding education", "", "", "", "New", "Educational only"],
  ],
  [115, 155, 160, 115, 220, 190, 120, 120, 120, 260]
);
leads.getRange("A2:A200").format.numberFormat = "yyyy-mm-dd";
leads.getRange("G2:H200").format.numberFormat = "yyyy-mm-dd";
leads.getRange("A1:J200").format.borders = { preset: "inside", style: "thin", color: "#E5E7EB" };

const money = writeSheet(
  "Money Tracker",
  [
    ["Date", "Business", "Type", "Amount", "Category", "Description", "Payment Method", "Receipt Saved?", "Notes"],
    [new Date("2026-05-16"), "TMMT Rentals", "Income", 0, "Rental", "", "", "No", ""],
    [new Date("2026-05-16"), "Ecommerce", "Expense", 0, "Product / Ads", "", "", "No", ""],
    [new Date("2026-05-16"), "Credit Education", "Income", 0, "Education", "", "", "No", ""],
  ],
  [115, 155, 100, 110, 160, 260, 160, 130, 220]
);
money.getRange("A2:A500").format.numberFormat = "yyyy-mm-dd";
money.getRange("D2:D500").format.numberFormat = '"$"#,##0.00';
money.getRange("A1:I500").format.borders = { preset: "inside", style: "thin", color: "#E5E7EB" };
money.getRange("C2:C500").conditionalFormats.add("containsText", {
  text: "Income",
  format: { fill: "#DCFCE7", font: { color: "#166534", bold: true } },
});
money.getRange("C2:C500").conditionalFormats.add("containsText", {
  text: "Expense",
  format: { fill: "#FEE2E2", font: { color: "#991B1B", bold: true } },
});

const content = writeSheet(
  "Content Calendar",
  [
    ["Post Date", "Business", "Platform", "Topic", "Hook", "Status", "Asset Needed", "CTA", "Notes"],
    [new Date("2026-05-16"), "TMMT Rentals", "Instagram/TikTok", "Available rental or customer FAQ", "", "Idea", "Photo/video", "Message us", ""],
    [new Date("2026-05-17"), "Ecommerce", "Instagram/TikTok", "Product benefit post", "", "Idea", "Product photo", "Shop now", ""],
    [new Date("2026-05-18"), "Credit Education", "Instagram/TikTok", "Credit education tip", "", "Idea", "Simple graphic", "Get checklist", "Educational only"],
  ],
  [115, 155, 140, 250, 260, 110, 160, 150, 220]
);
content.getRange("A2:A300").format.numberFormat = "yyyy-mm-dd";
content.getRange("A1:I300").format.borders = { preset: "inside", style: "thin", color: "#E5E7EB" };
content.getRange("F2:F300").conditionalFormats.add("containsText", {
  text: "Posted",
  format: { fill: "#DCFCE7", font: { color: "#166534", bold: true } },
});

writeSheet(
  "Daily Schedule",
  [
    ["Time Block", "Business", "Mission", "Exact Next Action", "Done?"],
    ["9:00 - 10:30", "TMMT Rentals", "Leads, fleet, payments", "Open Leads CRM and Task Board", ""],
    ["10:30 - 12:00", "Ecommerce", "Products, orders, content", "Open Content Calendar and product tasks", ""],
    ["1:00 - 2:30", "Credit Education", "Lessons, leads, scripts", "Open Credit tasks and create one asset", ""],
    ["2:30 - 3:00", "All", "Messages and follow-ups", "Send replies and update statuses", ""],
    ["3:00 - 4:00", "All", "Money and cleanup", "Enter money, move tomorrow's tasks", ""],
  ],
  [130, 160, 250, 300, 90]
).getRange("A1:E20").format.borders = { preset: "inside", style: "thin", color: "#E5E7EB" };

const summary = await workbook.inspect({
  kind: "table",
  range: "Dashboard!A1:D13",
  include: "values,formulas",
  tableMaxRows: 20,
  tableMaxCols: 8,
});
console.log(summary.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

await workbook.render({ sheetName: "Dashboard", range: "A1:D13", scale: 2 });
await workbook.render({ sheetName: "Task Board", range: "A1:H10", scale: 2 });
await workbook.render({ sheetName: "Leads CRM", range: "A1:J4", scale: 2 });
await workbook.render({ sheetName: "Money Tracker", range: "A1:I4", scale: 2 });
await workbook.render({ sheetName: "Content Calendar", range: "A1:I4", scale: 2 });
await workbook.render({ sheetName: "Daily Schedule", range: "A1:E6", scale: 2 });

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
