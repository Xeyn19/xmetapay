import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const schoolSetupPath = "lib/school/setup.ts";
const adminLayoutPath = "app/admin/(dashboard)/layout.tsx";
const adminShellPath = "app/admin/_components/admin-shell.tsx";
const checklistPath = "CHECKLIST.md";

test("school setup backend helper reads admin school context from MySQL", () => {
  assert.equal(existsSync(schoolSetupPath), true);
  const helper = readFileSync(schoolSetupPath, "utf8");

  assert.match(helper, /import "server-only";/);
  assert.match(helper, /import \{ pool \} from "@\/lib\/auth\/db";/);
  assert.match(helper, /export async function getAdminSchoolContext\(userId: number\)/);
  assert.match(helper, /FROM users u\s+JOIN admin_profiles ap ON ap\.user_id = u\.id/);
  assert.match(helper, /FROM schools/);
  assert.match(helper, /FROM school_years/);
  assert.match(helper, /FROM grade_levels/);
  assert.match(helper, /FROM sections/);
  assert.match(helper, /missingSchoolSetupTables/);
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
  assert.match(shell, /schoolContext\.schoolName/);
  assert.match(shell, /schoolContext\.activeSchoolYear\?\.name/);
  assert.match(shell, /schoolContext\.adminInitials/);
  assert.match(shell, /schoolContext\.staffRoleLabel/);
  assert.doesNotMatch(shell, /Brentwood Academy of Las Pinas/);
  assert.doesNotMatch(shell, /Ms\. Charmaine Nase/);
});

test("backend checklist tracks completed school setup backend slice", () => {
  const checklist = readFileSync(checklistPath, "utf8");

  assert.match(checklist, /- \[x\] Add backend helpers for `schools`, `school_years`, `grade_levels`, and `sections`\./);
  assert.match(checklist, /- \[x\] Replace hard-coded school year\/dashboard school labels with database reads\./);
});
