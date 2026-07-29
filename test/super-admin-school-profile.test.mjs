import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const records = readFileSync("lib/super-admin/records.ts", "utf8");
const profilePage = readFileSync("app/super-admin/schools/[schoolId]/page.tsx", "utf8");
const accountsTable = readFileSync("app/super-admin/_components/super-admin-admins-table.tsx", "utf8");
const dashboardPage = readFileSync("app/super-admin/dashboard/page.tsx", "utf8");
const shell = readFileSync("app/super-admin/_components/super-admin-shell.tsx", "utf8");

test("super admin school profile is a protected dynamic school-level route", () => {
  assert.match(profilePage, /params: Promise<\{ schoolId: string \}>/);
  assert.match(profilePage, /Number\.isInteger\(selectedSchoolId\)/);
  assert.match(profilePage, /getSuperAdminSchoolProfile\(selectedSchoolId\)/);
  assert.match(profilePage, /notFound\(\)/);
  assert.match(shell, /pathname\.startsWith\("\/super-admin\/schools\/"\)/);
  assert.match(shell, /item\.href === "\/super-admin\/admin-accounts"/);
});

test("school profile aggregates current and total populations without duplicate people", () => {
  assert.match(records, /export type SuperAdminSchoolProfile/);
  assert.match(records, /export async function getSuperAdminSchoolProfile/);
  assert.match(records, /COUNT\(DISTINCT e\.student_id\)/);
  assert.match(records, /COUNT\(DISTINCT parent_users\.id\)/);
  assert.match(records, /e\.status = 'enrolled'/);
  assert.match(records, /sy\.status = 'active'/);
  assert.match(records, /st\.school_id = :schoolId/);
  assert.match(records, /GROUP BY e\.status/);
  assert.match(records, /GROUP BY gl\.id, gl\.name, gl\.sort_order/);
});

test("school profile exposes aggregate operations without parent or student directories", () => {
  assert.match(profilePage, /Current students/);
  assert.match(profilePage, /Current parents/);
  assert.match(profilePage, /Active-year enrollment/);
  assert.match(profilePage, /Enrolled students by grade/);
  assert.doesNotMatch(profilePage, /parentEmail|parentPhone|studentReference|studentName/);
});

test("school-linked account and dashboard rows open the shared school profile", () => {
  assert.match(records, /schoolId: number \| null/);
  assert.match(accountsTable, /row\.schoolId/);
  assert.match(accountsTable, /href=\{`\/super-admin\/schools\/\$\{row\.schoolId\}`\}/);
  assert.match(accountsTable, /View school/);
  assert.match(accountsTable, /updateSchoolAdminStatusAction/);
  assert.match(accountsTable, /exportRowsToExcel/);
  assert.match(accountsTable, /exportRowsToPdf/);
  assert.match(dashboardPage, /href=\{`\/super-admin\/schools\/\$\{school\.id\}`\}/);
});
