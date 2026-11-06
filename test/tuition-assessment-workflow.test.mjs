import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "database/migrations/2026-11-03-tuition-assessment-workflow.sql";

test("tuition assessment migration keeps legacy rows and introduces deterministic assignment identity", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /legacy-fee:/);
  assert.match(sql, /assignment_key/);
  assert.match(sql, /DROP INDEX uq_student_fee_assignments_student_fee_year/);
  assert.doesNotMatch(sql, /INSERT INTO student_assessments[\s\S]*SELECT/i);
});

test("assessment schema covers academics, versioned schedules, credits, terms, and retries", async () => {
  const sql = await readFile("database/full-schema-v1.sql", "utf8");
  for (const table of ["academic_periods", "academic_programs", "college_enrollments", "fee_schedules", "fee_schedule_items", "assessment_batches", "student_assessments", "student_assessment_credits", "assessment_payment_terms", "payment_assessment_term_allocations"]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
  assert.match(sql, /UNIQUE KEY uq_assessment_batches_submission/);
  assert.match(sql, /ENUM\('draft','approved','archived'\)/);
});

test("assessment actions enforce school administrator ownership and atomic posting", async () => {
  const [domain, actions] = await Promise.all([readFile("lib/fees/assessment-workflow.ts", "utf8"), readFile("app/admin/tuition-assessments/actions.ts", "utf8")]);
  assert.match(domain, /role !== "school_administrator"/);
  assert.match(domain, /previewFingerprint/);
  assert.match(domain, /submission_token_hash/);
  assert.match(domain, /FOR UPDATE/);
  assert.match(actions, /beginTransaction/);
  assert.match(actions, /connection\.commit/);
  assert.match(actions, /connection\.rollback/);
});

test("assessment preview preserves the draft and uses one server-issued posting token", async () => {
  const [forms, actions, domain] = await Promise.all([
    readFile("app/admin/tuition-assessments/workflow-forms.tsx", "utf8"),
    readFile("app/admin/tuition-assessments/actions.ts", "utf8"),
    readFile("lib/fees/assessment-workflow.ts", "utf8"),
  ]);
  assert.match(forms, /onSubmit=\{submitAssessment\}/);
  assert.match(forms, /new FormData\(event\.currentTarget\)/);
  assert.match(forms, /formData\.set\("intent", intent\)/);
  assert.match(forms, /startTransition\(\(\) => action\(formData\)\)/);
  assert.match(forms, /value=\{creditTypeId\}/);
  assert.match(forms, /value=\{creditAmount\}/);
  assert.match(forms, /value=\{creditReference\}/);
  assert.match(forms, /value=\{state\.submissionToken \?\? ""\}/);
  assert.doesNotMatch(forms, /name="submissionToken" value=\{crypto\.randomUUID\(\)\}/);
  assert.match(actions, /submissionToken: randomUUID\(\)/);
  assert.match(domain, /submissionToken\?: string/);
});

test("approved schedules are target-safe and payment plans are validated", async () => {
  const [domain, rules] = await Promise.all([
    readFile("lib/fees/assessment-workflow.ts", "utf8"),
    readFile("lib/fees/installment-plan-rules.ts", "utf8"),
  ]);
  assert.match(domain, /status='draft' FOR UPDATE/);
  assert.match(domain, /already covers one or more selected targets/);
  assert.match(rules, /Payment percentages must total exactly 100%/);
  assert.match(rules, /inside the billing period and on or before the final payment deadline/);
});

test("parent assessment terms allocate to authoritative fee lines", async () => {
  const [actions, records] = await Promise.all([readFile("app/parent/payments/actions.ts", "utf8"), readFile("lib/payments/records.ts", "utf8")]);
  assert.match(actions, /payment_assessment_term_allocations/);
  assert.match(actions, /payment_allocations/);
  assert.match(actions, /payment_timing='installment'/);
  assert.match(records, /assessment_term/);
});

test("legacy parent tuition terms render their actual term due date", async () => {
  const records = await readFile("lib/fees/records.ts", "utf8");
  assert.match(records, /dueDate: term\.dueDate \? formatDate\(term\.dueDate\)/);
});

test("tuition UI exposes assessment-first controls and accessible pending feedback", async () => {
  const [page, forms] = await Promise.all([readFile("app/admin/(dashboard)/tuition/page.tsx", "utf8"), readFile("app/admin/tuition-assessments/workflow-forms.tsx", "utf8")]);
  assert.match(page, /Create assessments/);
  assert.match(page, /Tuition packages &amp; setup/);
  assert.match(page, /bg-primary/);
  assert.match(page, /bg-background/);
  assert.match(forms, /useActionState/);
  assert.match(forms, /role=\{state\.status === "error" \? "alert" : "status"\}/);
  assert.match(forms, /min-h-11/);
  assert.match(forms, /Recommended order:/);
  assert.match(forms, /Tuition amount per student/);
  assert.match(forms, /Amount deducted per student/);
  assert.match(forms, /Required/);
  assert.match(forms, /Optional/);
  assert.match(forms, /Select all visible/);
  assert.match(forms, /K–12 packages/);
  assert.match(forms, /College packages/);
  assert.match(forms, /Selected package summary/);
  assert.match(forms, /Already assessed/);
  assert.match(forms, /No matching students found/);
  assert.match(forms, /student\.targetId/);
  assert.match(forms, /student\.periodId === selectedSchedule\.periodId/);
  assert.match(forms, /dirtyAfterPreview/);
  assert.match(forms, /text-foreground/);
  assert.match(forms, /text-muted-foreground/);
  assert.match(forms, /border-input bg-background/);
  assert.doesNotMatch(forms, /font-semibold text-\[#151826\]/);
  assert.doesNotMatch(forms, /font-semibold text-\[#252936\]/);
  assert.match(forms, /Does your school offer a voucher, scholarship, or discount/);
  assert.match(forms, /DepEd Senior High School Voucher/);
  assert.match(forms, /Educational Service Contracting Subsidy/);
  assert.match(forms, /if both limits are blank/);
});

test("assessment workspace exposes exact package targets, groups, periods, and duplicates", async () => {
  const domain = await readFile("lib/fees/assessment-workflow.ts", "utf8");
  assert.match(domain, /fee_schedule_grade_targets/);
  assert.match(domain, /fee_schedule_program_targets/);
  assert.match(domain, /targetIds:targets\.get\(r\.id\)\?\.ids/);
  assert.match(domain, /assessedScheduleIds:assessedByStudent\.get\(r\.id\)/);
  assert.match(domain, /prd\.status='active'/);
  assert.match(domain, /ce\.academic_period_id/);
  assert.match(domain, /sa\.status<>'cancelled'/);
});

test("school academic offering is authoritative for tuition setup and assessment", async () => {
  const [domain, forms] = await Promise.all([
    readFile("lib/fees/assessment-workflow.ts", "utf8"),
    readFile("app/admin/tuition-assessments/workflow-forms.tsx", "utf8"),
  ]);
  assert.match(domain, /getSchoolAcademicReadiness/);
  assert.match(domain, /educationScope: academics\.educationScope/);
  assert.match(domain, /enabledAudiences\.includes\(r\.education_level\)/);
  assert.match(domain, /SELECT education_scope FROM schools WHERE id=:schoolId LIMIT 1 FOR UPDATE/);
  assert.match(domain, /currentScope==='both'\|\|currentScope===p\.audience/);
  assert.match(domain, /s\.education_scope='both' OR s\.education_scope=fs\.education_level/);
  assert.doesNotMatch(forms, /Connected to School Setup:/);
  assert.match(forms, /workspace\.educationScope === "both"/);
  assert.match(forms, /type="hidden" name="audience" value=\{audience\}/);
  assert.match(forms, /Complete School Setup first/);
  assert.match(forms, /openCollegePeriods/);
  assert.match(forms, /Select all/);
  assert.match(forms, /setSelectedTargetIds\(targetOptions\.map/);
  assert.match(forms, /selectedTargetIds\.length.*of.*availableTargets.*selected/);
  assert.match(forms, /How may families pay/);
  assert.match(forms, /installmentChoices/);
  assert.match(forms, /Full payment selected/);
});
