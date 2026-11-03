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

test("approved schedules are target-safe and payment plans are validated", async () => {
  const domain = await readFile("lib/fees/assessment-workflow.ts", "utf8");
  assert.match(domain, /status='draft' FOR UPDATE/);
  assert.match(domain, /already covers one or more selected targets/);
  assert.match(domain, /percentages must be positive and total 100%/);
  assert.match(domain, /term date must fall inside/);
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
  assert.match(page, /Manage fee catalog/);
  assert.match(forms, /useActionState/);
  assert.match(forms, /role=\{state\.status === "error" \? "alert" : "status"\}/);
  assert.match(forms, /min-h-11/);
});
