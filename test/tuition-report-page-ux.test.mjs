import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("tuition page renders the student balance report before secondary insights and reminders", () => {
  const page = read("app/admin/(dashboard)/tuition/page.tsx");
  const reportIndex = page.indexOf("Student tuition balances");
  const insightIndex = page.indexOf("Outstanding by grade");
  const reminderIndex = page.indexOf("<PaymentReminderPanel");

  assert.ok(reportIndex > -1);
  assert.ok(insightIndex > reportIndex);
  assert.ok(reminderIndex > insightIndex);
  assert.match(page, /Create assessments/);
  assert.match(page, /Tuition packages &amp; setup/);
});

test("payment reminder history is compact by default and expands without replacing its existing table", () => {
  const panel = read("app/admin/(dashboard)/tuition/payment-reminder-panel.tsx");
  assert.match(panel, /useState\(false\)/);
  assert.match(panel, /aria-expanded=\{historyOpen\}/);
  assert.match(panel, /Show reminder history/);
  assert.match(panel, /Hide reminder history/);
  assert.match(panel, /historyOpen \? \(/);
  assert.match(panel, /PaymentReminderHistoryTable/);
  assert.match(panel, /PaymentReminderForm/);
  assert.match(panel, /activeRows\.length/);
  assert.match(panel, /archivedRows\.length/);
});

test("tuition report uses finance-first columns and clearer payment wording", () => {
  const table = read("app/admin/(dashboard)/tuition/tuition-report-table.tsx");
  const realData = read("lib/admin/real-data.ts");
  for (const label of ["Billed", "Paid", "Balance", "Payment plan / due date", "Last payment", "Status", "Actions"]) {
    assert.match(table, new RegExp(label.replace("/", "\\/")));
  }
  assert.match(table, /Full payment/);
  assert.match(table, /No payment yet/);
  assert.match(table, /`Due \$\{row\.dueDate\}`/);
  assert.match(realData, /label: "Tuition records"/);
  assert.match(realData, /collected`/);
  assert.match(realData, /with remaining balance/);
});

test("tuition report compatibility keeps filters exports and financial actions", () => {
  const table = read("app/admin/(dashboard)/tuition/tuition-report-table.tsx");
  const panel = read("app/admin/(dashboard)/tuition/payment-reminder-panel.tsx");
  assert.match(table, /filterByQuery/);
  assert.match(table, /toFilterOptions/);
  assert.match(table, /exportRowsToExcel/);
  assert.match(table, /exportRowsToPdf/);
  assert.match(table, /TuitionAssignmentEditModal/);
  assert.match(table, /TuitionTermsModal/);
  assert.match(panel, /id="payment-reminders"/);
  assert.match(panel, /min-h-11/);
  assert.match(panel, /focus-visible:ring-primary/);
  assert.match(panel, /aria-live="polite"/);
});
