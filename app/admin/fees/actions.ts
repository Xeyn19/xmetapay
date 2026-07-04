"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { requireRole, setAuthFlashToast } from "@/lib/auth/session";
import { getAdminStaffRole } from "@/lib/admin/access";
import { canAccessFinance } from "@/lib/admin/permissions";
import { getResolvedAdminSchoolSetup } from "@/lib/school/setup";
import type { FeeCategory } from "@/lib/fees/records";
import {
  createTuitionTermsFromTemplate,
  getFeeTypeTermTemplate,
  parseTuitionTermInputs,
  saveFeeTypeTermTemplate,
  TuitionTermsError,
  type TuitionTermInput,
  validateTuitionTermSchedule,
} from "@/lib/tuition/terms";

type AdminFeeRedirectPath = "/admin/tuition" | "/admin/other-fees";

export async function createFeeTypeAction(
  category: FeeCategory,
  redirectPath: AdminFeeRedirectPath,
  formData: FormData,
) {
  const context = await requireFinanceContext();
  const name = value(formData, "name");
  const defaultAmount = amountValue(formData, "defaultAmount");
  let templateTerms: TuitionTermInput[] = [];

  if (!name || !defaultAmount || defaultAmount <= 0) {
    await toast("Fee type not created", "Enter a fee name and an amount greater than zero.");
    redirect(redirectPath);
  }

  if (category === "tuition") {
    try {
      templateTerms = parseTuitionTermInputs(formData);

      if (templateTerms.length > 0) {
        validateTuitionTermSchedule(templateTerms, defaultAmount);
      }
    } catch (error) {
      await toast("Fee type not created", error instanceof TuitionTermsError ? error.message : "Check the payment term template rows.");
      redirect(redirectPath);
    }
  }

  let connection: PoolConnection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(
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
    await saveFeeTypeTermTemplate(connection, {
      feeTypeId: result.insertId,
      terms: templateTerms,
    });
    await connection.commit();
    await toast(
      "Fee type created",
      templateTerms.length > 0
        ? `${name} is ready for assignment with ${templateTerms.length} payment terms.`
        : `${name} is ready for student assignment.`,
    );
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    await toast(
      "Fee type not created",
      duplicateRecord(error)
        ? "A fee type with that name already exists for the active school year."
        : "Unable to create the fee type. Check MySQL/XAMPP and try again.",
    );
  } finally {
    connection?.release();
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
  const studentIds = idValues(formData, "studentIds", "studentId");
  const feeTypeId = idValue(formData, "feeTypeId");
  const customAmount = amountValue(formData, "amountDue");
  const dueDate = value(formData, "dueDate") || null;
  let connection: PoolConnection | null = null;

  if (studentIds.length === 0 || !feeTypeId) {
    await toast("Fee not assigned", "Choose at least one enrolled student and a fee type.");
    redirect(redirectPath);
  }

  if (customAmount !== null && customAmount <= 0) {
    await toast("Fee not assigned", "Custom amount must be greater than zero, or leave it blank to use the fee default.");
    redirect(redirectPath);
  }

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [feeRows] = await connection.execute<FeeTypeRow[]>(
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
      throw new TuitionTermsError("Choose a valid active fee type for this school year.");
    }

    const studentPlaceholders = placeholders("studentId", studentIds);
    const studentParams = namedValues("studentId", studentIds);
    const [studentRows] = await connection.execute<StudentIdRow[]>(
      `SELECT st.id
       FROM students st
       JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = :schoolYearId
       WHERE st.id IN (${studentPlaceholders})
         AND st.school_id = :schoolId
         AND e.status = 'enrolled'`,
      {
        ...studentParams,
        schoolId: context.schoolId,
        schoolYearId: context.schoolYearId,
      },
    );

    if (studentRows.length !== studentIds.length) {
      throw new TuitionTermsError("Choose only enrolled students from this school.");
    }

    const amountDue = customAmount && customAmount > 0 ? customAmount : Number(feeType.default_amount);

    if (!amountDue || amountDue <= 0) {
      throw new TuitionTermsError("Enter an amount greater than zero or update the fee type default amount.");
    }

    const [existingRows] = await connection.execute<StudentAssignmentRow[]>(
      `SELECT student_id
       FROM student_fee_assignments
       WHERE fee_type_id = :feeTypeId
         AND school_year_id = :schoolYearId
         AND student_id IN (${studentPlaceholders})`,
      {
        ...studentParams,
        feeTypeId,
        schoolYearId: context.schoolYearId,
      },
    );
    const existingStudentIds = new Set(existingRows.map((row) => Number(row.student_id)));

    const insertValues = studentIds
      .map((_, index) => `(:assignStudentId${index}, :feeTypeId, :schoolYearId, :amountDue, 0.00, :dueDate, 'open')`)
      .join(", ");
    const insertParams = {
      ...namedValues("assignStudentId", studentIds),
      feeTypeId,
      schoolYearId: context.schoolYearId,
      amountDue,
      dueDate,
    };
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT IGNORE INTO student_fee_assignments (student_id, fee_type_id, school_year_id, amount_due, amount_paid, due_date, status)
       VALUES ${insertValues}`,
      insertParams,
    );
    const assignedCount = result.affectedRows;
    const skippedCount = studentIds.length - assignedCount;
    let createdTermCount = 0;

    if (category === "tuition" && assignedCount > 0) {
      const templateTerms = await getFeeTypeTermTemplate(connection, feeTypeId);

      if (templateTerms.length > 0) {
        const [assignmentRows] = await connection.execute<AssignmentIdRow[]>(
          `SELECT id, student_id
           FROM student_fee_assignments
           WHERE fee_type_id = :feeTypeId
             AND school_year_id = :schoolYearId
             AND student_id IN (${studentPlaceholders})`,
          {
            ...studentParams,
            feeTypeId,
            schoolYearId: context.schoolYearId,
          },
        );
        const newAssignmentIds = assignmentRows
          .filter((row) => !existingStudentIds.has(Number(row.student_id)))
          .map((row) => Number(row.id));

        createdTermCount = await createTuitionTermsFromTemplate(connection, {
          assignmentIds: newAssignmentIds,
          templateTerms,
          amountDue,
        });
      }
    }

    await connection.commit();

    if (assignedCount === 0) {
      await toast("Fee already assigned", "All selected students already have this fee for the active school year.");
    } else {
      await toast(
        "Fee assigned",
        skippedCount > 0
          ? `Assigned to ${assignedCount} students. ${skippedCount} were already assigned.`
          : createdTermCount > 0
            ? `Assigned to ${assignedCount} students with tuition payment terms.`
            : `Assigned to ${assignedCount} students. The balances are now visible in admin and parent fee screens.`,
      );
    }
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    await toast(
      "Fee not assigned",
      error instanceof TuitionTermsError
        ? error.message
        : duplicateRecord(error)
        ? "That fee is already assigned to the selected student for this school year."
        : "Unable to assign the fee. Check MySQL/XAMPP and try again.",
    );
  } finally {
    connection?.release();
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
  revalidatePath("/parent/pay-tuition");
}

function value(formData: FormData, key: string) {
  const fieldValue = formData.get(key);

  return typeof fieldValue === "string" ? fieldValue.trim() : "";
}

function idValue(formData: FormData, key: string) {
  const parsed = Number(value(formData, key));

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function idValues(formData: FormData, key: string, fallbackKey?: string) {
  const rawValues = formData.getAll(key);
  const fallbackValue = fallbackKey ? formData.get(fallbackKey) : null;
  const values = rawValues.length > 0 ? rawValues : fallbackValue ? [fallbackValue] : [];
  const parsedValues = values
    .map((fieldValue) => Number(typeof fieldValue === "string" ? fieldValue : ""))
    .filter((parsed): parsed is number => Number.isInteger(parsed) && parsed > 0);

  return [...new Set(parsedValues)];
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

function placeholders(prefix: string, values: number[]) {
  return values.map((_, index) => `:${prefix}${index}`).join(", ");
}

function namedValues(prefix: string, values: number[]) {
  return Object.fromEntries(values.map((currentValue, index) => [`${prefix}${index}`, currentValue]));
}

type FeeTypeRow = RowDataPacket & {
  id: number;
  default_amount: number | string;
};

type StudentIdRow = RowDataPacket & {
  id: number;
};

type StudentAssignmentRow = RowDataPacket & {
  student_id: number | string;
};

type AssignmentIdRow = RowDataPacket & {
  id: number | string;
  student_id: number | string;
};
