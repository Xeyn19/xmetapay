import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { getParentPayableTuitionTerms, type ParentPayableTuitionTerm } from "@/lib/tuition/terms";

export type PaymentChannel = "cash" | "card" | "online_banking" | "gcash" | "maya";

export type ParentPayableFee = {
  id: number;
  source: "fee" | "term";
  studentId: number;
  studentName: string;
  studentReference: string;
  feeName: string;
  category: "tuition" | "other" | "allowance";
  balanceValue: number;
  balance: string;
  amountDue: string;
  amountPaid: string;
  dueDate: string;
  status: string;
};

export type ParentPaymentPageData = {
  rows: ParentPayableFee[];
  totalOutstanding: string;
  warning: string | null;
};

export type ParentReceiptData = {
  receipt: {
    receiptId: number;
    paymentId: number;
    receiptNumber: string;
    referenceNumber: string;
    studentName: string;
    studentReference: string;
    paidItems: string;
    channel: string;
    amount: string;
    paidAt: string;
    status: string;
  } | null;
  warning: string | null;
};

export type ParentPaymentHistoryData = {
  rows: Array<{
    receiptId: number | null;
    referenceNumber: string;
    paidAt: string;
    studentName: string;
    description: string;
    amount: string;
    channel: string;
    status: string;
  }>;
  warning: string | null;
};

export async function getParentPaymentPageData(parentUserId: number): Promise<ParentPaymentPageData> {
  try {
    const rows = await getParentPayableFees(parentUserId);
    const totalOutstanding = rows.reduce((sum, row) => sum + row.balanceValue, 0);

    return {
      rows,
      totalOutstanding: money(totalOutstanding),
      warning: null,
    };
  } catch {
    return {
      rows: [],
      totalOutstanding: "Pending",
      warning: "Payment records are unavailable. Confirm MySQL/XAMPP and the full schema are ready.",
    };
  }
}

export async function getParentReceiptData(
  parentUserId: number,
  receiptId?: number,
): Promise<ParentReceiptData> {
  try {
    const selectedReceiptClause = typeof receiptId === "number" ? "AND r.id = :receiptId" : "";
    const [rows] = await pool.execute<ParentReceiptRow[]>(
      `SELECT r.id AS receipt_id, r.receipt_number, r.issued_at,
         p.id AS payment_id, p.reference_number, p.amount, p.channel, p.status, p.paid_at, p.created_at,
         st.student_reference, st.first_name, st.middle_name, st.last_name,
         COALESCE(
           GROUP_CONCAT(DISTINCT CONCAT(term_ft.name, ' - ', tpt.term_name) ORDER BY tpt.sort_order SEPARATOR ', '),
           GROUP_CONCAT(DISTINCT ft.name ORDER BY ft.name SEPARATOR ', '),
           MAX(CASE WHEN wt.type = 'top_up' THEN 'Wallet top-up' END),
           'School fee payment'
         ) AS paid_items
       FROM receipts r
       JOIN payments p ON p.id = r.payment_id
       JOIN students st ON st.id = p.student_id
       JOIN student_guardians sg ON sg.student_id = st.id AND sg.parent_user_id = :parentUserId
       LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
       LEFT JOIN student_fee_assignments sfa ON sfa.id = pa.student_fee_assignment_id
       LEFT JOIN fee_types ft ON ft.id = sfa.fee_type_id
       LEFT JOIN payment_term_allocations pta ON pta.payment_id = p.id
       LEFT JOIN tuition_payment_terms tpt ON tpt.id = pta.tuition_payment_term_id
       LEFT JOIN student_fee_assignments term_sfa ON term_sfa.id = tpt.student_fee_assignment_id
       LEFT JOIN fee_types term_ft ON term_ft.id = term_sfa.fee_type_id
       LEFT JOIN wallet_transactions wt ON wt.payment_id = p.id
       WHERE p.payer_user_id = :parentUserId
         ${selectedReceiptClause}
       GROUP BY r.id, r.receipt_number, r.issued_at, p.id, p.reference_number, p.amount, p.channel,
         p.status, p.paid_at, p.created_at, st.student_reference, st.first_name, st.middle_name, st.last_name
       ORDER BY COALESCE(p.paid_at, p.created_at) DESC, r.id DESC
       LIMIT 1`,
      typeof receiptId === "number" ? { parentUserId, receiptId } : { parentUserId },
    );
    const row = rows[0];

    if (!row) {
      return {
        receipt: null,
        warning: receiptId ? "Receipt not found for this parent account." : "No receipts yet.",
      };
    }

    return {
      warning: null,
      receipt: {
        receiptId: row.receipt_id,
        paymentId: row.payment_id,
        receiptNumber: row.receipt_number,
        referenceNumber: row.reference_number,
        studentName: fullName(row.first_name, row.middle_name, row.last_name),
        studentReference: row.student_reference,
        paidItems: row.paid_items,
        channel: labelForChannel(row.channel),
        amount: money(row.amount),
        paidAt: formatDateTime(row.paid_at ?? row.created_at),
        status: labelForStatus(row.status),
      },
    };
  } catch {
    return {
      receipt: null,
      warning: "Receipt records are unavailable. Confirm MySQL/XAMPP and the full schema are ready.",
    };
  }
}

export async function getParentPaymentHistoryData(parentUserId: number): Promise<ParentPaymentHistoryData> {
  try {
    const [rows] = await pool.execute<ParentPaymentHistoryRow[]>(
      `SELECT r.id AS receipt_id, p.reference_number, p.amount, p.channel, p.status, p.paid_at, p.created_at,
         st.first_name, st.middle_name, st.last_name,
         COALESCE(
           GROUP_CONCAT(DISTINCT CONCAT(term_ft.name, ' - ', tpt.term_name) ORDER BY tpt.sort_order SEPARATOR ', '),
           GROUP_CONCAT(DISTINCT ft.name ORDER BY ft.name SEPARATOR ', '),
           MAX(CASE WHEN wt.type = 'top_up' THEN 'Wallet top-up' END),
           'School fee payment'
         ) AS description
       FROM payments p
       JOIN students st ON st.id = p.student_id
       JOIN student_guardians sg ON sg.student_id = st.id AND sg.parent_user_id = :parentUserId
       LEFT JOIN receipts r ON r.payment_id = p.id
       LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
       LEFT JOIN student_fee_assignments sfa ON sfa.id = pa.student_fee_assignment_id
       LEFT JOIN fee_types ft ON ft.id = sfa.fee_type_id
       LEFT JOIN payment_term_allocations pta ON pta.payment_id = p.id
       LEFT JOIN tuition_payment_terms tpt ON tpt.id = pta.tuition_payment_term_id
       LEFT JOIN student_fee_assignments term_sfa ON term_sfa.id = tpt.student_fee_assignment_id
       LEFT JOIN fee_types term_ft ON term_ft.id = term_sfa.fee_type_id
       LEFT JOIN wallet_transactions wt ON wt.payment_id = p.id
       WHERE p.payer_user_id = :parentUserId
       GROUP BY r.id, p.id, p.reference_number, p.amount, p.channel, p.status, p.paid_at, p.created_at,
         st.first_name, st.middle_name, st.last_name
       ORDER BY COALESCE(p.paid_at, p.created_at) DESC, p.id DESC
       LIMIT 50`,
      { parentUserId },
    );

    return {
      warning: null,
      rows: rows.map((row) => ({
        receiptId: row.receipt_id,
        referenceNumber: row.reference_number,
        paidAt: formatDate(row.paid_at ?? row.created_at),
        studentName: fullName(row.first_name, row.middle_name, row.last_name),
        description: row.description,
        amount: money(row.amount),
        channel: labelForChannel(row.channel),
        status: labelForStatus(row.status),
      })),
    };
  } catch {
    return {
      rows: [],
      warning: "Payment history is unavailable. Confirm MySQL/XAMPP and the full schema are ready.",
    };
  }
}

async function getParentPayableFees(parentUserId: number) {
  const [termRows, feeRows] = await Promise.all([
    getParentPayableTuitionTerms(parentUserId),
    pool.execute<ParentPayableFeeRow[]>(
    `SELECT sfa.id, sfa.amount_due, sfa.amount_paid, sfa.due_date, sfa.status,
       ft.name AS fee_name, ft.category,
       st.id AS student_id, st.student_reference, st.first_name, st.middle_name, st.last_name
     FROM student_guardians sg
     JOIN students st ON st.id = sg.student_id
     JOIN student_fee_assignments sfa ON sfa.student_id = st.id
     JOIN school_years sy ON sy.id = sfa.school_year_id AND sy.status = 'active'
     JOIN fee_types ft ON ft.id = sfa.fee_type_id
     WHERE sg.parent_user_id = :parentUserId
       AND sfa.status IN ('open', 'partial')
       AND sfa.amount_due > sfa.amount_paid
       AND NOT EXISTS (
         SELECT 1
         FROM tuition_payment_terms tpt
         WHERE tpt.student_fee_assignment_id = sfa.id
           AND tpt.status <> 'cancelled'
       )
     ORDER BY st.last_name ASC, st.first_name ASC, sfa.due_date IS NULL ASC, sfa.due_date ASC, ft.name ASC`,
    { parentUserId },
    ),
  ]);
  const terms = termRows.map((row) => payableRow(row, "term" as const, `${row.fee_name} - ${row.term_name}`));
  const fees = feeRows[0].map((row) => payableRow(row, "fee" as const, row.fee_name));

  return [...terms, ...fees];
}

function payableRow(
  row: ParentPayableFeeRow | ParentPayableTuitionTerm,
  source: ParentPayableFee["source"],
  feeName: string,
): ParentPayableFee {
  const balanceValue = Math.max(decimalValue(row.amount_due) - decimalValue(row.amount_paid), 0);

  return {
    id: row.id,
    source,
    studentId: row.student_id,
    studentName: fullName(row.first_name, row.middle_name, row.last_name),
    studentReference: row.student_reference,
    feeName,
    category: row.category,
    balanceValue,
    balance: money(balanceValue),
    amountDue: money(row.amount_due),
    amountPaid: money(row.amount_paid),
    dueDate: row.due_date ? formatDate(row.due_date) : "Pending",
    status: labelForStatus(row.status),
  };
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

function formatDateTime(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function labelForStatus(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function labelForChannel(value: string) {
  const labels: Record<string, string> = {
    cash: "Cash",
    card: "Card",
    online_banking: "Online banking",
    gcash: "GCash",
    maya: "Maya",
    xmeta_wallet: "XMETA wallet",
  };

  return labels[value] ?? labelForStatus(value);
}

type ParentPayableFeeRow = RowDataPacket & {
  id: number;
  student_id: number;
  amount_due: number | string;
  amount_paid: number | string;
  due_date: Date | string | null;
  status: string;
  fee_name: string;
  category: ParentPayableFee["category"];
  student_reference: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
};

type ParentReceiptRow = RowDataPacket & {
  receipt_id: number;
  payment_id: number;
  receipt_number: string;
  issued_at: Date | string;
  reference_number: string;
  amount: number | string;
  channel: string;
  status: string;
  paid_at: Date | string | null;
  created_at: Date | string;
  student_reference: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  paid_items: string;
};

type ParentPaymentHistoryRow = RowDataPacket & {
  receipt_id: number | null;
  reference_number: string;
  amount: number | string;
  channel: string;
  status: string;
  paid_at: Date | string | null;
  created_at: Date | string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  description: string;
};
