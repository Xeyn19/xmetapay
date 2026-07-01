import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const feeRecordsPath = "lib/fees/records.ts";
const feeActionsPath = "app/admin/fees/actions.ts";
const feeFormsPath = "app/admin/fees/fee-management-forms.tsx";
const tuitionPagePath = "app/admin/(dashboard)/tuition/page.tsx";
const tuitionTablePath = "app/admin/(dashboard)/tuition/tuition-report-table.tsx";
const otherFeesPagePath = "app/admin/(dashboard)/other-fees/page.tsx";
const otherFeesTablePath = "app/admin/(dashboard)/other-fees/other-fees-table.tsx";
const adminDashboardPagePath = "app/admin/(dashboard)/dashboard/page.tsx";
const adminDashboardRecentTablesPath = "app/admin/(dashboard)/dashboard/dashboard-recent-tables.tsx";
const parentFeesPagePath = "app/parent/(portal)/fees/page.tsx";
const parentFeesTablePath = "app/parent/(portal)/fees/fees-table.tsx";
const parentPortalDataPath = "app/parent/_data/parent-portal-data.ts";
const checklistPath = "docs/CHECKLIST.md";

test("fee records helper reads admin options and parent fee balances from MySQL", () => {
  assert.equal(existsSync(feeRecordsPath), true);
  const helper = readFileSync(feeRecordsPath, "utf8");

  assert.match(helper, /import "server-only";/);
  assert.match(helper, /export async function getAdminFeeSetupData/);
  assert.match(helper, /export async function getParentFeePageData/);
  assert.match(helper, /FROM fee_types/);
  assert.match(helper, /JOIN student_fee_assignments/);
  assert.match(helper, /FROM student_guardians sg/);
  assert.match(helper, /WHERE sg\.parent_user_id = :parentUserId/);
  assert.match(helper, /getResolvedAdminSchoolSetup\(adminUserId\)/);
});

test("admin fee actions are protected and validate finance writes", () => {
  assert.equal(existsSync(feeActionsPath), true);
  const actions = readFileSync(feeActionsPath, "utf8");

  assert.match(actions, /"use server";/);
  assert.match(actions, /export async function createFeeTypeAction/);
  assert.match(actions, /export async function assignStudentFeeAction/);
  assert.match(actions, /await requireRole\("admin"\)/);
  assert.match(actions, /canAccessFinance\(staffRole\)/);
  assert.match(actions, /INSERT INTO fee_types/);
  assert.match(actions, /INSERT INTO student_fee_assignments/);
  assert.match(actions, /default_amount/);
  assert.match(actions, /e\.status = 'enrolled'/);
  assert.match(actions, /ER_DUP_ENTRY/);
  assert.match(actions, /That fee is already assigned to the selected student/);
});

test("admin tuition and other-fees pages expose database-backed fee forms", () => {
  assert.equal(existsSync(feeFormsPath), true);
  const forms = readFileSync(feeFormsPath, "utf8");
  const tuitionPage = readFileSync(tuitionPagePath, "utf8");
  const tuitionTable = readFileSync(tuitionTablePath, "utf8");
  const otherFeesPage = readFileSync(otherFeesPagePath, "utf8");
  const otherFeesTable = readFileSync(otherFeesTablePath, "utf8");

  assert.match(forms, /createFeeTypeAction\.bind\(null, category, redirectPath\)/);
  assert.match(forms, /assignStudentFeeAction\.bind\(null, category, redirectPath\)/);
  assert.match(forms, /name="defaultAmount"/);
  assert.match(forms, /name="studentId"/);
  assert.match(forms, /name="feeTypeId"/);
  assert.match(forms, /name="amountDue"/);
  assert.match(forms, /name="dueDate"/);
  assert.match(forms, /Current \{label\} types/);
  assert.match(forms, /data\.feeTypes\.map/);
  assert.match(forms, /No \{label\} types yet/);

  assert.match(tuitionPage, /getAdminFeeSetupData\(session\.userId, "tuition"\)/);
  assert.match(tuitionPage, /<FeeManagementForms category="tuition" redirectPath="\/admin\/tuition" data=\{feeSetup\} \/>/);
  assert.match(tuitionPage, /TuitionReportTable/);
  assert.match(tuitionTable, /DashboardTableControls/);
  assert.match(tuitionTable, /admin-tuition-report\.csv/);
  assert.match(tuitionTable, /admin-tuition-report\.pdf/);
  assert.match(tuitionTable, /exportRowsToPdf/);
  assert.match(otherFeesPage, /getAdminFeeSetupData\(session\.userId, "other"\)/);
  assert.match(otherFeesPage, /<FeeManagementForms category="other" redirectPath="\/admin\/other-fees" data=\{feeSetup\} \/>/);
  assert.match(otherFeesPage, /OtherFeesTable/);
  assert.match(otherFeesTable, /DashboardTableControls/);
  assert.match(otherFeesTable, /admin-other-fees\.csv/);
  assert.match(otherFeesTable, /admin-other-fees\.pdf/);
  assert.match(otherFeesTable, /exportRowsToPdf/);
  assert.doesNotMatch(otherFeesPage, /Add fee type pending/);
});

test("admin dashboard shows assigned fees before payment records exist", () => {
  const helper = readFileSync("lib/admin/real-data.ts", "utf8");
  const dashboard = readFileSync(adminDashboardPagePath, "utf8");
  const dashboardRecentTables = readFileSync(adminDashboardRecentTablesPath, "utf8");

  assert.match(helper, /async function getRecentFeeAssignments/);
  assert.match(helper, /FROM student_fee_assignments sfa/);
  assert.match(helper, /ORDER BY sfa\.created_at DESC, sfa\.id DESC/);
  assert.match(dashboardRecentTables, /Recent fee assignments/);
  assert.match(dashboard, /DashboardRecentTables/);
  assert.match(dashboardRecentTables, /No fee assignments yet/);
  assert.match(dashboard, /Assigned balances appear below/);
});

test("parent fees page reads real balances instead of static fee summary", () => {
  const page = readFileSync(parentFeesPagePath, "utf8");
  const feesTable = readFileSync(parentFeesTablePath, "utf8");
  const parentPortalData = readFileSync(parentPortalDataPath, "utf8");

  assert.match(page, /await requireRole\("parent"\)/);
  assert.match(page, /getParentFeePageData\(session\.userId\)/);
  assert.match(page, /data\.metrics\.map/);
  assert.match(page, /ParentFeesTable/);
  assert.match(feesTable, /DashboardTableControls/);
  assert.match(feesTable, /usePaginatedRows/);
  assert.match(feesTable, /DashboardTablePagination/);
  assert.match(feesTable, /pagination\.pageRows\.map/);
  assert.match(feesTable, /parent-fee-summary\.csv/);
  assert.match(feesTable, /parent-fee-summary\.pdf/);
  assert.match(feesTable, /exportRowsToPdf/);
  assert.match(page, /data\.hasPayableFees/);
  assert.match(page, /Pay fees/);
  assert.match(page, /No balance due/);
  assert.doesNotMatch(page, /feeSummary/);
  assert.doesNotMatch(parentPortalData, /export const feeSummary/);
  assert.doesNotMatch(parentPortalData, /Fee backend pending/);
});

test("checklist marks Phase 4 fees backend complete before Phase 5 payment work", () => {
  const checklist = readFileSync(checklistPath, "utf8");

  assert.match(checklist, /- \[x\] Add backend helpers for `fee_types` and `student_fee_assignments`\./);
  assert.match(checklist, /- \[x\] Create tuition and other fee types for the active school year\./);
  assert.match(checklist, /- \[x\] Assign fees to students\./);
  assert.match(checklist, /- \[x\] Replace parent fee summary mock rows with database rows\./);
  assert.match(checklist, /- \[x\] Calculate open, partial, and paid balances from database values\./);
  assert.match(checklist, /Parent local test payments, fee allocations, receipts, and payment history are implemented\./);
});
