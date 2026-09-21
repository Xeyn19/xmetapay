import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(path, "utf8");

function loadGuardianService() {
  const compiled = ts.transpileModule(read("lib/students/guardian-email-links.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: loadedModule, exports: loadedModule.exports,
    require: (name) => {
      if (name === "server-only") return {};
      if (name === "@/lib/auth/db") return { pool: {} };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return loadedModule.exports;
}

test("enrollment email validation requires all guardian fields and normalizes address", () => {
  const { parseGuardianEmailInput } = loadGuardianService();
  assert.equal(parseGuardianEmailInput("", "", ""), null);
  assert.deepEqual(JSON.parse(JSON.stringify(parseGuardianEmailInput(" Parent@School.Test ", " Maria ", "Mother"))), {
    email: "parent@school.test", name: "Maria", relationship: "mother",
  });
  assert.throws(() => parseGuardianEmailInput("parent@school.test", "", "mother"), /valid parent email/);
  assert.throws(() => parseGuardianEmailInput("bad", "Maria", "mother"), /valid parent email/);
});

test("enrollment links active same-school parents and keeps pending accounts unlinked", async () => {
  const { recordGuardianEmail } = loadGuardianService();
  const guardian = { email: "parent@school.test", name: "Maria", relationship: "mother" };
  const calls = [];
  const connection = (parent) => ({
    async execute(sql, values) {
      calls.push({ sql, values });
      if (sql.includes("FROM users u")) return [[parent]];
      if (sql.includes("COUNT(*) AS total")) return [[{ total: 0 }]];
      return [[]];
    },
  });

  assert.equal(await recordGuardianEmail(connection({ id: 7, status: "pending", school_id: 3 }), 3, 9, 2, guardian), "pending");
  assert.equal(calls.some(({ sql }) => sql.includes("INSERT INTO student_guardians")), false);
  calls.length = 0;
  assert.equal(await recordGuardianEmail(connection({ id: 7, status: "active", school_id: 3 }), 3, 9, 2, guardian), "linked");
  assert.equal(calls.some(({ sql }) => sql.includes("INSERT INTO student_guardians")), true);
  assert.equal(calls.some(({ sql }) => sql.includes("SET status = 'linked'")), true);
  calls.length = 0;
  await assert.rejects(recordGuardianEmail(connection({ id: 7, status: "active", school_id: 4 }), 3, 9, 2, guardian), /another school/);
  assert.equal(calls.some(({ sql }) => sql.includes("INSERT INTO pending_student_guardians")), false);
});

test("approval links every pending student for the email within the selected school", async () => {
  const { applyGuardianAssignments } = loadGuardianService();
  const calls = [];
  const connection = {
    async execute(sql, values) {
      calls.push({ sql, values });
      if (sql.includes("FROM pending_student_guardians pg")) {
        return [[
          { id: 10, student_id: 41, relationship: "mother" },
          { id: 11, student_id: 42, relationship: "mother" },
        ]];
      }
      if (sql.includes("COUNT(*) AS total")) return [[{ total: 0 }]];
      return [[]];
    },
  };
  assert.equal(await applyGuardianAssignments(connection, 3, "PARENT@SCHOOL.TEST", 7), 2);
  assert.deepEqual(calls.filter(({ sql }) => sql.includes("INSERT INTO student_guardians")).map(({ values }) => values.studentId), [41, 42]);
  assert.deepEqual(calls.filter(({ sql }) => sql.includes("SET status = 'linked'")).map(({ values }) => values.id), [10, 11]);
  assert.equal(calls.find(({ sql }) => sql.includes("FROM pending_student_guardians pg")).values.email, "parent@school.test");
  assert.equal(calls.find(({ sql }) => sql.includes("FROM pending_student_guardians pg")).values.schoolId, 3);
});

test("new student enrollment stores school-owned email assignments in the student transaction", () => {
  const enrollment = read("lib/students/enrollment.ts");
  const service = read("lib/students/guardian-email-links.ts");
  const migration = read("database/migrations/2026-09-21-enrollment-parent-email-links.sql");
  const schema = read("database/full-schema-v1.sql");

  assert.match(enrollment, /recordGuardianEmail\(connection, setup\.schoolId, studentId, adminUserId/);
  assert.match(enrollment, /await connection\.commit\(\)/);
  assert.match(service, /u\.role = 'parent' AND u\.email = :email/);
  assert.match(service, /parent\.school_id !== schoolId/);
  assert.match(service, /parent\?\.status !== "active"/);
  assert.match(service, /INSERT INTO student_guardians[\s\S]*ON DUPLICATE KEY UPDATE id = id/);
  assert.match(service, /WHERE pg\.school_id = :schoolId AND pg\.parent_email = :email AND pg\.status = 'pending'/);
  for (const sql of [migration, schema]) {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS pending_student_guardians/);
    assert.match(sql, /UNIQUE KEY uq_pending_student_guardian_email \(student_id, parent_email\)/);
    assert.match(sql, /KEY idx_pending_guardians_school_email \(school_id, parent_email, status\)/);
  }
});

test("registration and review retain pending access until school administrator approval", () => {
  const auth = read("app/auth/actions.ts");
  const review = read("lib/parents/registration-approval.ts");
  const actions = read("app/admin/students/actions.ts");

  assert.match(auth, /hasParentRegistrationMatch\(/);
  assert.match(auth, /status: "pending"/);
  assert.match(review, /matches\.length === 0 && recordedAssignments\.length === 0/);
  assert.match(review, /applyGuardianAssignments\(connection, schoolId, request\.email, parentUserId\)/);
  assert.match(review, /role !== "school_administrator"/);
  assert.match(actions, /requireStudentManager\("Your staff role cannot manage parent connections/);
  assert.match(actions, /changePendingGuardianEmail\(connection, context\.schoolId, assignmentId, guardian\)/);
});
