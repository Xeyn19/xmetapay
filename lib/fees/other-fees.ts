import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { getAdminSchoolContext } from "@/lib/school/setup";

export const OTHER_FEE_GROUPS = [
  "registration", "learning_resources", "laboratory_facilities", "student_services",
  "activities_programs", "identification_documents", "practicum_training", "campus_services", "other",
] as const;
export const OTHER_FEE_AUDIENCES = ["basic", "higher", "both"] as const;
export const OTHER_FEE_POLICIES = ["mandatory", "optional", "conditional"] as const;
export const OTHER_FEE_BILLING_BASES = ["school_year", "academic_period", "event", "recurring"] as const;
export const OTHER_FEE_AMOUNT_MODES = ["fixed", "assignment"] as const;

export type OtherFeeGroup = typeof OTHER_FEE_GROUPS[number];
export type OtherFeeAudience = typeof OTHER_FEE_AUDIENCES[number];
export type OtherFeePolicy = typeof OTHER_FEE_POLICIES[number];
export type OtherFeeBillingBasis = typeof OTHER_FEE_BILLING_BASES[number];
export type OtherFeeAmountMode = typeof OTHER_FEE_AMOUNT_MODES[number];

export type OtherFeeWorkspace = {
  ready: boolean;
  writable: boolean;
  warning: string | null;
  schoolYear: { id: number; name: string; startsOn: string; endsOn: string } | null;
  educationScope: "basic" | "higher" | "both";
  feeTypes: OtherFeeTypeOption[];
  students: OtherFeeStudentOption[];
  periods: Array<{ id: number; name: string; startsOn: string; endsOn: string; status: string }>;
};

export type OtherFeeTypeOption = {
  id: number;
  code: string;
  name: string;
  description: string;
  group: OtherFeeGroup;
  audience: OtherFeeAudience;
  policy: OtherFeePolicy;
  billingBasis: OtherFeeBillingBasis;
  amountMode: OtherFeeAmountMode;
  defaultAmount: number;
  approvalReference: string;
  status: "active" | "inactive";
};

export type OtherFeeStudentOption = {
  id: number;
  name: string;
  reference: string;
  audience: "basic" | "higher";
  periodId: number | null;
  groupLabel: string;
  gradeName: string;
  sectionName: string;
  programName: string;
  yearLevelName: string;
};

export type OtherFeeTypeDraft = {
  code: string;
  name: string;
  description: string;
  group: OtherFeeGroup;
  audience: OtherFeeAudience;
  policy: OtherFeePolicy;
  billingBasis: OtherFeeBillingBasis;
  amountMode: OtherFeeAmountMode;
  defaultAmount: number;
  approvalReference: string;
};

export type OtherFeeChargeDraft = {
  feeTypeId: number;
  audience: "basic" | "higher";
  periodId: number | null;
  chargeTitle: string;
  amountPerStudent: number;
  dueDate: string;
  approvalReference: string;
  internalNote: string;
  overrideReason: string;
  applicabilityConfirmed: boolean;
  studentIds: number[];
  submissionToken: string;
};

export type OtherFeePostResult = {
  reference: string;
  assignedCount: number;
  duplicateCount: number;
  totalAmount: number;
};

export class OtherFeeWorkflowError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
  }
}

export async function getOtherFeeWorkspace(adminUserId: number): Promise<OtherFeeWorkspace> {
  const context = await getAdminSchoolContext(adminUserId);
  const year = context.selectedSchoolYear;
  if (!context.schoolId || !year) {
    return { ready: false, writable: false, warning: context.warning ?? "Complete School Setup before managing other fees.", schoolYear: null, educationScope: context.educationScope, feeTypes: [], students: [], periods: [] };
  }
  try {
    const [feeRows, basicRows, collegeRows, periodRows] = await Promise.all([
      pool.execute<FeeTypeRow[]>(`SELECT id,code,name,description,other_fee_group,education_audience,collection_policy,billing_basis,amount_mode,default_amount,approval_reference,status FROM fee_types WHERE school_id=:schoolId AND school_year_id=:yearId AND category='other' ORDER BY status='active' DESC,name`, { schoolId: context.schoolId, yearId: year.id }),
      pool.execute<StudentRow[]>(`SELECT st.id,st.student_reference,CONCAT_WS(' ',st.first_name,NULLIF(st.middle_name,''),st.last_name) student_name,gl.name grade_name,COALESCE(sec.name,'No section') section_name FROM students st JOIN enrollments e ON e.student_id=st.id AND e.school_year_id=:yearId AND e.status='enrolled' JOIN grade_levels gl ON gl.id=e.grade_level_id LEFT JOIN sections sec ON sec.id=e.section_id WHERE st.school_id=:schoolId ORDER BY gl.sort_order,sec.name,student_name`, { schoolId: context.schoolId, yearId: year.id }),
      pool.execute<CollegeStudentRow[]>(`SELECT st.id,st.student_reference,CONCAT_WS(' ',st.first_name,NULLIF(st.middle_name,''),st.last_name) student_name,ce.academic_period_id,ap.code program_code,pyl.name year_level_name,COALESCE(cs.name,'No section') section_name FROM students st JOIN college_enrollments ce ON ce.student_id=st.id AND ce.school_year_id=:yearId AND ce.status='enrolled' JOIN academic_periods prd ON prd.id=ce.academic_period_id AND prd.status='active' JOIN academic_programs ap ON ap.id=ce.program_id JOIN program_year_levels pyl ON pyl.id=ce.program_year_level_id LEFT JOIN college_sections cs ON cs.id=ce.college_section_id WHERE st.school_id=:schoolId ORDER BY ap.code,pyl.level_number,cs.name,student_name`, { schoolId: context.schoolId, yearId: year.id }),
      pool.execute<PeriodRow[]>(`SELECT id,name,DATE_FORMAT(starts_on,'%Y-%m-%d') starts_on,DATE_FORMAT(ends_on,'%Y-%m-%d') ends_on,status FROM academic_periods WHERE school_id=:schoolId AND school_year_id=:yearId ORDER BY sort_order,name`, { schoolId: context.schoolId, yearId: year.id }),
    ]);
    return {
      ready: true,
      writable: context.selectedSchoolYearIsActive,
      warning: context.selectedSchoolYearIsActive ? null : "Other fees can be assigned only in the active school year. Historical years are read-only.",
      schoolYear: year,
      educationScope: context.educationScope,
      feeTypes: feeRows[0].map(mapFeeType),
      students: [
        ...basicRows[0].map((row) => ({ id: Number(row.id), name: row.student_name, reference: row.student_reference, audience: "basic" as const, periodId: null, groupLabel: `${row.grade_name} · ${row.section_name}`, gradeName: row.grade_name, sectionName: row.section_name, programName: "", yearLevelName: "" })),
        ...collegeRows[0].map((row) => ({ id: Number(row.id), name: row.student_name, reference: row.student_reference, audience: "higher" as const, periodId: Number(row.academic_period_id), groupLabel: `${row.program_code} · ${row.year_level_name} · ${row.section_name}`, gradeName: "", sectionName: row.section_name, programName: row.program_code, yearLevelName: row.year_level_name })),
      ],
      periods: periodRows[0].map((row) => ({ id: Number(row.id), name: row.name, startsOn: row.starts_on, endsOn: row.ends_on, status: row.status })),
    };
  } catch (error) {
    console.error("[other-fee-workspace]", error instanceof Error ? error.message : error);
    return { ready: false, writable: false, warning: "Other-fee setup is unavailable. Import the latest database migration and try again.", schoolYear: year, educationScope: context.educationScope, feeTypes: [], students: [], periods: [] };
  }
}

export async function createOtherFeeType(connection: PoolConnection, params: { schoolId: number; schoolYearId: number; draft: OtherFeeTypeDraft }) {
  validateFeeTypeDraft(params.draft);
  const [result] = await connection.execute<ResultSetHeader>(`INSERT INTO fee_types (school_id,school_year_id,code,name,description,category,other_fee_group,education_audience,collection_policy,billing_basis,amount_mode,approval_reference,default_amount,status) VALUES (:schoolId,:schoolYearId,:code,:name,:description,'other',:group,:audience,:policy,:billingBasis,:amountMode,:approvalReference,:defaultAmount,'active')`, { ...params, ...params.draft });
  return result.insertId;
}

export async function postOtherFeeCharge(connection: PoolConnection, params: { schoolId: number; schoolYearId: number; schoolYearStartsOn: string; schoolYearEndsOn: string; userId: number; draft: OtherFeeChargeDraft }): Promise<OtherFeePostResult> {
  const d = params.draft;
  if (d.studentIds.length < 1) throw new OtherFeeWorkflowError("Select at least one eligible student.", "students");
  if (d.studentIds.length > 500) throw new OtherFeeWorkflowError("A charge may include at most 500 students.", "students");
  if (!d.chargeTitle || d.chargeTitle.length > 140) throw new OtherFeeWorkflowError("Enter a short charge title or occasion.", "chargeTitle");
  if (!Number.isFinite(d.amountPerStudent) || d.amountPerStudent <= 0) throw new OtherFeeWorkflowError("Enter an amount greater than zero.", "amountPerStudent");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dueDate)) throw new OtherFeeWorkflowError("Choose a valid due date.", "dueDate");
  if (!d.submissionToken) throw new OtherFeeWorkflowError("This form expired. Reopen it and try again.");

  const tokenHash = hash(d.submissionToken);
  const [priorRows] = await connection.execute<ChargeRow[]>(`SELECT reference_number,assigned_count,duplicate_count,total_amount FROM other_fee_charges WHERE school_id=:schoolId AND submission_token_hash=:tokenHash LIMIT 1 FOR UPDATE`, { schoolId: params.schoolId, tokenHash });
  if (priorRows[0]) return { reference: priorRows[0].reference_number, assignedCount: Number(priorRows[0].assigned_count), duplicateCount: Number(priorRows[0].duplicate_count), totalAmount: Number(priorRows[0].total_amount) };

  const [feeRows] = await connection.execute<FeeTypeRow[]>(`SELECT id,code,name,description,other_fee_group,education_audience,collection_policy,billing_basis,amount_mode,default_amount,approval_reference,status FROM fee_types WHERE id=:feeTypeId AND school_id=:schoolId AND school_year_id=:schoolYearId AND category='other' AND status='active' LIMIT 1 FOR UPDATE`, { feeTypeId: d.feeTypeId, schoolId: params.schoolId, schoolYearId: params.schoolYearId });
  const fee = feeRows[0];
  if (!fee) throw new OtherFeeWorkflowError("Choose an active Other fee type for this school year.", "feeTypeId");
  const allowedAudience = normalizeAudience(fee.education_audience);
  if (allowedAudience !== "both" && allowedAudience !== d.audience) throw new OtherFeeWorkflowError("This fee type is not available for the selected academic group.", "audience");
  if ((normalizePolicy(fee.collection_policy) === "optional" || normalizePolicy(fee.collection_policy) === "conditional") && !d.applicabilityConfirmed) throw new OtherFeeWorkflowError("Confirm that every selected student is eligible or opted in.", "applicabilityConfirmed");
  const defaultAmount = Number(fee.default_amount ?? 0);
  if (normalizeAmountMode(fee.amount_mode) === "fixed" && Math.abs(defaultAmount - d.amountPerStudent) > 0.004 && !d.overrideReason) throw new OtherFeeWorkflowError("Explain why the fixed standard amount was changed.", "overrideReason");

  let periodId: number | null = null;
  let startsOn = params.schoolYearStartsOn;
  let endsOn = params.schoolYearEndsOn;
  if (d.audience === "higher") {
    if (!d.periodId) throw new OtherFeeWorkflowError("Choose the active college period.", "periodId");
    const [periodRows] = await connection.execute<PeriodRow[]>(`SELECT id,name,DATE_FORMAT(starts_on,'%Y-%m-%d') starts_on,DATE_FORMAT(ends_on,'%Y-%m-%d') ends_on,status FROM academic_periods WHERE id=:periodId AND school_id=:schoolId AND school_year_id=:schoolYearId AND status='active' LIMIT 1 FOR UPDATE`, { periodId: d.periodId, schoolId: params.schoolId, schoolYearId: params.schoolYearId });
    if (!periodRows[0]) throw new OtherFeeWorkflowError("Choose an active college period owned by this school.", "periodId");
    periodId = Number(periodRows[0].id); startsOn = periodRows[0].starts_on; endsOn = periodRows[0].ends_on;
  }
  if (d.dueDate < startsOn || d.dueDate > endsOn) throw new OtherFeeWorkflowError(`Choose a due date from ${startsOn} through ${endsOn}.`, "dueDate");

  const uniqueStudentIds = [...new Set(d.studentIds)];
  const placeholders = uniqueStudentIds.map((_, index) => `:student${index}`).join(",");
  const studentParams = Object.fromEntries(uniqueStudentIds.map((id, index) => [`student${index}`, id]));
  const eligibilitySql = d.audience === "basic"
    ? `SELECT DISTINCT st.id FROM students st JOIN enrollments e ON e.student_id=st.id AND e.school_year_id=:schoolYearId AND e.status='enrolled' WHERE st.school_id=:schoolId AND st.id IN (${placeholders})`
    : `SELECT DISTINCT st.id FROM students st JOIN college_enrollments ce ON ce.student_id=st.id AND ce.school_year_id=:schoolYearId AND ce.academic_period_id=:periodId AND ce.status='enrolled' JOIN academic_periods ap ON ap.id=ce.academic_period_id AND ap.status='active' WHERE st.school_id=:schoolId AND st.id IN (${placeholders})`;
  const [eligibleRows] = await connection.execute<IdRow[]>(eligibilitySql, { ...studentParams, schoolId: params.schoolId, schoolYearId: params.schoolYearId, periodId });
  if (eligibleRows.length !== uniqueStudentIds.length) throw new OtherFeeWorkflowError("One or more selected students are no longer eligible. Refresh the roster and try again.", "students");

  const logicalKey = hash(`${d.feeTypeId}|${d.audience}|${periodId ?? 0}|${d.chargeTitle.trim().toLowerCase()}|${d.dueDate}`).slice(0, 40);
  const assignmentKey = `other-fee:${d.feeTypeId}:${logicalKey}`;
  const reference = `OFC-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const description = String(fee.description ?? "Purpose not recorded");
  const [chargeResult] = await connection.execute<ResultSetHeader>(`INSERT INTO other_fee_charges (school_id,school_year_id,academic_period_id,fee_type_id,education_audience,reference_number,submission_token_hash,charge_title,fee_name_snapshot,description_snapshot,amount_per_student,due_date,approval_reference,internal_note,amount_override_reason,selected_count,assigned_count,duplicate_count,total_amount,created_by_user_id) VALUES (:schoolId,:schoolYearId,:periodId,:feeTypeId,:audience,:reference,:tokenHash,:chargeTitle,:feeName,:description,:amount,:dueDate,:approvalReference,:internalNote,:overrideReason,:selectedCount,0,0,0,:userId)`, { ...params, periodId, feeTypeId: d.feeTypeId, audience: d.audience, reference, tokenHash, chargeTitle: d.chargeTitle, feeName: fee.name, description, amount: d.amountPerStudent, dueDate: d.dueDate, approvalReference: d.approvalReference || fee.approval_reference || null, internalNote: d.internalNote || null, overrideReason: d.overrideReason || null, selectedCount: uniqueStudentIds.length });
  const values = uniqueStudentIds.map((_, index) => `(:student${index},:feeTypeId,:schoolYearId,:assignmentKey,:periodId,:chargeId,:feeName,:amount,0,:amount,0,:dueDate,'open')`).join(",");
  const [insertResult] = await connection.execute<ResultSetHeader>(`INSERT IGNORE INTO student_fee_assignments (student_id,fee_type_id,school_year_id,assignment_key,academic_period_id,other_fee_charge_id,fee_name_snapshot,gross_amount,credit_amount,amount_due,amount_paid,due_date,status) VALUES ${values}`, { ...studentParams, feeTypeId: d.feeTypeId, schoolYearId: params.schoolYearId, assignmentKey, periodId, chargeId: chargeResult.insertId, feeName: fee.name, amount: d.amountPerStudent, dueDate: d.dueDate });
  const assignedCount = insertResult.affectedRows;
  const duplicateCount = uniqueStudentIds.length - assignedCount;
  if (assignedCount === 0) throw new OtherFeeWorkflowError("All selected students already have this exact charge. Change the title or due date for a new charge.", "students");
  const totalAmount = roundMoney(assignedCount * d.amountPerStudent);
  await connection.execute(`UPDATE other_fee_charges SET assigned_count=:assignedCount,duplicate_count=:duplicateCount,total_amount=:totalAmount WHERE id=:chargeId`, { assignedCount, duplicateCount, totalAmount, chargeId: chargeResult.insertId });
  return { reference, assignedCount, duplicateCount, totalAmount };
}

function validateFeeTypeDraft(d: OtherFeeTypeDraft) {
  if (!d.name || d.name.length > 120) throw new OtherFeeWorkflowError("Enter a fee name up to 120 characters.", "name");
  if (!d.code || !/^[A-Z0-9-]{2,40}$/.test(d.code)) throw new OtherFeeWorkflowError("Use 2–40 uppercase letters, numbers, or hyphens for the fee code.", "code");
  if (!d.description || d.description.length > 255) throw new OtherFeeWorkflowError("Explain what the fee covers in 255 characters or fewer.", "description");
  if (!OTHER_FEE_GROUPS.includes(d.group)) throw new OtherFeeWorkflowError("Choose a purpose group.", "group");
  if (!OTHER_FEE_AUDIENCES.includes(d.audience)) throw new OtherFeeWorkflowError("Choose who this fee is for.", "audience");
  if (!OTHER_FEE_POLICIES.includes(d.policy)) throw new OtherFeeWorkflowError("Choose a collection policy.", "policy");
  if (!OTHER_FEE_BILLING_BASES.includes(d.billingBasis)) throw new OtherFeeWorkflowError("Choose when the fee may be charged.", "billingBasis");
  if (!OTHER_FEE_AMOUNT_MODES.includes(d.amountMode)) throw new OtherFeeWorkflowError("Choose how the amount is entered.", "amountMode");
  if (d.amountMode === "fixed" && (!Number.isFinite(d.defaultAmount) || d.defaultAmount <= 0)) throw new OtherFeeWorkflowError("Enter a fixed standard amount greater than zero.", "defaultAmount");
}

function mapFeeType(row: FeeTypeRow): OtherFeeTypeOption { return { id: Number(row.id), code: row.code || `LEGACY-${row.id}`, name: row.name, description: row.description || "Purpose not recorded", group: normalizeGroup(row.other_fee_group), audience: normalizeAudience(row.education_audience), policy: normalizePolicy(row.collection_policy), billingBasis: normalizeBasis(row.billing_basis), amountMode: normalizeAmountMode(row.amount_mode), defaultAmount: Number(row.default_amount ?? 0), approvalReference: row.approval_reference || "", status: row.status === "inactive" ? "inactive" : "active" }; }
function normalizeGroup(value: string | null): OtherFeeGroup { return OTHER_FEE_GROUPS.includes(value as OtherFeeGroup) ? value as OtherFeeGroup : "other"; }
function normalizeAudience(value: string | null): OtherFeeAudience { return OTHER_FEE_AUDIENCES.includes(value as OtherFeeAudience) ? value as OtherFeeAudience : "both"; }
function normalizePolicy(value: string | null): OtherFeePolicy { return OTHER_FEE_POLICIES.includes(value as OtherFeePolicy) ? value as OtherFeePolicy : "conditional"; }
function normalizeBasis(value: string | null): OtherFeeBillingBasis { return OTHER_FEE_BILLING_BASES.includes(value as OtherFeeBillingBasis) ? value as OtherFeeBillingBasis : "school_year"; }
function normalizeAmountMode(value: string | null): OtherFeeAmountMode { return OTHER_FEE_AMOUNT_MODES.includes(value as OtherFeeAmountMode) ? value as OtherFeeAmountMode : "fixed"; }
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }

type FeeTypeRow = RowDataPacket & { id:number; code:string|null; name:string; description:string|null; other_fee_group:string|null; education_audience:string|null; collection_policy:string|null; billing_basis:string|null; amount_mode:string|null; default_amount:number|string; approval_reference:string|null; status:string };
type StudentRow = RowDataPacket & { id:number; student_reference:string; student_name:string; grade_name:string; section_name:string };
type CollegeStudentRow = RowDataPacket & { id:number; student_reference:string; student_name:string; academic_period_id:number; program_code:string; year_level_name:string; section_name:string };
type PeriodRow = RowDataPacket & { id:number; name:string; starts_on:string; ends_on:string; status:string };
type ChargeRow = RowDataPacket & { reference_number:string; assigned_count:number|string; duplicate_count:number|string; total_amount:number|string };
type IdRow = RowDataPacket & { id:number };
