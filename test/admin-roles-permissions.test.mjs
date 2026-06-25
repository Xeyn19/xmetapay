import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const rolesDocPath = "docs/ADMIN_ROLES.md";
const permissionsPath = "lib/admin/permissions.ts";
const accessPath = "lib/admin/access.ts";
const adminShellPath = "app/admin/_components/admin-shell.tsx";
const schoolSetupActionPath = "app/admin/school-setup/actions.ts";
const studentActionPath = "app/admin/students/actions.ts";
const schoolSetupPagePath = "app/admin/(dashboard)/school-setup/page.tsx";
const studentPages = [
  "app/admin/(dashboard)/students/page.tsx",
  "app/admin/(dashboard)/student-profile/page.tsx",
  "app/admin/(dashboard)/parents/page.tsx",
];
const financePages = [
  "app/admin/(dashboard)/tuition/page.tsx",
  "app/admin/(dashboard)/collections/page.tsx",
  "app/admin/(dashboard)/other-fees/page.tsx",
  "app/admin/(dashboard)/allowance/page.tsx",
  "app/admin/(dashboard)/store-transactions/page.tsx",
  "app/admin/(dashboard)/reports/page.tsx",
];

test("admin role guide documents the three school staff roles", () => {
  assert.equal(existsSync(rolesDocPath), true);
  const doc = readFileSync(rolesDocPath, "utf8");

  assert.match(doc, /school_administrator/);
  assert.match(doc, /registrar/);
  assert.match(doc, /finance_officer/);
  assert.match(doc, /Set up school records/);
  assert.match(doc, /add and enroll students/i);
  assert.match(doc, /tuition, collections, other fees, allowance, store transactions, reports/i);
  assert.match(doc, /Ask a school administrator to complete school setup first\./);
});

test("shared admin permissions define role matrix and route access", () => {
  assert.equal(existsSync(permissionsPath), true);
  const permissions = readFileSync(permissionsPath, "utf8");

  assert.match(permissions, /export type AdminStaffRole/);
  assert.match(permissions, /"school_administrator"/);
  assert.match(permissions, /"registrar"/);
  assert.match(permissions, /"finance_officer"/);
  assert.match(permissions, /export function canManageSchoolSetup/);
  assert.match(permissions, /normalizeAdminStaffRole\(role\) === "school_administrator"/);
  assert.match(permissions, /export function canManageStudents/);
  assert.match(permissions, /normalizedRole === "registrar"/);
  assert.match(permissions, /export function canAccessFinance/);
  assert.match(permissions, /normalizedRole === "finance_officer"/);
  assert.match(permissions, /export function canAccessAdminPath/);
  assert.match(permissions, /export function filterAdminNavSectionsForStaffRole/);
});

test("server admin access helper redirects unauthorized staff routes", () => {
  assert.equal(existsSync(accessPath), true);
  const access = readFileSync(accessPath, "utf8");

  assert.match(access, /import "server-only";/);
  assert.match(access, /FROM admin_profiles/);
  assert.match(access, /getAdminStaffRole/);
  assert.match(access, /requireAdminPageAccess/);
  assert.match(access, /canAccessAdminPath/);
  assert.match(access, /redirect\("\/admin\/dashboard"\)/);
});

test("admin shell filters sidebar and setup actions by staff role", () => {
  const shell = readFileSync(adminShellPath, "utf8");

  assert.match(shell, /filterAdminNavSectionsForStaffRole/);
  assert.match(shell, /canManageSchoolSetup/);
  assert.match(shell, /canUseAdminHeaderAction/);
  assert.match(shell, /visibleNavSections\.map/);
  assert.match(shell, /Ask a school administrator to complete school setup first\./);
  assert.match(shell, /canManageSetup/);
  assert.match(shell, /canAddStudents/);
  assert.match(shell, /canRecordPayments/);
});

test("school setup and student actions enforce staff permissions", () => {
  const schoolSetupAction = readFileSync(schoolSetupActionPath, "utf8");
  const studentAction = readFileSync(studentActionPath, "utf8");

  assert.match(schoolSetupAction, /getAdminStaffRole/);
  assert.match(schoolSetupAction, /canManageSchoolSetup/);
  assert.match(schoolSetupAction, /Only school administrators can set up school records\./);
  assert.match(schoolSetupAction, /redirect\("\/admin\/dashboard"\)/);

  assert.match(studentAction, /getAdminStaffRole/);
  assert.match(studentAction, /canManageStudents/);
  assert.match(studentAction, /Your staff role cannot add or enroll students\./);
});

test("admin dashboard pages declare staff route access checks", () => {
  const setupPage = readFileSync(schoolSetupPagePath, "utf8");

  assert.match(setupPage, /requireAdminPageAccess\(session\.userId, "\/admin\/school-setup"\)/);

  for (const pagePath of [...studentPages, ...financePages]) {
    const page = readFileSync(pagePath, "utf8");

    assert.match(page, /requireAdminPageAccess\(session\.userId, "\/admin\//, `${pagePath} should check staff route access`);
  }
});
