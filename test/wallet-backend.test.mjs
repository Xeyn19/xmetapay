import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const walletRecordsPath = "lib/wallets/records.ts";
const walletActionsPath = "app/parent/wallet/actions.ts";
const walletPagePath = "app/parent/(portal)/wallet/page.tsx";
const walletFormPath = "app/parent/(portal)/wallet/wallet-top-up-form.tsx";
const parentDashboardPath = "app/parent/(portal)/dashboard/page.tsx";
const parentWalletActivityTablePath = "app/parent/(portal)/_components/parent-wallet-activity-table.tsx";
const parentStudentProfileViewPath = "app/parent/(portal)/student-profile/student-profile-view.tsx";
const adminAllowanceTablePath = "app/admin/(dashboard)/allowance/allowance-table.tsx";
const adminAllowancePagePath = "app/admin/(dashboard)/allowance/page.tsx";
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

test("wallet top-up action creates paid payment, wallet transaction, receipt, and updates balance", () => {
  assert.equal(existsSync(walletActionsPath), true);
  const action = readFileSync(walletActionsPath, "utf8");

  assert.match(action, /"use server";/);
  assert.match(action, /export async function createWalletTopUpAction\(formData: FormData\)/);
  assert.match(action, /await requireRole\("parent"\)/);
  assert.match(action, /student_guardians sg/);
  assert.match(action, /sg\.parent_user_id = :parentUserId/);
  assert.match(action, /INSERT INTO wallets/);
  assert.match(action, /ON DUPLICATE KEY UPDATE/);
  assert.match(action, /FOR UPDATE/);
  assert.match(action, /wallet\.status !== "active"/);
  assert.match(action, /maxTopUpAmount = 10000/);
  assert.match(action, /INSERT INTO payments/);
  assert.match(action, /'paid'/);
  assert.match(action, /UPDATE wallets/);
  assert.match(action, /INSERT INTO wallet_transactions/);
  assert.match(action, /'top_up'/);
  assert.match(action, /INSERT INTO receipts/);
  assert.match(action, /redirect\(`\/parent\/receipt\?receiptId=\$\{receiptId\}`\)/);
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
  assert.match(form, /name="studentId"/);
  assert.match(form, /name="amount"/);
  assert.match(form, /name="channel"/);
  assert.match(form, /max="10000"/);
  assert.doesNotMatch(page, /walletTransactions|walletQuickAmounts/);
  assert.doesNotMatch(parentPortalData, /walletTransactions|walletQuickAmounts/);
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
  assert.doesNotMatch(table, /toFilterOptions/);
  assert.doesNotMatch(page, /Export pending/);
});

test("payment history, receipts, and admin collections label wallet top-ups", () => {
  const paymentRecords = readFileSync(paymentRecordsPath, "utf8");
  const parentRecords = readFileSync(parentRecordsPath, "utf8");
  const adminRealData = readFileSync(adminRealDataPath, "utf8");

  for (const source of [paymentRecords, parentRecords, adminRealData]) {
    assert.match(source, /LEFT JOIN wallet_transactions wt ON wt\.payment_id = p\.id/);
    assert.match(source, /MAX\(CASE WHEN wt\.type = 'top_up' THEN 'Wallet top-up' END\)/);
  }
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
  assert.match(visualFlowcharts, /Wallet top-up/);
  assert.match(visualFlowcharts, /Accurate wallet totals/);
});
