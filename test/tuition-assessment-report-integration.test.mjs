import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const realDataPath = "lib/admin/real-data.ts";
const tablePath = "app/admin/(dashboard)/tuition/tuition-report-table.tsx";
const actionsPath = "app/admin/tuition-terms/actions.ts";
const legacyTermsPath = "lib/tuition/terms.ts";

test("tuition balances read the approved assessment payment plan", async () => {
  const source = await readFile(realDataPath, "utf8");

  assert.match(source, /recordSource: "assessment" \| "legacy"/);
  assert.match(source, /LEFT JOIN student_assessments sa ON sa\.id = sfa\.student_assessment_id/);
  assert.match(source, /LEFT JOIN payment_plan_templates ppt ON ppt\.id = sa\.payment_plan_template_id/);
  assert.match(source, /FROM assessment_payment_terms apt/);
  assert.match(source, /apt\.student_assessment_id = sa\.id/);
  assert.match(source, /AS next_due_date/);
  assert.match(source, /recordSource: row\.assessment_id \? "assessment" as const : "legacy" as const/);
  assert.match(source, /paymentPlanName: row\.payment_plan_name/);
});

test("assessment rows show their package plan and one read-only action", async () => {
  const source = await readFile(tablePath, "utf8");

  assert.match(source, /row\.recordSource === "assessment"/);
  assert.match(source, /<AssessmentDetailsModal row=\{row\} \/>/);
  assert.match(source, /row\.paymentPlanName \?\? "Full payment"/);
  assert.match(source, /Next due/);
  assert.match(source, /View tuition assessment for/);
  assert.match(source, /This schedule comes from the approved tuition package/);
  assert.match(source, /Approved payment schedule/);
});

test("legacy assignment controls remain available only for legacy rows", async () => {
  const source = await readFile(tablePath, "utf8");

  assert.match(source, /<TuitionAssignmentEditModal row=\{row\} \/>/);
  assert.match(source, /<TuitionTermsModal row=\{row\} \/>/);
  assert.match(source, /Custom payment terms/);
  assert.match(source, /aria-label=\{`Edit tuition assignment for \$\{row\.student\}`\}/);
  assert.match(source, /aria-label=\{`Manage tuition terms for \$\{row\.student\}`\}/);
});

test("server actions reject manual edits for package assessments", async () => {
  const [actions, legacyTerms] = await Promise.all([
    readFile(actionsPath, "utf8"),
    readFile(legacyTermsPath, "utf8"),
  ]);

  assert.match(actions, /sfa\.student_assessment_id/);
  assert.match(actions, /if \(row\.student_assessment_id\)/);
  assert.match(actions, /cannot be edited as a legacy assignment/);
  assert.match(legacyTerms, /if \(assignment\.student_assessment_id\)/);
  assert.match(legacyTerms, /approved package payment plan/);
});
