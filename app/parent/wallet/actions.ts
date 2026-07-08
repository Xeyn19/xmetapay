"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { requireRole, setAuthFlashToast } from "@/lib/auth/session";
import type { WalletTopUpChannel } from "@/lib/wallets/records";

const walletTopUpChannels = new Set<WalletTopUpChannel>(["card", "online_banking", "gcash", "maya"]);
const maxTopUpAmount = 10000;

export async function createWalletTopUpAction(formData: FormData) {
  const session = await requireRole("parent");
  const studentId = parsePositiveInteger(formData.get("studentId"));
  const amount = parseTopUpAmount(formData.get("amount"));
  const channel = walletTopUpChannel(formData);

  if (!studentId) {
    await toast("Top-up not recorded", "Choose a linked student wallet.");
    redirect("/parent/wallet");
  }

  if (!amount) {
    await toast("Top-up not recorded", `Enter an amount from P1 to P${maxTopUpAmount.toLocaleString()}.`);
    redirect("/parent/wallet");
  }

  if (!channel) {
    await toast("Top-up not recorded", "Choose a supported local test payment method.");
    redirect("/parent/wallet");
  }

  let connection: PoolConnection | null = null;
  let receiptId: number | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const student = await getLockedLinkedStudent(connection, session.userId, studentId);

    if (!student) {
      throw new WalletValidationError("That student wallet is not linked to this parent account.");
    }

    const wallet = await getOrCreateLockedWallet(connection, student.id);

    if (wallet.status !== "active") {
      throw new WalletValidationError("This wallet is not active. Ask the school administrator for help.");
    }

    const referenceNumber = makeReferenceNumber("PAY");
    const receiptNumber = makeReferenceNumber("RCT");
    const balanceAfter = roundMoney(decimalValue(wallet.balance) + amount);
    const [paymentResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO payments (school_id, school_year_id, payer_user_id, student_id, reference_number, channel, amount, status, paid_at)
       VALUES (:schoolId, :schoolYearId, :payerUserId, :studentId, :referenceNumber, :channel, :amount, 'paid', NOW())`,
      {
        schoolId: student.school_id,
        schoolYearId: student.school_year_id,
        payerUserId: session.userId,
        studentId: student.id,
        referenceNumber,
        channel,
        amount,
      },
    );
    const paymentId = paymentResult.insertId;

    await connection.execute<ResultSetHeader>(
      `UPDATE wallets
       SET balance = :balanceAfter
       WHERE id = :walletId`,
      {
        balanceAfter,
        walletId: wallet.id,
      },
    );
    await connection.execute<ResultSetHeader>(
      `INSERT INTO wallet_transactions (wallet_id, payment_id, school_year_id, type, amount, balance_after, description)
       VALUES (:walletId, :paymentId, :schoolYearId, 'top_up', :amount, :balanceAfter, 'Wallet top-up')`,
      {
        walletId: wallet.id,
        paymentId,
        schoolYearId: student.school_year_id,
        amount,
        balanceAfter,
      },
    );

    const [receiptResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO receipts (payment_id, receipt_number)
       VALUES (:paymentId, :receiptNumber)`,
      {
        paymentId,
        receiptNumber,
      },
    );
    receiptId = receiptResult.insertId;

    await connection.commit();
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    await toast(
      "Top-up not recorded",
      error instanceof WalletValidationError
        ? error.message
        : "Unable to record the wallet top-up. Check MySQL/XAMPP and try again.",
    );
    redirect("/parent/wallet");
  } finally {
    connection?.release();
  }

  revalidateWalletPaths();
  await toast("Wallet topped up", "The student allowance wallet and receipt were updated.");
  redirect(`/parent/receipt?receiptId=${receiptId}`);
}

async function getLockedLinkedStudent(
  connection: PoolConnection,
  parentUserId: number,
  studentId: number,
) {
  const [rows] = await connection.execute<LinkedStudentRow[]>(
    `SELECT st.id, st.school_id, sy.id AS school_year_id
     FROM students st
     JOIN school_years sy ON sy.school_id = st.school_id AND sy.status = 'active'
     JOIN student_guardians sg ON sg.student_id = st.id AND sg.parent_user_id = :parentUserId
     WHERE st.id = :studentId
     LIMIT 1
     FOR UPDATE`,
    { parentUserId, studentId },
  );

  return rows[0] ?? null;
}

async function getOrCreateLockedWallet(connection: PoolConnection, studentId: number) {
  await connection.execute<ResultSetHeader>(
    `INSERT INTO wallets (student_id, balance, status)
     VALUES (:studentId, 0.00, 'active')
     ON DUPLICATE KEY UPDATE updated_at = updated_at`,
    { studentId },
  );
  const [rows] = await connection.execute<WalletRow[]>(
    `SELECT id, balance, status
     FROM wallets
     WHERE student_id = :studentId
     LIMIT 1
     FOR UPDATE`,
    { studentId },
  );

  const wallet = rows[0];

  if (!wallet) {
    throw new WalletValidationError("The selected wallet could not be prepared.");
  }

  return wallet;
}

function parsePositiveInteger(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseTopUpAmount(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = roundMoney(Number(value));

  return Number.isFinite(parsed) && parsed > 0 && parsed <= maxTopUpAmount ? parsed : null;
}

function walletTopUpChannel(formData: FormData) {
  const value = formData.get("channel");

  if (typeof value !== "string") {
    return null;
  }

  return walletTopUpChannels.has(value as WalletTopUpChannel) ? (value as WalletTopUpChannel) : null;
}

function decimalValue(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function makeReferenceNumber(prefix: "PAY" | "RCT") {
  const timestamp = new Date()
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 14);
  const suffix = randomBytes(4).toString("hex").toUpperCase();

  return `${prefix}-${timestamp}-${suffix}`;
}

async function toast(title: string, description: string) {
  await setAuthFlashToast({
    role: "parent",
    title,
    description,
  });
}

function revalidateWalletPaths() {
  revalidatePath("/parent/dashboard");
  revalidatePath("/parent/wallet");
  revalidatePath("/parent/history");
  revalidatePath("/parent/receipt");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/allowance");
  revalidatePath("/admin/collections");
  revalidatePath("/admin/reports");
}

class WalletValidationError extends Error {}

type LinkedStudentRow = RowDataPacket & {
  id: number;
  school_id: number;
  school_year_id: number;
};

type WalletRow = RowDataPacket & {
  id: number;
  balance: number | string;
  status: "active" | "frozen" | "closed";
};
