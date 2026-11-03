import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("unified school setup exposes all Philippine academic offering choices", () => {
  const page = read("app/admin/(dashboard)/school-setup/page.tsx");
  const setup = read("lib/school/setup.ts");
  assert.match(page, /Basic Education only \(K–12\)/);
  assert.match(page, /Higher Education only \(College\)/);
  assert.match(page, /Both K–12 and College/);
  assert.match(page, /Basic Education \(K–12\)/);
  assert.match(page, /Higher Education \(College\)/);
  assert.match(setup, /educationScope: EducationScope/);
  assert.match(setup, /academicTracks: AcademicTrackReadiness/);
  assert.match(setup, /scope === "both"/);
});

test("scope changes preserve records and reject unsafe narrowing", () => {
  const helper = read("lib/school/academic-offerings.ts");
  const actions = read("app/admin/school-setup/actions.ts");
  assert.match(helper, /export type EducationScope = "basic" \| "higher" \| "both"/);
  assert.match(helper, /FOR UPDATE/);
  assert.match(helper, /Basic Education cannot be removed while grades, sections, or K–12 enrollments exist/);
  assert.match(helper, /Higher Education cannot be removed while college programs, periods, sections, enrollments, or tuition packages exist/);
  assert.match(actions, /export async function updateSchoolEducationScopeAction/);
  assert.match(actions, /canManageSchoolSetup\(staffRole\)/);
  assert.match(actions, /beginTransaction\(\)/);
});

test("college academics are owned by School Setup with active and upcoming year behavior", () => {
  const pagePath = new URL("../app/admin/(dashboard)/school-setup/academics/page.tsx", import.meta.url);
  const componentPath = new URL("../app/admin/_components/college-academic-setup.tsx", import.meta.url);
  assert.equal(existsSync(pagePath), true);
  assert.equal(existsSync(componentPath), true);
  const page = readFileSync(pagePath, "utf8");
  const component = readFileSync(componentPath, "utf8");
  const helper = read("lib/school/academic-offerings.ts");
  assert.match(page, /requireAdminPageAccess/);
  assert.match(page, /getCollegeAcademicSetupData/);
  assert.match(component, /School year to configure/);
  assert.match(component, /Closed years are available for historical review only/);
  assert.match(component, /Prepare periods and sections now/);
  assert.match(component, /min-h-12/);
  assert.match(component, /border-border bg-card/);
  assert.match(helper, /sy\.status='active'/);
  assert.match(helper, /ap\.status='active'/);
});

test("school year activation is scope aware", () => {
  const actions = read("app/admin/school-setup/actions.ts");
  const control = read("app/admin/_components/school-year-activation-control.tsx");
  assert.match(actions, /educationScope !== "higher"/);
  assert.match(actions, /educationScope !== "basic"/);
  assert.match(actions, /college period, program year level, and college section/);
  assert.match(control, /educationScope === "basic"/);
  assert.match(control, /educationScope === "higher"/);
  assert.match(control, /basicReady && collegeReady/);
});

test("unified setup does not introduce a database migration", () => {
  const helper = read("lib/school/academic-offerings.ts");
  assert.doesNotMatch(helper, /ALTER TABLE|CREATE TABLE/);
});
