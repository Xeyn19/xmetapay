import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("guided onboarding exposes the five accessible Philippine school setup steps", () => {
  const page = read("app/admin/onboarding/school-setup/page.tsx");
  const wizard = read("app/admin/_components/guided-school-setup-wizard.tsx");
  assert.match(page, /GuidedSchoolSetupWizard/);
  assert.match(page, /getSchoolOnboardingState/);
  assert.match(wizard, /School profile/);
  assert.match(wizard, /School year/);
  assert.match(wizard, /Basic Education/);
  assert.match(wizard, /College/);
  assert.match(wizard, /Review/);
  assert.match(wizard, /aria-label="School setup steps"/);
  assert.match(wizard, /aria-current=\{currentStep === step\.id \? "step"/);
  assert.match(wizard, /min-h-11/);
  assert.match(wizard, /border-border bg-card/);
  assert.match(wizard, /focus-visible:ring-primary/);
});

test("Basic Education uses selectable Philippine level groups and editable Section A defaults", () => {
  const wizard = read("app/admin/_components/guided-school-setup-wizard.tsx");
  for (const label of ["Kindergarten", "Elementary (Grades 1–6)", "Junior High School (Grades 7–10)", "Senior High School (Grades 11–12)"]) {
    assert.match(wizard, new RegExp(label.replace(/[–()]/g, ".")));
  }
  assert.match(wizard, /sections: \["Section A"\]/);
  assert.match(wizard, /Add section/);
  assert.match(read("lib/school/onboarding.ts"), /Every selected grade needs at least one section/);
});

test("onboarding actions authenticate, authorize, save per step, and keep retries idempotent", () => {
  const actions = read("app/admin/onboarding/school-setup/actions.ts");
  const helper = read("lib/school/onboarding.ts");
  const wizard = read("app/admin/_components/guided-school-setup-wizard.tsx");
  assert.match(actions, /await requireRole\("admin"\)/);
  assert.match(actions, /canManageSchoolSetup\(staffRole\)/);
  assert.match(actions, /use server/);
  assert.match(actions, /saveSchoolProfileStep/);
  assert.match(actions, /saveSchoolYearStep/);
  assert.match(actions, /saveBasicEducationStep/);
  assert.match(actions, /saveCollegeInitialStep/);
  assert.match(helper, /import "server-only"/);
  assert.match(helper, /beginTransaction\(\)/);
  assert.match(helper, /FOR UPDATE/);
  assert.match(helper, /ON DUPLICATE KEY UPDATE/);
  assert.match(helper, /updateSchoolEducationScope/);
  assert.match(helper, /Period dates must stay inside the active school year/);
  assert.match(helper, /program\.levelCount > 6/);
  assert.match(wizard, /Add another program/);
  assert.match(wizard, /Add section to/);
  assert.match(helper, /programs\.length > 30/);
  assert.match(helper, /for \(const program of programs\)/);
  assert.match(helper, /for \(const section of program\.sections\)/);
  assert.match(helper, /Program code .* is listed more than once/);
});

test("guided onboarding requires no new schema or migration", () => {
  const helper = read("lib/school/onboarding.ts");
  assert.doesNotMatch(helper, /ALTER TABLE|CREATE TABLE/);
  assert.match(helper, /FROM schools/);
  assert.match(helper, /school_years/);
  assert.match(helper, /grade_levels/);
  assert.match(helper, /academic_programs/);
  assert.match(helper, /academic_periods/);
});
