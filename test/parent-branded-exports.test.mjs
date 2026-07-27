import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const feeTable = readFileSync("app/parent/(portal)/fees/fees-table.tsx", "utf8");
const historyTable = readFileSync("app/parent/(portal)/history/history-table.tsx", "utf8");
const recentPayments = readFileSync("app/parent/(portal)/dashboard/parent-recent-payments-table.tsx", "utf8");
const walletActivity = readFileSync("app/parent/(portal)/_components/parent-wallet-activity-table.tsx", "utf8");
const walletPage = readFileSync("app/parent/(portal)/wallet/page.tsx", "utf8");
const studentProfile = readFileSync("app/parent/(portal)/student-profile/student-profile-view.tsx", "utf8");

test("parent fee and payment views export branded Excel while retaining branded PDFs", () => {
  for (const component of [feeTable, historyTable]) {
    assert.match(component, /exportRowsToExcel/);
    assert.match(component, /exportLabel="Export Excel"/);
    assert.match(component, /exportingLabel="Generating Excel\.\.\."/);
    assert.doesNotMatch(component, /exportRowsToCsv|\.csv"/);
  }

  assert.match(feeTable, /parent-fee-summary(?:-archived|-removed)?\.xlsx/);
  assert.match(feeTable, /createBrandedPdfDocument/);
  assert.match(feeTable, /row\.terms\.map/);
  assert.match(historyTable, /parent-payment-history(?:-archived|-removed)?\.xlsx/);
  assert.match(historyTable, /exportRowsToPdf/);
  assert.match(historyTable, /Recovery deadline/);
});

test("parent dashboard and reusable wallet exports use shared columns for Excel and PDF", () => {
  for (const component of [recentPayments, walletActivity]) {
    assert.match(component, /const exportColumns/);
    assert.match(component, /exportRowsToExcel/);
    assert.match(component, /exportRowsToPdf/);
    assert.match(component, /exportLabel="Export Excel"/);
    assert.doesNotMatch(component, /exportRowsToCsv|\.csv"/);
  }

  assert.match(recentPayments, /parent-recent-payments\.xlsx/);
  assert.match(walletActivity, /excelFilename = "parent-wallet-activity\.xlsx"/);
  assert.match(walletPage, /excelFilename="parent-wallet-transactions\.xlsx"/);
  assert.match(studentProfile, /excelFilename=\{`parent-\$\{student\.id\}-wallet-activity\.xlsx`\}/);
});

test("parent Excel and PDF exports include filtered counts and relevant summaries", () => {
  assert.match(feeTable, /label: "Billed"/);
  assert.match(feeTable, /label: "Paid"/);
  assert.match(feeTable, /label: "Balance"/);
  assert.match(historyTable, /label: "Total amount"/);
  assert.match(recentPayments, /label: "Total amount"/);
  assert.match(walletActivity, /label: "Net activity"/);
  assert.match(walletActivity, /filteredRows/);
});
