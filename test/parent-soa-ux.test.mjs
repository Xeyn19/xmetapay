import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const statements = readFileSync("app/parent/(portal)/fees/assessment-statements.tsx", "utf8");
const workflow = readFileSync("lib/fees/assessment-workflow.ts", "utf8");
const shell = readFileSync("app/parent/_components/parent-shell.tsx", "utf8");

test("statement summaries stay collapsed and prioritize payment information", () => {
  assert.match(statements, /<details className="group overflow-hidden/);
  assert.doesNotMatch(statements, /<details[^>]*\sopen(?:=|\s|>)/);
  assert.match(statements, /Outstanding balance/);
  assert.match(statements, /Next payment/);
  assert.match(statements, /Payment plan/);
  assert.match(statements, /View statement details/);
});

test("paid statements are secondary and charge details use progressive disclosure", () => {
  assert.match(statements, /Paid statements/);
  assert.match(statements, /paidStatements\.length/);
  assert.match(statements, /Charge and credit breakdown/);
  assert.match(statements, /statement\.credits > 0/);
});

test("expanded statements show progress and a deterministic payment schedule", () => {
  assert.match(statements, /role="progressbar"/);
  assert.match(statements, /Payment schedule/);
  assert.match(statements, /ScheduleRow/);
  assert.match(workflow, /sortOrder/);
  assert.match(workflow, /\.sort\(compareParentStatements\)/);
  assert.match(workflow, /dateSortKey\(a\.nextPayment/);
});

test("statement read model derives full payment, installment, partial, and overdue states", () => {
  assert.match(workflow, /paymentPlanLabel:terms\.length/);
  assert.match(workflow, /balance<=0\?"paid":hasOverdue\?"overdue":paid>0\?"partial":"payment_due"/);
  assert.match(workflow, /lineStatus\(lineBalance,linePaid,dueDate,today\)/);
  assert.match(workflow, /charge\.timing==="upfront"/);
  assert.match(workflow, /sameDatePayables\.reduce/);
});

test("SOA keeps the single shell payment action and does not duplicate it in statements", () => {
  assert.match(shell, /Pay fees/);
  assert.doesNotMatch(statements, />Pay fees</);
  assert.doesNotMatch(statements, /href="\/parent\/pay-tuition"/);
});
