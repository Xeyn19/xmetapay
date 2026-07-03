import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const paymentRecordsPath = "lib/payments/records.ts";
const paymentActionsPath = "app/parent/payments/actions.ts";
const payTuitionPagePath = "app/parent/(portal)/pay-tuition/page.tsx";
const paymentFormPath = "app/parent/(portal)/pay-tuition/payment-form.tsx";
const receiptPagePath = "app/parent/(portal)/receipt/page.tsx";
const historyPagePath = "app/parent/(portal)/history/page.tsx";
const historyTablePath = "app/parent/(portal)/history/history-table.tsx";
const parentDashboardPath = "app/parent/(portal)/dashboard/page.tsx";
const parentDashboardTablePath = "app/parent/(portal)/dashboard/parent-recent-payments-table.tsx";
const parentRecordsPath = "lib/students/records.ts";
const parentPortalDataPath = "app/parent/_data/parent-portal-data.ts";
const checklistPath = "docs/CHECKLIST.md";

test("parent payment records helper reads payable fees, receipts, and history through guardian scope", () => {
  assert.equal(existsSync(paymentRecordsPath), true);
  const helper = readFileSync(paymentRecordsPath, "utf8");

  assert.match(helper, /import "server-only";/);
  assert.match(helper, /export async function getParentPaymentPageData/);
  assert.match(helper, /export async function getParentReceiptData/);
  assert.match(helper, /export async function getParentPaymentHistoryData/);
  assert.match(helper, /FROM student_guardians sg/);
  assert.match(helper, /sg\.parent_user_id = :parentUserId/);
  assert.match(helper, /FROM receipts r/);
  assert.match(helper, /JOIN payments p/);
  assert.match(helper, /LEFT JOIN payment_allocations pa/);
  assert.match(helper, /LEFT JOIN student_fee_assignments sfa/);
});

test("parent payment action creates paid payment, allocations, receipt, and updates fee balances", () => {
  assert.equal(existsSync(paymentActionsPath), true);
  const actions = readFileSync(paymentActionsPath, "utf8");

  assert.match(actions, /"use server";/);
  assert.match(actions, /export async function createParentPaymentAction/);
  assert.match(actions, /await requireRole\("parent"\)/);
  assert.match(actions, /student_guardians sg/);
  assert.match(actions, /sg\.parent_user_id = :parentUserId/);
  assert.match(actions, /FOR UPDATE/);
  assert.match(actions, /INSERT INTO payments/);
  assert.match(actions, /'paid'/);
  assert.match(actions, /INSERT INTO payment_allocations/);
  assert.match(actions, /UPDATE student_fee_assignments/);
  assert.match(actions, /INSERT INTO receipts/);
  assert.match(actions, /makeReferenceNumber\("PAY"\)/);
  assert.match(actions, /makeReferenceNumber\("RCT"\)/);
  assert.match(actions, /redirect\(`\/parent\/receipt\?receiptId=\$\{receiptId\}`\)/);
});

test("parent payment pages use real database helpers instead of static payment arrays", () => {
  const payPage = readFileSync(payTuitionPagePath, "utf8");
  const form = readFileSync(paymentFormPath, "utf8");
  const receiptPage = readFileSync(receiptPagePath, "utf8");
  const historyPage = readFileSync(historyPagePath, "utf8");
  const historyTable = readFileSync(historyTablePath, "utf8");
  const parentPortalData = readFileSync(parentPortalDataPath, "utf8");

  assert.match(payPage, /await requireRole\("parent"\)/);
  assert.match(payPage, /getParentPaymentPageData\(session\.userId\)/);
  assert.match(payPage, /<ParentPaymentForm rows=\{data\.rows\} \/>/);
  assert.match(form, /createParentPaymentAction/);
  assert.match(form, /name=\{fee\.source === "term" \? "tuitionTermId" : "feeAssignmentId"\}/);
  assert.match(form, /name="channel"/);
  assert.match(form, /XMETA wallet fee payments are future work/);
  assert.match(receiptPage, /getParentReceiptData/);
  assert.match(receiptPage, /searchParams: Promise<\{ receiptId\?: string \}>/);
  assert.match(historyPage, /getParentPaymentHistoryData\(session\.userId\)/);
  assert.match(historyPage, /ParentPaymentHistoryTable/);
  assert.match(historyTable, /DashboardTableControls/);
  assert.match(historyTable, /usePaginatedRows/);
  assert.match(historyTable, /DashboardTablePagination/);
  assert.match(historyTable, /pagination\.pageRows\.map/);
  assert.match(historyTable, /parent-payment-history\.csv/);
  assert.match(historyTable, /parent-payment-history\.pdf/);
  assert.match(historyTable, /exportRowsToPdf/);
  assert.doesNotMatch(parentPortalData, /export const payableFees/);
  assert.doesNotMatch(parentPortalData, /export const paymentMethods/);
  assert.doesNotMatch(parentPortalData, /export const historyRows/);
});

test("parent dashboard reflects real payment summary and recent payment rows", () => {
  const dashboard = readFileSync(parentDashboardPath, "utf8");
  const dashboardTable = readFileSync(parentDashboardTablePath, "utf8");
  const records = readFileSync(parentRecordsPath, "utf8");

  assert.match(records, /async function getParentPaymentSummary/);
  assert.match(records, /async function getParentRecentPayments/);
  assert.match(records, /FROM payments p/);
  assert.match(records, /LEFT JOIN payment_allocations pa/);
  assert.match(records, /paid_this_month/);
  assert.match(dashboard, /data\.outstandingBalance/);
  assert.match(dashboard, /Recent payment activity/);
  assert.match(dashboard, /ParentRecentPaymentsTable/);
  assert.match(dashboardTable, /DashboardTableControls/);
  assert.match(dashboardTable, /usePaginatedRows/);
  assert.match(dashboardTable, /DashboardTablePagination/);
  assert.match(dashboardTable, /pagination\.pageRows\.map/);
  assert.match(dashboardTable, /parent-recent-payments\.csv/);
  assert.match(dashboardTable, /parent-recent-payments\.pdf/);
  assert.match(dashboardTable, /exportRowsToPdf/);
  assert.match(dashboardTable, /No payment records yet/);
});

test("checklist marks Phase 5 payments and receipts backend complete", () => {
  const checklist = readFileSync(checklistPath, "utf8");

  assert.match(checklist, /- \[x\] Add backend helpers for `payments`, `payment_allocations`, and `receipts`\./);
  assert.match(checklist, /- \[x\] Create a safe local payment flow that records payments without real payment gateway integration\./);
  assert.match(checklist, /- \[x\] Allocate payments to selected fee balances\./);
  assert.match(checklist, /- \[x\] Update fee assignment status after payment\./);
  assert.match(checklist, /- \[x\] Generate receipt records after successful payment\./);
  assert.match(checklist, /- \[x\] Show parent payment history from database records\./);
  assert.match(checklist, /- \[x\] Show admin collections log from database records\./);
});
