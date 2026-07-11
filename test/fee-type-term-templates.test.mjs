import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = "database/migrations/2026-07-04-fee-type-term-templates.sql";
const fullSchemaPath = "database/full-schema-v1.sql";
const feeFormsPath = "app/admin/fees/fee-management-forms.tsx";
const termFieldsPath = "app/admin/fees/tuition-term-schedule-fields.tsx";
const feeActionsPath = "app/admin/fees/actions.ts";
const feeRecordsPath = "lib/fees/records.ts";
const tuitionTermsPath = "lib/tuition/terms.ts";
const tuitionTablePath = "app/admin/(dashboard)/tuition/tuition-report-table.tsx";
const databaseReadmePath = "database/README.md";
const checklistPath = "docs/CHECKLIST.md";
const schemaPlanPath = "docs/DATABASE_SCHEMA_PLAN.md";
const schemaExplanationPath = "docs/DATABASE_SCHEMA_EXPLANATION.md";
const flowchartsPath = "docs/PROJECT_FLOWCHARTS.md";
const visualFlowchartsPath = "public/PROJECT_FLOWCHARTS_VISUAL.html";
const visualSchemaPath = "public/DATABASE_SCHEMA_VISUAL_PLAN.html";

test("fee type term template migration and fresh schema define reusable templates", () => {
  assert.equal(existsSync(migrationPath), true);
  const migration = readFileSync(migrationPath, "utf8");
  const fullSchema = readFileSync(fullSchemaPath, "utf8");

  for (const sql of [migration, fullSchema]) {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS fee_type_term_templates/);
    assert.match(sql, /fee_type_id BIGINT UNSIGNED NOT NULL/);
    assert.match(sql, /term_name VARCHAR\(120\) NOT NULL/);
    assert.match(sql, /sort_order INT UNSIGNED NOT NULL/);
    assert.match(sql, /amount_due DECIMAL\(10,2\) NOT NULL/);
    assert.match(sql, /due_date DATE NOT NULL/);
    assert.match(sql, /uq_fee_type_term_templates_order/);
    assert.match(sql, /uq_fee_type_term_templates_name/);
    assert.match(sql, /fk_fee_type_term_templates_fee_type/);
  }

  assert.ok(fullSchema.indexOf("CREATE TABLE IF NOT EXISTS fee_types") < fullSchema.indexOf("CREATE TABLE IF NOT EXISTS fee_type_term_templates"));
  assert.ok(fullSchema.indexOf("CREATE TABLE IF NOT EXISTS fee_type_term_templates") < fullSchema.indexOf("CREATE TABLE IF NOT EXISTS student_fee_assignments"));
});

test("tuition add fee type form no longer renders payment term template fields", () => {
  const forms = readFileSync(feeFormsPath, "utf8");
  const termFields = readFileSync(termFieldsPath, "utf8");
  const tuitionTable = readFileSync(tuitionTablePath, "utf8");

  assert.match(forms, /"use client";/);
  assert.match(forms, /useState/);
  assert.match(forms, /category === "tuition"/);
  assert.doesNotMatch(forms, /Payment terms template/);
  assert.doesNotMatch(forms, /TuitionTermScheduleFields/);
  assert.doesNotMatch(forms, /No template yet/);
  assert.doesNotMatch(forms, /feeType\.termCount/);
  assert.match(termFields, /"use client";/);
  assert.match(termFields, /name="termName"/);
  assert.match(termFields, /name="termAmount"/);
  assert.match(termFields, /name="termDueDate"/);
  assert.match(termFields, /Term due date/);
  assert.match(termFields, /Term dates must be on or before the fee due date/);
  assert.match(termFields, /Rebalance to/);
  assert.match(termFields, /Term amounts must match the tuition amount/);
  assert.match(tuitionTable, /TuitionTermScheduleFields/);
});

test("fee actions keep terms as per-student Manage terms work", () => {
  const actions = readFileSync(feeActionsPath, "utf8");
  const terms = readFileSync(tuitionTermsPath, "utf8");

  assert.doesNotMatch(actions, /parseTuitionTermInputs\(formData\)/);
  assert.doesNotMatch(actions, /validateTuitionTermSchedule\(templateTerms, defaultAmount\)/);
  assert.doesNotMatch(actions, /saveFeeTypeTermTemplate/);
  assert.match(actions, /connection\.beginTransaction\(\)/);
  assert.doesNotMatch(actions, /getFeeTypeTermTemplate/);
  assert.doesNotMatch(actions, /createTuitionTermsFromTemplate/);
  assert.doesNotMatch(actions, /existingStudentIds/);
  assert.doesNotMatch(actions, /Assigned to \$\{assignedCount\} students with tuition payment terms/);
  assert.match(terms, /export async function saveFeeTypeTermTemplate/);
  assert.match(terms, /INSERT INTO fee_type_term_templates/);
  assert.match(terms, /export async function getFeeTypeTermTemplate/);
  assert.match(terms, /export async function createTuitionTermsFromTemplate/);
  assert.match(terms, /Term schedule dates cannot be later than the fee due date/);
  assert.match(terms, /Set the fee due date before adding payment terms/);
  assert.match(terms, /scaleTuitionTermTemplate/);
  assert.match(terms, /final term absorbs|remainingCents|allocatedCents/);
  assert.match(terms, /WHERE student_fee_assignment_id = :assignmentId/);
});

test("fee setup reads template counts for tuition type display", () => {
  const records = readFileSync(feeRecordsPath, "utf8");

  assert.match(records, /LEFT JOIN fee_type_term_templates ftt ON ftt\.fee_type_id = ft\.id/);
  assert.match(records, /COUNT\(ftt\.id\) AS term_count/);
  assert.match(records, /termCount: numberValue\(row\.term_count\)/);
});

test("docs and import notes describe fee type term templates", () => {
  const combined = [
    databaseReadmePath,
    checklistPath,
    schemaPlanPath,
    schemaExplanationPath,
    flowchartsPath,
    visualFlowchartsPath,
    visualSchemaPath,
  ].map((path) => readFileSync(path, "utf8")).join("\n");

  assert.match(combined, /fee_type_term_templates/);
  assert.match(combined, /fee type term template/i);
  assert.match(combined, /2026-07-04-fee-type-term-templates\.sql/);
  assert.match(combined, /reserved for future template reuse/i);
});
