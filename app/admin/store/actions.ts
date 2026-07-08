"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getAdminStaffRole } from "@/lib/admin/access";
import { canAccessFinance } from "@/lib/admin/permissions";
import { pool } from "@/lib/auth/db";
import { requireRole, setAuthFlashToast } from "@/lib/auth/session";
import { getResolvedAdminSchoolSetup } from "@/lib/school/setup";
import type { StoreMerchantType } from "@/lib/stores/records";

const merchantTypes = new Set<StoreMerchantType>(["canteen", "school_store", "other"]);
const maxStorePurchaseAmount = 10000;

export async function createStoreMerchantAction(formData: FormData) {
  const context = await requireStoreFinanceContext();
  const name = value(formData, "name");
  const type = merchantType(formData);

  if (!name || !type) {
    await toast("Merchant not created", "Enter a merchant name and choose a valid type.");
    redirect("/admin/store-transactions");
  }

  try {
    await pool.execute<ResultSetHeader>(
      `INSERT INTO store_merchants (school_id, name, type, status)
       VALUES (:schoolId, :name, :type, 'active')`,
      {
        schoolId: context.schoolId,
        name,
        type,
      },
    );
    await toast("Merchant created", `${name} can now be used for wallet purchases.`);
  } catch (error) {
    await toast(
      "Merchant not created",
      duplicateRecord(error)
        ? "A store or canteen merchant with that name already exists for this school."
        : "Unable to create the merchant. Check MySQL/XAMPP and try again.",
    );
  }

  revalidateStorePaths();
  redirect("/admin/store-transactions");
}

export async function recordStorePurchaseAction(formData: FormData) {
  const context = await requireStoreFinanceContext();
  const studentId = idValue(formData, "studentId");
  const merchantId = idValue(formData, "merchantId");
  const amount = cappedAmountValue(formData, "amount");
  const feeAmount = optionalFeeAmount(formData, "feeAmount");

  if (!studentId || !merchantId || !amount || feeAmount === null) {
    await toast("Purchase not recorded", `Choose a student wallet, merchant, and amount from P1 to P${maxStorePurchaseAmount.toLocaleString()}.`);
    redirect("/admin/store-transactions");
  }

  let connection: PoolConnection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const merchant = await getMerchantForSchool(connection, context.schoolId, merchantId);

    if (!merchant) {
      throw new StoreValidationError("Choose an active merchant from this school.");
    }

    const wallet = await getLockedStudentWallet(connection, context.schoolId, context.schoolYearId, studentId);

    if (!wallet) {
      throw new StoreValidationError("Choose a student with an active allowance wallet.");
    }

    if (wallet.status !== "active") {
      throw new StoreValidationError("This wallet is not active. Ask a school administrator for help.");
    }

    const currentBalance = decimalValue(wallet.balance);

    if (currentBalance < amount) {
      throw new StoreValidationError("The selected wallet has insufficient balance for this purchase.");
    }

    const balanceAfter = roundMoney(currentBalance - amount);
    const referenceNumber = makeReferenceNumber("STR");

    await connection.execute<ResultSetHeader>(
      `UPDATE wallets
       SET balance = :balanceAfter
       WHERE id = :walletId`,
      {
        balanceAfter,
        walletId: wallet.id,
      },
    );
    const [walletTransactionResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO wallet_transactions (wallet_id, payment_id, school_year_id, type, amount, balance_after, description)
       VALUES (:walletId, NULL, :schoolYearId, 'purchase', :amount, :balanceAfter, :description)`,
      {
        walletId: wallet.id,
        schoolYearId: context.schoolYearId,
        amount: -amount,
        balanceAfter,
        description: `Store purchase - ${merchant.name}`,
      },
    );
    const walletTransactionId = walletTransactionResult.insertId;

    await connection.execute<ResultSetHeader>(
      `INSERT INTO store_transactions (merchant_id, student_id, school_year_id, wallet_transaction_id, reference_number, amount, fee_amount)
       VALUES (:merchantId, :studentId, :schoolYearId, :walletTransactionId, :referenceNumber, :amount, :feeAmount)`,
      {
        merchantId,
        studentId,
        schoolYearId: context.schoolYearId,
        walletTransactionId,
        referenceNumber,
        amount,
        feeAmount,
      },
    );

    await connection.commit();
    await toast("Purchase recorded", "The student wallet and store transaction log were updated.");
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    await toast(
      "Purchase not recorded",
      error instanceof StoreValidationError
        ? error.message
        : "Unable to record the purchase. Check MySQL/XAMPP and try again.",
    );
  } finally {
    connection?.release();
  }

  revalidateStorePaths();
  redirect("/admin/store-transactions");
}

async function requireStoreFinanceContext() {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);

  if (!canAccessFinance(staffRole)) {
    await toast("Access limited", "Only school administrators and finance officers can manage store transactions.");
    redirect("/admin/dashboard");
  }

  const setup = await getResolvedAdminSchoolSetup(session.userId);

  if (!setup.schoolId || !setup.schoolYearId) {
    await toast("School setup required", setup.warning ?? "Ask a school administrator to complete setup first.");
    redirect("/admin/dashboard");
  }

  return {
    schoolId: setup.schoolId,
    schoolYearId: setup.schoolYearId,
  };
}

async function getMerchantForSchool(connection: PoolConnection, schoolId: number, merchantId: number) {
  const [rows] = await connection.execute<MerchantRow[]>(
    `SELECT id, name
     FROM store_merchants
     WHERE id = :merchantId
       AND school_id = :schoolId
       AND status = 'active'
     LIMIT 1`,
    { merchantId, schoolId },
  );

  return rows[0] ?? null;
}

async function getLockedStudentWallet(
  connection: PoolConnection,
  schoolId: number,
  schoolYearId: number,
  studentId: number,
) {
  const [rows] = await connection.execute<WalletRow[]>(
    `SELECT w.id, w.balance, w.status
     FROM wallets w
     JOIN students st ON st.id = w.student_id
     JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = :schoolYearId
     WHERE st.id = :studentId
       AND st.school_id = :schoolId
       AND st.status = 'active'
     LIMIT 1
     FOR UPDATE`,
    { studentId, schoolId, schoolYearId },
  );

  return rows[0] ?? null;
}

async function toast(title: string, description: string) {
  await setAuthFlashToast({
    role: "admin",
    title,
    description,
  });
}

function revalidateStorePaths() {
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/allowance");
  revalidatePath("/admin/store-transactions");
  revalidatePath("/admin/reports");
  revalidatePath("/parent/dashboard");
  revalidatePath("/parent/wallet");
}

function value(formData: FormData, key: string) {
  const fieldValue = formData.get(key);

  return typeof fieldValue === "string" ? fieldValue.trim() : "";
}

function idValue(formData: FormData, key: string) {
  const parsed = Number(value(formData, key));

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function cappedAmountValue(formData: FormData, key: string) {
  const amount = amountValue(formData, key);

  return amount !== null && amount > 0 && amount <= maxStorePurchaseAmount ? amount : null;
}

function optionalFeeAmount(formData: FormData, key: string) {
  const raw = value(formData, key);

  if (!raw) {
    return 0;
  }

  const amount = amountValue(formData, key);

  return amount !== null && amount >= 0 ? amount : null;
}

function amountValue(formData: FormData, key: string) {
  const raw = value(formData, key);

  if (!raw) {
    return null;
  }

  const parsed = roundMoney(Number(raw));

  return Number.isFinite(parsed) ? parsed : null;
}

function merchantType(formData: FormData) {
  const selectedType = value(formData, "type");

  return merchantTypes.has(selectedType as StoreMerchantType) ? (selectedType as StoreMerchantType) : null;
}

function decimalValue(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function makeReferenceNumber(prefix: "STR") {
  const timestamp = new Date()
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 14);
  const suffix = randomBytes(4).toString("hex").toUpperCase();

  return `${prefix}-${timestamp}-${suffix}`;
}

function duplicateRecord(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY";
}

class StoreValidationError extends Error {}

type MerchantRow = RowDataPacket & {
  id: number;
  name: string;
};

type WalletRow = RowDataPacket & {
  id: number;
  balance: number | string;
  status: "active" | "frozen" | "closed";
};
