import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadMatchHelper() {
  const compiled = ts.transpileModule(readFileSync("lib/parents/registration-approval.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: loadedModule, exports: loadedModule.exports,
    require: (name) => {
      if (name === "server-only") return {};
      if (name === "@/lib/auth/db") return { pool: {} };
      if (name === "@/lib/admin/access") return {};
      if (name === "@/lib/school/setup") return {};
      if (name === "@/lib/students/records") return {};
      if (name === "@/lib/students/guardian-email-links") return {};
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return loadedModule.exports.hasParentRegistrationMatch;
}

test("signup rejects missing and unmatched references unless this school recorded the email", async () => {
  const hasMatch = loadMatchHelper();
  const calls = [];
  const connection = (recorded, validReferences) => ({
    async execute(sql, values) {
      calls.push({ sql, values });
      if (sql.includes("FROM pending_student_guardians")) return [recorded ? [{ id: 1 }] : []];
      if (sql.includes("FROM students st")) {
        assert.match(sql, /st\.school_id = :schoolId/);
        assert.equal(values.schoolId, 12);
        return [Object.entries(values).some(([key, value]) => key.startsWith("reference") && validReferences.includes(value))
          ? [{ id: 10 }] : []];
      }
      throw new Error("Unexpected query");
    },
  });

  assert.equal(await hasMatch(connection(false, []), 12, "parent@example.test", []), false);
  assert.equal(await hasMatch(connection(false, []), 12, "parent@example.test", ["WRONG"]), false);
  assert.equal(await hasMatch(connection(false, ["RIGHT"]), 12, "parent@example.test", ["WRONG", "RIGHT"]), true);
  assert.equal(await hasMatch(connection(true, []), 12, "parent@example.test", []), true);
  assert.equal(await hasMatch(connection(true, []), 12, "parent@example.test", ["WRONG"]), true);
  assert.equal(calls.every(({ values }) => values.schoolId === 12), true);
  assert.equal(calls.filter(({ sql }) => sql.includes("FROM students st")).length, 2);
});

test("signup returns a reference field alert and rolls back an unmatched account", () => {
  const auth = readFileSync("app/auth/actions.ts", "utf8");
  const form = readFileSync("app/_components/auth-ui.tsx", "utf8");
  assert.match(auth, /hasParentRegistrationMatch\(/);
  assert.match(auth, /if \(!hasMatch\) \{\s*await connection\.rollback\(\)/);
  assert.match(auth, /At least one reference must match a student at this school/);
  assert.match(form, /aria-describedby=\{error \? "student-references-error"/);
  assert.match(form, /role=\{state\.tone === "info" \? "status" : "alert"\}/);
});
