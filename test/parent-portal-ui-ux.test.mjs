import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const portalData = readFileSync("app/parent/_data/parent-portal-data.ts", "utf8");
const shell = readFileSync("app/parent/_components/parent-shell.tsx", "utf8");
const feesPage = readFileSync("app/parent/(portal)/fees/page.tsx", "utf8");
const statements = readFileSync("app/parent/(portal)/fees/assessment-statements.tsx", "utf8");
const feesTable = readFileSync("app/parent/(portal)/fees/fees-table.tsx", "utf8");
const historyTable = readFileSync("app/parent/(portal)/history/history-table.tsx", "utf8");
const paymentForm = readFileSync("app/parent/(portal)/pay-tuition/payment-form.tsx", "utf8");
const dashboard = readFileSync("app/parent/(portal)/dashboard/page.tsx", "utf8");
const students = readFileSync("app/parent/(portal)/students/page.tsx", "utf8");

test("parent navigation uses task-focused labels and keeps legacy routes", () => {
  assert.match(portalData, /title: "School fees & statements"/);
  assert.match(portalData, /label: "School fees"/);
  assert.match(portalData, /label: "Make a payment"/);
  assert.match(portalData, /label: "Allowance wallet"/);
  assert.match(portalData, /"\/parent\/student-profile"/);
  assert.doesNotMatch(portalData, /label: "Student profile"/);
});

test("parent shell keeps one contextual payment action and accessible mobile restoration", () => {
  assert.match(shell, /showPayAction/);
  assert.match(shell, /pathname !== "\/parent\/pay-tuition"/);
  assert.match(shell, /event\.key !== "Escape"/);
  assert.match(shell, /menuButtonRef\.current\?\.focus/);
  assert.match(shell, /role=\{open \? "dialog" : undefined\}/);
});

test("school fees prioritizes compact statements and collapses detailed records", () => {
  assert.match(statements, /<details key=\{statement\.id\}/);
  assert.match(statements, /Outstanding balance/);
  assert.match(statements, /Next: \$\{nextTerm\.name\}/);
  assert.match(feesPage, /All fee records and archive history/);
  assert.match(feesPage, /<details className="group/);
});

test("parent financial record tables use minimal controls and contextual selection", () => {
  for (const source of [feesTable, historyTable]) {
    assert.match(source, /layout="compact"/);
    assert.match(source, /activeFilterCount/);
    assert.match(source, /clearLabel="Reset filters"/);
    assert.match(source, /SelectPageCheckbox/);
    assert.match(source, /validSelectedIds\.length > 0/);
    assert.doesNotMatch(source, /CheckSquare/);
  }
});

test("dashboard, students, and payment flow use focused progressive disclosure", () => {
  assert.doesNotMatch(dashboard, /<form action=\{linkParentStudentAction\}/);
  assert.match(dashboard, /href="\/parent\/students"/);
  assert.match(students, /<details open=\{!hasLinkedStudents\}/);
  assert.match(paymentForm, /Choose a student/);
  assert.match(paymentForm, /Tuition and scheduled payments/);
  assert.match(paymentForm, /Other school fees/);
  assert.match(paymentForm, /xl:sticky xl:top-24/);
});
