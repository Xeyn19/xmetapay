import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = "database/migrations/2026-07-09-super-admin-role.sql";
const seedPath = "database/local/seed-super-admin-account.sql";
const session = readFileSync("lib/auth/session.ts", "utf8");
const loginAction = readFileSync("app/super-admin/actions.ts", "utf8");
const loginPage = readFileSync("app/login/page.tsx", "utf8");
const dashboardPage = readFileSync("app/super-admin/dashboard/page.tsx", "utf8");
const dashboardTable = readFileSync("app/super-admin/dashboard/super-admin-admins-table.tsx", "utf8");
const registrationsPage = existsSync("app/super-admin/registrations/page.tsx")
  ? readFileSync("app/super-admin/registrations/page.tsx", "utf8")
  : "";
const registrationsTable = existsSync("app/super-admin/registrations/super-admin-registrations-table.tsx")
  ? readFileSync("app/super-admin/registrations/super-admin-registrations-table.tsx", "utf8")
  : "";
const records = readFileSync("lib/super-admin/records.ts", "utf8");
const gitignore = readFileSync(".gitignore", "utf8");

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
    assert.doesNotMatch(seed, /'xmeta123'/);
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

test("super admin dashboard is protected and manages only school admin account status", () => {
  assert.match(dashboardPage, /await requireSuperAdmin\(\)/);
  assert.match(dashboardPage, /Admin registrations/);
  assert.match(dashboardPage, /data\.stats\.pendingAdmins/);
  assert.match(records, /WHERE u\.role = 'admin'/);
  assert.match(records, /status = 'pending'/);
  assert.match(records, /pendingAdmins/);
  assert.match(loginAction, /await requireSuperAdmin\(\)/);
  assert.match(loginAction, /WHERE id = :userId\s+AND role = 'admin'/);
  assert.match(dashboardTable, /updateSchoolAdminStatusAction/);
  assert.match(dashboardTable, /row\.status === "pending"/);
  assert.match(dashboardTable, /\/super-admin\/registrations/);
  assert.match(dashboardTable, /Enable/);
  assert.match(dashboardTable, /Disable/);
  assert.doesNotMatch(dashboardPage, /imperson/i);
});

test("super admin registration review page approves or rejects pending school admins", () => {
  assert.equal(existsSync("app/super-admin/registrations/page.tsx"), true);
  assert.match(registrationsPage, /await requireSuperAdmin\(\)/);
  assert.match(registrationsPage, /row\.status === "pending"/);
  assert.match(registrationsPage, /SuperAdminRegistrationsTable/);
  assert.match(registrationsTable, /reviewAdminRegistrationAction/);
  assert.match(registrationsTable, /decision" value="approve"/);
  assert.match(registrationsTable, /decision" value="reject"/);
  assert.match(loginAction, /export async function reviewAdminRegistrationAction/);
  assert.match(loginAction, /await requireSuperAdmin\(\)/);
  assert.match(loginAction, /AND role = 'admin'\s+AND status = 'pending'/);
  assert.match(loginAction, /decision === "approve" \? "active" : "disabled"/);
  assert.match(loginAction, /revalidatePath\("\/super-admin\/registrations"\)/);
});

test("docs describe company super admin without committed seed credentials", () => {
  const adminRoles = readFileSync("docs/ADMIN_ROLES.md", "utf8");
  const projectFlow = readFileSync("docs/PROJECT_FLOWCHARTS.md", "utf8");
  const databaseReadme = readFileSync("database/README.md", "utf8");

  assert.match(adminRoles, /`super_admin`/);
  assert.match(projectFlow, /Company Super Admin Flow/);
  assert.match(databaseReadme, /2026-07-09-super-admin-role\.sql/);
  assert.doesNotMatch(adminRoles + projectFlow + databaseReadme, /xmeta123/);
});
