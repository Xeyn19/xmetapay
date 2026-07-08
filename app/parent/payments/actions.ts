"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { requireRole, setAuthFlashToast } from "@/lib/auth/session";
import type { PaymentChannel } from "@/lib/payments/records";
import { applyTuitionTermPayment, TuitionTermsError } from "@/lib/tuition/terms";

const paymentChannels = new Set<PaymentChannel>(["cash", "card", "online_banking", "gcash", "maya"]);

export async function createParentPaymentAction(formData: FormData) {
  const session = await requireRole("parent");
  const feeAssignmentIds = selectedFeeIds(formData);
  const tuitionTermIds = selectedTermIds(formData);
  const channel = paymentChannel(formData);

  if (feeAssignmentIds.length === 0 && tuitionTermIds.length === 0) {
    await toast("Payment not recorded", "Select at least one payable fee.");
    redirect("/parent/pay-tuition");
  }

  if (feeAssignmentIds.length > 0 && tuitionTermIds.length > 0) {
    await toast("Payment not recorded", "Pay tuition terms separately from regular fee balances.");
    redirect("/parent/pay-tuition");
  }

  if (!channel) {
    await toast("Payment not recorded", "Choose a supported local test payment method.");
    redirect("/parent/pay-tuition");
  }

  let connection: PoolConnection | null = null;
  let receiptId: number | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    if (tuitionTermIds.length > 0) {
      receiptId = await applyTuitionTermPayment(connection, {
        parentUserId: session.userId,
        tuitionTermIds,
        channel,
        makeReferenceNumber,
      });
    } else {
      const fees = await getLockedPayableFees(connection, session.userId, feeAssignmentIds);

      if (fees.length !== feeAssignmentIds.length) {
        throw new PaymentValidationError("Some selected fees are no longer payable. Refresh and try again.");
      }

      const studentIds = new Set(fees.map((fee) => fee.student_id));

      if (studentIds.size !== 1) {
        throw new PaymentValidationError("Pay one student's fees at a time.");
      }

      const schoolIds = new Set(fees.map((fee) => fee.school_id));

      if (schoolIds.size !== 1) {
        throw new PaymentValidationError("Selected fees must belong to one school.");
      }

      const schoolYearIds = new Set(fees.map((fee) => fee.school_year_id));

      if (schoolYearIds.size !== 1) {
        throw new PaymentValidationError("Selected fees must belong to one school year.");
      }

      const total = roundMoney(
        fees.reduce((sum, fee) => sum + Math.max(decimalValue(fee.amount_due) - decimalValue(fee.amount_paid), 0), 0),
      );

      if (total <= 0) {
        throw new PaymentValidationError("The selected fees are already paid.");
      }

      const referenceNumber = makeReferenceNumber("PAY");
      const receiptNumber = makeReferenceNumber("RCT");
      const [paymentResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO payments (school_id, school_year_id, payer_user_id, student_id, reference_number, channel, amount, status, paid_at)
         VALUES (:schoolId, :schoolYearId, :payerUserId, :studentId, :referenceNumber, :channel, :amount, 'paid', NOW())`,
        {
          schoolId: fees[0].school_id,
          schoolYearId: fees[0].school_year_id,
          payerUserId: session.userId,
          studentId: fees[0].student_id,
          referenceNumber,
          channel,
          amount: total,
        },
      );
      const paymentId = paymentResult.insertId;

      for (const fee of fees) {
        const balance = roundMoney(Math.max(decimalValue(fee.amount_due) - decimalValue(fee.amount_paid), 0));

        if (balance <= 0) {
          continue;
        }

        await connection.execute<ResultSetHeader>(
          `INSERT INTO payment_allocations (payment_id, student_fee_assignment_id, amount)
           VALUES (:paymentId, :feeAssignmentId, :amount)`,
          {
            paymentId,
            feeAssignmentId: fee.id,
            amount: balance,
          },
        );
        await connection.execute<ResultSetHeader>(
          `UPDATE student_fee_assignments
           SET amount_paid = LEAST(amount_due, amount_paid + :amount),
             status = CASE
               WHEN amount_paid + :amount >= amount_due THEN 'paid'
               ELSE 'partial'
             END
           WHERE id = :feeAssignmentId`,
          {
            feeAssignmentId: fee.id,
            amount: balance,
          },
        );
      }

      const [receiptResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO receipts (payment_id, receipt_number)
         VALUES (:paymentId, :receiptNumber)`,
        {
          paymentId,
          receiptNumber,
        },
      );
      receiptId = receiptResult.insertId;
    }

    await connection.commit();
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    await toast(
      "Payment not recorded",
      error instanceof PaymentValidationError || error instanceof TuitionTermsError
        ? error.message
        : "Unable to record the payment. Check MySQL/XAMPP and try again.",
    );
    redirect("/parent/pay-tuition");
  } finally {
    connection?.release();
  }

  revalidatePaymentPaths();
  await toast("Payment recorded", "Your receipt and balances were updated.");
  redirect(`/parent/receipt?receiptId=${receiptId}`);
}

async function getLockedPayableFees(
  connection: PoolConnection,
  parentUserId: number,
  feeAssignmentIds: number[],
) {
  const placeholders = feeAssignmentIds.map((_, index) => `:feeAssignmentId${index}`).join(", ");
  const params = Object.fromEntries(feeAssignmentIds.map((id, index) => [`feeAssignmentId${index}`, id]));
  const [rows] = await connection.execute<PayableFeeRow[]>(
    `SELECT sfa.id, sfa.school_year_id, sfa.amount_due, sfa.amount_paid, sfa.status,
       st.id AS student_id, st.school_id
     FROM student_fee_assignments sfa
     JOIN students st ON st.id = sfa.student_id
     JOIN student_guardians sg ON sg.student_id = st.id AND sg.parent_user_id = :parentUserId
     WHERE sfa.id IN (${placeholders})
       AND sfa.status IN ('open', 'partial')
       AND sfa.amount_due > sfa.amount_paid
     FOR UPDATE`,
    {
      parentUserId,
      ...params,
    },
  );

  return rows;
}

function selectedFeeIds(formData: FormData) {
  const ids = formData
    .getAll("feeAssignmentId")
    .map((value) => (typeof value === "string" ? Number(value) : NaN))
    .filter((value) => Number.isInteger(value) && value > 0);

  return [...new Set(ids)].slice(0, 25);
}

function selectedTermIds(formData: FormData) {
  const ids = formData
    .getAll("tuitionTermId")
    .map((value) => (typeof value === "string" ? Number(value) : NaN))
    .filter((value) => Number.isInteger(value) && value > 0);

  return [...new Set(ids)].slice(0, 25);
}

function paymentChannel(formData: FormData) {
  const value = formData.get("channel");

  if (typeof value !== "string") {
    return null;
  }

  return paymentChannels.has(value as PaymentChannel) ? (value as PaymentChannel) : null;
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

function revalidatePaymentPaths() {
  revalidatePath("/parent/dashboard");
  revalidatePath("/parent/fees");
  revalidatePath("/parent/pay-tuition");
  revalidatePath("/parent/history");
  revalidatePath("/parent/receipt");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/collections");
  revalidatePath("/admin/tuition");
  revalidatePath("/admin/other-fees");
}

class PaymentValidationError extends Error {}

type PayableFeeRow = RowDataPacket & {
  id: number;
  student_id: number;
  school_id: number;
  school_year_id: number;
  amount_due: number | string;
  amount_paid: number | string;
  status: string;
};
