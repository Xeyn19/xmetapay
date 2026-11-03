import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { getAdminStaffRole } from "@/lib/admin/access";
import { getResolvedAdminSchoolSetup } from "@/lib/school/setup";

export const maxAssessmentStudents = 500;

export type AcademicAudience = "basic" | "higher";
export type AssessmentActionState = {
  status: "idle" | "error" | "preview" | "success";
  title?: string;
  message?: string;
  preview?: AssessmentPreview;
  batchReference?: string;
};
export type AssessmentPreview = {
  fingerprint: string;
  scheduleId: number;
  studentIds: number[];
  eligibleCount: number;
  duplicateCount: number;
  excludedCount: number;
  grossTotal: number;
  creditTotal: number;
  netTotal: number;
  perStudentGross: number;
  perStudentCredit: number;
  perStudentNet: number;
};

export type AssessmentWorkspace = {
  ready: boolean;
  warning: string | null;
  schoolYearName: string | null;
  schedules: Array<{ id: number; name: string; audience: AcademicAudience; period: string; grossAmount: number; itemCount: number; status: string; paymentPlanId:number|null }>;
  students: Array<{ id: number; name: string; meta: string; audience: AcademicAudience; targetId: number }>;
  creditTypes: Array<{ id: number; code: string; name: string; requiresReference: boolean; maxAmount: number | null; maxPercent: number | null }>;
  grades: Array<{ id: number; name: string }>;
  programs: Array<{ id: number; name: string; levels: Array<{ id: number; name: string }> }>;
  periods: Array<{ id: number; name: string; status: string; startsOn: string; endsOn: string }>;
  allStudents: Array<{ id:number; name:string; reference:string }>;
  collegeSections: Array<{ id:number; name:string; periodName:string; levelName:string }>;
};

export type ParentAssessmentStatement = {
  id: number; reference: string; studentName: string; scheduleName: string; periodName: string;
  gross: number; credits: number; net: number; paid: number; balance: number;
  charges: Array<{ name: string; gross: number; credit: number; net: number; timing: string }>;
  terms: Array<{ name: string; dueDate: string; due: number; paid: number; balance: number; status: string }>;
};

export class AssessmentWorkflowError extends Error {}

export async function requireAssessmentAdmin(userId: number) {
  const role = await getAdminStaffRole(userId);
  if (role !== "school_administrator") throw new AssessmentWorkflowError("Only the school administrator can manage tuition assessments.");
  const setup = await getResolvedAdminSchoolSetup(userId);
  if (!setup.schoolId || !setup.schoolYearId) throw new AssessmentWorkflowError(setup.warning ?? "Complete school setup first.");
  return { schoolId: setup.schoolId, schoolYearId: setup.schoolYearId, schoolYearName: setup.schoolYearName };
}

export async function getAssessmentWorkspace(userId: number): Promise<AssessmentWorkspace> {
  try {
    const context = await requireAssessmentAdmin(userId);
    const [scheduleRows, studentRows, creditRows, gradeRows, programRows, periodRows, allStudentRows, sectionRows] = await Promise.all([
      pool.execute<ScheduleOptionRow[]>(`SELECT fs.id, fs.name, fs.education_level, COALESCE(ap.name, 'Full school year') period_name, fs.status,
          COUNT(DISTINCT fsi.id) item_count, COALESCE(SUM(fsi.amount),0) gross_amount, MAX(fspp.payment_plan_template_id) payment_plan_id
        FROM fee_schedules fs LEFT JOIN academic_periods ap ON ap.id=fs.academic_period_id LEFT JOIN fee_schedule_items fsi ON fsi.fee_schedule_id=fs.id LEFT JOIN fee_schedule_payment_plans fspp ON fspp.fee_schedule_id=fs.id AND fspp.is_default=TRUE
        WHERE fs.school_id=:schoolId AND fs.school_year_id=:schoolYearId GROUP BY fs.id,fs.name,fs.education_level,ap.name,fs.status ORDER BY fs.created_at DESC`, context),
      pool.execute<StudentOptionRow[]>(`SELECT st.id, CONCAT_WS(' ',st.first_name,NULLIF(st.middle_name,''),st.last_name) student_name,
          CONCAT(gl.name,' - ',COALESCE(sec.name,'No section'),' - ',st.student_reference) meta, 'basic' audience, e.grade_level_id target_id
        FROM students st JOIN enrollments e ON e.student_id=st.id AND e.school_year_id=:schoolYearId AND e.status='enrolled'
        JOIN grade_levels gl ON gl.id=e.grade_level_id LEFT JOIN sections sec ON sec.id=e.section_id WHERE st.school_id=:schoolId
        UNION ALL
        SELECT st.id, CONCAT_WS(' ',st.first_name,NULLIF(st.middle_name,''),st.last_name),
          CONCAT(ap.code,' - ',pyl.name,' - ',prd.name,' - ',st.student_reference), 'higher', ce.program_year_level_id
        FROM students st JOIN college_enrollments ce ON ce.student_id=st.id AND ce.school_year_id=:schoolYearId AND ce.status='enrolled'
        JOIN academic_programs ap ON ap.id=ce.program_id JOIN program_year_levels pyl ON pyl.id=ce.program_year_level_id JOIN academic_periods prd ON prd.id=ce.academic_period_id AND prd.status='active'
        WHERE st.school_id=:schoolId ORDER BY student_name`, context),
      pool.execute<CreditTypeRow[]>(`SELECT id,code,name,requires_reference,max_amount,max_percent FROM assessment_credit_types WHERE school_id=:schoolId AND status='active' ORDER BY name`, context),
      pool.execute<NameRow[]>(`SELECT id,name FROM grade_levels WHERE school_id=:schoolId ORDER BY sort_order,name`, context),
      pool.execute<ProgramLevelRow[]>(`SELECT ap.id program_id,ap.name program_name,pyl.id level_id,pyl.name level_name FROM academic_programs ap LEFT JOIN program_year_levels pyl ON pyl.program_id=ap.id WHERE ap.school_id=:schoolId AND ap.status='active' ORDER BY ap.name,pyl.level_number`, context),
      pool.execute<PeriodRow[]>(`SELECT id,name,status,DATE_FORMAT(starts_on,'%Y-%m-%d') starts_on,DATE_FORMAT(ends_on,'%Y-%m-%d') ends_on FROM academic_periods WHERE school_id=:schoolId AND school_year_id=:schoolYearId ORDER BY sort_order,id`, context),
      pool.execute<AllStudentRow[]>(`SELECT id,CONCAT_WS(' ',first_name,NULLIF(middle_name,''),last_name) name,student_reference FROM students WHERE school_id=:schoolId AND status='active' ORDER BY last_name,first_name`,context),
      pool.execute<CollegeSectionRow[]>(`SELECT cs.id,cs.name,ap.name period_name,pyl.name level_name FROM college_sections cs JOIN academic_periods ap ON ap.id=cs.academic_period_id JOIN program_year_levels pyl ON pyl.id=cs.program_year_level_id WHERE cs.school_id=:schoolId AND ap.school_year_id=:schoolYearId ORDER BY ap.sort_order,pyl.level_number,cs.name`,context),
    ]);
    const programs = new Map<number, AssessmentWorkspace["programs"][number]>();
    for (const row of programRows[0]) {
      const item = programs.get(row.program_id) ?? { id: row.program_id, name: row.program_name, levels: [] };
      if (row.level_id) item.levels.push({ id: row.level_id, name: row.level_name });
      programs.set(row.program_id, item);
    }
    return { ready: true, warning: null, schoolYearName: context.schoolYearName,
      schedules: scheduleRows[0].map(r=>({id:r.id,name:r.name,audience:r.education_level,period:r.period_name,grossAmount:Number(r.gross_amount),itemCount:Number(r.item_count),status:r.status,paymentPlanId:r.payment_plan_id?Number(r.payment_plan_id):null})),
      students: studentRows[0].map(r=>({id:r.id,name:r.student_name,meta:r.meta,audience:r.audience,targetId:r.target_id})),
      creditTypes: creditRows[0].map(r=>({id:r.id,code:r.code,name:r.name,requiresReference:Boolean(r.requires_reference),maxAmount:r.max_amount==null?null:Number(r.max_amount),maxPercent:r.max_percent==null?null:Number(r.max_percent)})),
      grades: gradeRows[0], programs:[...programs.values()], periods:periodRows[0].map(r=>({id:r.id,name:r.name,status:r.status,startsOn:r.starts_on,endsOn:r.ends_on})),allStudents:allStudentRows[0].map(r=>({id:r.id,name:r.name,reference:r.student_reference})),collegeSections:sectionRows[0].map(r=>({id:r.id,name:r.name,periodName:r.period_name,levelName:r.level_name})) };
  } catch (error) {
    return { ready:false, warning:error instanceof Error?error.message:"Assessment workspace unavailable.", schoolYearName:null, schedules:[],students:[],creditTypes:[],grades:[],programs:[],periods:[],allStudents:[],collegeSections:[] };
  }
}

export async function getParentAssessmentStatements(parentUserId:number):Promise<ParentAssessmentStatement[]> {
  try {
    const [rows] = await pool.execute<StatementRow[]>(`SELECT sa.id,ab.reference_number,CONCAT_WS(' ',st.first_name,NULLIF(st.middle_name,''),st.last_name) student_name,fs.name schedule_name,COALESCE(ap.name,'Full school year') period_name,sa.gross_amount,sa.credit_amount,sa.net_amount,
      COALESCE((SELECT SUM(sfa.amount_paid) FROM student_fee_assignments sfa WHERE sfa.student_assessment_id=sa.id),0) paid,
      COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT('name',sfa.fee_name_snapshot,'gross',sfa.gross_amount,'credit',sfa.credit_amount,'net',sfa.amount_due,'timing',fsi.payment_timing)) FROM student_fee_assignments sfa LEFT JOIN fee_schedule_items fsi ON fsi.id=sfa.fee_schedule_item_id WHERE sfa.student_assessment_id=sa.id),JSON_ARRAY()) charges,
      COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT('name',apt.name,'dueDate',DATE_FORMAT(apt.due_date,'%Y-%m-%d'),'due',apt.amount_due,'paid',apt.amount_paid,'status',apt.status)) FROM assessment_payment_terms apt WHERE apt.student_assessment_id=sa.id),JSON_ARRAY()) terms
      FROM student_assessments sa JOIN assessment_batches ab ON ab.id=sa.assessment_batch_id JOIN fee_schedules fs ON fs.id=sa.fee_schedule_id JOIN students st ON st.id=sa.student_id JOIN student_guardians sg ON sg.student_id=st.id LEFT JOIN academic_periods ap ON ap.id=ab.academic_period_id
      WHERE sg.parent_user_id=:parentUserId AND sa.status<>'cancelled' ORDER BY sa.created_at DESC`,{parentUserId});
    return rows.map(row=>{const paid=Number(row.paid);return {id:row.id,reference:row.reference_number,studentName:row.student_name,scheduleName:row.schedule_name,periodName:row.period_name,gross:Number(row.gross_amount),credits:Number(row.credit_amount),net:Number(row.net_amount),paid,balance:money(Number(row.net_amount)-paid),charges:jsonArray(row.charges).map(x=>({name:String(x.name),gross:Number(x.gross),credit:Number(x.credit),net:Number(x.net),timing:String(x.timing)})),terms:jsonArray(row.terms).map(x=>({name:String(x.name),dueDate:String(x.dueDate),due:Number(x.due),paid:Number(x.paid),balance:money(Number(x.due)-Number(x.paid)),status:String(x.status)}))};});
  } catch { return []; }
}
export async function getAssessmentBatchResult(userId:number,reference:string){const context=await requireAssessmentAdmin(userId);const [rows]=await pool.execute<Array<RowDataPacket&{reference_number:string;selected_count:number;posted_count:number;duplicate_count:number;excluded_count:number;gross_total:number|string;credit_total:number|string;net_total:number|string;posted_at:Date|string}>>(`SELECT reference_number,selected_count,posted_count,duplicate_count,excluded_count,gross_total,credit_total,net_total,posted_at FROM assessment_batches WHERE school_id=:schoolId AND school_year_id=:schoolYearId AND reference_number=:reference LIMIT 1`,{...context,reference});const row=rows[0];return row?{reference:row.reference_number,selected:Number(row.selected_count),posted:Number(row.posted_count),duplicates:Number(row.duplicate_count),excluded:Number(row.excluded_count),gross:Number(row.gross_total),credits:Number(row.credit_total),net:Number(row.net_total),postedAt:String(row.posted_at)}:null;}

export async function previewAssessment(connection: PoolConnection, params: PreviewParams): Promise<AssessmentPreview> {
  if (!params.studentIds.length || params.studentIds.length > maxAssessmentStudents) throw new AssessmentWorkflowError(`Select 1 to ${maxAssessmentStudents} students.`);
  const schedule = await getLockedSchedule(connection, params.schoolId, params.schoolYearId, params.scheduleId);
  const planFingerprint = await validateSchedulePlan(connection,schedule.id,params.paymentPlanId);
  const students = await getEligibleStudents(connection, schedule, params.studentIds);
  const duplicates = await getDuplicateStudentIds(connection, schedule.id, students.map(s=>s.id));
  const eligibleIds = students.map(s=>s.id).filter(id=>!duplicates.has(id));
  const gross = schedule.items.reduce((sum,item)=>sum+Number(item.amount),0);
  const creditResult = await validateCredit(connection, params.schoolId, params.creditTypeId, params.creditAmount, params.creditReference, gross);const credit=creditResult.amount;
  const fingerprint = hash(JSON.stringify({scheduleId:schedule.id,updatedAt:String(schedule.updated_at),students:eligibleIds,duplicates:[...duplicates].sort(),creditTypeId:params.creditTypeId,credit,creditRule:creditResult.rule,creditReference:params.creditReference,planId:params.paymentPlanId,planFingerprint}));
  return { fingerprint,scheduleId:schedule.id,studentIds:eligibleIds,eligibleCount:eligibleIds.length,duplicateCount:duplicates.size,excludedCount:params.studentIds.length-students.length,
    grossTotal:money(gross*eligibleIds.length),creditTotal:money(credit*eligibleIds.length),netTotal:money((gross-credit)*eligibleIds.length),perStudentGross:money(gross),perStudentCredit:money(credit),perStudentNet:money(gross-credit) };
}

export async function postAssessmentBatch(connection: PoolConnection, params: PreviewParams & { previewFingerprint:string; submissionToken:string; postedByUserId:number }) {
  const existing = await findBatchByToken(connection, params.schoolId, params.submissionToken);
  if (existing) return { batchReference: existing.reference_number, duplicate:true, postedCount:existing.posted_count };
  const preview = await previewAssessment(connection, params);
  if (preview.fingerprint !== params.previewFingerprint) throw new AssessmentWorkflowError("The schedule or student selection changed. Review the assessment again before posting.");
  if (!preview.eligibleCount) throw new AssessmentWorkflowError("No new eligible students remain to assess.");
  const schedule = await getLockedSchedule(connection, params.schoolId, params.schoolYearId, params.scheduleId);
  const reference = `ASM-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const [batchResult] = await connection.execute<ResultSetHeader>(`INSERT INTO assessment_batches
      (school_id,school_year_id,academic_period_id,fee_schedule_id,reference_number,submission_token_hash,preview_fingerprint,selected_count,posted_count,duplicate_count,excluded_count,gross_total,credit_total,net_total,posted_by_user_id)
      VALUES (:schoolId,:schoolYearId,:periodId,:scheduleId,:reference,:tokenHash,:fingerprint,:selected,:posted,:duplicates,:excluded,:gross,:credits,:net,:userId)`,
    {schoolId:params.schoolId,schoolYearId:params.schoolYearId,periodId:schedule.academic_period_id,scheduleId:schedule.id,reference,tokenHash:hash(params.submissionToken),fingerprint:preview.fingerprint,
      selected:params.studentIds.length,posted:preview.eligibleCount,duplicates:preview.duplicateCount,excluded:preview.excludedCount,gross:preview.grossTotal,credits:preview.creditTotal,net:preview.netTotal,userId:params.postedByUserId});
  for (const studentId of preview.studentIds) await createStudentAssessment(connection,{...params,studentId,batchId:batchResult.insertId,schedule,preview});
  return { batchReference:reference,duplicate:false,postedCount:preview.eligibleCount };
}

async function createStudentAssessment(connection:PoolConnection, p: PreviewParams & {studentId:number;batchId:number;schedule:LockedSchedule;preview:AssessmentPreview;postedByUserId:number}) {
  const gross=p.preview.perStudentGross, credit=p.preview.perStudentCredit, net=p.preview.perStudentNet;
  const [a]=await connection.execute<ResultSetHeader>(`INSERT INTO student_assessments (assessment_batch_id,student_id,fee_schedule_id,payment_plan_template_id,gross_amount,credit_amount,net_amount)
    VALUES (:batchId,:studentId,:scheduleId,:planId,:gross,:credit,:net)`,{batchId:p.batchId,studentId:p.studentId,scheduleId:p.schedule.id,planId:p.paymentPlanId,gross,credit,net});
  let remainingCredit=credit; const assignments:Array<{id:number;eligible:boolean;net:number}>=[];
  for(const item of p.schedule.items){ const allocated=Math.min(remainingCredit,Number(item.amount)); remainingCredit=money(remainingCredit-allocated); const lineNet=money(Number(item.amount)-allocated);
    const key=`schedule-item:${item.id}:period:${p.schedule.academic_period_id??0}`;
    const [r]=await connection.execute<ResultSetHeader>(`INSERT INTO student_fee_assignments (student_id,fee_type_id,school_year_id,assignment_key,student_assessment_id,fee_schedule_item_id,academic_period_id,fee_name_snapshot,gross_amount,credit_amount,amount_due,amount_paid,due_date,status)
      VALUES (:studentId,:feeTypeId,:yearId,:assignmentKey,:assessmentId,:itemId,:periodId,:feeName,:gross,:credit,:net,0,:dueDate,'open')`,
      {studentId:p.studentId,feeTypeId:item.fee_type_id,yearId:p.schoolYearId,assignmentKey:key,assessmentId:a.insertId,itemId:item.id,periodId:p.schedule.academic_period_id,feeName:item.fee_name,gross:Number(item.amount),credit:allocated,net:lineNet,dueDate:item.due_date}); assignments.push({id:r.insertId,eligible:item.payment_timing==='installment',net:lineNet}); }
  if(credit>0&&p.creditTypeId){ const [cr]=await connection.execute<ResultSetHeader>(`INSERT INTO student_assessment_credits (student_assessment_id,assessment_credit_type_id,amount,reference_number,note,applied_by_user_id) VALUES (:assessmentId,:typeId,:amount,:reference,'Applied during assessment posting',:userId)`,{assessmentId:a.insertId,typeId:p.creditTypeId,amount:credit,reference:p.creditReference||null,userId:p.postedByUserId});
    let left=credit; for(const line of assignments){const amount=Math.min(left,Number(p.schedule.items[assignments.indexOf(line)]?.amount??0));if(amount>0){await connection.execute(`INSERT INTO student_assessment_credit_allocations (student_assessment_credit_id,student_fee_assignment_id,amount) VALUES (:creditId,:assignmentId,:amount)`,{creditId:cr.insertId,assignmentId:line.id,amount});left=money(left-amount);}}}
  if(p.paymentPlanId){const [terms]=await connection.execute<PlanTermRow[]>(`SELECT name,sort_order,percentage,due_date FROM payment_plan_template_terms WHERE payment_plan_template_id=:planId ORDER BY sort_order`,{planId:p.paymentPlanId});
    const base=assignments.filter(x=>x.eligible).reduce((s,x)=>s+x.net,0); let used=0; for(let i=0;i<terms.length;i++){const amount=i===terms.length-1?money(base-used):money(base*Number(terms[i].percentage)/100);used=money(used+amount);await connection.execute(`INSERT INTO assessment_payment_terms (student_assessment_id,name,sort_order,percentage,amount_due,due_date) VALUES (:assessmentId,:name,:sort,:percentage,:amount,:dueDate)`,{assessmentId:a.insertId,name:terms[i].name,sort:terms[i].sort_order,percentage:terms[i].percentage,amount,dueDate:terms[i].due_date});}}
}

async function getLockedSchedule(c:PoolConnection,schoolId:number,yearId:number,scheduleId:number){const [rows]=await c.execute<ScheduleRow[]>(`SELECT fs.id,fs.academic_period_id,fs.updated_at FROM fee_schedules fs LEFT JOIN academic_periods ap ON ap.id=fs.academic_period_id WHERE fs.id=:scheduleId AND fs.school_id=:schoolId AND fs.school_year_id=:yearId AND fs.status='approved' AND (fs.academic_period_id IS NULL OR ap.status='active') FOR UPDATE`,{scheduleId,schoolId,yearId});if(!rows[0])throw new AssessmentWorkflowError("Choose an approved schedule for the active academic period.");const [items]=await c.execute<ScheduleItemRow[]>(`SELECT fsi.id,fsi.fee_type_id,ft.name fee_name,fsi.amount,fsi.payment_timing,fsi.due_date FROM fee_schedule_items fsi JOIN fee_types ft ON ft.id=fsi.fee_type_id WHERE fsi.fee_schedule_id=:scheduleId ORDER BY fsi.sort_order`,{scheduleId});if(!items.length)throw new AssessmentWorkflowError("The fee schedule has no approved items.");return {...rows[0],items};}
async function getEligibleStudents(c:PoolConnection,s:LockedSchedule,ids:number[]){const placeholders=ids.map((_,i)=>`:id${i}`).join(',');const params=Object.fromEntries(ids.map((id,i)=>[`id${i}`,id]));const [rows]=await c.execute<StudentIdRow[]>(`SELECT DISTINCT st.id FROM students st JOIN fee_schedules fs ON fs.id=:scheduleId LEFT JOIN enrollments e ON e.student_id=st.id AND e.school_year_id=fs.school_year_id AND e.status='enrolled' LEFT JOIN fee_schedule_grade_targets gt ON gt.fee_schedule_id=fs.id AND gt.grade_level_id=e.grade_level_id LEFT JOIN college_enrollments ce ON ce.student_id=st.id AND ce.academic_period_id=fs.academic_period_id AND ce.status='enrolled' LEFT JOIN fee_schedule_program_targets pt ON pt.fee_schedule_id=fs.id AND pt.program_year_level_id=ce.program_year_level_id WHERE st.school_id=fs.school_id AND st.id IN (${placeholders}) AND ((fs.education_level='basic' AND gt.grade_level_id IS NOT NULL) OR (fs.education_level='higher' AND pt.program_year_level_id IS NOT NULL))`,{...params,scheduleId:s.id});return rows;}
async function getDuplicateStudentIds(c:PoolConnection,scheduleId:number,ids:number[]){if(!ids.length)return new Set<number>();const ph=ids.map((_,i)=>`:d${i}`).join(',');const p=Object.fromEntries(ids.map((id,i)=>[`d${i}`,id]));const [rows]=await c.execute<StudentIdRow[]>(`SELECT student_id id FROM student_assessments WHERE fee_schedule_id=:scheduleId AND student_id IN (${ph}) AND status<>'cancelled'`,{...p,scheduleId});return new Set(rows.map(r=>r.id));}
async function validateCredit(c:PoolConnection,schoolId:number,typeId:number|null,amount:number,reference:string,gross:number){if(amount<=0)return {amount:0,rule:null};if(!typeId)throw new AssessmentWorkflowError("Choose a credit type for the entered credit.");const [rows]=await c.execute<CreditRuleRow[]>(`SELECT requires_reference,max_amount,max_percent FROM assessment_credit_types WHERE id=:typeId AND school_id=:schoolId AND status='active'`,{typeId,schoolId});const r=rows[0];if(!r)throw new AssessmentWorkflowError("Choose an active school credit type.");if(r.requires_reference&&!reference)throw new AssessmentWorkflowError("Enter the required credit reference.");const limit=Math.min(r.max_amount==null?gross:Number(r.max_amount),r.max_percent==null?gross:gross*Number(r.max_percent)/100,gross);if(amount>limit)throw new AssessmentWorkflowError(`Credit cannot exceed ${formatMoney(limit)} per student.`);return {amount:money(amount),rule:{requiresReference:Boolean(r.requires_reference),maxAmount:r.max_amount,maxPercent:r.max_percent}};}
async function validateSchedulePlan(c:PoolConnection,scheduleId:number,planId:number|null){if(!planId)return null;const [rows]=await c.execute<PlanTermRow[]>(`SELECT pt.name,pt.sort_order,pt.percentage,pt.due_date FROM fee_schedule_payment_plans fsp JOIN payment_plan_template_terms pt ON pt.payment_plan_template_id=fsp.payment_plan_template_id WHERE fsp.fee_schedule_id=:scheduleId AND fsp.payment_plan_template_id=:planId ORDER BY pt.sort_order`,{scheduleId,planId});if(!rows.length)throw new AssessmentWorkflowError('Choose a payment plan approved with this schedule.');return rows.map(row=>[row.name,row.sort_order,String(row.percentage),String(row.due_date)]);}
async function findBatchByToken(c:PoolConnection,schoolId:number,token:string){const [rows]=await c.execute<BatchRow[]>(`SELECT reference_number,posted_count FROM assessment_batches WHERE school_id=:schoolId AND submission_token_hash=:tokenHash LIMIT 1`,{schoolId,tokenHash:hash(token)});return rows[0]??null;}

export async function createAcademicPeriod(connection:PoolConnection,p:{schoolId:number;schoolYearId:number;name:string;periodType:string;startsOn:string;endsOn:string}){
  if(!p.name||!['semester','trimester','summer','custom'].includes(p.periodType)||!p.startsOn||!p.endsOn||p.startsOn>p.endsOn)throw new AssessmentWorkflowError('Enter a valid academic period and date range.');
  const [years]=await connection.execute<Array<RowDataPacket&{starts_on:string;ends_on:string}>>(`SELECT DATE_FORMAT(starts_on,'%Y-%m-%d') starts_on,DATE_FORMAT(ends_on,'%Y-%m-%d') ends_on FROM school_years WHERE id=:yearId AND school_id=:schoolId LIMIT 1`,{yearId:p.schoolYearId,schoolId:p.schoolId});
  if(!years[0]||p.startsOn<years[0].starts_on||p.endsOn>years[0].ends_on)throw new AssessmentWorkflowError('Academic period dates must stay inside the active school year.');
  await connection.execute(`INSERT INTO academic_periods (school_id,school_year_id,name,period_type,starts_on,ends_on,status) VALUES (:schoolId,:schoolYearId,:name,:periodType,:startsOn,:endsOn,'upcoming')`,p);
}

export async function createAcademicProgram(connection:PoolConnection,p:{schoolId:number;code:string;name:string;levelCount:number}){
  if(!p.code||!p.name||p.levelCount<1||p.levelCount>8)throw new AssessmentWorkflowError('Enter a program code, name, and 1 to 8 year levels.');
  const [r]=await connection.execute<ResultSetHeader>(`INSERT INTO academic_programs (school_id,code,name) VALUES (:schoolId,:code,:name)`,p);
  for(let i=1;i<=p.levelCount;i++)await connection.execute(`INSERT INTO program_year_levels (program_id,level_number,name) VALUES (:programId,:level,:name)`,{programId:r.insertId,level:i,name:`Year ${i}`});
  await connection.execute(`UPDATE schools SET education_scope=CASE WHEN education_scope='basic' THEN 'both' WHEN education_scope='higher' THEN 'higher' ELSE 'both' END WHERE id=:schoolId`,{schoolId:p.schoolId});
}

export async function activateAcademicPeriod(connection:PoolConnection,p:{schoolId:number;schoolYearId:number;periodId:number}){
  const [rows]=await connection.execute<StudentIdRow[]>(`SELECT id FROM academic_periods WHERE id=:periodId AND school_id=:schoolId AND school_year_id=:schoolYearId AND status<>'closed' FOR UPDATE`,p);if(!rows[0])throw new AssessmentWorkflowError('Choose an upcoming period owned by this school year.');
  await connection.execute(`UPDATE academic_periods SET status='upcoming' WHERE school_id=:schoolId AND school_year_id=:schoolYearId AND status='active'`,p);
  await connection.execute(`UPDATE academic_periods SET status='active' WHERE id=:periodId`,p);
}

export async function createCollegeSection(connection:PoolConnection,p:{schoolId:number;periodId:number;levelId:number;name:string}){if(!p.name)throw new AssessmentWorkflowError('Enter a college section name.');const [rows]=await connection.execute<StudentIdRow[]>(`SELECT ap.id FROM academic_periods ap JOIN program_year_levels pyl ON pyl.id=:levelId JOIN academic_programs pr ON pr.id=pyl.program_id AND pr.school_id=ap.school_id WHERE ap.id=:periodId AND ap.school_id=:schoolId`,p);if(!rows[0])throw new AssessmentWorkflowError('Choose a school-owned period and program year level.');await connection.execute(`INSERT INTO college_sections (school_id,academic_period_id,program_year_level_id,name) VALUES (:schoolId,:periodId,:levelId,:name)`,p);}

export async function enrollCollegeStudent(connection:PoolConnection,p:{schoolId:number;schoolYearId:number;studentId:number;periodId:number;levelId:number;sectionId:number|null}){const [rows]=await connection.execute<Array<RowDataPacket&{program_id:number}>>(`SELECT pyl.program_id FROM students st JOIN program_year_levels pyl ON pyl.id=:levelId JOIN academic_programs pr ON pr.id=pyl.program_id AND pr.school_id=st.school_id JOIN academic_periods ap ON ap.id=:periodId AND ap.school_id=st.school_id AND ap.school_year_id=:schoolYearId AND ap.status='active' WHERE st.id=:studentId AND st.school_id=:schoolId`,p);if(!rows[0])throw new AssessmentWorkflowError('College enrollment requires a school-owned student, program level, and active period.');if(p.sectionId){const [sections]=await connection.execute<StudentIdRow[]>(`SELECT id FROM college_sections WHERE id=:sectionId AND school_id=:schoolId AND academic_period_id=:periodId AND program_year_level_id=:levelId`,p);if(!sections[0])throw new AssessmentWorkflowError('Choose a section for the selected level and period.');}await connection.execute(`INSERT INTO college_enrollments (student_id,school_year_id,academic_period_id,program_id,program_year_level_id,college_section_id,status) VALUES (:studentId,:schoolYearId,:periodId,:programId,:levelId,:sectionId,'enrolled')`,{...p,programId:rows[0].program_id});}

export async function createCreditType(connection:PoolConnection,p:{schoolId:number;userId:number;code:string;name:string;sourceKind:string;requiresReference:boolean;maxAmount:number|null;maxPercent:number|null}){
  if(!p.code||!p.name||!['government','school','manual'].includes(p.sourceKind))throw new AssessmentWorkflowError('Enter a valid credit code, name, and source.');
  if((p.maxAmount!==null&&p.maxAmount<=0)||(p.maxPercent!==null&&(p.maxPercent<=0||p.maxPercent>100)))throw new AssessmentWorkflowError('Credit limits must be positive, and percentage limits cannot exceed 100%.');
  await connection.execute(`INSERT INTO assessment_credit_types (school_id,code,name,source_kind,requires_reference,max_amount,max_percent,created_by_user_id) VALUES (:schoolId,:code,:name,:sourceKind,:requiresReference,:maxAmount,:maxPercent,:userId)`,p);
}

export async function createFeeSchedule(connection:PoolConnection,p:{schoolId:number;schoolYearId:number;userId:number;name:string;audience:AcademicAudience;periodId:number|null;targetIds:number[];tuitionName:string;tuitionAmount:number;mandatoryName:string;mandatoryAmount:number;mandatoryTiming:'upfront'|'installment';dueDate:string;planName:string;termNames:string[];termPercentages:number[];termDates:string[]}){
  if(!p.name||!p.targetIds.length||!p.tuitionName||p.tuitionAmount<=0||!p.dueDate)throw new AssessmentWorkflowError('Complete the schedule name, targets, tuition item, amount, and deadline.');
  if(p.audience==='higher'&&!p.periodId)throw new AssessmentWorkflowError('College schedules require an academic period.');
  const [bounds]=await connection.execute<Array<RowDataPacket&{starts_on:string;ends_on:string}>>(p.periodId?`SELECT DATE_FORMAT(starts_on,'%Y-%m-%d') starts_on,DATE_FORMAT(ends_on,'%Y-%m-%d') ends_on FROM academic_periods WHERE id=:periodId AND school_id=:schoolId AND school_year_id=:schoolYearId`:`SELECT DATE_FORMAT(starts_on,'%Y-%m-%d') starts_on,DATE_FORMAT(ends_on,'%Y-%m-%d') ends_on FROM school_years WHERE id=:schoolYearId AND school_id=:schoolId`,p);if(!bounds[0]||p.dueDate<bounds[0].starts_on||p.dueDate>bounds[0].ends_on)throw new AssessmentWorkflowError('The fee deadline must fall inside the school year or selected college period.');
  const hasPlan=p.planName&&p.termNames.length>0; if(hasPlan){const total=p.termPercentages.reduce((s,v)=>s+v,0);if(p.termPercentages.some(value=>value<=0)||Math.round(total*100)!==10000||p.termNames.length!==p.termPercentages.length||p.termNames.length!==p.termDates.length)throw new AssessmentWorkflowError('Payment plan percentages must be positive and total 100%.');if(p.termDates.some(date=>!date||date<bounds[0].starts_on||date>bounds[0].ends_on))throw new AssessmentWorkflowError('Every payment term date must fall inside the school year or selected college period.');}
  const [s]=await connection.execute<ResultSetHeader>(`INSERT INTO fee_schedules (school_id,school_year_id,academic_period_id,name,education_level,created_by_user_id) VALUES (:schoolId,:schoolYearId,:periodId,:name,:audience,:userId)`,p);
  const targetTable=p.audience==='basic'?'fee_schedule_grade_targets':'fee_schedule_program_targets';const targetColumn=p.audience==='basic'?'grade_level_id':'program_year_level_id';
  const ownershipSql=p.audience==='basic'?`SELECT COUNT(*) total FROM grade_levels WHERE school_id=:schoolId AND id IN (${p.targetIds.map((_,i)=>`:target${i}`).join(',')})`:`SELECT COUNT(*) total FROM program_year_levels pyl JOIN academic_programs ap ON ap.id=pyl.program_id WHERE ap.school_id=:schoolId AND pyl.id IN (${p.targetIds.map((_,i)=>`:target${i}`).join(',')})`;const [owned]=await connection.execute<Array<RowDataPacket&{total:number}>>(ownershipSql,{schoolId:p.schoolId,...Object.fromEntries(p.targetIds.map((id,i)=>[`target${i}`,id]))});if(Number(owned[0]?.total)!==new Set(p.targetIds).size)throw new AssessmentWorkflowError('Every schedule target must belong to this school.');
  for(const id of [...new Set(p.targetIds)])await connection.execute(`INSERT INTO ${targetTable} (fee_schedule_id,${targetColumn}) VALUES (:scheduleId,:targetId)`,{scheduleId:s.insertId,targetId:id});
  const tuitionTypeId=await getOrCreateFeeType(connection,{schoolId:p.schoolId,schoolYearId:p.schoolYearId,code:`TUI-${s.insertId}`,name:p.tuitionName,category:'tuition',amount:p.tuitionAmount,description:'Approved schedule tuition'});
  await connection.execute(`INSERT INTO fee_schedule_items (fee_schedule_id,fee_type_id,sort_order,amount,payment_timing,due_date) VALUES (:scheduleId,:typeId,1,:amount,'installment',:dueDate)`,{scheduleId:s.insertId,typeId:tuitionTypeId,amount:p.tuitionAmount,dueDate:p.dueDate});
  if(p.mandatoryName&&p.mandatoryAmount>0){const otherId=await getOrCreateFeeType(connection,{schoolId:p.schoolId,schoolYearId:p.schoolYearId,code:`REQ-${s.insertId}`,name:p.mandatoryName,category:'other',amount:p.mandatoryAmount,description:'Approved mandatory schedule item'});await connection.execute(`INSERT INTO fee_schedule_items (fee_schedule_id,fee_type_id,sort_order,amount,payment_timing,due_date) VALUES (:scheduleId,:typeId,2,:amount,:timing,:dueDate)`,{scheduleId:s.insertId,typeId:otherId,amount:p.mandatoryAmount,timing:p.mandatoryTiming,dueDate:p.dueDate});}
  if(hasPlan){const [plan]=await connection.execute<ResultSetHeader>(`INSERT INTO payment_plan_templates (school_id,school_year_id,academic_period_id,name,created_by_user_id) VALUES (:schoolId,:schoolYearId,:periodId,:name,:userId)`,{schoolId:p.schoolId,schoolYearId:p.schoolYearId,periodId:p.periodId,name:p.planName,userId:p.userId});for(let i=0;i<p.termNames.length;i++)await connection.execute(`INSERT INTO payment_plan_template_terms (payment_plan_template_id,name,sort_order,percentage,due_date) VALUES (:planId,:name,:sort,:percentage,:dueDate)`,{planId:plan.insertId,name:p.termNames[i],sort:i+1,percentage:p.termPercentages[i],dueDate:p.termDates[i]});await connection.execute(`INSERT INTO fee_schedule_payment_plans (fee_schedule_id,payment_plan_template_id,is_default) VALUES (:scheduleId,:planId,TRUE)`,{scheduleId:s.insertId,planId:plan.insertId});}
  return s.insertId;
}

export async function approveFeeSchedule(connection:PoolConnection,p:{schoolId:number;schoolYearId:number;userId:number;scheduleId:number}){
  const [rows]=await connection.execute<Array<RowDataPacket&{id:number;education_level:AcademicAudience;academic_period_id:number|null}>>(`SELECT id,education_level,academic_period_id FROM fee_schedules WHERE id=:scheduleId AND school_id=:schoolId AND school_year_id=:schoolYearId AND status='draft' FOR UPDATE`,p);const s=rows[0];if(!s)throw new AssessmentWorkflowError('Only a draft schedule can be approved.');
  const table=s.education_level==='basic'?'fee_schedule_grade_targets':'fee_schedule_program_targets';const column=s.education_level==='basic'?'grade_level_id':'program_year_level_id';
  const [overlap]=await connection.execute<Array<RowDataPacket&{total:number}>>(`SELECT COUNT(*) total FROM ${table} mine JOIN ${table} other ON other.${column}=mine.${column} JOIN fee_schedules fs ON fs.id=other.fee_schedule_id WHERE mine.fee_schedule_id=:scheduleId AND other.fee_schedule_id<>:scheduleId AND fs.school_year_id=:schoolYearId AND fs.status='approved' AND (fs.academic_period_id<=>:periodId)`,{scheduleId:p.scheduleId,schoolYearId:p.schoolYearId,periodId:s.academic_period_id});if(Number(overlap[0]?.total)>0)throw new AssessmentWorkflowError('An approved schedule already covers one or more selected targets for this period.');
  await connection.execute(`UPDATE fee_schedules SET status='approved',approved_by_user_id=:userId,approved_at=NOW() WHERE id=:scheduleId`,p);
}
async function getOrCreateFeeType(connection:PoolConnection,p:{schoolId:number;schoolYearId:number;code:string;name:string;category:'tuition'|'other';amount:number;description:string}){const [rows]=await connection.execute<StudentIdRow[]>(`SELECT id FROM fee_types WHERE school_id=:schoolId AND school_year_id=:schoolYearId AND name=:name AND category=:category LIMIT 1`,p);if(rows[0])return rows[0].id;const [created]=await connection.execute<ResultSetHeader>(`INSERT INTO fee_types (school_id,school_year_id,code,name,description,category,default_amount,status) VALUES (:schoolId,:schoolYearId,:code,:name,:description,:category,:amount,'active')`,p);return created.insertId;}
export async function cloneFeeSchedule(connection:PoolConnection,p:{schoolId:number;schoolYearId:number;userId:number;scheduleId:number}){const [source]=await connection.execute<Array<RowDataPacket&{name:string;education_level:AcademicAudience;academic_period_id:number|null}>>(`SELECT name,education_level,academic_period_id FROM fee_schedules WHERE id=:scheduleId AND school_id=:schoolId AND school_year_id=:schoolYearId AND status IN ('approved','archived')`,p);if(!source[0])throw new AssessmentWorkflowError('Choose an approved or archived schedule to clone.');const [created]=await connection.execute<ResultSetHeader>(`INSERT INTO fee_schedules (school_id,school_year_id,academic_period_id,name,education_level,version_no,cloned_from_id,created_by_user_id) SELECT school_id,school_year_id,academic_period_id,CONCAT(name,' - revision ',version_no+1),education_level,version_no+1,id,:userId FROM fee_schedules WHERE id=:scheduleId`,p);const target=source[0].education_level==='basic'?'fee_schedule_grade_targets':'fee_schedule_program_targets';const column=source[0].education_level==='basic'?'grade_level_id':'program_year_level_id';await connection.execute(`INSERT INTO ${target} (fee_schedule_id,${column}) SELECT :newId,${column} FROM ${target} WHERE fee_schedule_id=:scheduleId`,{newId:created.insertId,scheduleId:p.scheduleId});await connection.execute(`INSERT INTO fee_schedule_items (fee_schedule_id,fee_type_id,sort_order,amount,payment_timing,due_date) SELECT :newId,fee_type_id,sort_order,amount,payment_timing,due_date FROM fee_schedule_items WHERE fee_schedule_id=:scheduleId`,{newId:created.insertId,scheduleId:p.scheduleId});await connection.execute(`INSERT INTO fee_schedule_payment_plans (fee_schedule_id,payment_plan_template_id,is_default) SELECT :newId,payment_plan_template_id,is_default FROM fee_schedule_payment_plans WHERE fee_schedule_id=:scheduleId`,{newId:created.insertId,scheduleId:p.scheduleId});return created.insertId;}
export async function archiveFeeSchedule(connection:PoolConnection,p:{schoolId:number;schoolYearId:number;scheduleId:number}){const [result]=await connection.execute<ResultSetHeader>(`UPDATE fee_schedules SET status='archived',archived_at=NOW() WHERE id=:scheduleId AND school_id=:schoolId AND school_year_id=:schoolYearId AND status='approved'`,p);if(!result.affectedRows)throw new AssessmentWorkflowError('Only an approved school-owned schedule can be archived.');}
function hash(v:string){return createHash('sha256').update(v).digest('hex');} function money(v:number){return Math.round(v*100)/100;} export function formatMoney(v:number){return new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(v);}

type PreviewParams={schoolId:number;schoolYearId:number;scheduleId:number;studentIds:number[];creditTypeId:number|null;creditAmount:number;creditReference:string;paymentPlanId:number|null};
type ScheduleOptionRow=RowDataPacket&{id:number;name:string;education_level:AcademicAudience;period_name:string;status:string;item_count:number|string;gross_amount:number|string;payment_plan_id:number|null};
type StudentOptionRow=RowDataPacket&{id:number;student_name:string;meta:string;audience:AcademicAudience;target_id:number}; type CreditTypeRow=RowDataPacket&{id:number;code:string;name:string;requires_reference:number;max_amount:number|string|null;max_percent:number|string|null};
type NameRow=RowDataPacket&{id:number;name:string};type ProgramLevelRow=RowDataPacket&{program_id:number;program_name:string;level_id:number|null;level_name:string};type PeriodRow=RowDataPacket&{id:number;name:string;status:string;starts_on:string;ends_on:string};
type AllStudentRow=RowDataPacket&{id:number;name:string;student_reference:string};type CollegeSectionRow=RowDataPacket&{id:number;name:string;period_name:string;level_name:string};
type ScheduleRow=RowDataPacket&{id:number;academic_period_id:number|null;updated_at:Date|string};type ScheduleItemRow=RowDataPacket&{id:number;fee_type_id:number;fee_name:string;amount:number|string;payment_timing:'upfront'|'installment';due_date:Date|string|null};type LockedSchedule=ScheduleRow&{items:ScheduleItemRow[]};
type StudentIdRow=RowDataPacket&{id:number};type CreditRuleRow=RowDataPacket&{requires_reference:number;max_amount:number|string|null;max_percent:number|string|null};type BatchRow=RowDataPacket&{reference_number:string;posted_count:number};type PlanTermRow=RowDataPacket&{name:string;sort_order:number;percentage:number|string;due_date:Date|string};
type StatementRow=RowDataPacket&{id:number;reference_number:string;student_name:string;schedule_name:string;period_name:string;gross_amount:number|string;credit_amount:number|string;net_amount:number|string;paid:number|string;charges:unknown;terms:unknown};
function jsonArray(value:unknown):Array<Record<string,unknown>>{if(Array.isArray(value))return value as Array<Record<string,unknown>>;if(typeof value==='string'){try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[];}catch{return [];}}return [];}
