import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const studentRecordsPath = "lib/students/records.ts";
const adminStudentActionsPath = "app/admin/students/actions.ts";
const parentStudentLinkActionsPath = "app/parent/student-link/actions.ts";
const authActionsPath = "app/auth/actions.ts";
const adminStudentsPagePath = "app/admin/(dashboard)/students/page.tsx";
const adminStudentFormPath = "app/admin/(dashboard)/students/student-enrollment-form.tsx";
const adminParentsPagePath = "app/admin/(dashboard)/parents/page.tsx";
const parentDashboardPath = "app/parent/(portal)/dashboard/page.tsx";
const parentLayoutPath = "app/parent/(portal)/layout.tsx";
const parentStudentProfilePath = "app/parent/(portal)/student-profile/page.tsx";
const parentStudentProfileViewPath = "app/parent/(portal)/student-profile/student-profile-view.tsx";
const parentSelectedStudentProfilePath = "app/parent/(portal)/students/[studentId]/page.tsx";
const adminShellPath = "app/admin/_components/admin-shell.tsx";
const parentShellPath = "app/parent/_components/parent-shell.tsx";
const parentPortalDataPath = "app/parent/_data/parent-portal-data.ts";
const checklistPath = "docs/CHECKLIST.md";

test("student records helper reads students, enrollment, and guardian links from MySQL", () => {
  assert.equal(existsSync(studentRecordsPath), true);
  const helper = readFileSync(studentRecordsPath, "utf8");

  assert.match(helper, /import "server-only";/);
  assert.match(helper, /import \{ pool \} from "@\/lib\/auth\/db";/);
  assert.match(helper, /import \{ getResolvedAdminSchoolSetup \} from "@\/lib\/school\/setup";/);
  assert.match(helper, /export async function getAdminStudentPageData\(adminUserId: number\)/);
  assert.match(helper, /export async function getAdminParentsPageData\(adminUserId: number\)/);
  assert.match(helper, /export async function getParentDashboardData\(parentUserId: number\)/);
  assert.match(helper, /export async function getParentPortalContext\(parentUserId: number/);
  assert.match(helper, /export async function getParentStudentProfileData\(\s+parentUserId: number,/);
  assert.match(helper, /FROM students/);
  assert.match(helper, /JOIN enrollments/);
  assert.match(helper, /FROM student_guardians/);
  assert.match(helper, /parent_user_id = :parentUserId/);
  assert.match(helper, /WHERE sg\.parent_user_id = :parentUserId/);
  assert.match(helper, /studentId\?: number/);
  assert.match(helper, /AND st\.id = :studentId/);
  assert.match(helper, /return getResolvedAdminSchoolSetup\(adminUserId\)/);
  assert.doesNotMatch(helper, /FROM admin_profiles ap\s+LEFT JOIN school_years sy ON sy\.school_id = ap\.school_id/);
});

test("admin student action is protected and creates student enrollment records", () => {
  assert.equal(existsSync(adminStudentActionsPath), true);
  const action = readFileSync(adminStudentActionsPath, "utf8");

  assert.match(action, /"use server";/);
  assert.match(action, /export async function createStudentAction\(formData: FormData\)/);
  assert.match(action, /await requireRole\("admin"\)/);
  assert.match(action, /INSERT INTO students/);
  assert.match(action, /INSERT INTO enrollments/);
  assert.match(action, /resolveSchoolIdForProfile/);
  assert.match(action, /getSchoolByName/);
  assert.match(action, /UPDATE admin_profiles\s+SET school_id = :schoolId/);
  assert.match(action, /status\s*:\s*"enrolled"|status = 'enrolled'|VALUES \(.*'enrolled'/s);
  assert.match(action, /section\.grade_level_id !== input\.data\.gradeLevelId/);
  assert.match(action, /Choose a section under the selected grade\./);
  assert.match(action, /redirect\("\/admin\/students"\)/);
});

test("parent student link action is protected and links by student reference", () => {
  assert.equal(existsSync(parentStudentLinkActionsPath), true);
  const action = readFileSync(parentStudentLinkActionsPath, "utf8");

  assert.match(action, /"use server";/);
  assert.match(action, /export async function linkParentStudentAction\(formData: FormData\)/);
  assert.match(action, /await requireRole\("parent"\)/);
  assert.match(action, /linkParentToStudentByReference/);
  assert.match(action, /redirect\("\/parent\/dashboard"\)/);
});

test("parent registration attempts guardian linking after creating parent profile", () => {
  const authActions = readFileSync(authActionsPath, "utf8");

  assert.match(authActions, /import \{ linkParentToStudentByReference \} from "@\/lib\/students\/records";/);
  assert.match(authActions, /INSERT INTO parent_profiles/);
  assert.match(authActions, /tryLinkAdminProfileToExistingSchool/);
  assert.match(authActions, /UPDATE admin_profiles ap\s+SET ap\.school_id = \(/);
  assert.match(authActions, /missingFullSchema/);
  assert.match(authActions, /await linkParentToStudentByReference\(/);
  assert.match(authActions, /parsed\.data\.profile\.studentReference/);
});

test("admin and parent pages use database helpers instead of mock student arrays", () => {
  const adminStudentsPage = readFileSync(adminStudentsPagePath, "utf8");
  const adminStudentForm = readFileSync(adminStudentFormPath, "utf8");
  const adminStudentsTable = readFileSync("app/admin/(dashboard)/students/students-table.tsx", "utf8");
  const adminParentsPage = readFileSync(adminParentsPagePath, "utf8");
  const parentDashboard = readFileSync(parentDashboardPath, "utf8");

  assert.doesNotMatch(adminStudentsPage, /"use client";/);
  assert.match(adminStudentsPage, /getAdminStudentPageData/);
  assert.match(adminStudentsPage, /StudentEnrollmentForm/);
  assert.match(adminStudentsPage, /StudentsTable/);
  assert.match(adminStudentsTable, /href=\{`\/admin\/students\/\$\{row\.id\}`\}/);
  assert.doesNotMatch(adminStudentsPage, /href="\/admin\/student-profile"/);
  assert.match(adminStudentForm, /createStudentAction/);
  assert.match(adminStudentForm, /<form action=\{createStudentAction\}/);
  assert.doesNotMatch(adminStudentsPage, /studentRows|studentsKpis/);

  assert.match(adminParentsPage, /getAdminParentsPageData/);
  assert.match(adminParentsPage, /ParentsTable/);
  assert.doesNotMatch(adminParentsPage, /parentRows|parentKpis/);

  assert.match(parentDashboard, /getParentDashboardData/);
  assert.match(parentDashboard, /linkParentStudentAction/);
  assert.match(parentDashboard, /<form action=\{linkParentStudentAction\}/);
  assert.match(parentDashboard, /href=\{student\.profileHref\}/);
  assert.doesNotMatch(parentDashboard, /href="\/parent\/student-profile"/);
  assert.doesNotMatch(parentDashboard, /children|dashboardMetrics|outstandingFees|recentActivity/);
});

test("admin student enrollment form filters sections by selected grade", () => {
  assert.equal(existsSync(adminStudentFormPath), true);
  const form = readFileSync(adminStudentFormPath, "utf8");

  assert.match(form, /"use client";/);
  assert.match(form, /useState\(""\)/);
  assert.match(form, /setSectionId\(""\)/);
  assert.match(form, /section\.gradeLevelId === selectedGradeLevelId/);
  assert.match(form, /disabled=\{sectionDisabled\}/);
  assert.match(form, /Choose grade first/);
  assert.match(form, /name="gradeLevelId"/);
  assert.match(form, /name="sectionId"/);
});

test("admin header enrollment action opens the database-backed student form", () => {
  const shell = readFileSync(adminShellPath, "utf8");

  assert.equal(existsSync("app/admin/_components/admin-modals.tsx"), false);
  assert.match(shell, /href="\/admin\/students#add-student"/);
  assert.match(shell, /Add student/);
  assert.doesNotMatch(shell, /openModal\("enroll"\)/);
  assert.doesNotMatch(shell, /data-modal-trigger="enroll"/);
  assert.doesNotMatch(shell, /AdminModals/);
});

test("parent portal removes dead enrollment wizard and keeps student reference linking", () => {
  const parentDashboard = readFileSync(parentDashboardPath, "utf8");
  const parentShell = readFileSync(parentShellPath, "utf8");
  const parentPortalData = readFileSync(parentPortalDataPath, "utf8");

  assert.equal(existsSync("app/parent/(portal)/enroll/page.tsx"), false);
  assert.equal(existsSync("app/parent/(portal)/enroll/family/page.tsx"), false);
  assert.equal(existsSync("app/parent/(portal)/enroll/review/page.tsx"), false);

  assert.doesNotMatch(parentShell, /\/parent\/enroll/);
  assert.doesNotMatch(parentShell, /Enroll student/);
  assert.doesNotMatch(parentPortalData, /Enroll a student|\/parent\/enroll/);

  assert.match(parentDashboard, /linkParentStudentAction/);
  assert.match(parentDashboard, /Link another student/);
  assert.match(parentDashboard, /name="studentReference"/);
  assert.doesNotMatch(parentDashboard, /href="\/parent\/enroll"/);
});

test("parent portal shell and profile use real database-backed identity", () => {
  const helper = readFileSync(studentRecordsPath, "utf8");
  const parentLayout = readFileSync(parentLayoutPath, "utf8");
  const parentShell = readFileSync(parentShellPath, "utf8");
  const parentProfile = readFileSync(parentStudentProfilePath, "utf8");
  const parentProfileView = readFileSync(parentStudentProfileViewPath, "utf8");
  const parentPortalData = readFileSync(parentPortalDataPath, "utf8");

  assert.match(parentLayout, /getParentPortalContext/);
  assert.match(parentLayout, /<ParentShell context=\{parentContext\}>/);

  assert.match(parentShell, /context\.parentName/);
  assert.match(parentShell, /context\.parentInitials/);
  assert.match(parentShell, /context\.relationshipLabel/);
  assert.match(parentShell, /context\.payableFeeCount > 0/);
  assert.match(parentShell, /Parent portal/);
  assert.match(parentShell, /Student-linked access/);
  assert.doesNotMatch(parentShell, /context\.schoolName/);
  assert.doesNotMatch(parentShell, /Maria Santos|Brentwood Academy of Las Pinas/);
  assert.match(helper, /payable_fee_count/);
  assert.match(helper, /sfa_count\.status IN \('open', 'partial'\)/);
  assert.doesNotMatch(parentPortalData, /badge: "2"/);

  assert.match(parentProfile, /getParentDashboardData/);
  assert.match(parentProfile, /StudentProfileSelector/);
  assert.match(parentProfile, /StudentProfileEmptyState/);
  assert.match(parentProfile, /redirect\(data\.linkedStudents\[0\]\.profileHref\)/);
  assert.doesNotMatch(parentProfile, /getParentStudentProfileData\(session\.userId, session\.name\)/);
  assert.match(parentProfileView, /export function StudentProfileView/);
  assert.match(parentProfileView, /export function StudentProfileSelector/);
  assert.match(parentProfileView, /href=\{student\.profileHref\}/);
  assert.match(parentProfileView, /student\.studentDetails/);
  assert.match(parentProfileView, /student\.guardianDetails/);
  assert.match(parentProfileView, /student\.schoolName/);
  assert.match(parentProfileView, /student\.schoolYearName/);
  assert.match(helper, /\{ label: "School", value: row\.school_name \}/);
  assert.doesNotMatch(parentProfileView, /profileDetails|parentDetails|profileStats/);
  assert.doesNotMatch(parentProfileView, /Juan Miguel Santos|Maria Santos|Brentwood Academy of Las Pinas/);
  assert.doesNotMatch(parentProfile, /profileDetails|parentDetails|profileStats/);
  assert.doesNotMatch(parentProfile, /Juan Miguel Santos|Maria Santos|Brentwood Academy of Las Pinas/);

  assert.doesNotMatch(parentPortalData, /Juan Miguel Santos|Maria Santos Jr\.|Juan Santos|maria@email\.com|0917-234-5678/);
  assert.match(helper, /JOIN users u ON u\.id = sg\.parent_user_id/);
  assert.match(helper, /JOIN schools sc ON sc\.id = st\.school_id/);
});

test("parent dashboard routes each linked student to its own protected profile", () => {
  assert.equal(existsSync(parentSelectedStudentProfilePath), true);
  const helper = readFileSync(studentRecordsPath, "utf8");
  const parentDashboard = readFileSync(parentDashboardPath, "utf8");
  const selectedProfile = readFileSync(parentSelectedStudentProfilePath, "utf8");
  const parentShell = readFileSync(parentShellPath, "utf8");

  assert.match(helper, /profileHref: `\/parent\/students\/\$\{row\.id\}`/);
  assert.match(parentDashboard, /href=\{student\.profileHref\}/);
  assert.match(selectedProfile, /params: Promise<\{ studentId: string \}>/);
  assert.match(selectedProfile, /await params/);
  assert.match(selectedProfile, /Number\(studentId\)/);
  assert.match(selectedProfile, /getParentStudentProfileData\(session\.userId, session\.name, selectedStudentId\)/);
  assert.match(selectedProfile, /notFound\(\)/);
  assert.match(parentShell, /pathname\.startsWith\("\/parent\/students\/"\)/);
  assert.match(parentShell, /Selected student details/);
});

test("parent student profile helper can read a selected linked student only", () => {
  const helper = readFileSync(studentRecordsPath, "utf8");

  assert.match(helper, /selectedStudentClause = typeof studentId === "number" \? "AND st\.id = :studentId" : ""/);
  assert.match(helper, /WHERE sg\.parent_user_id = :parentUserId\s+\$\{selectedStudentClause\}/);
  assert.match(helper, /typeof studentId === "number" \? \{ parentUserId, studentId \} : \{ parentUserId \}/);
});

test("parent profile fallback shows selector instead of first linked student details", () => {
  const parentProfile = readFileSync(parentStudentProfilePath, "utf8");
  const parentProfileView = readFileSync(parentStudentProfileViewPath, "utf8");

  assert.match(parentProfile, /getParentDashboardData\(session\.userId\)/);
  assert.match(parentProfile, /data\.linkedStudents\.length === 0/);
  assert.match(parentProfile, /data\.linkedStudents\.length === 1/);
  assert.match(parentProfile, /redirect\(data\.linkedStudents\[0\]\.profileHref\)/);
  assert.match(parentProfile, /<StudentProfileSelector students=\{data\.linkedStudents\} \/>/);
  assert.match(parentProfile, /StudentProfileEmptyState/);
  assert.doesNotMatch(parentProfile, /StudentProfileView/);
  assert.doesNotMatch(parentProfile, /getParentStudentProfileData\(session\.userId, session\.name\)/);
  assert.match(parentProfileView, /Choose a student profile/);
  assert.match(parentProfileView, /href=\{student\.profileHref\}/);
});

test("backend checklist tracks completed student and guardian linking slice", () => {
  const checklist = readFileSync(checklistPath, "utf8");

  assert.match(checklist, /- \[x\] Add backend helpers for `students` and `student_guardians`\./);
  assert.match(checklist, /- \[x\] Create an admin flow for adding or listing students\./);
  assert.match(checklist, /- \[x\] Link parent accounts to students using `student_reference`\./);
  assert.match(checklist, /- \[x\] Show linked students on the parent dashboard from the database\./);
  assert.match(checklist, /- \[x\] Keep parent access limited to their linked students only\./);
});
