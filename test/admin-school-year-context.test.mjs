import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const setupHelperPath = "lib/school/setup.ts";
const schoolYearActionPath = "app/admin/school-year/actions.ts";
const adminShellPath = "app/admin/_components/admin-shell.tsx";
const realDataPath = "lib/admin/real-data.ts";
const studentsRecordsPath = "lib/students/records.ts";
const reportExportsPath = "lib/admin/report-exports.ts";
const feesActionsPath = "app/admin/fees/actions.ts";
const storeActionsPath = "app/admin/store/actions.ts";

test("admin school context exposes active and selected school years", () => {
  assert.equal(existsSync(setupHelperPath), true);
  const helper = readFileSync(setupHelperPath, "utf8");

  assert.match(helper, /adminSchoolYearCookieName = "xmetapay_admin_school_year_id"/);
  assert.match(helper, /export type AdminSchoolYearOption/);
  assert.match(helper, /selectedSchoolYear: AdminSchoolYearOption \| null/);
  assert.match(helper, /schoolYears: AdminSchoolYearOption\[\]/);
  assert.match(helper, /export async function getResolvedAdminSchoolViewSetup/);
  assert.match(helper, /resolveSelectedSchoolYear\(schoolYears, activeSchoolYear\)/);
  assert.match(helper, /cookies\(\)/);
  assert.match(helper, /canSelectAdminSchoolYear/);
});

test("admin school year selector action validates ownership before setting cookie", () => {
  assert.equal(existsSync(schoolYearActionPath), true);
  const action = readFileSync(schoolYearActionPath, "utf8");

  assert.match(action, /"use server"/);
  assert.match(action, /await requireRole\("admin"\)/);
  assert.match(action, /canSelectAdminSchoolYear\(session\.userId, schoolYearId\)/);
  assert.match(action, /cookieStore\.set\(adminSchoolYearCookieName/);
  assert.match(action, /cookieStore\.delete\(\{\s+name: adminSchoolYearCookieName,/);
  assert.match(action, /value\.startsWith\("\/admin"\)/);
});

test("admin shell renders selected-year selector and labels non-active years as read-only", () => {
  const shell = readFileSync(adminShellPath, "utf8");

  assert.match(shell, /selectAdminSchoolYearAction/);
  assert.match(shell, /name="schoolYearId"/);
  assert.match(shell, /schoolContext\.selectedSchoolYear\?\.name/);
  assert.match(shell, /schoolContext\.schoolYears\.map/);
  assert.match(shell, /New records stay in the active year/);
});

test("admin read helpers use selected-year context while write actions stay active-year-only", () => {
  const realData = readFileSync(realDataPath, "utf8");
  const students = readFileSync(studentsRecordsPath, "utf8");
  const reports = readFileSync(reportExportsPath, "utf8");
  const feesActions = readFileSync(feesActionsPath, "utf8");
  const storeActions = readFileSync(storeActionsPath, "utf8");

  assert.match(realData, /getResolvedAdminSchoolViewSetup/);
  assert.match(students, /getResolvedAdminSchoolViewSetup/);
  assert.match(reports, /getResolvedAdminSchoolViewSetup/);
  assert.match(reports, /monthlyRevenueExport\(setup\.schoolId, setup\.schoolYearId, contextLines\)/);
  assert.match(reports, /collectionsExport\(setup\.schoolId, setup\.schoolYearId, contextLines\)/);
  assert.match(feesActions, /getResolvedAdminSchoolSetup\(session\.userId\)/);
  assert.match(storeActions, /getResolvedAdminSchoolSetup\(session\.userId\)/);
});
