import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import type { WalletTopUpChannel } from "@/lib/wallets/records";

export const maxWalletTopUpStudents = 20;
export const maxWalletTopUpAmount = 10000;

export type WalletTopUpItemInput = {
  studentId: number;
  amount: number;
};

export type WalletTopUpBatchResult = {
  batchReference: string;
  duplicate: boolean;
};

export class WalletTopUpValidationError extends Error {}

export async function createWalletTopUpBatch(input: {
  parentUserId: number;
  channel: WalletTopUpChannel;
  submissionToken: string;
  items: WalletTopUpItemInput[];
}): Promise<WalletTopUpBatchResult> {
  const items = normalizeItems(input.items);
  const submissionTokenHash = createHash("sha256").update(input.submissionToken).digest("hex");
  const existing = await findExistingBatch(input.parentUserId, submissionTokenHash);

  if (existing) {
    return { batchReference: existing.batch_reference, duplicate: true };
  }

  let connection: PoolConnection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const existingLocked = await findExistingBatch(input.parentUserId, submissionTokenHash, connection, true);
    if (existingLocked) {
      await connection.commit();
      return { batchReference: existingLocked.batch_reference, duplicate: true };
    }

    const students = await getLockedLinkedStudents(
      connection,
      input.parentUserId,
      items.map((item) => item.studentId),
    );

    if (students.length !== items.length) {
      throw new WalletTopUpValidationError(
        "One or more students are no longer linked or do not have an active school year.",
      );
    }

    await prepareWallets(connection, items.map((item) => item.studentId));
    const wallets = await getLockedWallets(connection, items.map((item) => item.studentId));

    if (wallets.length !== items.length) {
      throw new WalletTopUpValidationError("One or more selected wallets could not be prepared.");
    }

    if (wallets.some((wallet) => wallet.status !== "active")) {
      throw new WalletTopUpValidationError(
        "One or more selected wallets are frozen or closed. No wallets were topped up.",
      );
    }

    const totalAmount = roundMoney(items.reduce((total, item) => total + item.amount, 0));
    const batchReference = makeReferenceNumber("WTB");
    const [batchResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO wallet_top_up_batches
         (parent_user_id, batch_reference, submission_token_hash, channel, item_count, total_amount, status, completed_at)
       VALUES
         (:parentUserId, :batchReference, :submissionTokenHash, :channel, :itemCount, :totalAmount, 'completed', NOW())`,
      {
        parentUserId: input.parentUserId,
        batchReference,
        submissionTokenHash,
        channel: input.channel,
        itemCount: items.length,
        totalAmount,
      },
    );

    const studentMap = new Map(students.map((student) => [student.id, student]));
    const walletMap = new Map(wallets.map((wallet) => [wallet.student_id, wallet]));

    for (const item of items) {
      const student = studentMap.get(item.studentId);
      const wallet = walletMap.get(item.studentId);
      if (!student || !wallet) {
        throw new WalletTopUpValidationError("A selected student wallet became unavailable.");
      }

      const balanceAfter = roundMoney(decimalValue(wallet.balance) + item.amount);
      const paymentReference = makeReferenceNumber("PAY");
      const receiptNumber = makeReferenceNumber("RCT");
      const [paymentResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO payments
           (school_id, school_year_id, payer_user_id, wallet_top_up_batch_id, student_id, reference_number, channel, amount, status, paid_at)
         VALUES
           (:schoolId, :schoolYearId, :payerUserId, :batchId, :studentId, :referenceNumber, :channel, :amount, 'paid', NOW())`,
        {
          schoolId: student.school_id,
          schoolYearId: student.school_year_id,
          payerUserId: input.parentUserId,
          batchId: batchResult.insertId,
          studentId: student.id,
          referenceNumber: paymentReference,
          channel: input.channel,
          amount: item.amount,
        },
      );

      await connection.execute<ResultSetHeader>(
        `UPDATE wallets SET balance = :balanceAfter WHERE id = :walletId`,
        { balanceAfter, walletId: wallet.id },
      );
      await connection.execute<ResultSetHeader>(
        `INSERT INTO wallet_transactions
           (wallet_id, payment_id, school_year_id, type, amount, balance_after, description)
         VALUES
           (:walletId, :paymentId, :schoolYearId, 'top_up', :amount, :balanceAfter, 'Wallet top-up')`,
        {
          walletId: wallet.id,
          paymentId: paymentResult.insertId,
          schoolYearId: student.school_year_id,
          amount: item.amount,
          balanceAfter,
        },
      );
      await connection.execute<ResultSetHeader>(
        `INSERT INTO receipts (payment_id, receipt_number)
         VALUES (:paymentId, :receiptNumber)`,
        { paymentId: paymentResult.insertId, receiptNumber },
      );
    }

    await connection.commit();
    return { batchReference, duplicate: false };
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    if (isDuplicateKeyError(error)) {
      const duplicate = await findExistingBatch(input.parentUserId, submissionTokenHash);
      if (duplicate) {
        return { batchReference: duplicate.batch_reference, duplicate: true };
      }
    }

    throw error;
  } finally {
    connection?.release();
  }
}

function normalizeItems(items: WalletTopUpItemInput[]) {
  if (items.length < 1 || items.length > maxWalletTopUpStudents) {
    throw new WalletTopUpValidationError(
      `Select between 1 and ${maxWalletTopUpStudents} student wallets.`,
    );
  }

  const sorted = [...items].sort((left, right) => left.studentId - right.studentId);
  if (new Set(sorted.map((item) => item.studentId)).size !== sorted.length) {
    throw new WalletTopUpValidationError("Each student wallet can only be selected once.");
  }

  for (const item of sorted) {
    if (!Number.isInteger(item.studentId) || item.studentId < 1) {
      throw new WalletTopUpValidationError("A selected student is invalid.");
    }

    if (
      !Number.isFinite(item.amount)
      || item.amount < 1
      || item.amount > maxWalletTopUpAmount
      || roundMoney(item.amount) !== item.amount
    ) {
      throw new WalletTopUpValidationError(
        `Enter an amount from P1 to P${maxWalletTopUpAmount.toLocaleString()} for every selected student.`,
      );
    }
  }

  return sorted;
}

async function getLockedLinkedStudents(
  connection: PoolConnection,
  parentUserId: number,
  studentIds: number[],
) {
  const { placeholders, params } = idParams(studentIds, "student");
  const [rows] = await connection.execute<LinkedStudentRow[]>(
    `SELECT st.id, st.school_id, sy.id AS school_year_id
     FROM students st
     JOIN student_guardians sg
       ON sg.student_id = st.id
      AND sg.parent_user_id = :parentUserId
     JOIN school_years sy
       ON sy.school_id = st.school_id
      AND sy.status = 'active'
     WHERE st.id IN (${placeholders})
     ORDER BY st.id
     FOR UPDATE`,
    { parentUserId, ...params },
  );
  return rows;
}

async function prepareWallets(connection: PoolConnection, studentIds: number[]) {
  const values = studentIds.map((studentId, index) => `(:studentId${index}, 0.00, 'active')`);
  const params = Object.fromEntries(studentIds.map((studentId, index) => [`studentId${index}`, studentId]));
  await connection.execute<ResultSetHeader>(
    `INSERT INTO wallets (student_id, balance, status)
     VALUES ${values.join(", ")}
     ON DUPLICATE KEY UPDATE updated_at = updated_at`,
    params,
  );
}

async function getLockedWallets(connection: PoolConnection, studentIds: number[]) {
  const { placeholders, params } = idParams(studentIds, "walletStudent");
  const [rows] = await connection.execute<WalletRow[]>(
    `SELECT id, student_id, balance, status
     FROM wallets
     WHERE student_id IN (${placeholders})
     ORDER BY student_id
     FOR UPDATE`,
    params,
  );
  return rows;
}

async function findExistingBatch(
  parentUserId: number,
  submissionTokenHash: string,
  connection: PoolConnection | typeof pool = pool,
  lock = false,
) {
  const [rows] = await connection.execute<BatchRow[]>(
    `SELECT batch_reference
     FROM wallet_top_up_batches
     WHERE parent_user_id = :parentUserId
       AND submission_token_hash = :submissionTokenHash
     LIMIT 1${lock ? " FOR UPDATE" : ""}`,
    { parentUserId, submissionTokenHash },
  );
  return rows[0] ?? null;
}

function idParams(ids: number[], prefix: string) {
  const params: Record<string, number> = {};
  const placeholders = ids.map((id, index) => {
    const key = `${prefix}Id${index}`;
    params[key] = id;
    return `:${key}`;
  });
  return { placeholders: placeholders.join(", "), params };
}

function makeReferenceNumber(prefix: "WTB" | "PAY" | "RCT") {
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `${prefix}-${timestamp}-${randomBytes(6).toString("hex").toUpperCase()}`;
}

function decimalValue(value: number | string) {
  return Number(value);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function isDuplicateKeyError(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY";
}

type LinkedStudentRow = RowDataPacket & {
  id: number;
  school_id: number;
  school_year_id: number;
};

type WalletRow = RowDataPacket & {
  id: number;
  student_id: number;
  balance: number | string;
  status: "active" | "frozen" | "closed";
};

type BatchRow = RowDataPacket & {
  batch_reference: string;
};
