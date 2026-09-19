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
  form.set("schoolId", "12");
  form.set("relationship", "Mother");
  form.set("password", "example-password");
  form.set("confirmPassword", "example-password");
  references.forEach((reference) => form.append("studentReferences", reference));
  return form;
}

test("parent registration preserves multiple distinct references and bounds submissions", () => {
  const valid = parseRegisterForm("parent", parentForm([" A-1 ", "a-1", "B-2"]));
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.data.profile.studentReferences, ["A-1", "B-2"]);
  assert.equal(valid.data.profile.studentReference, "A-1");

  const tooMany = parseRegisterForm("parent", parentForm(Array.from({ length: 11 }, (_, index) => `R-${index}`)));
  assert.equal(tooMany.ok, false);
  assert.match(tooMany.errors.studentReferences, /no more than 10/);

  const tooLong = parseRegisterForm("parent", parentForm(["x".repeat(61)]));
  assert.equal(tooLong.ok, false);
  assert.match(tooLong.errors.studentReferences, /60 characters/);
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
  assert.match(service, /if \(matches\.length === 0\)/);
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
