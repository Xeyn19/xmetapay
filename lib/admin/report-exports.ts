import "server-only";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { getTuitionCollectionRows } from "@/lib/admin/tuition-collections";
import { getResolvedAdminSchoolViewSetup } from "@/lib/school/setup";

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

export type ReportExportFormat = "csv" | "pdf";

export type AdminReportExportData = {
  title: string;
  filenameBase: string;
  contextLines: string[];
  columns: string[];
  rows: string[][];
};

export function isReportExportType(value: string | null): value is ReportExportType {
  return reportExportTypes.includes(value as ReportExportType);
}

export function isReportExportFormat(value: string | null): value is ReportExportFormat {
  return value === "csv" || value === "pdf";
}

export async function getAdminReportExport(adminUserId: number, type: ReportExportType) {
  const report = await getAdminReportExportData(adminUserId, type);

  return {
    filename: `${report.filenameBase}.csv`,
    csv: toCsv(report),
  };
}

export async function getAdminReportExportData(adminUserId: number, type: ReportExportType): Promise<AdminReportExportData> {
  const setup = await getResolvedAdminSchoolViewSetup(adminUserId);

  if (!setup.schoolId || !setup.schoolYearId) {
    return {
      title: reportTitle(type),
      filenameBase: `xmetapay-${type}`,
      contextLines: ["School setup incomplete"],
      columns: ["Message"],
      rows: [[setup.warning ?? "School setup is incomplete."]],
    };
  }

  const contextLines = [
    `School ID: ${setup.schoolId}`,
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

  renderPdfReport(doc, report);

  return Buffer.from(doc.output("arraybuffer"));
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
  return {
    title,
    filenameBase,
    contextLines,
    columns: columns.map((column) => column.label),
    rows: rows.map((row) => columns.map((column) => cleanCell(column.value(row)))),
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

function renderPdfReport(doc: jsPDF, report: AdminReportExportData) {
  const generatedAt = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const context = [...report.contextLines, `Generated: ${generatedAt}`];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor("#0f1117");
  doc.text("XMETA Pay", 30, 34);
  doc.setFontSize(13);
  doc.text(report.title, 30, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor("#5a6070");
  doc.text(context.join("  |  "), 30, 66);

  autoTable(doc, {
    head: [report.columns],
    body: report.rows.length > 0
      ? report.rows
      : [[
          "No records yet",
          ...Array.from({ length: Math.max(report.columns.length - 1, 0) }, () => ""),
        ]],
    margin: { left: 30, right: 30 },
    startY: 82,
    styles: {
      cellPadding: 3,
      fontSize: report.columns.length > 8 ? 6 : 7,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [230, 74, 25],
      textColor: [255, 255, 255],
    },
  });
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
