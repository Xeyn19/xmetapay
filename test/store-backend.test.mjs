import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const storeActionsPath = "app/admin/store/actions.ts";
const storeRecordsPath = "lib/stores/records.ts";
const storePagePath = "app/admin/(dashboard)/store-transactions/page.tsx";
const storeFormsPath = "app/admin/(dashboard)/store-transactions/store-forms.tsx";
const storeActionModalPath = "app/admin/(dashboard)/store-transactions/store-action-modal.tsx";
const storeTablePath = "app/admin/(dashboard)/store-transactions/store-transactions-table.tsx";
const walletRecordsPath = "lib/wallets/records.ts";
const parentDashboardPath = "app/parent/(portal)/dashboard/page.tsx";
const parentWalletActivityTablePath = "app/parent/(portal)/_components/parent-wallet-activity-table.tsx";
const paymentRecordsPath = "lib/payments/records.ts";
const adminRealDataPath = "lib/admin/real-data.ts";
const checklistPath = "docs/CHECKLIST.md";
const flowchartsPath = "docs/PROJECT_FLOWCHARTS.md";
const visualFlowchartsPath = "public/PROJECT_FLOWCHARTS_VISUAL.html";
const visualSchemaPath = "public/DATABASE_SCHEMA_VISUAL_PLAN.html";

test("admin store actions require finance permission and write store purchases safely", () => {
  assert.equal(existsSync(storeActionsPath), true);
  const actions = readFileSync(storeActionsPath, "utf8");

  assert.match(actions, /"use server";/);
  assert.match(actions, /export async function createStoreMerchantAction\(formData: FormData\)/);
  assert.match(actions, /export async function recordStorePurchaseAction\(formData: FormData\)/);
  assert.match(actions, /await requireRole\("admin"\)/);
  assert.match(actions, /canAccessFinance\(staffRole\)/);
  assert.match(actions, /getResolvedAdminSchoolSetup\(session\.userId\)/);
  assert.match(actions, /INSERT INTO store_merchants/);
  assert.match(actions, /ER_DUP_ENTRY/);
  assert.match(actions, /SELECT w\.id, w\.balance, w\.status/);
  assert.match(actions, /FOR UPDATE/);
  assert.match(actions, /wallet\.status !== "active"/);
  assert.match(actions, /insufficient/i);
  assert.match(actions, /UPDATE wallets/);
  assert.match(actions, /INSERT INTO wallet_transactions/);
  assert.match(actions, /'purchase'/);
  assert.match(actions, /-amount/);
  assert.match(actions, /payment_id/);
  assert.match(actions, /INSERT INTO store_transactions/);
  assert.doesNotMatch(actions, /INSERT INTO payments/);
  assert.doesNotMatch(actions, /INSERT INTO receipts/);
  assert.doesNotMatch(actions, /INSERT INTO payment_allocations/);
});

test("admin store records helper exposes merchants, wallets, and students for purchase forms", () => {
  assert.equal(existsSync(storeRecordsPath), true);
  const helper = readFileSync(storeRecordsPath, "utf8");

  assert.match(helper, /import "server-only";/);
  assert.match(helper, /export async function getAdminStoreSetupData\(adminUserId: number\)/);
  assert.match(helper, /getResolvedAdminSchoolSetup\(adminUserId\)/);
  assert.match(helper, /FROM store_merchants/);
  assert.match(helper, /JOIN wallets w ON w\.student_id = st\.id/);
  assert.match(helper, /w\.status = 'active'/);
  assert.match(helper, /w\.balance > 0/);
  assert.match(helper, /FROM students st/);
  assert.match(helper, /school_id = :schoolId/);
});

test("admin store transaction page exposes merchant and purchase forms plus working table controls", () => {
  assert.equal(existsSync(storeFormsPath), true);
  assert.equal(existsSync(storeActionModalPath), true);
  assert.equal(existsSync(storeTablePath), true);
  const page = readFileSync(storePagePath, "utf8");
  const forms = readFileSync(storeFormsPath, "utf8");
  const modal = readFileSync(storeActionModalPath, "utf8");
  const table = readFileSync(storeTablePath, "utf8");

  assert.match(page, /getAdminStoreSetupData\(session\.userId\)/);
  assert.match(page, /StoreActionModal/);
  assert.match(page, /triggerLabel="Record purchase"/);
  assert.match(page, /triggerIcon="store"/);
  assert.match(page, /RecordStorePurchaseForm data=\{storeSetup\}/);
  assert.match(page, /triggerLabel="Create merchant"/);
  assert.match(page, /triggerIcon="plus"/);
  assert.match(page, /CreateStoreMerchantForm data=\{storeSetup\}/);
  assert.match(page, /StoreTransactionsTable rows=\{rows\}/);
  assert.ok(page.indexOf("<KpiGrid>") < page.indexOf('title="Spend by grade"'));
  assert.ok(page.indexOf('title="Spend by grade"') < page.indexOf('title="Store transaction log"'));
  assert.ok(page.indexOf("RecordStorePurchaseForm data={storeSetup}") < page.indexOf("<StoreTransactionsTable rows={rows} />"));
  assert.doesNotMatch(page, /<StoreManagementForms data=\{storeSetup\} \/>/);
  assert.match(page, /className="mb-\[18px\]"[\s\S]*RecordStorePurchaseForm data=\{storeSetup\}[\s\S]*<StoreTransactionsTable rows=\{rows\} \/>/);
  assert.match(modal, /"use client";/);
  assert.match(modal, /triggerIcon: "plus" \| "store"/);
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.doesNotMatch(page, /triggerIcon=\{Store\}/);
  assert.doesNotMatch(page, /triggerIcon=\{Plus\}/);
  assert.match(forms, /export function StoreManagementForms/);
  assert.match(forms, /export function CreateStoreMerchantForm/);
  assert.match(forms, /export function RecordStorePurchaseForm/);
  assert.match(forms, /createStoreMerchantAction/);
  assert.match(forms, /recordStorePurchaseAction/);
  assert.match(forms, /name="name"/);
  assert.match(forms, /name="type"/);
  assert.match(forms, /name="studentId"/);
  assert.match(forms, /name="merchantId"/);
  assert.match(forms, /name="amount"/);
  assert.match(forms, /name="feeAmount"/);
  assert.match(forms, /max="10000"/);
  assert.match(table, /"use client";/);
  assert.match(table, /DashboardTableControls/);
  assert.match(table, /usePaginatedRows/);
  assert.match(table, /DashboardTablePagination/);
  assert.match(table, /pagination\.pageRows\.map/);
  assert.match(table, /admin-store-transactions\.csv/);
  assert.match(table, /admin-store-transactions\.pdf/);
  assert.match(table, /exportRowsToPdf/);
  assert.match(table, /filterByQuery/);
  assert.doesNotMatch(page, /Export pending/);
});

test("parent wallet history labels store purchases as spending", () => {
  const walletRecords = readFileSync(walletRecordsPath, "utf8");
  const parentDashboard = readFileSync(parentDashboardPath, "utf8");
  const walletActivityTable = readFileSync(parentWalletActivityTablePath, "utf8");
  const paymentRecords = readFileSync(paymentRecordsPath, "utf8");
  const adminRealData = readFileSync(adminRealDataPath, "utf8");

  assert.match(walletRecords, /labelForWalletType/);
  assert.match(walletRecords, /purchase: "Store purchase"/);
  assert.match(walletRecords, /row\.type === "purchase"/);
  assert.match(parentDashboard, /Recent wallet activity/);
  assert.match(walletActivityTable, /Channel/);
  assert.match(walletActivityTable, /parent-wallet-activity\.csv/);
  assert.match(walletActivityTable, /parent-wallet-activity\.pdf/);
  assert.match(walletActivityTable, /exportRowsToPdf/);
  assert.doesNotMatch(paymentRecords, /store_transactions/);
  assert.match(adminRealData, /CASE WHEN wt\.type = 'purchase'/);
});

test("docs and visual plans mark Phase 6B store transactions complete after implementation", () => {
  const checklist = readFileSync(checklistPath, "utf8");
  const flowcharts = readFileSync(flowchartsPath, "utf8");
  const visualFlowcharts = readFileSync(visualFlowchartsPath, "utf8");
  const visualSchema = readFileSync(visualSchemaPath, "utf8");

  assert.match(checklist, /- \[x\] Add admin\/finance merchant setup for `store_merchants`\./);
  assert.match(checklist, /- \[x\] Add admin\/finance purchase recording for `store_transactions`\./);
  assert.match(checklist, /- \[x\] Decrease student wallet balance through a `wallet_transactions` purchase row\./);
  assert.match(checklist, /- \[x\] Show store purchases in parent wallet history, not parent payment history\./);
  assert.match(checklist, /- \[x\] Show recent wallet\/store activity on the parent dashboard\./);
  assert.match(checklist, /- \[x\] Add store purchase write flow\./);
  assert.match(flowcharts, /Parent dashboard recent wallet\/store activity snapshot from MySQL/);
  assert.match(flowcharts, /Parent payment history stays payment-only/);
  assert.match(visualFlowcharts, /parent dashboard wallet activity/);
  assert.match(visualSchema, /parent dashboard wallet activity/);
  assert.match(visualSchema, /Admin allowance total balance sums current wallet balances once per wallet/);
});
