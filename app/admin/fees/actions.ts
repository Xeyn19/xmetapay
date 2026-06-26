"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { requireRole, setAuthFlashToast } from "@/lib/auth/session";
import { getAdminStaffRole } from "@/lib/admin/access";
import { canAccessFinance } from "@/lib/admin/permissions";
import { getResolvedAdminSchoolSetup } from "@/lib/school/setup";
import type { FeeCategory } from "@/lib/fees/records";

type AdminFeeRedirectPath = "/admin/tuition" | "/admin/other-fees";

export async function createFeeTypeAction(
  category: FeeCategory,
  redirectPath: AdminFeeRedirectPath,
  formData: FormData,
) {
  const context = await requireFinanceContext();
  const name = value(formData, "name");
  const defaultAmount = amountValue(formData, "defaultAmount");

  if (!name || !defaultAmount || defaultAmount <= 0) {
    await toast("Fee type not created", "Enter a fee name and an amount greater than zero.");
    redirect(redirectPath);
  }

  try {
    await pool.execute<ResultSetHeader>(
      `INSERT INTO fee_types (school_id, school_year_id, name, category, default_amount, status)
       VALUES (:schoolId, :schoolYearId, :name, :category, :defaultAmount, 'active')`,
      {
        schoolId: context.schoolId,
        schoolYearId: context.schoolYearId,
        name,
        category,
        defaultAmount,
      },
    );
    await toast("Fee type created", `${name} is ready for student assignment.`);
  } catch (error) {
    await toast(
      "Fee type not created",
      duplicateRecord(error)
        ? "A fee type with that name already exists for the active school year."
        : "Unable to create the fee type. Check MySQL/XAMPP and try again.",
    );
  }

  revalidateFinancePaths();
  redirect(redirectPath);
}

export async function assignStudentFeeAction(
  category: FeeCategory,
  redirectPath: AdminFeeRedirectPath,
  formData: FormData,
) {
  const context = await requireFinanceContext();
  const studentId = idValue(formData, "studentId");
  const feeTypeId = idValue(formData, "feeTypeId");
  const customAmount = amountValue(formData, "amountDue");
  const dueDate = value(formData, "dueDate") || null;

  if (!studentId || !feeTypeId) {
    await toast("Fee not assigned", "Choose a student and fee type.");
    redirect(redirectPath);
  }

  try {
    const [feeRows] = await pool.execute<FeeTypeRow[]>(
      `SELECT id, default_amount
       FROM fee_types
       WHERE id = :feeTypeId
         AND school_id = :schoolId
         AND school_year_id = :schoolYearId
         AND category = :category
         AND status = 'active'
       LIMIT 1`,
      {
        feeTypeId,
        schoolId: context.schoolId,
        schoolYearId: context.schoolYearId,
        category,
      },
    );
    const feeType = feeRows[0];

    if (!feeType) {
      await toast("Fee not assigned", "Choose a valid active fee type for this school year.");
      redirect(redirectPath);
    }

    const [studentRows] = await pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS total
       FROM students st
       JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = :schoolYearId
       WHERE st.id = :studentId
         AND st.school_id = :schoolId
         AND e.status = 'enrolled'`,
      {
        studentId,
        schoolId: context.schoolId,
        schoolYearId: context.schoolYearId,
      },
    );

    if (Number(studentRows[0]?.total ?? 0) !== 1) {
      await toast("Fee not assigned", "Choose an enrolled student from this school.");
      redirect(redirectPath);
    }

    const amountDue = customAmount && customAmount > 0 ? customAmount : Number(feeType.default_amount);

    if (!amountDue || amountDue <= 0) {
      await toast("Fee not assigned", "Enter an amount greater than zero or update the fee type default amount.");
      redirect(redirectPath);
    }

    await pool.execute<ResultSetHeader>(
      `INSERT INTO student_fee_assignments (student_id, fee_type_id, school_year_id, amount_due, amount_paid, due_date, status)
       VALUES (:studentId, :feeTypeId, :schoolYearId, :amountDue, 0.00, :dueDate, 'open')`,
      {
        studentId,
        feeTypeId,
        schoolYearId: context.schoolYearId,
        amountDue,
        dueDate,
      },
    );
    await toast("Fee assigned", "The student balance is now visible in admin and parent fee screens.");
  } catch (error) {
    await toast(
      "Fee not assigned",
      duplicateRecord(error)
        ? "That fee is already assigned to the selected student for this school year."
        : "Unable to assign the fee. Check MySQL/XAMPP and try again.",
    );
  }

  revalidateFinancePaths();
  redirect(redirectPath);
}

async function requireFinanceContext() {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);

  if (!canAccessFinance(staffRole)) {
    await toast("Access limited", "Only school administrators and finance officers can manage fees.");
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

function revalidateFinancePaths() {
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/tuition");
  revalidatePath("/admin/other-fees");
  revalidatePath("/parent/fees");
}

function value(formData: FormData, key: string) {
  const fieldValue = formData.get(key);

  return typeof fieldValue === "string" ? fieldValue.trim() : "";
}

function idValue(formData: FormData, key: string) {
  const parsed = Number(value(formData, key));

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function amountValue(formData: FormData, key: string) {
  const raw = value(formData, key);

  if (!raw) {
    return null;
  }

  const parsed = Number(raw);

  return Number.isFinite(parsed) ? parsed : null;
}

function duplicateRecord(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY";
}

type FeeTypeRow = RowDataPacket & {
  id: number;
  default_amount: number | string;
};

type CountRow = RowDataPacket & {
  total: number;
};
