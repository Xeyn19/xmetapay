import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const feeRecordsPath = "lib/fees/records.ts";
const feeActionsPath = "app/admin/fees/actions.ts";
const feeFormsPath = "app/admin/fees/fee-management-forms.tsx";
const feeStudentChecklistPath = "app/admin/fees/fee-student-checklist.tsx";
const tuitionPagePath = "app/admin/(dashboard)/tuition/page.tsx";
const tuitionTablePath = "app/admin/(dashboard)/tuition/tuition-report-table.tsx";
const otherFeesPagePath = "app/admin/(dashboard)/other-fees/page.tsx";
const otherFeesTablePath = "app/admin/(dashboard)/other-fees/other-fees-table.tsx";
const otherFeesModalPath = "app/admin/(dashboard)/other-fees/other-fees-management-modal.tsx";
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
  assert.match(actions, /INSERT IGNORE INTO student_fee_assignments/);
  assert.match(actions, /idValues\(formData, "studentIds", "studentId"\)/);
  assert.match(actions, /studentRows\.length !== studentIds\.length/);
  assert.match(actions, /Custom amount must be greater than zero/);
  assert.match(actions, /Assigned to \$\{assignedCount\} students/);
  assert.match(actions, /were already assigned/);
  assert.match(actions, /default_amount/);
  assert.match(actions, /e\.status = 'enrolled'/);
  assert.match(actions, /ER_DUP_ENTRY/);
  assert.match(actions, /That fee is already assigned to the selected student/);
});

test("admin tuition and other-fees pages expose database-backed fee forms", () => {
  assert.equal(existsSync(feeFormsPath), true);
  assert.equal(existsSync(feeStudentChecklistPath), true);
  assert.equal(existsSync(otherFeesModalPath), true);
  const forms = readFileSync(feeFormsPath, "utf8");
  const studentChecklist = readFileSync(feeStudentChecklistPath, "utf8");
  const otherFeesModal = readFileSync(otherFeesModalPath, "utf8");
  const tuitionPage = readFileSync(tuitionPagePath, "utf8");
  const tuitionTable = readFileSync(tuitionTablePath, "utf8");
  const otherFeesPage = readFileSync(otherFeesPagePath, "utf8");
  const otherFeesTable = readFileSync(otherFeesTablePath, "utf8");

  assert.match(forms, /createFeeTypeAction\.bind\(null, category, redirectPath\)/);
  assert.match(forms, /assignStudentFeeAction\.bind\(null, category, redirectPath\)/);
  assert.match(forms, /export function FeeCreateTypeForm/);
  assert.match(forms, /export function FeeAssignStudentsForm/);
  assert.match(forms, /name="defaultAmount"/);
  assert.match(forms, /FeeStudentChecklist/);
  assert.match(forms, /Assign \{label\} to selected students/);
  assert.match(studentChecklist, /name="studentIds"/);
  assert.match(studentChecklist, /Search enrolled students/);
  assert.match(studentChecklist, /Select visible/);
  assert.match(studentChecklist, /Clear/);
  assert.match(forms, /name="feeTypeId"/);
  assert.match(forms, /name="amountDue"/);
  assert.match(forms, /Custom amount/);
  assert.match(forms, /Leave blank to use fee default/);
  assert.match(forms, /Use for discounts, scholarships, or special charges/);
  assert.match(forms, /name="dueDate"/);
  assert.match(forms, /Set a specific payment deadline/);
  assert.match(forms, /Choose fee/);
  assert.match(forms, /Select students/);
  assert.match(forms, /Custom amount and due date/);
  assert.match(forms, /xl:grid-cols-\[0\.8fr_1\.2fr\]/);
  assert.doesNotMatch(forms, /Amount due/);
  assert.doesNotMatch(forms, /Use default/);
  assert.match(forms, /Current \{label\} types/);
  assert.match(forms, /data\.feeTypes\.map/);
  assert.match(forms, /No \{label\} types yet/);

  assert.match(tuitionPage, /getAdminFeeSetupData\(session\.userId, "tuition"\)/);
  assert.match(tuitionPage, /OtherFeeActionModal/);
  assert.match(tuitionPage, /triggerLabel="Assign fee"/);
  assert.match(tuitionPage, /triggerLabel="Add fee type"/);
  assert.match(tuitionPage, /triggerIcon="receipt"/);
  assert.match(tuitionPage, /triggerIcon="plus"/);
  assert.doesNotMatch(tuitionPage, /triggerIcon=\{Receipt\}/);
  assert.doesNotMatch(tuitionPage, /triggerIcon=\{Plus\}/);
  assert.match(tuitionPage, /triggerTone="dark"/);
  assert.match(tuitionPage, /triggerTone="outline"/);
  assert.match(tuitionPage, /<FeeAssignStudentsForm category="tuition" redirectPath="\/admin\/tuition" data=\{feeSetup\} \/>/);
  assert.match(tuitionPage, /<FeeCreateTypeForm category="tuition" redirectPath="\/admin\/tuition" data=\{feeSetup\} \/>/);
  assert.doesNotMatch(tuitionPage, /<FeeManagementForms category="tuition"/);
  assert.doesNotMatch(tuitionPage, /Tuition setup/);
  assert.match(tuitionPage, /TuitionReportTable/);
  assert.match(tuitionTable, /DashboardTableControls/);
  assert.match(tuitionTable, /admin-tuition-report\.csv/);
  assert.match(tuitionTable, /admin-tuition-report\.pdf/);
  assert.match(tuitionTable, /exportRowsToPdf/);
  assert.match(otherFeesPage, /getAdminFeeSetupData\(session\.userId, "other"\)/);
  assert.match(otherFeesPage, /OtherFeeActionModal/);
  assert.match(otherFeesPage, /triggerLabel="Assign fee"/);
  assert.match(otherFeesPage, /triggerLabel="Add fee type"/);
  assert.match(otherFeesPage, /triggerIcon="receipt"/);
  assert.match(otherFeesPage, /triggerIcon="plus"/);
  assert.doesNotMatch(otherFeesPage, /triggerIcon=\{Receipt\}/);
  assert.doesNotMatch(otherFeesPage, /triggerIcon=\{Plus\}/);
  assert.match(otherFeesPage, /triggerTone="dark"/);
  assert.match(otherFeesPage, /triggerTone="outline"/);
  assert.match(otherFeesPage, /<FeeAssignStudentsForm category="other" redirectPath="\/admin\/other-fees" data=\{feeSetup\} \/>/);
  assert.match(otherFeesPage, /<FeeCreateTypeForm category="other" redirectPath="\/admin\/other-fees" data=\{feeSetup\} \/>/);
  assert.doesNotMatch(otherFeesPage, /<FeeManagementForms category="other"/);
  assert.doesNotMatch(otherFeesPage, /Other fee setup/);
  assert.match(otherFeesModal, /"use client";/);
  assert.match(otherFeesModal, /useId/);
  assert.match(otherFeesModal, /role="dialog"/);
  assert.match(otherFeesModal, /z-\[200\]/);
  assert.match(otherFeesModal, /place-items-center/);
  assert.match(otherFeesModal, /max-w-xl/);
  assert.match(otherFeesModal, /max-w-4xl/);
  assert.match(otherFeesModal, /100svh/);
  assert.match(otherFeesModal, /triggerLabel/);
  assert.match(otherFeesModal, /triggerTone/);
  assert.match(otherFeesModal, /size/);
  assert.match(otherFeesPage, /OtherFeesTable/);
  assert.match(otherFeesTable, /DashboardTableControls/);
  assert.match(otherFeesTable, /admin-other-fees\.csv/);
  assert.match(otherFeesTable, /admin-other-fees\.pdf/);
  assert.match(otherFeesTable, /exportRowsToPdf/);
  assert.match(otherFeesTable, /paidLabel/);
  assert.match(otherFeesTable, /\{item\.amount\}/);
  assert.match(otherFeesTable, /totalBilled/);
  assert.match(otherFeesTable, /Assigned \$/);
  assert.match(otherFeesTable, /Not assigned yet/);
  assert.doesNotMatch(otherFeesPage, /Add fee type pending/);

  const createFormSection = forms.slice(
    forms.indexOf("export function FeeCreateTypeForm"),
    forms.indexOf("export function FeeAssignStudentsForm"),
  );
  const assignFormSection = forms.slice(
    forms.indexOf("export function FeeAssignStudentsForm"),
    forms.indexOf("function feeLabel"),
  );
  assert.doesNotMatch(createFormSection, /FeeStudentChecklist/);
  assert.doesNotMatch(createFormSection, /name="amountDue"/);
  assert.doesNotMatch(createFormSection, /name="dueDate"/);
  assert.match(assignFormSection, /FeeStudentChecklist/);
  assert.match(assignFormSection, /name="amountDue"/);
  assert.match(assignFormSection, /name="dueDate"/);
  assert.doesNotMatch(assignFormSection, /name="defaultAmount"/);
});

test("other fees real data includes paid assignment counts and screenshot-style totals", () => {
  const helper = readFileSync("lib/admin/real-data.ts", "utf8");

  assert.match(helper, /COUNT\(sfa\.id\) AS assigned_count/);
  assert.match(helper, /sfa\.status = 'paid'/);
  assert.match(helper, /AS paid_count/);
  assert.match(helper, /COALESCE\(SUM\(sfa\.amount_due\), 0\) AS billed/);
  assert.match(helper, /GREATEST\(sfa\.amount_due - sfa\.amount_paid, 0\)/);
  assert.match(helper, /paidLabel/);
  assert.match(helper, /No assignments yet/);
  assert.match(helper, /Total billed/);
  assert.match(helper, /Outstanding/);
  assert.match(helper, /Active fee types/);
});

test("admin dashboard shows assigned fees before payment records exist", () => {
  const helper = readFileSync("lib/admin/real-data.ts", "utf8");
  const dashboard = readFileSync(adminDashboardPagePath, "utf8");
  const dashboardRecentTables = readFileSync(adminDashboardRecentTablesPath, "utf8");

  assert.match(helper, /async function getRecentFeeAssignments/);
  assert.match(helper, /FROM student_fee_assignments sfa/);
  assert.match(helper, /ORDER BY sfa\.created_at DESC, sfa\.id DESC/);
  assert.match(dashboard, /getAdminFeeSetupData\(session\.userId, "tuition"\)/);
  assert.match(dashboard, /getAdminStaffRole\(session\.userId\)/);
  assert.match(dashboard, /canAccessFinance\(staffRole\)/);
  assert.match(dashboard, /const feeAssignmentAction = canManageFinance/);
  assert.match(dashboard, /<DashboardFeeAssignmentActions feeSetup=\{feeSetup\} \/>/);
  assert.match(dashboard, /triggerLabel="Assign fee"/);
  assert.match(dashboard, /triggerLabel="Add fee type"/);
  assert.match(dashboard, /triggerIcon="receipt"/);
  assert.match(dashboard, /triggerIcon="plus"/);
  assert.doesNotMatch(dashboard, /triggerIcon=\{Receipt\}/);
  assert.doesNotMatch(dashboard, /triggerIcon=\{Plus\}/);
  assert.match(dashboard, /<FeeAssignStudentsForm category="tuition" redirectPath="\/admin\/tuition" data=\{feeSetup\} \/>/);
  assert.match(dashboard, /<FeeCreateTypeForm category="tuition" redirectPath="\/admin\/tuition" data=\{feeSetup\} \/>/);
  assert.match(dashboardRecentTables, /Recent fee assignments/);
  assert.match(dashboardRecentTables, /feeAssignmentAction\?: ReactNode/);
  assert.match(dashboardRecentTables, /action=\{action\}/);
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
  assert.match(checklist, /- \[x\] Assign fees to one or more selected students\./);
  assert.match(checklist, /- \[x\] Replace parent fee summary mock rows with database rows\./);
  assert.match(checklist, /- \[x\] Calculate open, partial, and paid balances from database values\./);
  assert.match(checklist, /Parent local test payments, fee allocations, receipts, and payment history are implemented\./);
});
