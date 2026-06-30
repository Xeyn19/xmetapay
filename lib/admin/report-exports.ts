import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { getResolvedAdminSchoolSetup } from "@/lib/school/setup";

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

export function isReportExportType(value: string | null): value is ReportExportType {
  return reportExportTypes.includes(value as ReportExportType);
}

export async function getAdminReportExport(adminUserId: number, type: ReportExportType) {
  const setup = await getResolvedAdminSchoolSetup(adminUserId);

  if (!setup.schoolId || !setup.schoolYearId) {
    return {
      filename: `xmetapay-${type}.csv`,
      csv: toCsv([{ message: setup.warning ?? "School setup is incomplete." }], [
        { label: "Message", value: (row) => row.message },
      ]),
    };
  }

  if (type === "monthly-revenue") {
    return monthlyRevenueExport(setup.schoolId);
  }

  if (type === "collections") {
    return collectionsExport(setup.schoolId);
  }

  if (type === "outstanding-balances") {
    return outstandingBalancesExport(setup.schoolId, setup.schoolYearId);
  }

  return walletStoreExport(setup.schoolId, setup.schoolYearId);
}

async function monthlyRevenueExport(schoolId: number) {
  const [rows] = await pool.execute<MonthlyRevenueExportRow[]>(
    `SELECT DATE_FORMAT(COALESCE(p.paid_at, p.created_at), '%Y-%m') AS month,
       COUNT(*) AS paid_payment_count,
       COALESCE(SUM(p.amount), 0) AS paid_amount
     FROM payments p
     WHERE p.school_id = :schoolId AND p.status = 'paid'
     GROUP BY DATE_FORMAT(COALESCE(p.paid_at, p.created_at), '%Y-%m')
     ORDER BY month ASC`,
    { schoolId },
  );

  return {
    filename: "xmetapay-monthly-revenue.csv",
    csv: toCsv(rows, [
      { label: "Month", value: (row) => row.month },
      { label: "Paid payment count", value: (row) => row.paid_payment_count },
      { label: "Paid amount", value: (row) => decimal(row.paid_amount) },
    ]),
  };
}

async function collectionsExport(schoolId: number) {
  const [rows] = await pool.execute<CollectionsExportRow[]>(
    `SELECT p.reference_number, p.channel, p.status, p.amount, p.paid_at, p.created_at,
       st.first_name, st.middle_name, st.last_name
     FROM payments p
     JOIN students st ON st.id = p.student_id
     WHERE p.school_id = :schoolId
     ORDER BY COALESCE(p.paid_at, p.created_at) DESC, p.id DESC`,
    { schoolId },
  );

  return {
    filename: "xmetapay-collections.csv",
    csv: toCsv(rows, [
      { label: "Reference", value: (row) => row.reference_number },
      { label: "Student", value: (row) => fullName(row.first_name, row.middle_name, row.last_name) },
      { label: "Channel", value: (row) => label(row.channel) },
      { label: "Status", value: (row) => label(row.status) },
      { label: "Amount", value: (row) => decimal(row.amount) },
      { label: "Paid or created date", value: (row) => formatDateTime(row.paid_at ?? row.created_at) },
    ]),
  };
}

async function outstandingBalancesExport(schoolId: number, schoolYearId: number) {
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

  return {
    filename: "xmetapay-outstanding-balances.csv",
    csv: toCsv(rows, [
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
    ]),
  };
}

async function walletStoreExport(schoolId: number, schoolYearId: number) {
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
     ORDER BY wt.created_at DESC, wt.id DESC`,
    { schoolId, schoolYearId },
  );

  return {
    filename: "xmetapay-wallet-store.csv",
    csv: toCsv(rows, [
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
    ]),
  };
}

function toCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  return [
    columns.map((column) => csvCell(column.label)).join(","),
    ...rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(",")),
  ].join("\r\n");
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");

  return `"${text.replaceAll("\"", "\"\"")}"`;
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

type CollectionsExportRow = RowDataPacket & {
  reference_number: string;
  channel: string;
  status: string;
  amount: number | string;
  paid_at: Date | string | null;
  created_at: Date | string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
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
