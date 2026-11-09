"use server";

import { revalidatePath } from "next/cache";
import type { PoolConnection } from "mysql2/promise";

import { getAdminStaffRole } from "@/lib/admin/access";
import { canAccessFinance } from "@/lib/admin/permissions";
import { pool } from "@/lib/auth/db";
import { requireRole } from "@/lib/auth/session";
import {
  createOtherFeeType,
  OTHER_FEE_AMOUNT_MODES,
  OTHER_FEE_AUDIENCES,
  OTHER_FEE_BILLING_BASES,
  OTHER_FEE_GROUPS,
  OTHER_FEE_POLICIES,
  OtherFeeWorkflowError,
  postOtherFeeCharge,
  type OtherFeeAmountMode,
  type OtherFeeAudience,
  type OtherFeeBillingBasis,
  type OtherFeeGroup,
  type OtherFeePolicy,
} from "@/lib/fees/other-fees";
import { getAdminSchoolContext } from "@/lib/school/setup";

export type OtherFeeActionState = {
  status: "idle" | "error" | "success";
  message: string;
  field?: string;
  reference?: string;
};

export const initialOtherFeeActionState: OtherFeeActionState = { status: "idle", message: "" };

export async function createOtherFeeTypeAction(_previous: OtherFeeActionState, formData: FormData): Promise<OtherFeeActionState> {
  let connection: PoolConnection | null = null;
  try {
    const context = await requireFinanceWriteContext();
    const amountMode = closedValue(value(formData, "amountMode"), OTHER_FEE_AMOUNT_MODES, "fixed");
    const audience = closedValue(value(formData, "audience"), OTHER_FEE_AUDIENCES, "basic") as OtherFeeAudience;
    if ((context.educationScope === "basic" && audience !== "basic") || (context.educationScope === "higher" && audience !== "higher")) {
      throw new OtherFeeWorkflowError("Choose an academic audience enabled in School Setup.", "audience");
    }
    const defaultAmount = amountMode === "assignment" ? 0 : numberValue(formData, "defaultAmount");
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await createOtherFeeType(connection, {
      schoolId: context.schoolId,
      schoolYearId: context.schoolYearId,
      draft: {
        code: value(formData, "code").toUpperCase(),
        name: value(formData, "name"),
        description: value(formData, "description"),
        group: closedValue(value(formData, "group"), OTHER_FEE_GROUPS, "other") as OtherFeeGroup,
        audience,
        policy: closedValue(value(formData, "policy"), OTHER_FEE_POLICIES, "mandatory") as OtherFeePolicy,
        billingBasis: closedValue(value(formData, "billingBasis"), OTHER_FEE_BILLING_BASES, "school_year") as OtherFeeBillingBasis,
        amountMode: amountMode as OtherFeeAmountMode,
        defaultAmount,
        approvalReference: value(formData, "approvalReference"),
      },
    });
    await connection.commit();
    revalidateFinancePaths();
    return { status: "success", message: "Fee type created. It is now available for student assignment." };
  } catch (error) {
    await connection?.rollback().catch(() => undefined);
    if (isDuplicate(error)) return { status: "error", field: duplicateField(error), message: "That fee name or code already exists for this school year." };
    return safeError(error, "Unable to create the fee type. Confirm the latest database migration is imported.");
  } finally {
    connection?.release();
  }
}

export async function postOtherFeeChargeAction(_previous: OtherFeeActionState, formData: FormData): Promise<OtherFeeActionState> {
  let connection: PoolConnection | null = null;
  try {
    const context = await requireFinanceWriteContext();
    const studentIds = formData.getAll("studentIds").map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0);
    const audience = value(formData, "audience") === "higher" ? "higher" : "basic";
    if ((context.educationScope === "basic" && audience !== "basic") || (context.educationScope === "higher" && audience !== "higher")) {
      throw new OtherFeeWorkflowError("Choose an academic audience enabled in School Setup.", "audience");
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const result = await postOtherFeeCharge(connection, {
      schoolId: context.schoolId,
      schoolYearId: context.schoolYearId,
      schoolYearStartsOn: context.startsOn,
      schoolYearEndsOn: context.endsOn,
      userId: context.userId,
      draft: {
        feeTypeId: integerValue(formData, "feeTypeId"),
        audience,
        periodId: optionalIntegerValue(formData, "periodId"),
        chargeTitle: value(formData, "chargeTitle"),
        amountPerStudent: numberValue(formData, "amountPerStudent"),
        dueDate: value(formData, "dueDate"),
        approvalReference: value(formData, "approvalReference"),
        internalNote: value(formData, "internalNote"),
        overrideReason: value(formData, "overrideReason"),
        applicabilityConfirmed: formData.get("applicabilityConfirmed") === "on",
        studentIds,
        submissionToken: value(formData, "submissionToken"),
      },
    });
    await connection.commit();
    revalidateFinancePaths();
    const duplicateNote = result.duplicateCount ? ` ${result.duplicateCount} duplicate${result.duplicateCount === 1 ? " was" : "s were"} skipped.` : "";
    return { status: "success", reference: result.reference, message: `Assigned to ${result.assignedCount} student${result.assignedCount === 1 ? "" : "s"}.${duplicateNote}` };
  } catch (error) {
    await connection?.rollback().catch(() => undefined);
    return safeError(error, "Unable to assign the fee. No student charges were created.");
  } finally {
    connection?.release();
  }
}

export async function updateOtherFeeTypeStatusAction(feeTypeId: number, status: "active" | "inactive"): Promise<void> {
  const context = await requireFinanceWriteContext();
  if (!Number.isInteger(feeTypeId) || feeTypeId < 1) throw new OtherFeeWorkflowError("Choose a valid Other fee type.");
  await pool.execute(
    `UPDATE fee_types SET status=:status WHERE id=:feeTypeId AND school_id=:schoolId AND school_year_id=:schoolYearId AND category='other'`,
    { feeTypeId, status, schoolId: context.schoolId, schoolYearId: context.schoolYearId },
  );
  revalidateFinancePaths();
}

async function requireFinanceWriteContext() {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);
  if (!canAccessFinance(staffRole)) throw new OtherFeeWorkflowError("Only school administrators and finance officers can manage other fees.");
  const school = await getAdminSchoolContext(session.userId);
  if (!school.schoolId || !school.activeSchoolYear) throw new OtherFeeWorkflowError("Complete School Setup and activate a school year first.");
  if (!school.selectedSchoolYearIsActive) throw new OtherFeeWorkflowError("Historical school years are read-only. Switch to the active school year.");
  return { userId: session.userId, schoolId: school.schoolId, schoolYearId: school.activeSchoolYear.id, startsOn: school.activeSchoolYear.startsOn, endsOn: school.activeSchoolYear.endsOn, educationScope: school.educationScope };
}

function safeError(error: unknown, fallback: string): OtherFeeActionState {
  if (error instanceof OtherFeeWorkflowError) return { status: "error", message: error.message, field: error.field };
  console.error("[other-fee-action]", error instanceof Error ? error.message : error);
  return { status: "error", message: fallback };
}
function value(formData: FormData, key: string) { const item = formData.get(key); return typeof item === "string" ? item.trim() : ""; }
function numberValue(formData: FormData, key: string) { const parsed = Number(value(formData, key)); return Number.isFinite(parsed) ? parsed : 0; }
function integerValue(formData: FormData, key: string) { const parsed = Number(value(formData, key)); return Number.isInteger(parsed) && parsed > 0 ? parsed : 0; }
function optionalIntegerValue(formData: FormData, key: string) { const parsed = integerValue(formData, key); return parsed || null; }
function closedValue<T extends readonly string[]>(candidate: string, values: T, fallback: T[number]) { return values.includes(candidate) ? candidate as T[number] : fallback; }
function isDuplicate(error: unknown) { return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY"; }
function duplicateField(error: unknown) { return String((error as { message?: string }).message ?? "").includes("year_code") ? "code" : "name"; }
function revalidateFinancePaths() { for (const path of ["/admin/other-fees", "/admin/dashboard", "/parent/fees", "/parent/pay-tuition"]) revalidatePath(path); }
