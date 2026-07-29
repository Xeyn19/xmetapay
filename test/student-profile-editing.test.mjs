import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const servicePath = "lib/students/profile.ts";
const actionPath = "app/admin/students/actions.ts";
const dataPath = "lib/admin/real-data.ts";
const modalPath = "app/admin/(dashboard)/student-profile/student-profile-edit-modal.tsx";
const profileViewPath = "app/admin/(dashboard)/student-profile/admin-student-profile-view.tsx";

test("student profile update is school scoped, transactional, and active-year authoritative", () => {
  assert.equal(existsSync(servicePath), true);
  const service = readFileSync(servicePath, "utf8");

  assert.match(service, /import "server-only";/);
  assert.match(service, /getResolvedAdminSchoolViewSetup/);
  assert.match(service, /await connection\.beginTransaction\(\)/);
  assert.match(service, /FROM students[\s\S]*school_id = :schoolId[\s\S]*FOR UPDATE/);
  assert.match(service, /FROM school_years[\s\S]*status = 'active'[\s\S]*FOR UPDATE/);
  assert.match(service, /FROM enrollments[\s\S]*student_id = :studentId[\s\S]*school_year_id = :schoolYearId[\s\S]*FOR UPDATE/);
  assert.match(service, /s\.school_id = :schoolId/);
  assert.match(service, /s\.school_year_id = :schoolYearId/);
  assert.match(service, /s\.grade_level_id = :gradeLevelId/);
  assert.match(service, /selectedSchoolYearIsActive/);
  assert.match(service, /await connection\.commit\(\)/);
  assert.match(service, /await connection\.rollback/);
  assert.doesNotMatch(service, /UPDATE student_guardians|UPDATE users|UPDATE payments|UPDATE wallets/);
});

test("student profile validation protects identity and placement contracts", () => {
  const service = readFileSync(servicePath, "utf8");

  assert.match(service, /studentReference[\s\S]*60/);
  assert.match(service, /firstName[\s\S]*80/);
  assert.match(service, /middleName[\s\S]*80/);
  assert.match(service, /lastName[\s\S]*80/);
  assert.match(service, /Enter a real birthdate that is not in the future/);
  assert.match(service, /new", "transferee", "returned"/);
  assert.match(service, /male", "female"/);
  assert.match(service, /LOWER\(student_reference\) = LOWER\(:studentReference\)/);
  assert.match(service, /id <> :studentId/);
  assert.match(service, /ER_DUP_ENTRY/);
  assert.doesNotMatch(service, /SET status =|status = :status/);
});

test("student profile action stays thin and revalidates all admin student views", () => {
  const action = readFileSync(actionPath, "utf8");

  assert.match(action, /export type StudentProfileUpdateActionState/);
  assert.match(action, /export async function updateStudentProfileAction/);
  assert.match(action, /requireStudentManager\("Your staff role cannot edit student profiles\."\)/);
  assert.match(action, /updateAdminStudentProfile\(session\.userId, formData\)/);
  assert.match(action, /revalidatePath\(`\/admin\/students\/\$\{result\.studentId\}`\)/);
  assert.match(action, /revalidatePath\("\/admin\/student-profile"\)/);
  assert.match(action, /revalidatePath\("\/admin\/students"\)/);
});

test("profile reader returns editable raw values and selected-year placement options", () => {
  const data = readFileSync(dataPath, "utf8");

  assert.match(data, /editable: \{/);
  assert.match(data, /studentReference: row\.student_reference/);
  assert.match(data, /DATE_FORMAT\(st\.birthdate, '%Y-%m-%d'\) AS birthdate/);
  assert.match(data, /e\.id AS enrollment_id/);
  assert.match(data, /selectedSchoolYearIsActive: setup\.selectedSchoolYearIsActive/);
  assert.match(data, /getStudentProfileGradeOptions/);
  assert.match(data, /getStudentProfileSectionOptions/);
  assert.match(data, /s\.school_year_id = :schoolYearId/);
});

test("student profile modal edits details responsively while statuses and historical placement stay read only", () => {
  assert.equal(existsSync(modalPath), true);
  const modal = readFileSync(modalPath, "utf8");
  const view = readFileSync(profileViewPath, "utf8");

  assert.match(view, /StudentProfileEditModal/);
  assert.doesNotMatch(view, /Edit pending/);
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /Student information/);
  assert.match(modal, /Active-year placement/);
  assert.match(modal, /Future parent linking must use the updated reference/);
  assert.match(modal, /Historical placement is read-only/);
  assert.match(modal, /Enroll existing students/);
  assert.match(modal, /useActionState/);
  assert.match(modal, /Saving details\.\.\./);
  assert.match(modal, /max-h-\[calc\(100svh-40px\)\]/);
  assert.match(modal, /min-h-11/);
  assert.match(modal, /sm:grid-cols-2/);
  assert.doesNotMatch(modal, /name="studentStatus"|name="enrollmentStatus"/);
});
