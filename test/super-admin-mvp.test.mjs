import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = "database/migrations/2026-07-09-super-admin-role.sql";
const seedPath = "database/local/seed-super-admin-account.sql";
const session = readFileSync("lib/auth/session.ts", "utf8");
const loginAction = readFileSync("app/super-admin/actions.ts", "utf8");
const loginPage = readFileSync("app/login/page.tsx", "utf8");
const loginForm = readFileSync("app/login/super-admin-login-form.tsx", "utf8");
const superAdminLayout = existsSync("app/super-admin/layout.tsx")
  ? readFileSync("app/super-admin/layout.tsx", "utf8")
  : "";
const superAdminShell = existsSync("app/super-admin/_components/super-admin-shell.tsx")
  ? readFileSync("app/super-admin/_components/super-admin-shell.tsx", "utf8")
  : "";
const dashboardPage = readFileSync("app/super-admin/dashboard/page.tsx", "utf8");
const registrationChart = existsSync("app/super-admin/_components/super-admin-registration-trend-chart.tsx")
  ? readFileSync("app/super-admin/_components/super-admin-registration-trend-chart.tsx", "utf8")
  : "";
const adminAccountsPage = existsSync("app/super-admin/admin-accounts/page.tsx")
  ? readFileSync("app/super-admin/admin-accounts/page.tsx", "utf8")
  : "";
const adminAccountsTable = existsSync("app/super-admin/_components/super-admin-admins-table.tsx")
  ? readFileSync("app/super-admin/_components/super-admin-admins-table.tsx", "utf8")
  : "";
const tableControls = readFileSync("app/_components/table-controls.tsx", "utf8");
const registrationsPage = existsSync("app/super-admin/registrations/page.tsx")
  ? readFileSync("app/super-admin/registrations/page.tsx", "utf8")
  : "";
const registrationsTable = existsSync("app/super-admin/registrations/super-admin-registrations-table.tsx")
  ? readFileSync("app/super-admin/registrations/super-admin-registrations-table.tsx", "utf8")
  : "";
const records = readFileSync("lib/super-admin/records.ts", "utf8");
const gitignore = readFileSync(".gitignore", "utf8");
const temporarySeedPassword = ["xmeta", "123"].join("");

test("super admin role migration updates users and auth session role enums", () => {
  assert.equal(existsSync(migrationPath), true);
  const migration = readFileSync(migrationPath, "utf8");
  const authSchema = readFileSync("database/auth-schema.sql", "utf8");
  const fullSchema = readFileSync("database/full-schema-v1.sql", "utf8");

  assert.match(migration, /ALTER TABLE users MODIFY COLUMN role ENUM\(''admin'', ''parent'', ''super_admin''\) NOT NULL/);
  assert.match(migration, /ALTER TABLE auth_sessions MODIFY COLUMN role ENUM\(''admin'', ''parent'', ''super_admin''\) NOT NULL/);
  assert.match(authSchema, /role ENUM\('admin', 'parent', 'super_admin'\) NOT NULL/);
  assert.match(fullSchema, /role ENUM\('admin', 'parent', 'super_admin'\) NOT NULL/);
});

test("temporary super admin seed is local-only and stores a password hash", () => {
  assert.match(gitignore, /\/database\/local\//);

  if (existsSync(seedPath)) {
    const seed = readFileSync(seedPath, "utf8");

    assert.match(seed, /'super_admin'/);
    assert.match(seed, /'xmeta@gmail\.com'/);
    assert.match(seed, /'scrypt\$/);
    assert.equal(seed.includes(`'${temporarySeedPassword}'`), false);
  }
});

test("session helpers support super admin without changing portal register roles", () => {
  assert.match(session, /export type PortalRole = "admin" \| "parent";/);
  assert.match(session, /export type AuthRole = PortalRole \| "super_admin";/);
  assert.match(session, /export async function requireSuperAdmin\(\)/);
  assert.match(session, /redirect\("\/login"\)/);
});

test("root login uses company super admin action and redirects to company dashboard", () => {
  assert.match(loginPage, /SuperAdminLoginForm/);
  assert.match(loginAction, /export async function superAdminLoginAction/);
  assert.match(loginAction, /WHERE role = 'super_admin' AND email = :email/);
  assert.match(loginAction, /verifyPassword\(password, user\.password_hash\)/);
  assert.match(loginAction, /createSession\(\{ userId: user\.id, role: "super_admin", name: user\.name \}\)/);
  assert.match(loginAction, /redirect\("\/super-admin\/dashboard"\)/);
});

test("company login gives clear credential and inactive-account guidance without enumerating accounts", () => {
  const loginFlowStart = loginAction.indexOf("export async function superAdminLoginAction");
  const loginFlowEnd = loginAction.indexOf("export async function superAdminLogoutAction");
  const loginFlow = loginAction.slice(loginFlowStart, loginFlowEnd);
  const logoutFlow = loginAction.match(/export async function superAdminLogoutAction[\s\S]*?\n}/)?.[0] ?? "";

  assert.match(loginAction, /The company email or password is incorrect\. Check your details and try again\./);
  assert.match(loginFlow, /feedbackId = Number\.isSafeInteger\(_state\.feedbackId\) \? _state\.feedbackId \+ 1 : 1/);
  assert.match(loginFlow, /return failure\(invalidCompanyLoginMessage\)/);
  assert.match(loginFlow, /verifyPassword\(password, user\.password_hash\)[\s\S]*user\.status !== "active"/);
  assert.match(loginFlow, /Your company account is inactive\. Contact the \$\{PRODUCT_NAME\} system administrator to restore access\./);
  assert.doesNotMatch(loginFlow, /Invalid company login details or inactive account\./);
  assert.match(loginForm, /toast\.error\("Unable to sign in"/);
  assert.match(loginForm, /\[state\.feedbackId, state\.message\]/);
  assert.match(loginForm, /id: "company-sign-in-error"/);
  assert.doesNotMatch(loginForm, /lastMessage|useRef/);
  assert.match(logoutFlow, /await deleteSession\(\);/);
  assert.doesNotMatch(logoutFlow, /setAuthFlashToast/);
  assert.match(logoutFlow, /redirect\("\/login\?signedOut=1"\)/);
});

test("super admin dashboard is protected and manages only school admin account status", () => {
  assert.match(superAdminLayout, /await requireSuperAdmin\(\)/);
  assert.match(superAdminLayout, /consumeAuthFlashToast\("super_admin"\)/);
  assert.match(superAdminLayout, /pendingApprovals=\{data\.stats\.pendingAdmins\}/);
  assert.match(superAdminShell, /\/super-admin\/dashboard/);
  assert.match(superAdminShell, /\/super-admin\/admin-accounts/);
  assert.match(superAdminShell, /\/super-admin\/registrations/);
  assert.match(superAdminShell, /pendingApprovals/);
  assert.match(superAdminShell, /superAdminLogoutAction/);
  assert.match(superAdminShell, /FlashToast/);
  assert.match(records, /WHERE u\.role = 'admin'/);
  assert.match(records, /status = 'pending'/);
  assert.match(records, /pendingAdmins/);
  assert.match(records, /registrationTrend/);
  assert.match(loginAction, /await requireSuperAdmin\(\)/);
  assert.match(loginAction, /WHERE id = :userId\s+AND role = 'admin'/);
  assert.match(adminAccountsPage, /SuperAdminAdminsTable/);
  assert.match(adminAccountsTable, /updateSchoolAdminStatusAction/);
  assert.match(adminAccountsTable, /row\.status === "pending"/);
  assert.match(adminAccountsTable, /\/super-admin\/registrations/);
  assert.match(adminAccountsTable, /Enable/);
  assert.match(adminAccountsTable, /Disable/);
  assert.doesNotMatch(dashboardPage, /SuperAdminAdminsTable/);
  assert.doesNotMatch(dashboardPage, /FlashToast|superAdminLogoutAction|requireSuperAdmin/);
  assert.doesNotMatch(dashboardPage, /imperson/i);
});

test("school admin accounts export all filtered rows as branded Excel and PDF", () => {
  assert.match(adminAccountsTable, /exportRowsToExcel\(/);
  assert.match(adminAccountsTable, /"super-admin-school-admins\.xlsx"/);
  assert.match(adminAccountsTable, /worksheetName: "School admin accounts"/);
  assert.match(adminAccountsTable, /exportLabel="Export Excel"/);
  assert.doesNotMatch(adminAccountsTable, /exportRowsToCsv|super-admin-school-admins\.csv/);
  assert.match(adminAccountsTable, /exportRowsToPdf\(/);
  assert.match(adminAccountsTable, /"super-admin-school-admins\.pdf"/);
  assert.match(adminAccountsTable, /"School admin accounts"/);
  assert.match(adminAccountsTable, /filteredRows,\s+accountExportColumns/);
  assert.match(adminAccountsTable, /Name.*Email.*Phone.*School.*Staff role.*Status.*Last login.*Created/s);
  assert.match(adminAccountsTable, /Search.*Status.*School/s);
  assert.match(adminAccountsTable, /Accounts.*Active.*Pending.*Disabled/s);
  assert.doesNotMatch(adminAccountsTable, /pagination\.pageRows,\s+accountExportColumns/);
  assert.match(adminAccountsTable, /updateSchoolAdminStatusAction/);
  assert.match(adminAccountsTable, /\/super-admin\/registrations/);
});

test("super admin dashboard shows a Recharts-backed school admin registration trend", () => {
  const packageJson = readFileSync("package.json", "utf8");

  assert.match(packageJson, /"recharts":/);
  assert.match(records, /DATE_FORMAT\(u\.created_at, '%Y-%m-01'\)/);
  assert.match(records, /u\.role = 'admin'/);
  assert.match(records, /fromDate/);
  assert.match(records, /RegistrationTrendPreset/);
  assert.match(records, /daily.*weekly.*monthly.*custom/s);
  assert.match(records, /buildRegistrationTrend/);
  assert.match(records, /SuperAdminRegistrationTrendRow/);
  assert.match(registrationChart, /"use client";/);
  assert.match(registrationChart, /from "recharts"/);
  assert.match(registrationChart, /ResponsiveContainer/);
  assert.match(registrationChart, /BarChart/);
  assert.match(registrationChart, /No school admin registrations in this date range\./);
  assert.match(registrationChart, /Daily/);
  assert.match(registrationChart, /Weekly/);
  assert.match(registrationChart, /Monthly/);
  assert.match(registrationChart, /Custom/);
  assert.match(registrationChart, /Apply dates/);
  assert.match(registrationChart, /selectedPreset === preset\.value/);
  assert.match(dashboardPage, /SuperAdminRegistrationTrendChart/);
  assert.match(dashboardPage, /rows=\{data\.registrationTrend\}/);
  assert.match(dashboardPage, /meta=\{data\.registrationTrendMeta\}/);
  assert.match(dashboardPage, /Schools overview/);
  assert.match(dashboardPage, /Recent school admins/);
});

test("super admin registration review page approves or rejects pending school admins", () => {
  assert.equal(existsSync("app/super-admin/registrations/page.tsx"), true);
  assert.match(superAdminLayout, /await requireSuperAdmin\(\)/);
  assert.match(registrationsPage, /row\.status === "pending"/);
  assert.match(registrationsPage, /SuperAdminRegistrationsTable/);
  assert.doesNotMatch(registrationsPage, /FlashToast|superAdminLogoutAction|requireSuperAdmin/);
  assert.match(registrationsTable, /reviewAdminRegistrationAction/);
  assert.match(registrationsTable, /decision" value="approve"/);
  assert.match(registrationsTable, /decision" value="reject"/);
  assert.match(loginAction, /export async function reviewAdminRegistrationAction/);
  assert.match(loginAction, /await requireSuperAdmin\(\)/);
  assert.match(loginAction, /AND role = 'admin'\s+AND status = 'pending'/);
  assert.match(loginAction, /decision === "approve" \? "active" : "disabled"/);
  assert.match(loginAction, /revalidatePath\("\/super-admin\/registrations"\)/);
});

test("pending admin registrations export all filtered rows as branded Excel and PDF", () => {
  assert.match(registrationsTable, /registrationExportColumns/);
  assert.match(registrationsTable, /exportRowsToExcel\(/);
  assert.match(registrationsTable, /"super-admin-pending-registrations\.xlsx"/);
  assert.match(registrationsTable, /worksheetName: "Pending registrations"/);
  assert.match(registrationsTable, /exportLabel="Export Excel"/);
  assert.doesNotMatch(registrationsTable, /exportRowsToCsv|super-admin-pending-registrations\.csv/);
  assert.match(registrationsTable, /exportRowsToPdf\(/);
  assert.match(registrationsTable, /"super-admin-pending-registrations\.pdf"/);
  assert.match(registrationsTable, /"Pending school admin registrations"/);
  assert.match(registrationsTable, /filteredRows,\s+registrationExportColumns/);
  assert.match(registrationsTable, /Name.*Email.*Phone.*School.*Staff role.*Created/s);
  assert.match(registrationsTable, /Status", value: "Pending"/);
  assert.match(registrationsTable, /Search.*School/s);
  assert.match(registrationsTable, /Pending registrations.*filteredRows\.length/s);
  assert.doesNotMatch(registrationsTable, /pagination\.pageRows,\s+registrationExportColumns/);
  assert.match(registrationsTable, /reviewAdminRegistrationAction/);
  assert.match(registrationsTable, /Approve/);
  assert.match(registrationsTable, /Reject/);
});

test("shared Excel exporter builds branded formula-safe workbooks on demand", () => {
  assert.match(tableControls, /export async function exportRowsToExcel/);
  assert.match(tableControls, /await import\("exceljs"\)/);
  assert.match(tableControls, /\/xmetapay-logo\.jpg/);
  assert.match(tableControls, /workbook\.creator = PRODUCT_NAME/);
  assert.match(tableControls, /fitToPage: true/);
  assert.match(tableControls, /worksheet\.views = \[\{ state: "frozen"/);
  assert.match(tableControls, /worksheet\.autoFilter/);
  assert.match(tableControls, /fgColor: \{ argb: "FFE64A19" \}/);
  assert.match(tableControls, /cell\.value = cleanSpreadsheetText\(column\.value\(row\) \?\? ""\)/);
  assert.match(tableControls, /cell\.numFmt = "@"/);
  assert.match(tableControls, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(tableControls, /exportLabel = "Export CSV"/);
  assert.match(tableControls, /exportingLabel = "Generating export\.\.\."/);
});

test("docs describe company super admin without committed seed credentials", () => {
  const adminRoles = readFileSync("docs/ADMIN_ROLES.md", "utf8");
  const projectFlow = readFileSync("docs/PROJECT_FLOWCHARTS.md", "utf8");
  const databaseReadme = readFileSync("database/README.md", "utf8");

  assert.match(adminRoles, /`super_admin`/);
  assert.match(projectFlow, /Company Super Admin Flow/);
  assert.match(databaseReadme, /2026-07-09-super-admin-role\.sql/);
  assert.equal((adminRoles + projectFlow + databaseReadme).includes(temporarySeedPassword), false);
});
