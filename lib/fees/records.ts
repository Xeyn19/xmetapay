import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { getResolvedAdminSchoolSetup } from "@/lib/school/setup";
import { parseTuitionTermsBlob } from "@/lib/tuition/terms";

export type FeeCategory = "tuition" | "other";

export type AdminFeeSetupData = {
  ready: boolean;
  warning: string | null;
  activeSchoolYearName: string | null;
  students: Array<{ id: number; name: string; meta: string }>;
  feeTypes: Array<{ id: number; name: string; amount: string; amountValue: number }>;
};

export type ParentFeePageData = {
  metrics: Array<{
    label: string;
    value: string;
    note: string;
    tone?: "orange" | "green" | "red" | "blue" | "amber" | "muted";
    accent?: boolean;
  }>;
  rows: ParentFeeRow[];
  hasPayableFees: boolean;
  warning: string | null;
};

export type ParentFeeRow = {
  id: number;
  studentName: string;
  studentReference: string;
  feeName: string;
  category: FeeCategory;
  amountDue: string;
  amountPaid: string;
  balance: string;
  dueDate: string;
  status: string;
  tone: "green" | "amber" | "red" | "muted";
  terms: ParentFeeTerm[];
};

export type ParentFeeTerm = {
  id: number;
  name: string;
  amountDue: string;
  amountPaid: string;
  balance: string;
  dueDate: string;
  status: string;
  payable: boolean;
  tone: ParentFeeRow["tone"];
};

export async function getAdminFeeSetupData(
  adminUserId: number,
  category: FeeCategory,
): Promise<AdminFeeSetupData> {
  try {
    const setup = await getResolvedAdminSchoolSetup(adminUserId);

    if (!setup.schoolId || !setup.schoolYearId) {
      return {
        ready: false,
        warning: setup.warning ?? "Ask a school administrator to complete school setup first.",
        activeSchoolYearName: setup.schoolYearName,
        students: [],
        feeTypes: [],
      };
    }

    const [students, feeTypes] = await Promise.all([
      getEnrolledStudentOptions(setup.schoolId, setup.schoolYearId),
      getFeeTypeOptions(setup.schoolId, setup.schoolYearId, category),
    ]);

    return {
      ready: true,
      warning: null,
      activeSchoolYearName: setup.schoolYearName,
      students,
      feeTypes,
    };
  } catch {
    return {
      ready: false,
      warning: "Fee setup data is unavailable. Confirm MySQL/XAMPP and the full schema are ready.",
      activeSchoolYearName: null,
      students: [],
      feeTypes: [],
    };
  }
}

export async function getParentFeePageData(parentUserId: number): Promise<ParentFeePageData> {
  try {
    const rows = await getParentFeeRows(parentUserId);
    const totals = rows.reduce(
      (sum, row) => ({
        billed: sum.billed + decimalValue(row.amount_due),
        paid: sum.paid + decimalValue(row.amount_paid),
        outstanding: sum.outstanding + Math.max(decimalValue(row.amount_due) - decimalValue(row.amount_paid), 0),
      }),
      { billed: 0, paid: 0, outstanding: 0 },
    );
    const nextDue = rows
      .filter((row) => row.due_date)
      .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0]?.due_date;
    const displayRows = rows.map((row) => {
      const terms = parseFeeTerms(row.terms_blob);

      return {
        id: row.id,
        studentName: fullName(row.first_name, row.middle_name, row.last_name),
        studentReference: row.student_reference,
        feeName: row.fee_name,
        category: row.category,
        amountDue: money(row.amount_due),
        amountPaid: money(row.amount_paid),
        balance: money(Math.max(decimalValue(row.amount_due) - decimalValue(row.amount_paid), 0)),
        dueDate: row.due_date ? formatDate(row.due_date) : "Pending",
        status: labelForStatus(row.status),
        tone: feeTone(row.status, row.amount_due, row.amount_paid),
        terms,
      };
    });

    return {
      warning: null,
      hasPayableFees: displayRows.some((row) =>
        row.terms.length > 0
          ? row.terms.some((term) => term.payable)
          : row.balance !== "P0" && row.status !== "Cancelled"
      ),
      metrics: [
        { label: "Total billed", value: rows.length > 0 ? money(totals.billed) : "Pending", note: rows.length > 0 ? `${rows.length} assigned fees` : "No assigned fees yet", accent: true },
        { label: "Paid", value: rows.length > 0 ? money(totals.paid) : "Pending", note: "Recorded payment allocations", tone: "green" },
        { label: "Outstanding", value: rows.length > 0 ? money(totals.outstanding) : "Pending", note: rows.length > 0 ? "Open and partial balances" : "Balances pending", tone: "red" },
        { label: "Next due date", value: nextDue ? formatDate(nextDue) : "Pending", note: nextDue ? "Earliest assigned due date" : "No due dates yet", tone: "blue" },
      ],
      rows: displayRows,
    };
  } catch {
    return {
      warning: "Fee records are unavailable. Confirm MySQL/XAMPP and the full schema are ready.",
      hasPayableFees: false,
      metrics: [
        { label: "Total billed", value: "Pending", note: "Fee records unavailable", accent: true },
        { label: "Paid", value: "Pending", note: "Payment records pending", tone: "green" },
        { label: "Outstanding", value: "Pending", note: "Balances pending", tone: "red" },
        { label: "Next due date", value: "Pending", note: "Due dates pending", tone: "blue" },
      ],
      rows: [],
    };
  }
}

async function getEnrolledStudentOptions(schoolId: number, schoolYearId: number) {
  const [rows] = await pool.execute<StudentOptionRow[]>(
    `SELECT st.id, st.student_reference, st.first_name, st.middle_name, st.last_name,
       gl.name AS grade_name, sec.name AS section_name
     FROM students st
     JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = :schoolYearId
     JOIN grade_levels gl ON gl.id = e.grade_level_id
     LEFT JOIN sections sec ON sec.id = e.section_id
     WHERE st.school_id = :schoolId AND e.status = 'enrolled'
     ORDER BY gl.sort_order ASC, st.last_name ASC, st.first_name ASC`,
    { schoolId, schoolYearId },
  );

  return rows.map((row) => ({
    id: row.id,
    name: fullName(row.first_name, row.middle_name, row.last_name),
    meta: [row.grade_name, row.section_name, row.student_reference].filter(Boolean).join(" - "),
  }));
}

async function getFeeTypeOptions(schoolId: number, schoolYearId: number, category: FeeCategory) {
  const [rows] = await pool.execute<FeeTypeOptionRow[]>(
    `SELECT id, name, default_amount
     FROM fee_types
     WHERE school_id = :schoolId AND school_year_id = :schoolYearId AND category = :category AND status = 'active'
     ORDER BY name ASC`,
    { schoolId, schoolYearId, category },
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    amount: money(row.default_amount),
    amountValue: decimalValue(row.default_amount),
  }));
}

async function getParentFeeRows(parentUserId: number) {
  const [rows] = await pool.execute<ParentFeeSqlRow[]>(
    `SELECT sfa.id, sfa.amount_due, sfa.amount_paid, sfa.due_date, sfa.status,
       ft.name AS fee_name, ft.category,
       st.student_reference, st.first_name, st.middle_name, st.last_name,
       GROUP_CONCAT(
         DISTINCT CONCAT_WS(
           '~',
           tpt.id,
           tpt.term_name,
           tpt.amount_due,
           tpt.amount_paid,
           DATE_FORMAT(tpt.due_date, '%Y-%m-%d'),
           tpt.status
         )
         ORDER BY tpt.sort_order ASC SEPARATOR '||'
       ) AS terms_blob
     FROM student_guardians sg
     JOIN students st ON st.id = sg.student_id
     JOIN student_fee_assignments sfa ON sfa.student_id = st.id
     JOIN fee_types ft ON ft.id = sfa.fee_type_id
     LEFT JOIN tuition_payment_terms tpt ON tpt.student_fee_assignment_id = sfa.id AND tpt.status <> 'cancelled'
     WHERE sg.parent_user_id = :parentUserId
       AND sfa.status <> 'cancelled'
     GROUP BY sfa.id, sfa.amount_due, sfa.amount_paid, sfa.due_date, sfa.status,
       ft.name, ft.category, st.student_reference, st.first_name, st.middle_name, st.last_name
     ORDER BY sfa.due_date IS NULL ASC, sfa.due_date ASC, st.last_name ASC, ft.name ASC`,
    { parentUserId },
  );

  return rows;
}

function feeTone(status: string, amountDue: number | string, amountPaid: number | string): ParentFeeRow["tone"] {
  if (status === "paid" || decimalValue(amountPaid) >= decimalValue(amountDue)) {
    return "green";
  }

  if (status === "partial" || decimalValue(amountPaid) > 0) {
    return "amber";
  }

  return "red";
}

function parseFeeTerms(value: string | null): ParentFeeTerm[] {
  return parseTuitionTermsBlob(value).map((term) => ({
    id: term.id,
    name: term.name,
    amountDue: money(term.amountDue),
    amountPaid: money(term.amountPaid),
    balance: money(term.balance),
    dueDate: formatDate(term.dueDate),
    status: labelForStatus(term.status),
    payable: term.payable,
    tone: feeTone(term.status, term.amountDue, term.amountPaid),
  }));
}

function fullName(firstName: string, middleName: string | null, lastName: string) {
  return [firstName, middleName, lastName].filter(Boolean).join(" ");
}

function decimalValue(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function money(value: number | string | null | undefined) {
  const amount = decimalValue(value);

  return `P${amount.toLocaleString("en-US", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function labelForStatus(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type StudentOptionRow = RowDataPacket & {
  id: number;
  student_reference: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  grade_name: string;
  section_name: string | null;
};

type FeeTypeOptionRow = RowDataPacket & {
  id: number;
  name: string;
  default_amount: number | string;
};

type ParentFeeSqlRow = RowDataPacket & {
  id: number;
  amount_due: number | string;
  amount_paid: number | string;
  due_date: Date | string | null;
  status: string;
  fee_name: string;
  category: FeeCategory;
  student_reference: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  terms_blob: string | null;
};
