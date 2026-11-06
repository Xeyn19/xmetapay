import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("tuition page renders the student balance report before secondary insights and reminders", () => {
  const page = read("app/admin/(dashboard)/tuition/page.tsx");
  const reportIndex = page.indexOf("Student tuition balances");
  const insightIndex = page.indexOf("Outstanding balances by grade");
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
  assert.match(realData, /label: "Student tuition records"/);
  assert.match(realData, /paid`/);
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

test("tuition controls support reference search section filtering sorting exports and reset", () => {
  const table = read("app/admin/(dashboard)/tuition/tuition-report-table.tsx");
  const controls = read("app/_components/table-controls.tsx");
  const realData = read("lib/admin/real-data.ts");

  assert.match(realData, /st\.student_reference/);
  assert.match(realData, /studentReference: row\.student_reference/);
  assert.match(table, /studentReference: string/);
  assert.match(table, /Search student name or reference/);
  assert.match(table, /row\.studentReference/);
  assert.match(table, /label: "Student reference"/);
  assert.match(table, /label: "Section"/);
  assert.match(table, /Grade then student name/);
  assert.match(table, /Highest balance/);
  assert.match(table, /Nearest due date/);
  assert.match(table, /Student name A–Z/);
  assert.match(table, /if \(!left\.dueDate\) return 1/);
  assert.doesNotMatch(table, /filteredRows\.length === 1 \? "student" : "students"/);
  assert.match(table, /Reset filters/);
  assert.match(table, /exportRowsToExcel[\s\S]*filteredRows/);
  assert.match(controls, /searchLabel\?: string/);
  assert.match(controls, /clearLabel\?: string/);
  assert.match(controls, /clearDisabled\?: boolean/);
});

test("reminder filters clear hidden selections and keep filter reset separate", () => {
  const history = read("app/admin/(dashboard)/tuition/payment-reminder-history-table.tsx");

  assert.match(history, /function|const changeQuery/);
  assert.match(history, /const changeQuery = \(value: string\)[\s\S]*setSelectedIds\(\[\]\)[\s\S]*setConfirmationIds\(\[\]\)/);
  assert.match(history, /const changeStatus = \(value: string\)[\s\S]*setSelectedIds\(\[\]\)[\s\S]*setConfirmationIds\(\[\]\)/);
  assert.match(history, /Search reminder history by student, parent, subject, or message/);
  assert.match(history, /Reset filters/);
  assert.match(history, /aria-label="Select all visible reminders"/);
  assert.match(history, /selectedIds\.length > 0/);
  assert.match(history, /> Clear/);
});
