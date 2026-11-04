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

test("incomplete school administrators resume onboarding before dashboard access", () => {
  const layout = read("app/admin/(dashboard)/layout.tsx");
  const setup = read("lib/school/setup.ts");

  assert.match(layout, /const setupIncomplete = !schoolContext\.databaseReady/);
  assert.match(layout, /setupIncomplete && canManageSchoolSetup\(schoolContext\.staffRole\)/);
  assert.match(layout, /redirect\("\/admin\/onboarding\/school-setup"\)/);
  assert.doesNotMatch(layout, /!schoolContext\.activeSchoolYear/);
  assert.match(setup, /databaseReady: Boolean\(activeSchoolYear && academics\.ready\)/);
  assert.match(setup, /getSchoolAcademicReadiness\(school\.id, activeSchoolYear\?\.id \?\? null\)/);
});

test("Basic Education uses selectable Philippine level groups and editable Section A defaults", () => {
  const wizard = read("app/admin/_components/guided-school-setup-wizard.tsx");
  for (const label of ["Kindergarten", "Elementary (Grades 1–6)", "Junior High School (Grades 7–10)", "Senior High School (Grades 11–12)"]) {
    assert.match(wizard, new RegExp(label.replace(/[–()]/g, ".")));
  }
  assert.match(wizard, /groupId === "senior" \? \[\] : \["Section A"\]/);
  assert.match(wizard, /Add section/);
  assert.match(read("lib/school/onboarding.ts"), /Every selected grade needs at least one section/);
});

test("Basic Education onboarding uses compact task panels and bulk level controls", () => {
  const wizard = read("app/admin/_components/guided-school-setup-wizard.tsx");
  for (const title of ["Choose education levels", "Set up sections", "Configure Senior High School"]) {
    assert.match(wizard, new RegExp(title));
  }
  assert.match(wizard, /function BasicTaskPanel/);
  assert.match(wizard, /aria-expanded=\{open\}/);
  assert.match(wizard, /firstIncompleteBasicPanel/);
  assert.match(wizard, /openBasicPanels\.has\("levels"\)/);
  assert.match(wizard, /new Set\(current\)\.add\(panel\)/);
  assert.match(wizard, /openBasicPanelAndScroll/);
  assert.match(wizard, /Select all K–12 levels/);
  assert.match(wizard, /Clear selection/);
  assert.match(wizard, /seniorSelected \? \(/);
});

test("standard grade sections support common templates and isolated per-grade customization", () => {
  const wizard = read("app/admin/_components/guided-school-setup-wizard.tsx");
  assert.match(wizard, /Fill once, apply to every grade/);
  assert.match(wizard, /function updateCommonSection/);
  assert.match(wizard, /indexes\.has\(index\)/);
  assert.match(wizard, /Customize individual grades/);
  assert.match(wizard, /Use same sections for all/);
  assert.match(wizard, /gradeNamesReadOnly/);
  assert.match(wizard, /JSON\.stringify\(grades\.map\(\(\{ name, sections \}\)/);
});

test("Senior High panels expose curriculum-specific offerings and local incomplete guidance", () => {
  const wizard = read("app/admin/_components/guided-school-setup-wizard.tsx");
  assert.match(wizard, /Why can Grade 11 and Grade 12 differ/);
  assert.match(wizard, /grade\.curriculumVersion === "strengthened" \? strengthenedOfferings : legacyOfferings/);
  assert.match(wizard, /Needs offerings/);
  assert.match(wizard, /before continuing/);
  assert.match(wizard, /seniorHighGradeComplete/);
});

test("onboarding keeps responsive progress, sticky actions, and field-directed error recovery", () => {
  const page = read("app/admin/onboarding/school-setup/page.tsx");
  const wizard = read("app/admin/_components/guided-school-setup-wizard.tsx");
  assert.match(page, /max-w-\[1480px\]/);
  assert.match(wizard, /md:hidden/);
  assert.match(wizard, /hidden overflow-x-auto pb-1 md:block/);
  assert.match(wizard, /sticky bottom-0/);
  assert.match(wizard, /result\.field === "seniorHigh"/);
  assert.match(wizard, /scrollIntoView/);
});

test("Senior High setup supports the strengthened curriculum and transitional legacy strands", () => {
  const wizard = read("app/admin/_components/guided-school-setup-wizard.tsx");
  const helper = read("lib/school/onboarding.ts");
  const actions = read("app/admin/onboarding/school-setup/actions.ts");

  assert.match(wizard, /Strengthened SHS Curriculum/);
  assert.match(wizard, /Legacy SHS Curriculum/);
  assert.match(wizard, /Technical-Professional Track/);
  for (const code of ["STEM", "ABM", "HUMSS", "GAS", "TVL"]) assert.match(wizard, new RegExp(code));
  assert.match(wizard, /Strengthened SHS uses tracks—not fixed strands/);
  assert.match(wizard, /Sections by/);
  assert.match(actions, /parseSeniorHigh/);
  assert.match(helper, /senior_high_offerings/);
  assert.match(helper, /Choose at least one offered track or strand/);
  assert.match(helper, /senior_high_offering_id/);
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

test("guided onboarding uses existing academic tables plus the additive Senior High schema", () => {
  const helper = read("lib/school/onboarding.ts");
  assert.doesNotMatch(helper, /ALTER TABLE|CREATE TABLE/);
  assert.match(helper, /FROM schools/);
  assert.match(helper, /school_years/);
  assert.match(helper, /grade_levels/);
  assert.match(helper, /academic_programs/);
  assert.match(helper, /academic_periods/);
  assert.match(helper, /senior_high_offerings/);
  assert.match(helper, /senior_high_offering_id/);
});

test("Senior High migration is additive, guarded, and represented in the fresh schema", () => {
  const migration = read("database/migrations/2026-11-04-senior-high-offerings.sql");
  const schema = read("database/full-schema-v1.sql");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS senior_high_offerings/);
  assert.match(migration, /information_schema\.COLUMNS/);
  assert.match(migration, /information_schema\.STATISTICS/);
  assert.match(migration, /information_schema\.TABLE_CONSTRAINTS/);
  assert.match(migration, /senior_high_offering_id/);
  assert.match(schema, /curriculum_version ENUM\('legacy', 'strengthened'\)/);
  assert.match(schema, /offering_type ENUM\('track', 'strand'\)/);
  assert.match(schema, /fk_sections_senior_high_offering/);
});
