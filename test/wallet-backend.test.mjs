import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const walletRecordsPath = "lib/wallets/records.ts";
const walletActionsPath = "app/parent/wallet/actions.ts";
const walletTopUpServicePath = "lib/wallets/top-up.ts";
const walletPagePath = "app/parent/(portal)/wallet/page.tsx";
const walletFormPath = "app/parent/(portal)/wallet/wallet-top-up-form.tsx";
const walletResultPath = "app/parent/(portal)/wallet/top-up-result/page.tsx";
const walletBatchMigrationPath = "database/migrations/2026-07-25-wallet-top-up-batches.sql";
const parentDashboardPath = "app/parent/(portal)/dashboard/page.tsx";
const parentWalletActivityTablePath = "app/parent/(portal)/_components/parent-wallet-activity-table.tsx";
const parentStudentProfileViewPath = "app/parent/(portal)/student-profile/student-profile-view.tsx";
const adminAllowanceTablePath = "app/admin/(dashboard)/allowance/allowance-table.tsx";
const adminAllowancePagePath = "app/admin/(dashboard)/allowance/page.tsx";
const adminAllowanceActionsPath = "app/admin/allowance/actions.ts";
const adminAllowanceServicePath = "lib/admin/allowance-ledger.ts";
const allowanceArchiveMigrationPath = "database/migrations/2026-07-20-wallet-ledger-archive.sql";
const fullSchemaPath = "database/full-schema-v1.sql";
const paymentRecordsPath = "lib/payments/records.ts";
const parentRecordsPath = "lib/students/records.ts";
const adminRealDataPath = "lib/admin/real-data.ts";
const parentPortalDataPath = "app/parent/_data/parent-portal-data.ts";
const checklistPath = "docs/CHECKLIST.md";
const flowchartsPath = "docs/PROJECT_FLOWCHARTS.md";
const visualFlowchartsPath = "public/PROJECT_FLOWCHARTS_VISUAL.html";

test("wallet records helper reads linked student wallets and transactions through guardian scope", () => {
  assert.equal(existsSync(walletRecordsPath), true);
  const helper = readFileSync(walletRecordsPath, "utf8");

  assert.match(helper, /import "server-only";/);
  assert.match(helper, /export async function getParentWalletPageData\(parentUserId: number\)/);
  assert.match(helper, /FROM student_guardians sg/);
  assert.match(helper, /sg\.parent_user_id = :parentUserId/);
  assert.match(helper, /LEFT JOIN wallets w ON w\.student_id = st\.id/);
  assert.match(helper, /FROM wallet_transactions wt/);
  assert.match(helper, /LEFT JOIN payments p ON p\.id = wt\.payment_id/);
  assert.match(helper, /Wallet top-up/);
});

test("wallet top-up action stays thin and accepts a bounded idempotent student batch", () => {
  assert.equal(existsSync(walletActionsPath), true);
  const action = readFileSync(walletActionsPath, "utf8");

  assert.match(action, /"use server";/);
  assert.match(action, /export async function createWalletTopUpAction\(formData: FormData\)/);
  assert.match(action, /await requireRole\("parent"\)/);
  assert.match(action, /formData\.getAll\("studentIds"\)/);
  assert.match(action, /submissionToken/);
  assert.match(action, /maxWalletTopUpStudents/);
  assert.match(action, /createWalletTopUpBatch/);
  assert.match(action, /\/parent\/wallet\/top-up-result\?batch=/);
});

test("wallet top-up service creates one atomic payment, transaction, and receipt per student", () => {
  const service = readFileSync(walletTopUpServicePath, "utf8");

  assert.match(service, /import "server-only"/);
  assert.match(service, /maxWalletTopUpStudents = 20/);
  assert.match(service, /maxWalletTopUpAmount = 10000/);
  assert.match(service, /beginTransaction/);
  assert.match(service, /student_guardians sg/);
  assert.match(service, /sg\.parent_user_id = :parentUserId/);
  assert.match(service, /sy\.status = 'active'/);
  assert.match(service, /ORDER BY st\.id[\s\S]*FOR UPDATE/);
  assert.match(service, /ORDER BY student_id[\s\S]*FOR UPDATE/);
  assert.match(service, /INSERT INTO wallets/);
  assert.match(service, /ON DUPLICATE KEY UPDATE/);
  assert.match(service, /wallet\.status !== "active"/);
  assert.match(service, /INSERT INTO wallet_top_up_batches/);
  assert.match(service, /for \(const item of items\)/);
  assert.match(service, /INSERT INTO payments/);
  assert.match(service, /wallet_top_up_batch_id/);
  assert.match(service, /UPDATE wallets SET balance/);
  assert.match(service, /INSERT INTO wallet_transactions/);
  assert.match(service, /INSERT INTO receipts/);
  assert.match(service, /await connection\.commit/);
  assert.match(service, /await connection\.rollback/);
  assert.match(service, /ER_DUP_ENTRY/);
});

test("parent wallet page uses real wallet data and no static placeholder rows", () => {
  const page = readFileSync(walletPagePath, "utf8");
  const form = readFileSync(walletFormPath, "utf8");
  const parentPortalData = readFileSync(parentPortalDataPath, "utf8");

  assert.match(page, /await requireRole\("parent"\)/);
  assert.match(page, /getParentWalletPageData\(session\.userId\)/);
  assert.match(page, /WalletTopUpForm wallets=\{data\.wallets\}/);
  assert.match(page, /ParentWalletActivityTable/);
  assert.match(page, /rows=\{data\.transactions\}/);
  assert.match(page, /parent-wallet-transactions\.csv/);
  assert.match(page, /parent-wallet-transactions\.pdf/);
  assert.match(form, /createWalletTopUpAction/);
  assert.match(form, /name="studentIds"/);
  assert.match(form, /name=\{`amount_\$\{wallet\.studentId\}`\}/);
  assert.match(form, /name="channel"/);
  assert.match(form, /name="submissionToken"/);
  assert.match(form, /max="10000"/);
  assert.match(form, /Select all eligible/);
  assert.match(form, /Clear selection/);
  assert.match(form, /Apply amount to selected/);
  assert.match(form, /role="alertdialog"/);
  assert.match(form, /Confirm allowance top-up/);
  assert.match(form, /Recording top-ups/);
  assert.doesNotMatch(page, /walletTransactions|walletQuickAmounts/);
  assert.doesNotMatch(parentPortalData, /walletTransactions|walletQuickAmounts/);
});

test("wallet top-up batch schema and parent-scoped result preserve individual receipts", () => {
  const migration = readFileSync(walletBatchMigrationPath, "utf8");
  const schema = readFileSync(fullSchemaPath, "utf8");
  const records = readFileSync(walletRecordsPath, "utf8");
  const result = readFileSync(walletResultPath, "utf8");

  for (const source of [migration, schema]) {
    assert.match(source, /CREATE TABLE IF NOT EXISTS wallet_top_up_batches/);
    assert.match(source, /submission_token_hash CHAR\(64\)/);
    assert.match(source, /UNIQUE KEY uq_wallet_top_up_batches_submission \(parent_user_id, submission_token_hash\)/);
    assert.match(source, /wallet_top_up_batch_id BIGINT UNSIGNED NULL/);
    assert.match(source, /fk_payments_wallet_top_up_batch/);
  }
  assert.match(migration, /INFORMATION_SCHEMA\.COLUMNS/);
  assert.match(migration, /INFORMATION_SCHEMA\.STATISTICS/);
  assert.match(records, /getParentWalletTopUpBatch/);
  assert.match(records, /wtb\.parent_user_id = :parentUserId/);
  assert.match(records, /JOIN receipts r ON r\.payment_id = p\.id/);
  assert.match(result, /Allowance top-up complete/);
  assert.match(result, /data\.batch\.items\.map/);
  assert.match(result, /\/parent\/receipt\?receiptId=/);
});

test("parent dashboard and student profile expose real wallet details", () => {
  const records = readFileSync(parentRecordsPath, "utf8");
  const dashboard = readFileSync(parentDashboardPath, "utf8");
  const walletActivityTable = readFileSync(parentWalletActivityTablePath, "utf8");
  const profileView = readFileSync(parentStudentProfileViewPath, "utf8");

  assert.match(records, /wallet_balance/);
  assert.match(records, /wallet_count/);
  assert.match(records, /walletDetails/);
  assert.match(records, /LEFT JOIN wallets w ON w\.student_id = st\.id/);
  assert.match(records, /Top up allowance to create a wallet/);
  assert.match(records, /async function getParentRecentWalletActivity\(\s*parentUserId: number,/);
  assert.match(records, /FROM wallet_transactions wt/);
  assert.match(records, /JOIN student_guardians sg ON sg\.student_id = st\.id AND sg\.parent_user_id = :parentUserId/);
  assert.match(records, /selectedStudentClause = typeof studentId === "number" \? "AND st\.id = :studentId" : ""/);
  assert.match(records, /getParentRecentWalletActivity\(parentUserId, \{ studentId: row\.id, limit: 10 \}\)/);
  assert.match(records, /walletActivity/);
  assert.match(dashboard, /getParentDashboardData/);
  assert.match(dashboard, /Recent wallet activity/);
  assert.match(dashboard, /ParentWalletActivityTable/);
  assert.match(dashboard, /data\.walletActivity/);
  assert.match(walletActivityTable, /DashboardTableControls/);
  assert.match(walletActivityTable, /usePaginatedRows/);
  assert.match(walletActivityTable, /DashboardTablePagination/);
  assert.match(walletActivityTable, /pagination\.pageRows\.map/);
  assert.match(walletActivityTable, /parent-wallet-activity\.csv/);
  assert.match(walletActivityTable, /parent-wallet-activity\.pdf/);
  assert.match(walletActivityTable, /exportRowsToPdf/);
  assert.match(walletActivityTable, /showStudent/);
  assert.match(walletActivityTable, /No wallet activity yet/);
  assert.match(profileView, /student\.walletDetails/);
  assert.match(profileView, /ParentWalletActivityTable/);
  assert.match(profileView, /rows=\{student\.walletActivity\}/);
  assert.match(profileView, /showStudent=\{false\}/);
  assert.doesNotMatch(records, /Phase 6 will add allowance/);
  assert.doesNotMatch(profileView, /Wallet backend pending/);
});

test("admin allowance page uses working controls for real wallet rows", () => {
  const page = readFileSync(adminAllowancePagePath, "utf8");
  const table = readFileSync(adminAllowanceTablePath, "utf8");
  const adminRealData = readFileSync(adminRealDataPath, "utf8");

  assert.match(page, /AllowanceTable/);
  assert.match(page, /Student wallet balances/);
  assert.match(page, /getAdminAllowancePageRealData/);
  assert.match(page, /activeRows=\{data\.activeRows\}/);
  assert.match(page, /archivedRows=\{data\.archivedRows\}/);
  assert.match(adminRealData, /label: "Active wallets"/);
  assert.match(adminRealData, /COUNT\(CASE WHEN wallet_status = 'active' THEN 1 END\) AS active_wallets/);
  assert.match(adminRealData, /label: "Top-ups this month"/);
  assert.match(adminRealData, /wt\.type = 'top_up'/);
  assert.match(adminRealData, /monthly_top_ups/);
  assert.match(adminRealData, /monthly_top_up_count/);
  assert.match(table, /DashboardTableControls/);
  assert.match(table, /SegmentedTabs/);
  assert.match(table, /All students/);
  assert.match(table, /Low balance/);
  assert.match(table, /Zero balance/);
  assert.match(table, /usePaginatedRows/);
  assert.match(table, /DashboardTablePagination/);
  assert.match(table, /pagination\.pageRows\.map/);
  assert.match(table, /admin-allowance-wallets\.csv/);
  assert.match(table, /admin-allowance-wallets\.pdf/);
  assert.match(table, /exportRowsToPdf/);
  assert.match(table, /filterByQuery/);
  assert.match(table, /Active wallets/);
  assert.match(table, /Archived wallets/);
  assert.match(table, /Select visible/);
  assert.match(table, /Clear selection/);
  assert.match(table, /role="alertdialog"/);
  assert.match(table, /setActiveWalletRows/);
  assert.match(table, /setArchivedWalletRows/);
  assert.match(table, /router\.refresh\(\)/);
  assert.doesNotMatch(table, /toFilterOptions/);
  assert.doesNotMatch(page, /Export pending/);
});

test("allowance archive is selected-year view metadata and never changes wallet operations", () => {
  const actions = readFileSync(adminAllowanceActionsPath, "utf8");
  const service = readFileSync(adminAllowanceServicePath, "utf8");
  const migration = readFileSync(allowanceArchiveMigrationPath, "utf8");
  const schema = readFileSync(fullSchemaPath, "utf8");

  assert.match(actions, /archiveAllowanceWalletsAction/);
  assert.match(actions, /restoreAllowanceWalletsAction/);
  assert.match(actions, /await requireRole\("admin"\)/);
  assert.match(actions, /canAccessFinance\(staffRole\)/);
  assert.match(actions, /getResolvedAdminSchoolViewSetup/);
  assert.match(actions, /slice\(0, 100\)/);
  assert.match(service, /AllowanceLedgerArchiveScope = "active" \| "archived" \| "all"/);
  assert.match(service, /wla\.school_year_id = :schoolYearId/);
  assert.match(service, /INSERT INTO wallet_ledger_archives/);
  assert.match(service, /DELETE FROM wallet_ledger_archives/);
  assert.doesNotMatch(service, /UPDATE wallets[\s\S]*SET (balance|status)/);
  assert.doesNotMatch(service, /UPDATE wallet_transactions/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS wallet_ledger_archives/);
  assert.match(migration, /information_schema\.COLUMNS/);
  assert.match(migration, /information_schema\.STATISTICS/);
  assert.match(migration, /DECLARE CONTINUE HANDLER FOR 1060/);
  assert.match(migration, /DECLARE CONTINUE HANDLER FOR 1061/);
  assert.match(migration, /PRIMARY KEY \(wallet_id, school_year_id\)/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS wallet_ledger_archives/);
  assert.match(schema, /idx_wallet_ledger_archives_year_archived_wallet/);
});

test("payment history and parent records label wallet top-ups while admin collections stay tuition-only", () => {
  const paymentRecords = readFileSync(paymentRecordsPath, "utf8");
  const parentRecords = readFileSync(parentRecordsPath, "utf8");

  for (const source of [paymentRecords, parentRecords]) {
    assert.match(source, /LEFT JOIN wallet_transactions wt ON wt\.payment_id = p\.id/);
    assert.match(source, /MAX\(CASE WHEN wt\.type = 'top_up' THEN 'Wallet top-up' END\)/);
  }

  assert.doesNotMatch(readFileSync(adminRealDataPath, "utf8"), /Wallet top-up/);
});

test("docs and checklist mark wallet top-up and store transactions complete with later phases still future", () => {
  const checklist = readFileSync(checklistPath, "utf8");
  const flowcharts = readFileSync(flowchartsPath, "utf8");
  const visualFlowcharts = readFileSync(visualFlowchartsPath, "utf8");

  assert.match(checklist, /- \[x\] Add backend helpers for `wallets` and `wallet_transactions`\./);
  assert.match(checklist, /- \[x\] Create student wallets lazily when the parent tops up allowance\./);
  assert.match(checklist, /- \[x\] Record local allowance top-ups\./);
  assert.match(checklist, /- \[x\] Add parent wallet top-up write flow\./);
  assert.match(checklist, /- \[x\] Add store purchase write flow\./);
  assert.match(checklist, /Calculate admin allowance total balance from one row per wallet/);
  assert.match(flowcharts, /Top-ups this month/);
  assert.match(flowcharts, /Parent local wallet top-up flow/);
  assert.match(flowcharts, /Store\/canteen purchase recording is implemented for local MVP testing/);
  assert.match(flowcharts, /Admin allowance `Total balance` should sum the current `wallets\.balance` once per wallet/);
  assert.match(checklist, /selected-year Allowance ledger archive\/restore/);
  assert.match(flowcharts, /wallet_ledger_archives/);
  assert.match(visualFlowcharts, /Allowance archive and restore/);
  assert.match(visualFlowcharts, /Wallet top-up/);
  assert.match(visualFlowcharts, /Accurate wallet totals/);
});
