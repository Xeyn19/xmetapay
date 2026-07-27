import "server-only";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { getTuitionCollectionRows } from "@/lib/admin/tuition-collections";
import { getAdminSchoolContext, getResolvedAdminSchoolViewSetup } from "@/lib/school/setup";

export const reportExportTypes = [
  "monthly-revenue",
  "collections",
  "outstanding-balances",
  "wallet-store",
] as const;

export type ReportExportType = (typeof reportExportTypes)[number];

type CsvColumn<T> = {
  label: string;
  value: (row: T) => string | number | null | undefined;
};

export type ReportExportFormat = "csv" | "xlsx" | "pdf";

export type AdminReportField = {
  label: string;
  value: string | number;
};

export type AdminReportExportData = {
  title: string;
  filenameBase: string;
  contextLines: string[];
  context: AdminReportField[];
  summary: AdminReportField[];
  columns: string[];
  rows: string[][];
};

export function isReportExportType(value: string | null): value is ReportExportType {
  return reportExportTypes.includes(value as ReportExportType);
}

export function isReportExportFormat(value: string | null): value is ReportExportFormat {
  return value === "csv" || value === "xlsx" || value === "pdf";
}

export async function getAdminReportExport(adminUserId: number, type: ReportExportType) {
  const report = await getAdminReportExportData(adminUserId, type);

  return {
    filename: `${report.filenameBase}.csv`,
    csv: toCsv(report),
  };
}

export async function getAdminReportExportData(adminUserId: number, type: ReportExportType): Promise<AdminReportExportData> {
  const [setup, schoolContext] = await Promise.all([
    getResolvedAdminSchoolViewSetup(adminUserId),
    getAdminSchoolContext(adminUserId),
  ]);

  if (!setup.schoolId || !setup.schoolYearId) {
    return {
      title: reportTitle(type),
      filenameBase: `xmetapay-${type}`,
      contextLines: ["School setup incomplete"],
      context: [{ label: "School", value: "School setup incomplete" }],
      summary: [{ label: "Records", value: 1 }],
      columns: ["Message"],
      rows: [[setup.warning ?? "School setup is incomplete."]],
    };
  }

  const contextLines = [
    `School: ${schoolContext.schoolName}`,
    setup.schoolYearName ? `School year: ${setup.schoolYearName}` : "School year: Active year",
  ];

  if (type === "monthly-revenue") {
    return monthlyRevenueExport(setup.schoolId, setup.schoolYearId, contextLines);
  }

  if (type === "collections") {
    return collectionsExport(setup.schoolId, setup.schoolYearId, contextLines);
  }

  if (type === "outstanding-balances") {
    return outstandingBalancesExport(setup.schoolId, setup.schoolYearId, contextLines);
  }

  return walletStoreExport(setup.schoolId, setup.schoolYearId, contextLines);
}

export async function getAdminReportPdf(report: AdminReportExportData) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  renderPdfReport(doc, report, await loadServerBrandLogo());

  return Buffer.from(doc.output("arraybuffer"));
}

export async function getAdminReportExcel(report: AdminReportExportData) {
  const ExcelJS = await import("exceljs");
  const Workbook = ExcelJS.Workbook ?? ExcelJS.default.Workbook;
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet(cleanWorksheetName(report.title), {
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    properties: { defaultRowHeight: 18 },
  });
  const dataColumnCount = Math.max(report.columns.length, 1);
  const columnCount = Math.max(dataColumnCount, 2);
  const lastColumn = worksheet.getColumn(columnCount).letter;
  const logo = await loadServerBrandLogo();

  workbook.creator = "XMETA Pay";
  workbook.company = "XMETA Pay";
  workbook.title = cleanSpreadsheetText(report.title);
  workbook.created = new Date();

  worksheet.mergeCells(`B1:${lastColumn}1`);
  worksheet.mergeCells(`B2:${lastColumn}2`);
  worksheet.getRow(1).height = 24;
  worksheet.getRow(2).height = 22;
  worksheet.getCell("B1").value = "XMETA Pay";
  worksheet.getCell("B1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF0F1117" } };
  worksheet.getCell("B2").value = cleanSpreadsheetText(report.title);
  worksheet.getCell("B2").font = { name: "Arial", size: 12, bold: true, color: { argb: "FFE64A19" } };

  if (logo) {
    const logoId = workbook.addImage({ base64: logo, extension: "jpeg" });
    worksheet.addImage(logoId, { tl: { col: 0.1, row: 0.1 }, ext: { width: 42, height: 42 } });
  } else {
    worksheet.getCell("A1").value = "X";
    worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE64A19" } };
  }

  let cursor = 4;
  cursor = addWorkbookMetadata(worksheet, cursor, columnCount, [
    ...report.context,
    { label: "Generated", value: new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) },
    { label: "Records", value: report.rows.length },
  ]);
  if (report.summary.length > 0) {
    cursor += 1;
    cursor = addWorkbookSummary(worksheet, cursor, columnCount, report.summary);
  }

  const headerRowNumber = cursor + 1;
  const headerRow = worksheet.getRow(headerRowNumber);
  report.columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = cleanSpreadsheetText(column);
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE64A19" } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = workbookBorder("FFF1C3B5");
  });
  headerRow.height = 24;

  const bodyRows = report.rows.length > 0 ? report.rows : [["No records yet"]];
  bodyRows.forEach((row, rowIndex) => {
    const dataRow = worksheet.getRow(headerRowNumber + rowIndex + 1);
    report.columns.forEach((_, columnIndex) => {
      const cell = dataRow.getCell(columnIndex + 1);
      cell.value = cleanSpreadsheetText(row[columnIndex] ?? "");
      cell.numFmt = "@";
      cell.font = { name: "Arial", size: 9, color: { argb: "FF2D3348" } };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = workbookBorder("FFE5E7EB");
      if (rowIndex % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F8F7" } };
      }
    });
  });

  report.columns.forEach((column, index) => {
    const values = report.rows.map((row) => cleanSpreadsheetText(row[index] ?? ""));
    const contentWidth = Math.max(cleanSpreadsheetText(column).length, ...values.map((value) => value.length));
    worksheet.getColumn(index + 1).width = Math.min(Math.max(contentWidth + 2, 12), 36);
  });
  worksheet.views = [{ state: "frozen", ySplit: headerRowNumber, activeCell: `A${headerRowNumber + 1}` }];
  worksheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: dataColumnCount },
  };
  worksheet.headerFooter.oddFooter = "&LXMETA Pay&RPage &P of &N";

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function monthlyRevenueExport(schoolId: number, schoolYearId: number, contextLines: string[]): Promise<AdminReportExportData> {
  const [rows] = await pool.execute<MonthlyRevenueExportRow[]>(
    `SELECT DATE_FORMAT(COALESCE(p.paid_at, p.created_at), '%Y-%m') AS month,
       COUNT(*) AS paid_payment_count,
       COALESCE(SUM(p.amount), 0) AS paid_amount
     FROM payments p
     WHERE p.school_id = :schoolId AND p.status = 'paid'
       AND (
         p.school_year_id = :schoolYearId
         OR
         EXISTS (
           SELECT 1
           FROM payment_allocations pa
           JOIN student_fee_assignments paid_sfa ON paid_sfa.id = pa.student_fee_assignment_id
           WHERE pa.payment_id = p.id AND paid_sfa.school_year_id = :schoolYearId
         )
         OR EXISTS (
           SELECT 1
           FROM payment_term_allocations pta
           JOIN tuition_payment_terms tpt ON tpt.id = pta.tuition_payment_term_id
           JOIN student_fee_assignments term_sfa ON term_sfa.id = tpt.student_fee_assignment_id
           WHERE pta.payment_id = p.id AND term_sfa.school_year_id = :schoolYearId
         )
         OR EXISTS (
           SELECT 1
           FROM wallet_transactions wt
           JOIN wallets w ON w.id = wt.wallet_id
           JOIN enrollments e ON e.student_id = w.student_id AND e.school_year_id = :schoolYearId
           WHERE wt.payment_id = p.id
         )
       )
     GROUP BY DATE_FORMAT(COALESCE(p.paid_at, p.created_at), '%Y-%m')
     ORDER BY month ASC`,
    { schoolId, schoolYearId },
  );

  return reportData(
    "Monthly revenue",
    "xmetapay-monthly-revenue",
    contextLines,
    rows,
    [
      { label: "Month", value: (row) => row.month },
      { label: "Paid payment count", value: (row) => row.paid_payment_count },
      { label: "Paid amount", value: (row) => decimal(row.paid_amount) },
    ],
  );
}

async function collectionsExport(schoolId: number, schoolYearId: number, contextLines: string[]): Promise<AdminReportExportData> {
  const rows = await getTuitionCollectionRows(schoolId, schoolYearId);

  return reportData(
    "Tuition collections report",
    "xmetapay-collections",
    contextLines,
    rows,
    [
      { label: "Reference", value: (row) => row.reference_number },
      { label: "Student", value: (row) => fullName(row.first_name, row.middle_name, row.last_name) },
      { label: "Grade", value: (row) => row.grade_name ?? "Not enrolled" },
      { label: "Tuition record", value: (row) => row.fee_name },
      { label: "Channel", value: (row) => label(row.channel) },
      { label: "Status", value: (row) => label(row.status) },
      { label: "Amount", value: (row) => decimal(row.amount) },
      { label: "Paid or created date", value: (row) => formatDateTime(row.paid_at ?? row.created_at) },
    ],
  );
}

async function outstandingBalancesExport(
  schoolId: number,
  schoolYearId: number,
  contextLines: string[],
): Promise<AdminReportExportData> {
  const [rows] = await pool.execute<OutstandingBalancesExportRow[]>(
    `SELECT sfa.amount_due, sfa.amount_paid, sfa.due_date, sfa.status,
       ft.name AS fee_name, ft.category,
       st.student_reference, st.first_name, st.middle_name, st.last_name,
       COALESCE(gl.name, 'Not enrolled') AS grade_name,
       COALESCE(sec.name, '-') AS section_name
     FROM student_fee_assignments sfa
     JOIN fee_types ft ON ft.id = sfa.fee_type_id
     JOIN students st ON st.id = sfa.student_id
     LEFT JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = sfa.school_year_id
     LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
     LEFT JOIN sections sec ON sec.id = e.section_id
     WHERE ft.school_id = :schoolId AND sfa.school_year_id = :schoolYearId
     ORDER BY st.last_name ASC, st.first_name ASC, ft.name ASC, sfa.id ASC`,
    { schoolId, schoolYearId },
  );

  return reportData(
    "Outstanding balances",
    "xmetapay-outstanding-balances",
    contextLines,
    rows,
    [
      { label: "Student reference", value: (row) => row.student_reference },
      { label: "Student", value: (row) => fullName(row.first_name, row.middle_name, row.last_name) },
      { label: "Grade", value: (row) => row.grade_name },
      { label: "Section", value: (row) => row.section_name },
      { label: "Fee", value: (row) => row.fee_name },
      { label: "Category", value: (row) => label(row.category) },
      { label: "Amount due", value: (row) => decimal(row.amount_due) },
      { label: "Amount paid", value: (row) => decimal(row.amount_paid) },
      { label: "Balance", value: (row) => decimal(Number(row.amount_due) - Number(row.amount_paid)) },
      { label: "Due date", value: (row) => formatDate(row.due_date) },
      { label: "Status", value: (row) => label(row.status) },
    ],
  );
}

async function walletStoreExport(schoolId: number, schoolYearId: number, contextLines: string[]): Promise<AdminReportExportData> {
  const [rows] = await pool.execute<WalletStoreExportRow[]>(
    `SELECT wt.type, wt.amount, wt.balance_after, wt.description, wt.created_at,
       p.reference_number AS payment_reference, p.channel, p.status AS payment_status,
       stx.reference_number AS store_reference,
       sm.name AS merchant_name,
       st.student_reference, st.first_name, st.middle_name, st.last_name,
       COALESCE(gl.name, 'Not enrolled') AS grade_name,
       COALESCE(sec.name, '-') AS section_name
     FROM wallet_transactions wt
     JOIN wallets w ON w.id = wt.wallet_id
     JOIN students st ON st.id = w.student_id
     LEFT JOIN payments p ON p.id = wt.payment_id
     LEFT JOIN store_transactions stx ON stx.wallet_transaction_id = wt.id
     LEFT JOIN store_merchants sm ON sm.id = stx.merchant_id
     LEFT JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = :schoolYearId
     LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
     LEFT JOIN sections sec ON sec.id = e.section_id
     WHERE st.school_id = :schoolId
       AND (wt.school_year_id = :schoolYearId OR (wt.school_year_id IS NULL AND e.id IS NOT NULL))
     ORDER BY wt.created_at DESC, wt.id DESC`,
    { schoolId, schoolYearId },
  );

  return reportData(
    "Wallet and store report",
    "xmetapay-wallet-store",
    contextLines,
    rows,
    [
      { label: "Date", value: (row) => formatDateTime(row.created_at) },
      { label: "Student reference", value: (row) => row.student_reference },
      { label: "Student", value: (row) => fullName(row.first_name, row.middle_name, row.last_name) },
      { label: "Grade", value: (row) => row.grade_name },
      { label: "Section", value: (row) => row.section_name },
      { label: "Type", value: (row) => label(row.type) },
      { label: "Reference", value: (row) => row.payment_reference ?? row.store_reference ?? "" },
      { label: "Merchant or description", value: (row) => row.merchant_name ?? row.description ?? label(row.type) },
      { label: "Channel", value: (row) => row.type === "purchase" ? "Store wallet" : row.channel ? label(row.channel) : "Wallet" },
      { label: "Status", value: (row) => row.payment_status ? label(row.payment_status) : "Recorded" },
      { label: "Amount", value: (row) => decimal(row.amount) },
      { label: "Balance after", value: (row) => decimal(row.balance_after) },
    ],
  );
}

function reportData<T>(
  title: string,
  filenameBase: string,
  contextLines: string[],
  rows: T[],
  columns: CsvColumn<T>[],
): AdminReportExportData {
  const exportColumns = columns.map((column) => column.label);
  const exportRows = rows.map((row) => columns.map((column) => cleanCell(column.value(row))));

  return {
    title,
    filenameBase,
    contextLines,
    context: contextLines.map(contextField),
    summary: reportSummary(filenameBase, exportColumns, exportRows),
    columns: exportColumns,
    rows: exportRows,
  };
}

function toCsv(report: AdminReportExportData) {
  return [
    report.columns.map((column) => csvCell(column)).join(","),
    ...report.rows.map((row) => row.map((value) => csvCell(value)).join(",")),
  ].join("\r\n");
}

function csvCell(value: string | number | null | undefined) {
  const text = cleanCell(value);

  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function cleanCell(value: string | number | null | undefined) {
  return String(value ?? "");
}

function renderPdfReport(doc: jsPDF, report: AdminReportExportData, logo: string | null) {
  const generatedAt = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const context = [...report.contextLines, `Generated: ${generatedAt}`, `Records: ${report.rows.length}`];
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(230, 74, 25);
  doc.rect(0, 0, pageWidth, 6, "F");
  if (logo) {
    doc.addImage(logo, "JPEG", 30, 18, 34, 34);
  } else {
    doc.setFillColor(230, 74, 25);
    doc.roundedRect(30, 18, 34, 34, 5, 5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("X", 47, 40, { align: "center" });
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor("#0f1117");
  doc.text("XMETA Pay", 74, 32);
  doc.setFontSize(11);
  doc.text(report.title, 74, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor("#5a6070");
  doc.text(context.join("  |  "), 30, 68);
  let startY = 82;

  if (report.summary.length > 0) {
    const gap = 8;
    const cardWidth = (pageWidth - 60 - gap * (report.summary.length - 1)) / report.summary.length;
    report.summary.forEach((field, index) => {
      const x = 30 + index * (cardWidth + gap);
      doc.setFillColor(255, 247, 244);
      doc.setDrawColor(248, 205, 190);
      doc.roundedRect(x, 78, cardWidth, 38, 4, 4, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(90, 96, 112);
      doc.text(cleanCell(field.label), x + 8, 91);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 17, 23);
      doc.text(cleanCell(field.value), x + 8, 107);
    });
    startY = 126;
  }

  autoTable(doc, {
    head: [report.columns],
    body: report.rows.length > 0
      ? report.rows
      : [[
          "No records yet",
          ...Array.from({ length: Math.max(report.columns.length - 1, 0) }, () => ""),
        ]],
    margin: { left: 30, right: 30, top: 42, bottom: 34 },
    startY,
    showHead: "everyPage",
    styles: {
      cellPadding: 3,
      fontSize: report.columns.length > 8 ? 6 : 7,
      overflow: "linebreak",
      textColor: [45, 51, 65],
      lineColor: [229, 231, 235],
      lineWidth: 0.25,
    },
    headStyles: {
      fillColor: [230, 74, 25],
      textColor: [255, 255, 255],
    },
    alternateRowStyles: { fillColor: [248, 248, 247] },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    doc.setDrawColor(230, 74, 25);
    doc.line(30, height - 24, width - 30, height - 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(90, 96, 112);
    doc.text("XMETA Pay - School payment records", 30, height - 12);
    doc.text(`Page ${page} of ${pageCount}`, width - 30, height - 12, { align: "right" });
  }
}

function contextField(line: string): AdminReportField {
  const separator = line.indexOf(":");
  return separator > 0
    ? { label: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() }
    : { label: "Context", value: line };
}

function reportSummary(filenameBase: string, columns: string[], rows: string[][]): AdminReportField[] {
  const sum = (label: string) => {
    const index = columns.indexOf(label);
    return index < 0 ? 0 : rows.reduce((total, row) => total + Number(String(row[index] ?? "").replaceAll(/[^0-9.-]/g, "") || 0), 0);
  };

  if (filenameBase === "xmetapay-monthly-revenue") {
    return [
      { label: "Months", value: rows.length },
      { label: "Paid payments", value: sum("Paid payment count") },
      { label: "Paid amount", value: moneySummary(sum("Paid amount")) },
    ];
  }
  if (filenameBase === "xmetapay-collections") {
    return [
      { label: "Payments", value: rows.length },
      { label: "Collected", value: moneySummary(sum("Amount")) },
    ];
  }
  if (filenameBase === "xmetapay-outstanding-balances") {
    return [
      { label: "Assignments", value: rows.length },
      { label: "Amount due", value: moneySummary(sum("Amount due")) },
      { label: "Amount paid", value: moneySummary(sum("Amount paid")) },
      { label: "Balance", value: moneySummary(sum("Balance")) },
    ];
  }
  return [
    { label: "Transactions", value: rows.length },
    { label: "Amount", value: moneySummary(sum("Amount")) },
  ];
}

function moneySummary(value: number) {
  return `P${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function loadServerBrandLogo() {
  try {
    const logo = await readFile(join(process.cwd(), "public", "xmetapay-logo.jpg"));
    return `data:image/jpeg;base64,${logo.toString("base64")}`;
  } catch {
    return null;
  }
}

function cleanSpreadsheetText(value: string | number) {
  return String(value).replaceAll(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim();
}

function cleanWorksheetName(value: string) {
  const cleaned = cleanSpreadsheetText(value).replaceAll(/[\\/*?:[\]]/g, " ").slice(0, 31).trim();
  return cleaned || "XMETA Pay";
}

function addWorkbookMetadata(
  worksheet: import("exceljs").Worksheet,
  rowNumber: number,
  columnCount: number,
  fields: AdminReportField[],
) {
  worksheet.mergeCells(rowNumber, 1, rowNumber, columnCount);
  const cell = worksheet.getCell(rowNumber, 1);
  cell.value = fields.map((field) => `${cleanSpreadsheetText(field.label)}: ${cleanSpreadsheetText(field.value)}`).join("   |   ");
  cell.font = { name: "Arial", size: 9, color: { argb: "FF5A6070" } };
  cell.alignment = { vertical: "middle", wrapText: true };
  worksheet.getRow(rowNumber).height = 24;
  return rowNumber + 1;
}

function addWorkbookSummary(
  worksheet: import("exceljs").Worksheet,
  rowNumber: number,
  columnCount: number,
  fields: AdminReportField[],
) {
  const visibleFields = fields.slice(0, columnCount);
  const span = Math.max(Math.floor(columnCount / visibleFields.length), 1);
  visibleFields.forEach((field, index) => {
    const startColumn = Math.min(index * span + 1, columnCount);
    const endColumn = index === visibleFields.length - 1 ? columnCount : Math.min(startColumn + span - 1, columnCount);
    if (endColumn > startColumn) {
      worksheet.mergeCells(rowNumber, startColumn, rowNumber, endColumn);
      worksheet.mergeCells(rowNumber + 1, startColumn, rowNumber + 1, endColumn);
    }
    const labelCell = worksheet.getCell(rowNumber, startColumn);
    const valueCell = worksheet.getCell(rowNumber + 1, startColumn);
    labelCell.value = cleanSpreadsheetText(field.label);
    valueCell.value = cleanSpreadsheetText(field.value);
    labelCell.font = { name: "Arial", size: 8, color: { argb: "FF5A6070" } };
    valueCell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF0F1117" } };
    for (let column = startColumn; column <= endColumn; column += 1) {
      for (const row of [rowNumber, rowNumber + 1]) {
        const cell = worksheet.getCell(row, column);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7F4" } };
        cell.border = workbookBorder("FFF8CDBE");
      }
    }
  });
  return rowNumber + 3;
}

function workbookBorder(color: string): Partial<import("exceljs").Borders> {
  const side = { style: "thin" as const, color: { argb: color } };
  return { top: side, left: side, bottom: side, right: side };
}

function reportTitle(type: ReportExportType) {
  if (type === "monthly-revenue") {
    return "Monthly revenue";
  }

  if (type === "collections") {
    return "Tuition collections report";
  }

  if (type === "outstanding-balances") {
    return "Outstanding balances";
  }

  return "Wallet and store report";
}

function decimal(value: number | string | null | undefined) {
  return Number(value ?? 0).toFixed(2);
}

function label(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fullName(firstName: string, middleName: string | null, lastName: string) {
  return [firstName, middleName, lastName].filter(Boolean).join(" ");
}

function formatDate(value: Date | string | null) {
  if (!value) {
    return "";
  }

  const parsed = value instanceof Date ? value : new Date(value);

  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString().slice(0, 10);
}

function formatDateTime(value: Date | string | null) {
  if (!value) {
    return "";
  }

  const parsed = value instanceof Date ? value : new Date(value);

  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString().replace("T", " ").slice(0, 19);
}

type MonthlyRevenueExportRow = RowDataPacket & {
  month: string;
  paid_payment_count: number;
  paid_amount: number | string;
};

type OutstandingBalancesExportRow = RowDataPacket & {
  amount_due: number | string;
  amount_paid: number | string;
  due_date: Date | string | null;
  status: string;
  fee_name: string;
  category: string;
  student_reference: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  grade_name: string;
  section_name: string;
};

type WalletStoreExportRow = RowDataPacket & {
  type: string;
  amount: number | string;
  balance_after: number | string;
  description: string | null;
  created_at: Date | string;
  payment_reference: string | null;
  channel: string | null;
  payment_status: string | null;
  store_reference: string | null;
  merchant_name: string | null;
  student_reference: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  grade_name: string;
  section_name: string;
};
