import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadClaimHelper() {
  const compiled = ts.transpileModule(readFileSync("lib/parents/student-claims.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: loadedModule,
    exports: loadedModule.exports,
    require: (name) => {
      if (name === "server-only") return {};
      if (name === "@/lib/auth/db") return { pool: {} };
      if (name === "@/lib/admin/access") return {};
      if (name === "@/lib/parents/school-scope") return {};
      if (name === "@/lib/school/setup") return {};
      if (name === "@/lib/students/records") return {};
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return loadedModule.exports;
}

test("registration resolves exact reference and name claims without asking for a school", async () => {
  const { resolveRegistrationStudentClaims, StudentClaimError } = loadClaimHelper();
  const rows = [
    { id: 10, school_id: 12, student_reference: "A-1", first_name: "Ana", last_name: "Cruz" },
    { id: 11, school_id: 12, student_reference: "B-2", first_name: "Ben", last_name: "Cruz" },
  ];
  const calls = [];
  const connection = { async execute(sql, values) { calls.push({ sql, values }); return [rows]; } };
  const result = await resolveRegistrationStudentClaims(connection, "parent@example.test", [
    { reference: "a-1", firstName: "ana", lastName: "cruz" },
    { reference: "B-2", firstName: "Ben", lastName: "Cruz" },
  ]);

  assert.equal(result.schoolId, 12);
  assert.deepEqual(Array.from(result.references), ["A-1", "B-2"]);
  assert.match(calls[0].sql, /JOIN schools sc ON sc\.id = st\.school_id AND sc\.status = 'active'/);
  assert.match(calls[0].sql, /LOWER\(TRIM\(st\.first_name\)\)/);
  assert.doesNotMatch(calls[0].sql, /st\.school_id = :schoolId/);

  await assert.rejects(
    () => resolveRegistrationStudentClaims({ execute: async () => [[]] }, "parent@example.test", [
      { reference: "WRONG", firstName: "Ana", lastName: "Cruz" },
    ]),
    (error) => error instanceof StudentClaimError && error.reason === "not_found",
  );
});

test("registration rejects mixed schools and accepts an optional school code", async () => {
  const { resolveRegistrationStudentClaims, StudentClaimError } = loadClaimHelper();
  const rows = [
    { id: 10, school_id: 12, student_reference: "A-1", first_name: "Ana", last_name: "Cruz" },
    { id: 20, school_id: 13, student_reference: "B-2", first_name: "Ben", last_name: "Cruz" },
  ];
  await assert.rejects(
    () => resolveRegistrationStudentClaims({ execute: async () => [rows] }, "parent@example.test", [
      { reference: "A-1", firstName: "Ana", lastName: "Cruz" },
      { reference: "B-2", firstName: "Ben", lastName: "Cruz" },
    ]),
    (error) => error instanceof StudentClaimError && error.reason === "different_schools",
  );

  let captured;
  await resolveRegistrationStudentClaims({ async execute(sql, values) { captured = { sql, values }; return [[rows[0]]]; } },
    "parent@example.test", [{ reference: "A-1", firstName: "Ana", lastName: "Cruz" }], "ABC");
  assert.match(captured.sql, /LOWER\(sc\.code\) = LOWER\(:schoolCode\)/);
  assert.equal(captured.values.schoolCode, "ABC");
});

test("signup reports privacy-safe claim errors and rolls back an unmatched account", () => {
  const auth = readFileSync("app/auth/actions.ts", "utf8");
  const form = readFileSync("app/_components/auth-ui.tsx", "utf8");
  assert.match(auth, /resolveRegistrationStudentClaims\(/);
  assert.match(auth, /error instanceof StudentClaimError/);
  assert.match(auth, /We could not verify the student details/);
  assert.match(auth, /await connection\.rollback\(\)/);
  assert.match(form, /id="student-claims-error"/);
  assert.match(form, /role=\{state\.tone === "info" \? "status" : "alert"\}/);
});
