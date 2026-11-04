import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseRegisterForm } from "../lib/auth/validation.mjs";

const read = (path) => readFileSync(path, "utf8");

function parentForm(references) {
  const form = new FormData();
  form.set("guardianName", "Sample Guardian");
  form.set("email", "guardian@example.test");
  form.set("phone", "09170000000");
  form.set("relationship", "Mother");
  form.set("password", "example-password");
  form.set("confirmPassword", "example-password");
  references.forEach((reference, index) => {
    form.append("studentReferences", reference);
    form.append("studentFirstNames", `First${index}`);
    form.append("studentLastNames", "Student");
  });
  return form;
}

test("parent registration preserves multiple distinct references and bounds submissions", () => {
  const valid = parseRegisterForm("parent", parentForm([" A-1 ", "a-1", "B-2"]));
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.data.profile.studentReferences, ["A-1", "a-1", "B-2"]);
  assert.equal(valid.data.profile.studentReference, "A-1");

  const tooMany = parseRegisterForm("parent", parentForm(Array.from({ length: 11 }, (_, index) => `R-${index}`)));
  assert.equal(tooMany.ok, false);
  assert.match(tooMany.errors.studentClaims, /no more than 10/);

  const tooLong = parseRegisterForm("parent", parentForm(["x".repeat(61)]));
  assert.equal(tooLong.ok, false);
  assert.match(tooLong.errors.studentClaims, /maximum length/);
});

test("signup waits for school review and login distinguishes pending from rejected", () => {
  const auth = read("app/auth/actions.ts");
  const session = read("lib/auth/session.ts");

  assert.match(auth, /status: "pending"/);
  assert.match(auth, /saveParentRegistrationReferences\(/);
  assert.doesNotMatch(auth, /createSession\(\{ userId: userResult\.insertId/);
  assert.doesNotMatch(auth, /linkParentToStudentByReference\(/);
  assert.match(auth, /parent\/login\?registrationSubmitted=1/);
  assert.match(auth, /if \(user\.status === "pending"\)/);
  assert.match(auth, /if \(reviewRows\[0\]\?\.decision === "rejected"\)/);
  assert.match(auth, /if \(user\.status !== "active"\)/);
  assert.match(session, /row\.user_status !== "active"/);
});

test("school-only review is atomic and requires a same-school match", () => {
  const service = read("lib/parents/registration-approval.ts");
  const action = read("app/admin/(dashboard)/parents/actions.ts");
  const page = read("app/admin/(dashboard)/parents/page.tsx");

  assert.match(service, /role !== "school_administrator"/);
  assert.match(service, /pp\.school_id = :schoolId/);
  assert.match(service, /LIMIT 1 FOR UPDATE/);
  assert.match(service, /await connection\.beginTransaction\(\)/);
  assert.match(service, /st\.school_id = rr\.school_id/);
  assert.match(service, /if \(matches\.length === 0 && recordedAssignments\.length === 0\)/);
  assert.match(service, /linkParentToStudentByReference\(connection/);
  assert.match(service, /WHERE id = :parentUserId AND role = 'parent' AND status = :currentStatus/);
  assert.match(service, /INSERT INTO parent_registration_reviews/);
  assert.match(service, /await connection\.commit\(\)/);
  assert.match(service, /await connection\.rollback\(\)/);
  assert.match(action, /await requireRole\("admin"\)/);
  assert.match(action, /reviewParentRegistration\(session\.userId, parentUserId, decision\)/);
  assert.match(page, /schoolContext\.staffRole === "school_administrator"/);
});

test("migration preserves existing parent access and stores review history", () => {
  const migration = read("database/migrations/2026-09-19-parent-registration-approval.sql");
  const fullSchema = read("database/full-schema-v1.sql");

  for (const table of ["parent_registration_references", "parent_registration_reviews"]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    assert.match(fullSchema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(migration, /INSERT IGNORE INTO parent_registration_references/);
  assert.doesNotMatch(migration, /UPDATE\s+users\s+SET\s+status/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM\s+student_guardians/i);
});

test("student connection request migration is additive and auditable", () => {
  const migration = read("database/migrations/2026-11-04-parent-student-claim-requests.sql");
  const fullSchema = read("database/full-schema-v1.sql");
  const service = read("lib/parents/student-claims.ts");
  const adminPage = read("app/admin/(dashboard)/parents/page.tsx");
  const studentsPage = read("app/admin/(dashboard)/students/page.tsx");

  for (const sql of [migration, fullSchema]) {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS parent_student_link_requests/);
    assert.match(sql, /UNIQUE KEY uq_parent_student_link_request \(parent_user_id, student_id\)/);
    assert.match(sql, /reviewer_user_id BIGINT UNSIGNED NULL/);
  }
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\b|\bTRUNCATE\b|\bDROP TABLE\b/i);
  assert.match(service, /parent_email = :email AND status = 'pending'/);
  assert.match(service, /INSERT INTO parent_student_link_requests/);
  assert.match(service, /reviewParentStudentLinkRequest/);
  assert.match(adminPage, /StudentLinkRequestsTable/);
  assert.match(studentsPage, /Parent connection review/);
  assert.match(studentsPage, /StudentLinkRequestsTable rows=\{pendingLinkRequests\} returnTo="\/admin\/students"/);
});
