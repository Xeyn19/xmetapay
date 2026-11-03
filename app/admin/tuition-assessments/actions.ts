"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

import { pool } from "@/lib/auth/db";
import { requireRole } from "@/lib/auth/session";
import {
  archiveFeeSchedule,
  approveFeeSchedule,
  AssessmentWorkflowError,
  createCreditType,
  createFeeSchedule,
  cloneFeeSchedule,
  postAssessmentBatch,
  previewAssessment,
  requireAssessmentAdmin,
  type AcademicAudience,
  type AssessmentActionState,
} from "@/lib/fees/assessment-workflow";

const initialError = (error: unknown): AssessmentActionState => ({
  status: "error",
  title: "Unable to continue",
  message: error instanceof AssessmentWorkflowError ? error.message : "The request could not be completed. No financial records were changed.",
});

export async function assessmentWizardAction(_previous: AssessmentActionState, formData: FormData): Promise<AssessmentActionState> {
  const connection = await pool.getConnection();
  try {
    const session = await requireRole("admin");
    const context = await requireAssessmentAdmin(session.userId);
    const request = {
      ...context,
      scheduleId: integer(formData, "scheduleId"),
      studentIds: integers(formData, "studentIds"),
      creditTypeId: optionalInteger(formData, "creditTypeId"),
      creditAmount: decimal(formData, "creditAmount"),
      creditReference: text(formData, "creditReference"),
      paymentPlanId: optionalInteger(formData, "paymentPlanId"),
    };
    await connection.beginTransaction();
    if (text(formData, "intent") === "post") {
      const result = await postAssessmentBatch(connection, {
        ...request,
        previewFingerprint: text(formData, "previewFingerprint"),
        submissionToken: text(formData, "submissionToken") || randomUUID(),
        postedByUserId: session.userId,
      });
      await connection.commit();
      revalidateFinancialPaths();
      return { status: "success", title: "Assessments posted", message: `${result.postedCount} student assessment${result.postedCount === 1 ? "" : "s"} posted atomically.`, batchReference: result.batchReference };
    }
    const preview = await previewAssessment(connection, request);
    await connection.rollback();
    return { status: "preview", title: "Review before posting", message: "No charges have been posted yet.", preview };
  } catch (error) {
    await connection.rollback();
    return initialError(error);
  } finally {
    connection.release();
  }
}

export async function tuitionSetupAction(_previous: AssessmentActionState, formData: FormData): Promise<AssessmentActionState> {
  const connection = await pool.getConnection();
  try {
    const session = await requireRole("admin");
    const context = await requireAssessmentAdmin(session.userId);
    await connection.beginTransaction();
    const intent = text(formData, "intent");
    if (intent === "create-credit") await createCreditType(connection, { schoolId: context.schoolId, userId: session.userId, code: text(formData, "code"), name: text(formData, "name"), sourceKind: text(formData, "sourceKind"), requiresReference: formData.get("requiresReference") === "on", maxAmount: optionalDecimal(formData, "maxAmount"), maxPercent: optionalDecimal(formData, "maxPercent") });
    else if (intent === "approve-schedule") await approveFeeSchedule(connection, { ...context, userId: session.userId, scheduleId: integer(formData, "scheduleId") });
    else if(intent === "clone-schedule") await cloneFeeSchedule(connection,{...context,userId:session.userId,scheduleId:integer(formData,"scheduleId")});
    else if(intent === "archive-schedule") await archiveFeeSchedule(connection,{...context,scheduleId:integer(formData,"scheduleId")});
    else if (intent === "create-schedule") { const terms=planTerms(formData); await createFeeSchedule(connection, {
      ...context, userId: session.userId, name: text(formData, "name"), audience: text(formData, "audience") as AcademicAudience,
      periodId: optionalInteger(formData, "periodId"), targetIds: integers(formData, "targetIds"), tuitionName: text(formData, "tuitionName"), tuitionAmount: decimal(formData, "tuitionAmount"),
      mandatoryName: text(formData, "mandatoryName"), mandatoryAmount: decimal(formData, "mandatoryAmount"), mandatoryTiming: text(formData, "mandatoryTiming") === "upfront" ? "upfront" : "installment",
      dueDate: text(formData, "dueDate"), planName: text(formData, "planName"), termNames: terms.map(term=>term.name), termPercentages:terms.map(term=>term.percentage), termDates:terms.map(term=>term.date),
    }); }
    else throw new AssessmentWorkflowError("Choose a valid tuition setup action.");
    await connection.commit();
    revalidateFinancialPaths();
    revalidatePath("/admin/tuition/schedules");
    revalidatePath("/admin/school-setup/academics");
    return { status: "success", title: "Saved", message: "The tuition workflow setup was updated." };
  } catch (error) {
    await connection.rollback();
    return initialError(error);
  } finally {
    connection.release();
  }
}

function text(data: FormData, key: string) { return String(data.get(key) ?? "").trim(); }
const fieldNames: Record<string,string> = { scheduleId:"tuition package", periodId:"academic period", levelId:"program and year level", studentId:"student", sectionId:"college section" };
function integer(data: FormData, key: string) { const value = Number.parseInt(text(data, key), 10); if (!Number.isInteger(value) || value <= 0) throw new AssessmentWorkflowError(`Please select a valid ${fieldNames[key] ?? key}.`); return value; }
function integers(data: FormData, key: string) { return data.getAll(key).map(value => Number.parseInt(String(value), 10)).filter(value => Number.isInteger(value) && value > 0); }
function optionalInteger(data: FormData, key: string) { const value = Number.parseInt(text(data, key), 10); return Number.isInteger(value) && value > 0 ? value : null; }
function decimal(data: FormData, key: string) { const value = Number(text(data, key) || 0); if (!Number.isFinite(value) || value < 0) throw new AssessmentWorkflowError(`Please enter a valid non-negative amount for ${key === "creditAmount" ? "the deduction" : "this field"}.`); return Math.round(value * 100) / 100; }
function planTerms(data:FormData){const names=data.getAll("termNames").map(String),percentages=data.getAll("termPercentages").map(Number),dates=data.getAll("termDates").map(String);return names.map((name,index)=>({name:name.trim(),percentage:percentages[index],date:(dates[index]??"").trim()})).filter(term=>term.name||term.date||Number.isFinite(term.percentage)&&term.percentage>0);}
function optionalDecimal(data: FormData, key: string) { return text(data, key) ? decimal(data, key) : null; }
function revalidateFinancialPaths() { ["/admin/tuition", "/admin/collections", "/parent/fees", "/parent/pay-tuition"].forEach(path => revalidatePath(path)); }
