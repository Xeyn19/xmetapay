"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PoolConnection } from "mysql2/promise";

import { getAdminStaffRole } from "@/lib/admin/access";
import { canAccessFinance } from "@/lib/admin/permissions";
import { pool } from "@/lib/auth/db";
import { requireRole, setAuthFlashToast } from "@/lib/auth/session";
import { getResolvedAdminSchoolSetup } from "@/lib/school/setup";
import { parseTuitionTermInputs, saveTuitionTermSchedule, TuitionTermsError, type TuitionTermInput } from "@/lib/tuition/terms";

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

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/tuition");
  revalidatePath("/parent/fees");
  revalidatePath("/parent/pay-tuition");
  redirect("/admin/tuition");
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

function field(value: FormDataEntryValue | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}
