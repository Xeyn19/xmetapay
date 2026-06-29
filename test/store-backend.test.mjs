import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const storeActionsPath = "app/admin/store/actions.ts";
const storeRecordsPath = "lib/stores/records.ts";
const storePagePath = "app/admin/(dashboard)/store-transactions/page.tsx";
const storeFormsPath = "app/admin/(dashboard)/store-transactions/store-forms.tsx";
const storeTablePath = "app/admin/(dashboard)/store-transactions/store-transactions-table.tsx";
const walletRecordsPath = "lib/wallets/records.ts";
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
  assert.equal(existsSync(storeTablePath), true);
  const page = readFileSync(storePagePath, "utf8");
  const forms = readFileSync(storeFormsPath, "utf8");
  const table = readFileSync(storeTablePath, "utf8");

  assert.match(page, /getAdminStoreSetupData\(session\.userId\)/);
  assert.match(page, /StoreManagementForms data=\{storeSetup\}/);
  assert.match(page, /StoreTransactionsTable rows=\{rows\}/);
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
  assert.match(table, /admin-store-transactions\.csv/);
  assert.match(table, /filterByQuery/);
  assert.doesNotMatch(page, /Export pending/);
});

test("parent wallet history labels store purchases as spending", () => {
  const walletRecords = readFileSync(walletRecordsPath, "utf8");
  const adminRealData = readFileSync(adminRealDataPath, "utf8");

  assert.match(walletRecords, /labelForWalletType/);
  assert.match(walletRecords, /purchase: "Store purchase"/);
  assert.match(walletRecords, /row\.type === "purchase"/);
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
  assert.match(checklist, /- \[x\] Add store purchase write flow\./);
  assert.match(flowcharts, /Store\/canteen purchase recording is implemented for local MVP testing/);
  assert.match(visualFlowcharts, /store purchase recording, and admin allowance totals/);
  assert.match(visualSchema, /wallet top-up and Phase 6B store purchase recording/);
  assert.match(visualSchema, /Admin allowance total balance sums current wallet balances once per wallet/);
});
