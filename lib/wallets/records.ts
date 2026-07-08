import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { labelForChannel } from "@/lib/payments/records";

export type WalletTopUpChannel = "card" | "online_banking" | "gcash" | "maya";

export type ParentWalletPageData = {
  warning: string | null;
  wallets: ParentWalletSummary[];
  transactions: ParentWalletTransaction[];
};

export type ParentWalletSummary = {
  studentId: number;
  walletId: number | null;
  initials: string;
  studentName: string;
  studentReference: string;
  meta: string;
  balance: string;
  balanceValue: number;
  status: "active" | "frozen" | "closed" | "not_started";
  statusLabel: string;
  tone: "green" | "amber" | "red" | "muted";
};

export type ParentWalletTransaction = {
  id: number;
  date: string;
  studentName: string;
  description: string;
  amount: string;
  balanceAfter: string;
  channel: string;
  status: string;
  tone: "green" | "amber" | "red" | "muted";
};

export async function getParentWalletPageData(parentUserId: number): Promise<ParentWalletPageData> {
  try {
    const [wallets, transactions] = await Promise.all([
      getParentWallets(parentUserId),
      getParentWalletTransactions(parentUserId),
    ]);

    return {
      warning: null,
      wallets,
      transactions,
    };
  } catch {
    return {
      warning: "Wallet records are unavailable. Confirm MySQL/XAMPP and the wallet tables are ready.",
      wallets: [],
      transactions: [],
    };
  }
}

async function getParentWallets(parentUserId: number) {
  const [rows] = await pool.execute<ParentWalletRow[]>(
    `SELECT st.id AS student_id, st.student_reference, st.first_name, st.middle_name, st.last_name,
       COALESCE(gl.name, 'Not enrolled') AS grade_name,
       COALESCE(sec.name, '-') AS section_name,
       w.id AS wallet_id,
       COALESCE(w.balance, 0) AS balance,
       COALESCE(w.status, 'not_started') AS wallet_status
     FROM student_guardians sg
     JOIN students st ON st.id = sg.student_id
     LEFT JOIN enrollments e ON e.id = (
       SELECT e2.id
       FROM enrollments e2
       LEFT JOIN school_years sy2 ON sy2.id = e2.school_year_id
       WHERE e2.student_id = st.id
       ORDER BY (sy2.status = 'active') DESC, sy2.starts_on DESC, e2.id DESC
       LIMIT 1
     )
     LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
     LEFT JOIN sections sec ON sec.id = e.section_id
     LEFT JOIN wallets w ON w.student_id = st.id
     WHERE sg.parent_user_id = :parentUserId
     ORDER BY sg.is_primary DESC, st.last_name ASC, st.first_name ASC`,
    { parentUserId },
  );

  return rows.map((row) => {
    const studentName = fullName(row.first_name, row.middle_name, row.last_name);
    const status = row.wallet_status;

    return {
      studentId: row.student_id,
      walletId: row.wallet_id,
      initials: initialsFor(studentName),
      studentName,
      studentReference: row.student_reference,
      meta: [row.grade_name, row.section_name !== "-" ? row.section_name : null, row.student_reference].filter(Boolean).join(" - "),
      balance: money(row.balance),
      balanceValue: decimalValue(row.balance),
      status,
      statusLabel: status === "not_started" ? "Ready for top-up" : labelForStatus(status),
      tone: walletTone(status, row.balance),
    } satisfies ParentWalletSummary;
  });
}

async function getParentWalletTransactions(parentUserId: number) {
  const [rows] = await pool.execute<ParentWalletTransactionRow[]>(
    `SELECT wt.id, wt.type, wt.amount, wt.balance_after, wt.description, wt.created_at,
       sy.name AS school_year_name,
       p.channel, p.status,
       st.first_name, st.middle_name, st.last_name
     FROM wallet_transactions wt
     JOIN wallets w ON w.id = wt.wallet_id
     JOIN students st ON st.id = w.student_id
     JOIN student_guardians sg ON sg.student_id = st.id AND sg.parent_user_id = :parentUserId
     LEFT JOIN school_years sy ON sy.id = wt.school_year_id
     LEFT JOIN payments p ON p.id = wt.payment_id
     ORDER BY wt.created_at DESC, wt.id DESC
     LIMIT 50`,
    { parentUserId },
  );

  return rows.map((row) => {
    const amount = decimalValue(row.amount);
    const isPurchase = row.type === "purchase";
    const signedAmount = row.type === "top_up" || amount > 0 ? `+${money(Math.abs(amount))}` : `-${money(Math.abs(amount))}`;
    const status = row.status ? labelForStatus(row.status) : "Recorded";

    return {
      id: row.id,
      date: formatDateTime(row.created_at),
      studentName: fullName(row.first_name, row.middle_name, row.last_name),
      description: [isPurchase ? row.description ?? "Store purchase" : row.description ?? labelForWalletType(row.type), row.school_year_name]
        .filter(Boolean)
        .join(" - "),
      amount: signedAmount,
      balanceAfter: money(row.balance_after),
      channel: isPurchase ? "Store wallet" : row.channel ? labelForChannel(row.channel) : "Wallet",
      status,
      tone: status === "Paid" || status === "Recorded" ? "green" : status === "Pending" ? "amber" : "red",
    } satisfies ParentWalletTransaction;
  });
}

function walletTone(status: ParentWalletSummary["status"], balance: number | string) {
  if (status === "frozen") {
    return "amber";
  }

  if (status === "closed") {
    return "red";
  }

  if (status === "not_started") {
    return "muted";
  }

  return decimalValue(balance) > 0 ? "green" : "muted";
}

function labelForWalletType(value: string) {
  const labels: Record<string, string> = {
    top_up: "Wallet top-up",
    purchase: "Store purchase",
    adjustment: "Wallet adjustment",
    reversal: "Wallet reversal",
  };

  return labels[value] ?? labelForStatus(value);
}

function fullName(firstName: string, middleName: string | null, lastName: string) {
  return [firstName, middleName, lastName].filter(Boolean).join(" ");
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "ST";
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

type ParentWalletRow = RowDataPacket & {
  student_id: number;
  student_reference: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  grade_name: string;
  section_name: string;
  wallet_id: number | null;
  balance: number | string;
  wallet_status: ParentWalletSummary["status"];
};

type ParentWalletTransactionRow = RowDataPacket & {
  id: number;
  type: string;
  amount: number | string;
  balance_after: number | string;
  description: string | null;
  created_at: Date | string;
  school_year_name: string | null;
  channel: string | null;
  status: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
};
