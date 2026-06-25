import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const schoolSetupPath = "lib/school/setup.ts";
const schoolSetupActionPath = "app/admin/school-setup/actions.ts";
const schoolSetupPagePath = "app/admin/(dashboard)/school-setup/page.tsx";
const schoolSetupFormPath = "app/admin/(dashboard)/school-setup/manual-school-setup-form.tsx";
const adminLayoutPath = "app/admin/(dashboard)/layout.tsx";
const adminShellPath = "app/admin/_components/admin-shell.tsx";
const checklistPath = "docs/CHECKLIST.md";
const fullSchemaPath = "database/full-schema-v1.sql";
const migrationPath = "database/migrations/2026-06-24-admin-school-link.sql";

test("admin school link migration is safe to import into existing XAMPP data", () => {
  assert.equal(existsSync(migrationPath), true);
  const migration = readFileSync(migrationPath, "utf8");

  assert.match(migration, /ALTER TABLE admin_profiles ADD COLUMN school_id BIGINT UNSIGNED NULL/);
  assert.match(migration, /CREATE INDEX idx_admin_profiles_school_id ON admin_profiles \(school_id\)/);
  assert.match(migration, /CONSTRAINT fk_admin_profiles_school/);
  assert.match(migration, /FOREIGN KEY \(school_id\) REFERENCES schools\(id\)/);
  assert.match(migration, /ON DELETE SET NULL/);
});

test("fresh full schema includes admin profile school link after schools table exists", () => {
  assert.equal(existsSync(fullSchemaPath), true);
  const schema = readFileSync(fullSchemaPath, "utf8");
  const schoolsIndex = schema.indexOf("CREATE TABLE IF NOT EXISTS schools");
  const linkIndex = schema.indexOf("ALTER TABLE admin_profiles ADD COLUMN school_id BIGINT UNSIGNED NULL");

  assert.ok(schoolsIndex >= 0, "schools table should exist in full schema");
  assert.ok(linkIndex > schoolsIndex, "admin profile school link should be added after schools exists");
  assert.match(schema, /idx_admin_profiles_school_id/);
  assert.match(schema, /fk_admin_profiles_school/);
});

test("school setup backend helper reads admin school context from MySQL", () => {
  assert.equal(existsSync(schoolSetupPath), true);
  const helper = readFileSync(schoolSetupPath, "utf8");

  assert.match(helper, /import "server-only";/);
  assert.match(helper, /import \{ pool \} from "@\/lib\/auth\/db";/);
  assert.match(helper, /export async function getAdminSchoolContext\(userId: number\)/);
  assert.match(helper, /FROM users u\s+JOIN admin_profiles ap ON ap\.user_id = u\.id/);
  assert.match(helper, /ap\.school_id/);
  assert.match(helper, /getSchoolById/);
  assert.match(helper, /FROM schools/);
  assert.match(helper, /profile\.school_id/);
  assert.match(helper, /getSchoolByName\(profile\.school_name\)/);
  assert.match(helper, /FROM school_years/);
  assert.match(helper, /FROM grade_levels/);
  assert.match(helper, /FROM sections/);
  assert.match(helper, /missingSchoolSetupTables/);
  assert.match(helper, /export async function getAdminSchoolSetupFormData\(userId: number\)/);
  assert.match(helper, /getGradeSectionRows/);
  assert.match(helper, /schoolCodeFor/);
});

test("admin manual school setup action is protected and saves submitted records", () => {
  assert.equal(existsSync(schoolSetupActionPath), true);
  const action = readFileSync(schoolSetupActionPath, "utf8");

  assert.match(action, /"use server";/);
  assert.match(action, /export async function saveSchoolSetupAction\(formData: FormData\)/);
  assert.match(action, /await requireRole\("admin"\)/);
  assert.match(action, /formData\.get\(key\)/);
  assert.match(action, /schoolName/);
  assert.match(action, /schoolCode/);
  assert.match(action, /schoolYearName/);
  assert.match(action, /startsOn/);
  assert.match(action, /endsOn/);
  assert.match(action, /gradeSetup/);
  assert.match(action, /INSERT INTO schools/);
  assert.match(action, /INSERT INTO school_years/);
  assert.match(action, /INSERT INTO grade_levels/);
  assert.match(action, /INSERT INTO sections/);
  assert.match(action, /ON DUPLICATE KEY UPDATE/);
  assert.match(action, /UPDATE admin_profiles\s+SET school_id = :schoolId/);
  assert.match(action, /setAuthFlashToast/);
  assert.match(action, /redirect\("\/admin\/school-setup"\)/);
  assert.match(action, /redirect\("\/admin\/dashboard"\)/);
  assert.doesNotMatch(action, /defaultSchoolYear/);
  assert.doesNotMatch(action, /defaultGradeLevels/);
  assert.doesNotMatch(action, /starterSectionName/);
  assert.doesNotMatch(action, /2025-2026/);
  assert.doesNotMatch(action, /Grade 1/);
  assert.doesNotMatch(action, /Section A/);
});

test("admin dashboard layout passes authenticated school context into the shell", () => {
  const layout = readFileSync(adminLayoutPath, "utf8");

  assert.match(layout, /import \{ getAdminSchoolContext \} from "@\/lib\/school\/setup";/);
  assert.match(layout, /const session = await requireRole\("admin"\);/);
  assert.match(layout, /const schoolContext = await getAdminSchoolContext\(session\.userId\);/);
  assert.match(layout, /<AdminShell schoolContext=\{schoolContext\}>/);
});

test("admin shell renders school setup context instead of fixed prototype labels", () => {
  const shell = readFileSync(adminShellPath, "utf8");

  assert.match(shell, /import type \{ AdminSchoolContext \} from "@\/lib\/school\/setup";/);
  assert.match(shell, /schoolContext: AdminSchoolContext/);
  assert.match(shell, /const setupIncomplete = /);
  assert.match(shell, /schoolContext\.schoolName/);
  assert.match(shell, /schoolContext\.activeSchoolYear\?\.name/);
  assert.match(shell, /schoolContext\.adminInitials/);
  assert.match(shell, /schoolContext\.staffRoleLabel/);
  assert.match(shell, /href="\/admin\/school-setup"/);
  assert.match(shell, /Set up school records/);
  assert.doesNotMatch(shell, /initializeSchoolSetupAction/);
  assert.doesNotMatch(shell, /Initialize school setup/);
  assert.doesNotMatch(shell, /Brentwood Academy of Las Pinas/);
  assert.doesNotMatch(shell, /Ms\. Charmaine Nase/);
});

test("manual school setup page uses protected data and editable setup form", () => {
  assert.equal(existsSync(schoolSetupPagePath), true);
  assert.equal(existsSync(schoolSetupFormPath), true);
  const page = readFileSync(schoolSetupPagePath, "utf8");
  const form = readFileSync(schoolSetupFormPath, "utf8");

  assert.match(page, /await requireRole\("admin"\)/);
  assert.match(page, /getAdminSchoolSetupFormData\(session\.userId\)/);
  assert.match(page, /<ManualSchoolSetupForm initialData=\{initialData\} \/>/);
  assert.match(form, /"use client";/);
  assert.match(form, /saveSchoolSetupAction/);
  assert.match(form, /name="gradeSetup"/);
  assert.match(form, /name="schoolName"/);
  assert.match(form, /name="schoolCode"/);
  assert.match(form, /name="schoolYearName"/);
  assert.match(form, /name="startsOn"/);
  assert.match(form, /name="endsOn"/);
  assert.match(form, /Add grade level/);
  assert.match(form, /Add section/);
  assert.match(form, /Grade 1-10/);
  assert.match(form, /Section A/);
  assert.match(form, /Save school setup/);
});

test("backend checklist tracks completed school setup backend slice", () => {
  const checklist = readFileSync(checklistPath, "utf8");

  assert.match(checklist, /- \[x\] Add backend helpers for `schools`, `school_years`, `grade_levels`, and `sections`\./);
  assert.match(checklist, /- \[x\] Replace hard-coded school year\/dashboard school labels with database reads\./);
  assert.match(checklist, /- \[x\] Link admin profiles to a real school record\./);
  assert.match(checklist, /- \[x\] Create one active school year for the local test school\./);
  assert.match(checklist, /- \[x\] Create grade levels and sections from the admin side or a safe local seed script\./);
});
