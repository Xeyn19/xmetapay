import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const studentRecordsPath = "lib/students/records.ts";
const adminStudentActionsPath = "app/admin/students/actions.ts";
const parentStudentLinkActionsPath = "app/parent/student-link/actions.ts";
const authActionsPath = "app/auth/actions.ts";
const adminStudentsPagePath = "app/admin/(dashboard)/students/page.tsx";
const adminParentsPagePath = "app/admin/(dashboard)/parents/page.tsx";
const parentDashboardPath = "app/parent/(portal)/dashboard/page.tsx";
const adminShellPath = "app/admin/_components/admin-shell.tsx";
const adminModalsPath = "app/admin/_components/admin-modals.tsx";
const parentShellPath = "app/parent/_components/parent-shell.tsx";
const parentPortalDataPath = "app/parent/_data/parent-portal-data.ts";
const checklistPath = "CHECKLIST.md";

test("student records helper reads students, enrollment, and guardian links from MySQL", () => {
  assert.equal(existsSync(studentRecordsPath), true);
  const helper = readFileSync(studentRecordsPath, "utf8");

  assert.match(helper, /import "server-only";/);
  assert.match(helper, /import \{ pool \} from "@\/lib\/auth\/db";/);
  assert.match(helper, /export async function getAdminStudentPageData\(adminUserId: number\)/);
  assert.match(helper, /export async function getAdminParentsPageData\(adminUserId: number\)/);
  assert.match(helper, /export async function getParentDashboardData\(parentUserId: number\)/);
  assert.match(helper, /FROM students/);
  assert.match(helper, /JOIN enrollments/);
  assert.match(helper, /FROM student_guardians/);
  assert.match(helper, /parent_user_id = :parentUserId/);
});

test("admin student action is protected and creates student enrollment records", () => {
  assert.equal(existsSync(adminStudentActionsPath), true);
  const action = readFileSync(adminStudentActionsPath, "utf8");

  assert.match(action, /"use server";/);
  assert.match(action, /export async function createStudentAction\(formData: FormData\)/);
  assert.match(action, /await requireRole\("admin"\)/);
  assert.match(action, /INSERT INTO students/);
  assert.match(action, /INSERT INTO enrollments/);
  assert.match(action, /status\s*:\s*"enrolled"|status = 'enrolled'|VALUES \(.*'enrolled'/s);
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
  assert.match(authActions, /await linkParentToStudentByReference\(/);
  assert.match(authActions, /parsed\.data\.profile\.studentReference/);
});

test("admin and parent pages use database helpers instead of mock student arrays", () => {
  const adminStudentsPage = readFileSync(adminStudentsPagePath, "utf8");
  const adminParentsPage = readFileSync(adminParentsPagePath, "utf8");
  const parentDashboard = readFileSync(parentDashboardPath, "utf8");

  assert.doesNotMatch(adminStudentsPage, /"use client";/);
  assert.match(adminStudentsPage, /getAdminStudentPageData/);
  assert.match(adminStudentsPage, /createStudentAction/);
  assert.match(adminStudentsPage, /<form action=\{createStudentAction\}/);
  assert.doesNotMatch(adminStudentsPage, /studentRows|studentsKpis/);

  assert.match(adminParentsPage, /getAdminParentsPageData/);
  assert.doesNotMatch(adminParentsPage, /parentRows|parentKpis/);

  assert.match(parentDashboard, /getParentDashboardData/);
  assert.match(parentDashboard, /linkParentStudentAction/);
  assert.match(parentDashboard, /<form action=\{linkParentStudentAction\}/);
  assert.doesNotMatch(parentDashboard, /children|dashboardMetrics|outstandingFees|recentActivity/);
});

test("admin header enrollment action opens the database-backed student form", () => {
  const shell = readFileSync(adminShellPath, "utf8");
  const modals = readFileSync(adminModalsPath, "utf8");

  assert.match(shell, /href="\/admin\/students#add-student"/);
  assert.match(shell, /Add student/);
  assert.doesNotMatch(shell, /openModal\("enroll"\)/);
  assert.doesNotMatch(shell, /data-modal-trigger="enroll"/);
  assert.doesNotMatch(modals, /activeModal === "enroll"/);
  assert.doesNotMatch(modals, /Add \/ enroll student/);
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

test("backend checklist tracks completed student and guardian linking slice", () => {
  const checklist = readFileSync(checklistPath, "utf8");

  assert.match(checklist, /- \[x\] Add backend helpers for `students` and `student_guardians`\./);
  assert.match(checklist, /- \[x\] Create an admin flow for adding or listing students\./);
  assert.match(checklist, /- \[x\] Link parent accounts to students using `student_reference`\./);
  assert.match(checklist, /- \[x\] Show linked students on the parent dashboard from the database\./);
  assert.match(checklist, /- \[x\] Keep parent access limited to their linked students only\./);
});
