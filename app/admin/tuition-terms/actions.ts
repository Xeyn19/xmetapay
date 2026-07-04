"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getAdminStaffRole } from "@/lib/admin/access";
import { canAccessFinance } from "@/lib/admin/permissions";
import { pool } from "@/lib/auth/db";
import { requireRole, setAuthFlashToast } from "@/lib/auth/session";
import { getResolvedAdminSchoolSetup } from "@/lib/school/setup";
import { parseTuitionTermInputs, saveTuitionTermSchedule, TuitionTermsError, type TuitionTermInput } from "@/lib/tuition/terms";

const tuitionStatuses = new Set(["open", "partial", "paid", "cancelled"]);

export async function saveTuitionTermsAction(formData: FormData) {
  const context = await requireFinanceContext();
  const assignmentId = idValue(formData, "assignmentId");
  let terms: TuitionTermInput[];

  try {
    terms = parseTuitionTermInputs(formData);
  } catch (error) {
    await toast("Terms not saved", error instanceof TuitionTermsError ? error.message : "Check the submitted term rows.");
    redirect("/admin/tuition");
  }

  if (!assignmentId) {
    await toast("Terms not saved", "Choose a valid tuition assignment.");
    redirect("/admin/tuition");
  }

  if (terms.length === 0) {
    await toast("Terms not saved", "Add at least one payment term.");
    redirect("/admin/tuition");
  }

  let connection: PoolConnection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const savedTerms = await saveTuitionTermSchedule(connection, {
      schoolId: context.schoolId,
      schoolYearId: context.schoolYearId,
      assignmentId,
      terms,
    });

    await connection.commit();
    await toast("Tuition terms saved", `${savedTerms} terms now control this tuition payment schedule.`);
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    await toast(
      "Terms not saved",
      error instanceof TuitionTermsError
        ? error.message
        : "Unable to save tuition terms. Check MySQL/XAMPP and try again.",
    );
  } finally {
    connection?.release();
  }

  revalidateTuitionPaths();
  redirect("/admin/tuition");
}

export async function updateTuitionAssignmentAction(formData: FormData) {
  const context = await requireFinanceContext();
  const assignmentId = idValue(formData, "assignmentId");
  const amountDue = amountValue(formData, "amountDue");
  const dueDate = field(formData.get("dueDate")) || null;
  const status = field(formData.get("status"));

  if (!assignmentId || !amountDue || amountDue <= 0 || !tuitionStatuses.has(status)) {
    await toast("Tuition not updated", "Enter a valid amount, due date, and status.");
    redirect("/admin/tuition");
  }

  let connection: PoolConnection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute<TuitionAssignmentRow[]>(
      `SELECT sfa.id, sfa.amount_due, sfa.amount_paid, sfa.status, COUNT(tpt.id) AS term_count
       FROM student_fee_assignments sfa
       JOIN fee_types ft ON ft.id = sfa.fee_type_id AND ft.category = 'tuition'
       JOIN students st ON st.id = sfa.student_id
       LEFT JOIN tuition_payment_terms tpt ON tpt.student_fee_assignment_id = sfa.id AND tpt.status <> 'cancelled'
       WHERE sfa.id = :assignmentId
         AND sfa.school_year_id = :schoolYearId
         AND st.school_id = :schoolId
       GROUP BY sfa.id, sfa.amount_due, sfa.amount_paid, sfa.status
       FOR UPDATE`,
      {
        assignmentId,
        schoolId: context.schoolId,
        schoolYearId: context.schoolYearId,
      },
    );
    const row = rows[0];

    if (!row) {
      throw new TuitionAssignmentError("Choose a valid tuition assignment.");
    }

    const paid = Number(row.amount_paid);
    const currentAmount = Number(row.amount_due);
    const termCount = Number(row.term_count);

    if (amountDue < paid) {
      throw new TuitionAssignmentError("Amount due cannot be lower than the amount already paid.");
    }

    if (termCount > 0 && amountDue !== currentAmount) {
      throw new TuitionAssignmentError("This tuition has terms. Use Manage terms before changing the total amount.");
    }

    await connection.execute<ResultSetHeader>(
      `UPDATE student_fee_assignments
       SET amount_due = :amountDue,
         due_date = :dueDate,
         status = :status
       WHERE id = :assignmentId`,
      {
        assignmentId,
        amountDue,
        dueDate,
        status,
      },
    );

    await connection.commit();
    await toast(
      "Tuition updated",
      termCount > 0
        ? "Report details were updated. Parent deadlines still follow the term schedule."
        : "The parent fee deadline and tuition details were updated.",
    );
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    await toast(
      "Tuition not updated",
      error instanceof TuitionAssignmentError
        ? error.message
        : "Unable to update tuition. Check MySQL/XAMPP and try again.",
    );
  } finally {
    connection?.release();
  }

  revalidateTuitionPaths();
  redirect("/admin/tuition");
}

function revalidateTuitionPaths() {
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/tuition");
  revalidatePath("/admin/collections");
  revalidatePath("/parent/fees");
  revalidatePath("/parent/pay-tuition");
}

async function requireFinanceContext() {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);

  if (!canAccessFinance(staffRole)) {
    await toast("Access limited", "Only school administrators and finance officers can manage tuition terms.");
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

async function toast(title: string, description: string) {
  await setAuthFlashToast({
    role: "admin",
    title,
    description,
  });
}

function idValue(formData: FormData, key: string) {
  const parsed = Number(field(formData.get(key)));

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function amountValue(formData: FormData, key: string) {
  const parsed = Number(field(formData.get(key)));

  return Number.isFinite(parsed) ? parsed : null;
}

function field(value: FormDataEntryValue | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

class TuitionAssignmentError extends Error {}

type TuitionAssignmentRow = RowDataPacket & {
  id: number;
  amount_due: number | string;
  amount_paid: number | string;
  status: string;
  term_count: number | string;
};
