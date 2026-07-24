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
const parentFeeArchiveActionsPath = "app/parent/fees/actions.ts";
const parentFeeArchiveServicePath = "lib/fees/parent-archive.ts";
const parentFeeArchiveMigrationPath = "database/migrations/2026-07-21-parent-fee-summary-archive.sql";
const parentFeePermanentHideMigrationPath = "database/migrations/2026-07-24-parent-fee-permanent-hide.sql";
const fullSchemaPath = "database/full-schema-v1.sql";
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
  assert.match(helper, /gradeName: row\.grade_name/);
  assert.match(helper, /sectionName: row\.section_name/);
  assert.match(helper, /studentReference: row\.student_reference/);
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
  assert.match(forms, /Assign other fee/);
  assert.match(forms, /Assign tuition fee/);
  assert.match(studentChecklist, /name="studentIds"/);
  assert.match(studentChecklist, /Search enrolled students/);
  assert.match(studentChecklist, /All grades/);
  assert.match(studentChecklist, /All sections/);
  assert.match(studentChecklist, /student\.gradeName === grade/);
  assert.match(studentChecklist, /student\.sectionName === section/);
  assert.match(studentChecklist, /Select matching/);
  assert.match(studentChecklist, /Use filters to assign this fee by grade, section, or selected students/);
  assert.match(studentChecklist, /Clear/);
  assert.match(forms, /name="feeTypeId"/);
  assert.match(forms, /name="amountDue"/);
  assert.match(forms, /Custom amount/);
  assert.match(forms, /Leave blank to use fee default/);
  assert.match(forms, /Leave blank to use the default amount\. Use this for discounts or approved exceptions/);
  assert.match(forms, /name="dueDate"/);
  assert.match(forms, /Fee due date/);
  assert.match(forms, /Official parent deadline\. Any payment term dates must be on or before this date/);
  assert.match(forms, /Used as the parent payment deadline for this fee/);
  assert.match(forms, /Choose fee/);
  assert.match(forms, /Select students/);
  assert.match(forms, /Set amount and deadline/);
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
  assert.match(createFormSection, /Add other fee type/);
  assert.match(createFormSection, /Create a reusable charge for this school year/);
  assert.match(createFormSection, /Default amount per student/);
  assert.match(assignFormSection, /FeeStudentChecklist/);
  assert.match(assignFormSection, /name="amountDue"/);
  assert.match(assignFormSection, /name="dueDate"/);
  assert.match(assignFormSection, /Set amount and deadline/);
  assert.match(assignFormSection, /Leave blank to use the default amount/);
  assert.match(assignFormSection, /The date this fee should be paid by the parent/);
  assert.match(assignFormSection, /selectedStudentCount === 0/);
  assert.doesNotMatch(assignFormSection, /name="defaultAmount"/);

  const checklist = readFileSync("app/admin/fees/fee-student-checklist.tsx", "utf8");
  assert.match(checklist, /onSelectionChange/);
  assert.match(checklist, /selectedIds\.length === 1 \? "student" : "students"/);
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

test("admin dashboard omits fee assignment management while dedicated finance pages retain it", () => {
  const helper = readFileSync("lib/admin/real-data.ts", "utf8");
  const dashboard = readFileSync(adminDashboardPagePath, "utf8");
  const dashboardRecentTables = readFileSync(adminDashboardRecentTablesPath, "utf8");
  const tuitionPage = readFileSync(tuitionPagePath, "utf8");
  const otherFeesPage = readFileSync(otherFeesPagePath, "utf8");

  assert.doesNotMatch(helper, /getRecentFeeAssignments|recentFeeAssignments/);
  assert.match(dashboard, /getAdminStaffRole\(session\.userId\)/);
  assert.match(dashboard, /RecentPaymentsTable rows=\{payments\}/);
  assert.doesNotMatch(dashboard, /getAdminFeeSetupData|DashboardFeeAssignmentActions|triggerLabel="Assign fee"|triggerLabel="Add fee type"/);
  assert.doesNotMatch(dashboardRecentTables, /Recent fee assignments|RecentFeeAssignmentsTable/);
  assert.match(tuitionPage, /triggerLabel="Assign fee"/);
  assert.match(tuitionPage, /triggerLabel="Add fee type"/);
  assert.match(otherFeesPage, /triggerLabel="Assign fee"/);
  assert.match(otherFeesPage, /triggerLabel="Add fee type"/);
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
  assert.match(feesTable, /function exportParentFeeSummaryPdf\(rows: ParentFeeRow\[\], includeArchived: boolean\)/);
  assert.match(feesTable, /onExportPdf=\{\(\) => exportParentFeeSummaryPdf\(filteredRows, view === "archived"\)\}/);
  assert.match(feesTable, /rows\.flatMap/);
  assert.match(feesTable, /`Term: \$\{term\.name\}`/);
  assert.match(feesTable, /"Tuition term"/);
  assert.match(feesTable, /term\.amountDue/);
  assert.match(feesTable, /term\.dueDate/);
  assert.match(feesTable, /startsWith\("Term:"\)/);
  assert.doesNotMatch(feesTable, /onExportPdf=\{\(\) => exportRowsToPdf/);
  assert.match(page, /data\.hasPayableFees/);
  assert.match(page, /Pay fees/);
  assert.match(page, /No balance due/);
  assert.doesNotMatch(page, /feeSummary/);
  assert.doesNotMatch(parentPortalData, /export const feeSummary/);
  assert.doesNotMatch(parentPortalData, /Fee backend pending/);
});

test("parent Fee summary archive is parent-specific and preserves financial truth", () => {
  const helper = readFileSync(feeRecordsPath, "utf8");
  const service = readFileSync(parentFeeArchiveServicePath, "utf8");
  const actions = readFileSync(parentFeeArchiveActionsPath, "utf8");

  assert.match(helper, /LEFT JOIN parent_fee_summary_archives pfsa/);
  assert.match(helper, /pfsa\.parent_user_id = :parentUserId/);
  assert.match(helper, /activeRows: ParentFeeRow\[\]/);
  assert.match(helper, /archivedRows: ParentFeeRow\[\]/);
  assert.match(helper, /archiveEligible: row\.status === "paid" \|\| balanceValue <= 0/);
  assert.match(helper, /const totals = rows\.reduce/);
  assert.match(helper, /const activeRows = visibleRows\.filter/);
  assert.match(helper, /const visibleRows = displayRows\.filter\(\(row\) => !row\.deletedAt\)/);
  assert.match(helper, /const archivedRows = visibleRows\.filter/);
  assert.match(helper, /deletedAt: row\.deleted_at/);

  assert.match(service, /import "server-only"/);
  assert.match(service, /ParentFeeArchiveOperation = "archive" \| "restore" \| "delete"/);
  assert.match(service, /student_guardians sg/);
  assert.match(service, /sg\.parent_user_id = :parentUserId/);
  assert.match(service, /sy\.status = 'active'/);
  assert.match(service, /sfa\.status = 'paid' OR sfa\.amount_paid >= sfa\.amount_due/);
  assert.match(service, /INSERT IGNORE INTO parent_fee_summary_archives/);
  assert.match(service, /DELETE FROM parent_fee_summary_archives/);
  assert.match(service, /SET deleted_at = CURRENT_TIMESTAMP/);
  assert.match(service, /pfsa\.deleted_at IS NULL/);
  assert.ok(
    (service.match(/FOR UPDATE/g) ?? []).length >= 2,
    "restore and permanent removal should serialize archived-row updates",
  );
  assert.doesNotMatch(service, /UPDATE student_fee_assignments|UPDATE payments|DELETE FROM student_fee_assignments/);

  assert.match(actions, /export async function archiveParentFeeAssignmentsAction/);
  assert.match(actions, /export async function restoreParentFeeAssignmentsAction/);
  assert.match(actions, /export async function permanentlyDeleteParentFeeAssignmentsAction/);
  assert.match(actions, /await requireRole\("parent"\)/);
  assert.match(actions, /\.slice\(0, 100\)/);
  assert.match(actions, /updatedIds/);
  assert.match(actions, /revalidatePath\("\/parent\/fees"\)/);
});

test("parent Fee summary archive table switches locally with selection and immediate row movement", () => {
  const table = readFileSync(parentFeesTablePath, "utf8");
  const page = readFileSync(parentFeesPagePath, "utf8");

  assert.match(page, /activeRows=\{data\.activeRows\}/);
  assert.match(page, /archivedRows=\{data\.archivedRows\}/);
  assert.match(table, /Current fees/);
  assert.match(table, /Archived fees/);
  assert.match(table, /role="tablist"/);
  assert.match(table, /Select visible/);
  assert.match(table, /Clear selection/);
  assert.match(table, /const operationLabel = view === "archived" \? "Restore" : "Archive"/);
  assert.match(table, /\{operationLabel\} selected/);
  assert.match(table, /Delete selected/);
  assert.match(table, /operation: "delete"/);
  assert.match(table, /Permanently delete/);
  assert.match(table, /cannot be undone in the parent portal/);
  assert.match(table, /type="button" autoFocus/);
  assert.match(table, /setArchivedFeeRows\(\(current\) =>\s+current\.filter/);
  assert.match(table, /row\.archiveEligible/);
  assert.match(table, /Outstanding fees cannot be archived/);
  assert.match(table, /setActiveFeeRows/);
  assert.match(table, /setArchivedFeeRows/);
  assert.match(table, /result\.updatedIds/);
  assert.match(table, /role="alertdialog"/);
  assert.match(table, /router\.refresh\(\)/);
  assert.match(table, /pagination\.pageRows/);
  assert.match(table, /exportParentFeeSummaryPdf\(filteredRows/);
  assert.match(table, /`Term: \$\{term\.name\}`/);
});

test("parent Fee summary archive migration and fresh schema use separate metadata", () => {
  assert.equal(existsSync(parentFeeArchiveMigrationPath), true);
  const migration = readFileSync(parentFeeArchiveMigrationPath, "utf8");
  const schema = readFileSync(fullSchemaPath, "utf8");

  for (const source of [migration, schema]) {
    assert.match(source, /CREATE TABLE IF NOT EXISTS parent_fee_summary_archives/);
    assert.match(source, /PRIMARY KEY \(parent_user_id, student_fee_assignment_id\)/);
    assert.match(source, /idx_parent_fee_archives_parent_archived_assignment/);
    assert.match(source, /FOREIGN KEY \(parent_user_id\) REFERENCES users\(id\)/);
    assert.match(source, /FOREIGN KEY \(student_fee_assignment_id\) REFERENCES student_fee_assignments\(id\)/);
  }

  assert.doesNotMatch(migration, /ALTER TABLE student_fee_assignments|ADD COLUMN archived_at/);
});

test("parent Fee summary permanent removal uses an idempotent parent-only tombstone", () => {
  assert.equal(existsSync(parentFeePermanentHideMigrationPath), true);
  const migration = readFileSync(parentFeePermanentHideMigrationPath, "utf8");
  const schema = readFileSync(fullSchemaPath, "utf8");
  const helper = readFileSync(feeRecordsPath, "utf8");
  const service = readFileSync(parentFeeArchiveServicePath, "utf8");

  assert.match(migration, /information_schema\.COLUMNS/);
  assert.match(migration, /COLUMN_NAME = 'deleted_at'/);
  assert.match(migration, /ADD COLUMN deleted_at DATETIME NULL/);
  assert.match(migration, /information_schema\.STATISTICS/);
  assert.match(schema, /deleted_at DATETIME NULL/);
  assert.match(schema, /idx_parent_fee_archives_parent_deleted_archived_assignment/);
  assert.match(helper, /pfsa\.archived_at, pfsa\.deleted_at/);
  assert.match(service, /sg\.parent_user_id = :parentUserId/);
  assert.match(service, /sy\.status = 'active'/);
  assert.match(service, /sfa\.status = 'paid' OR sfa\.amount_paid >= sfa\.amount_due/);
  assert.doesNotMatch(
    `${migration}\n${service}`,
    /DELETE FROM student_fee_assignments|DELETE FROM payments|DELETE FROM receipts/,
  );
});

test("checklist marks Phase 4 fees backend complete before Phase 5 payment work", () => {
  const checklist = readFileSync(checklistPath, "utf8");

  assert.match(checklist, /- \[x\] Add backend helpers for `fee_types` and `student_fee_assignments`\./);
  assert.match(checklist, /- \[x\] Create tuition and other fee types for the active school year\./);
  assert.match(checklist, /- \[x\] Assign fees to one or more selected students, with grade\/section filters for faster bulk selection\./);
  assert.match(checklist, /- \[x\] Replace parent fee summary mock rows with database rows\./);
  assert.match(checklist, /- \[x\] Calculate open, partial, and paid balances from database values\./);
  assert.match(checklist, /Parent local test payments, fee allocations, receipts, and payment history are implemented\./);
});
