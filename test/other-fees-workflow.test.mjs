import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = "database/migrations/2026-11-07-other-fees-workflow.sql";
const domainPath = "lib/fees/other-fees.ts";
const actionsPath = "app/admin/fees/other-fee-actions.ts";
const formsPath = "app/admin/fees/other-fee-workflow-forms.tsx";
const pagePath = "app/admin/(dashboard)/other-fees/page.tsx";
const tablePath = "app/admin/(dashboard)/other-fees/other-fees-table.tsx";

test("other-fee migration adds reusable metadata and repeatable charge instances", () => {
  assert.equal(existsSync(migrationPath), true);
  const migration = readFileSync(migrationPath, "utf8");
  for (const column of ["other_fee_group", "education_audience", "collection_policy", "billing_basis", "amount_mode", "approval_reference"]) {
    assert.match(migration, new RegExp(`COLUMN_NAME='${column}'`));
  }
  assert.match(migration, /CREATE TABLE IF NOT EXISTS other_fee_charges/);
  assert.match(migration, /submission_token_hash CHAR\(64\)/);
  assert.match(migration, /UNIQUE KEY uq_other_fee_charges_submission/);
  assert.match(migration, /other_fee_charge_id/);
  assert.match(migration, /information_schema\.(?:COLUMNS|STATISTICS|TABLE_CONSTRAINTS)/);
});

test("server-owned other-fee posting validates context and remains atomic and retry-safe", () => {
  const domain = readFileSync(domainPath, "utf8");
  const actions = readFileSync(actionsPath, "utf8");
  assert.match(domain, /export async function getOtherFeeWorkspace/);
  assert.match(domain, /export async function postOtherFeeCharge/);
  assert.match(domain, /d\.studentIds\.length > 500/);
  assert.match(domain, /status='active' LIMIT 1 FOR UPDATE/);
  assert.match(domain, /submission_token_hash=:tokenHash/);
  assert.match(domain, /INSERT IGNORE INTO student_fee_assignments/);
  assert.match(domain, /other_fee_charge_id/);
  assert.match(domain, /academic_period_id/);
  assert.match(domain, /fee_name_snapshot/);
  assert.match(domain, /One or more selected students are no longer eligible/);
  assert.match(actions, /await connection\.beginTransaction\(\)/);
  assert.match(actions, /await connection\.commit\(\)/);
  assert.match(actions, /connection\?\.rollback/);
  assert.match(actions, /canAccessFinance/);
  assert.match(actions, /selectedSchoolYearIsActive/);
});

test("other-fee UI separates catalog setup from five-step assignment", () => {
  const forms = readFileSync(formsPath, "utf8");
  const page = readFileSync(pagePath, "utf8");
  const table = readFileSync(tablePath, "utf8");
  assert.match(page, /triggerLabel="Create fee type"/);
  assert.match(page, /triggerLabel="Assign other fee"/);
  assert.match(page, /Create a fee type before assigning students/);
  for (const title of ["Choose fee type", "Choose academic context", "Enter charge details", "Select students", "Review and assign"]) {
    assert.match(forms, new RegExp(`title="${title}"`));
  }
  assert.match(forms, /Start from a common Philippine school fee/);
  assert.match(forms, /Registration or enrollment/);
  assert.match(forms, /OJT, internship, or practicum/);
  assert.match(forms, /Select all visible/);
  assert.match(forms, /maximum 500 per assignment/);
  assert.match(forms, /I confirm that every selected student is eligible for or opted in/);
  assert.match(forms, /`Assign \$\{money\(total\)\} to \$\{selectedIds\.length\}/);
  assert.match(table, /layout="compact"/);
  assert.match(table, /filterTitle="Filter fee types"/);
  assert.match(table, /Search fee name, code, or description/);
  assert.match(table, /activeFilterCount/);
  assert.match(table, /admin-other-fees\.xlsx/);
  assert.match(table, /admin-other-fees\.pdf/);
});
