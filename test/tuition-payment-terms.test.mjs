import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = "database/migrations/2026-07-03-tuition-payment-terms.sql";
const fullSchemaPath = "database/full-schema-v1.sql";
const tuitionTermsPath = "lib/tuition/terms.ts";
const adminActionPath = "app/admin/tuition-terms/actions.ts";
const tuitionTablePath = "app/admin/(dashboard)/tuition/tuition-report-table.tsx";
const termScheduleFieldsPath = "app/admin/fees/tuition-term-schedule-fields.tsx";
const adminRealDataPath = "lib/admin/real-data.ts";
const parentFeeRecordsPath = "lib/fees/records.ts";
const parentFeesTablePath = "app/parent/(portal)/fees/fees-table.tsx";
const paymentRecordsPath = "lib/payments/records.ts";
const paymentActionsPath = "app/parent/payments/actions.ts";
const paymentFormPath = "app/parent/(portal)/pay-tuition/payment-form.tsx";
const checklistPath = "docs/CHECKLIST.md";
const flowchartsPath = "docs/PROJECT_FLOWCHARTS.md";
const visualFlowchartsPath = "public/PROJECT_FLOWCHARTS_VISUAL.html";
const visualSchemaPath = "public/DATABASE_SCHEMA_VISUAL_PLAN.html";

test("tuition terms migration and fresh schema define installment tables", () => {
  assert.equal(existsSync(migrationPath), true);
  const migration = readFileSync(migrationPath, "utf8");
  const fullSchema = readFileSync(fullSchemaPath, "utf8");

  for (const sql of [migration, fullSchema]) {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS tuition_payment_terms/);
    assert.match(sql, /student_fee_assignment_id BIGINT UNSIGNED NOT NULL/);
    assert.match(sql, /term_name VARCHAR\(120\) NOT NULL/);
    assert.match(sql, /amount_due DECIMAL\(10,2\) NOT NULL/);
    assert.match(sql, /amount_paid DECIMAL\(10,2\) NOT NULL DEFAULT 0\.00/);
    assert.match(sql, /due_date DATE NOT NULL/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS payment_term_allocations/);
    assert.match(sql, /tuition_payment_term_id BIGINT UNSIGNED NOT NULL/);
    assert.match(sql, /uq_tuition_terms_assignment_order/);
    assert.match(sql, /idx_tuition_terms_assignment_status_due/);
    assert.match(sql, /fk_payment_term_allocations_term/);
  }
});

test("admin tuition term action requires finance access and validates totals", () => {
  const action = readFileSync(adminActionPath, "utf8");
  const terms = readFileSync(tuitionTermsPath, "utf8");

  assert.match(action, /"use server";/);
  assert.match(action, /export async function saveTuitionTermsAction/);
  assert.match(action, /export async function updateTuitionAssignmentAction/);
  assert.match(action, /await requireRole\("admin"\)/);
  assert.match(action, /canAccessFinance\(staffRole\)/);
  assert.match(action, /parseTuitionTermInputs/);
  assert.match(action, /saveTuitionTermSchedule/);
  assert.doesNotMatch(action, /DELETE FROM tuition_payment_terms/);
  assert.match(terms, /ft\.category = 'tuition'/);
  assert.match(terms, /FOR UPDATE/);
  assert.match(terms, /amount_paid > 0/);
  assert.match(terms, /Term amounts must total the remaining tuition balance/);
  assert.match(terms, /Term schedule dates cannot be later than the fee due date/);
  assert.match(terms, /Set the fee due date before adding payment terms/);
  assert.match(terms, /DELETE FROM tuition_payment_terms/);
  assert.match(terms, /INSERT INTO tuition_payment_terms/);
  assert.match(action, /revalidatePath\("\/parent\/pay-tuition"\)/);
  assert.match(action, /Amount due cannot be lower than the amount already paid/);
  assert.match(action, /This tuition has terms\. Use Manage terms before changing the total amount/);
  assert.match(action, /Fee due date cannot be earlier than an existing term schedule date/);
  assert.match(action, /UPDATE student_fee_assignments/);
});

test("tuition term service owns shared parsing, payable, and payment rules", () => {
  const terms = readFileSync(tuitionTermsPath, "utf8");

  assert.match(terms, /import "server-only"/);
  assert.match(terms, /export function parseTuitionTermInputs/);
  assert.match(terms, /export function parseTuitionTermsBlob/);
  assert.match(terms, /export function getTuitionTermSummary/);
  assert.match(terms, /export function isTuitionTermPayable/);
  assert.match(terms, /export async function saveTuitionTermSchedule/);
  assert.match(terms, /export async function getParentPayableTuitionTerms/);
  assert.match(terms, /export async function applyTuitionTermPayment/);
  assert.match(terms, /export async function recalculateTuitionAssignmentFromTerms/);
  assert.match(terms, /status === "open" \|\| status === "partial"/);
  assert.doesNotMatch(terms, /tpt\.due_date <= CURRENT_DATE/);
});

test("admin tuition report exposes per-student manage terms UI", () => {
  const table = readFileSync(tuitionTablePath, "utf8");
  const termFields = readFileSync(termScheduleFieldsPath, "utf8");
  const helper = readFileSync(adminRealDataPath, "utf8");

  assert.match(helper, /assignmentId: number/);
  assert.match(helper, /dueDate: string \| null/);
  assert.match(helper, /statusValue: "open" \| "partial" \| "paid" \| "cancelled"/);
  assert.match(helper, /terms: TuitionTermRow\[\]/);
  assert.match(helper, /LEFT JOIN tuition_payment_terms tpt/);
  assert.match(helper, /LEFT JOIN payment_term_allocations pta/);
  assert.match(helper, /getTuitionTermSummary/);
  assert.match(helper, /parseTuitionTermsBlob/);
  assert.match(table, /saveTuitionTermsAction, updateTuitionAssignmentAction/);
  assert.match(table, /import \{ Button \} from "@\/components\/ui\/button";/);
  assert.match(table, /label: "Schedule"/);
  assert.match(table, /label: "Actions"/);
  assert.match(table, /colSpan=\{8\}/);
  assert.match(table, /row\.grade\} - \{row\.section/);
  assert.match(table, /variant="outline"/);
  assert.match(table, /size="icon-sm"/);
  assert.match(table, /aria-label=\{`Edit tuition assignment for \$\{row\.student\}`\}/);
  assert.match(table, /aria-label=\{`Manage tuition terms for \$\{row\.student\}`\}/);
  assert.match(table, /Manage terms/);
  assert.match(table, /Edit tuition assignment/);
  assert.doesNotMatch(table, />\s*Edit\s*<\/button>/);
  assert.doesNotMatch(table, />\s*Manage terms\s*<\/button>/);
  assert.doesNotMatch(table, /archived_at/);
  assert.match(table, /The fee due date is the official parent deadline/);
  assert.match(table, /Amount is locked while terms exist/);
  assert.match(table, /Official parent deadline\. Term dates must be on or before this date/);
  assert.match(table, /TuitionTermScheduleFields/);
  assert.match(table, /latestDueDate=\{row\.dueDate\}/);
  assert.match(termFields, /name="termName"/);
  assert.match(termFields, /name="termAmount"/);
  assert.match(termFields, /name="termDueDate"/);
  assert.match(termFields, /Term due date/);
  assert.match(termFields, /max=\{latestDueDate \?\? undefined\}/);
  assert.match(termFields, /Term amounts must match the tuition amount before saving/);
  assert.match(termFields, /function rebalanceTerms/);
});

test("parent fee and payment helpers expose payable tuition terms through guardian scope", () => {
  const feeHelper = readFileSync(parentFeeRecordsPath, "utf8");
  const feesTable = readFileSync(parentFeesTablePath, "utf8");
  const paymentHelper = readFileSync(paymentRecordsPath, "utf8");
  const paymentForm = readFileSync(paymentFormPath, "utf8");
  const terms = readFileSync(tuitionTermsPath, "utf8");

  assert.match(feeHelper, /parseTuitionTermsBlob/);
  assert.match(feeHelper, /formatFeeTerms/);
  assert.match(feeHelper, /dueDateCandidates/);
  assert.match(feeHelper, /row\.due_date \? formatDate\(row\.due_date\) : "Pending"/);
  assert.match(feeHelper, /Earliest unpaid fee deadline/);
  assert.match(feesTable, /Tuition payment terms/);
  assert.match(feesTable, /Visible now, not payable for this status/);
  assert.match(paymentHelper, /source: "fee" \| "term"/);
  assert.match(paymentHelper, /getParentPayableTuitionTerms/);
  assert.match(terms, /JOIN tuition_payment_terms tpt/);
  assert.match(terms, /sfa\.due_date/);
  assert.match(terms, /sg\.parent_user_id = :parentUserId/);
  assert.doesNotMatch(paymentHelper, /tpt\.due_date <= CURRENT_DATE/);
  assert.doesNotMatch(terms, /tpt\.due_date <= CURRENT_DATE/);
  assert.match(paymentHelper, /NOT EXISTS \(/);
  assert.match(paymentForm, /name=\{fee\.source === "term" \? "tuitionTermId" : "feeAssignmentId"\}/);
});

test("parent payment action pays tuition terms and updates assignment totals", () => {
  const action = readFileSync(paymentActionsPath, "utf8");
  const records = readFileSync(paymentRecordsPath, "utf8");
  const terms = readFileSync(tuitionTermsPath, "utf8");

  assert.match(action, /selectedTermIds\(formData\)/);
  assert.match(action, /Pay tuition terms separately from regular fee balances/);
  assert.match(action, /applyTuitionTermPayment/);
  assert.doesNotMatch(action, /function createTuitionTermPayment/);
  assert.doesNotMatch(action, /getLockedPayableTerms/);
  assert.match(terms, /INSERT INTO payment_term_allocations/);
  assert.match(terms, /UPDATE tuition_payment_terms/);
  assert.match(terms, /recalculateTuitionAssignmentFromTerms/);
  assert.doesNotMatch(action, /tpt\.due_date <= CURRENT_DATE/);
  assert.match(records, /payment_term_allocations pta/);
  assert.match(records, /CONCAT\(term_ft\.name, ' - ', tpt\.term_name\)/);
});

test("docs and visual plans mention tuition terms as implemented", () => {
  const combined = [
    checklistPath,
    flowchartsPath,
    visualFlowchartsPath,
    visualSchemaPath,
  ].map((path) => readFileSync(path, "utf8")).join("\n");

  assert.match(combined, /tuition payment terms/i);
  assert.match(combined, /installment/i);
  assert.match(combined, /tuition_payment_terms/);
  assert.match(combined, /payment_term_allocations/);
  assert.match(combined, /other fees remain|other fees stay/i);
});
