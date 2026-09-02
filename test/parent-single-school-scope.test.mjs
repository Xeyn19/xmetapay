import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("parent school migration is idempotent and preserves every existing record", () => {
  const migration = read("database/migrations/2026-09-02-parent-single-school-scope.sql");
  const fullSchema = read("database/full-schema-v1.sql");

  for (const sql of [migration, fullSchema]) {
    assert.match(sql, /parent_profiles ADD COLUMN school_id BIGINT UNSIGNED NULL/);
    assert.match(sql, /idx_parent_profiles_school_id/);
    assert.match(sql, /fk_parent_profiles_school/);
    assert.match(sql, /ON DELETE SET NULL/);
    assert.match(sql, /information_schema\.COLUMNS/);
  }

  assert.match(migration, /HAVING COUNT\(DISTINCT st\.school_id\) = 1/g);
  assert.match(migration, /WHERE pp\.school_id IS NULL/g);
  assert.match(migration, /unresolved_parent_profiles/);
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(migration, /\bTRUNCATE\b/i);
  assert.doesNotMatch(migration, /\bDROP\s+TABLE\b/i);
});

test("parent registration is invitation-driven and cannot accept client school ownership", () => {
  const authAction = read("app/auth/actions.ts");
  const registerPage = read("app/parent/register/page.tsx");
  const claimFlow = read("app/parent/register/parent-claim-flow.tsx");
  const invitations = read("lib/parents/invitations.ts");

  assert.match(authAction, /Parent registration requires a school-issued invitation/);
  assert.doesNotMatch(authAction, /INSERT INTO parent_profiles/);
  assert.match(registerPage, /getParentClaimState/);
  assert.match(registerPage, /ParentClaimFlow/);
  assert.doesNotMatch(claimFlow, /name="schoolId"|name="studentReferences"|name="studentReference"/);
  assert.match(invitations, /INSERT INTO parent_profiles \(user_id,school_id/);
  assert.match(invitations, /claim\.school_id/);
});

test("parent school helper is the immutable server-only write boundary", () => {
  const helper = read("lib/parents/school-scope.ts");
  const studentRecords = read("lib/students/records.ts");
  const paymentAction = read("app/parent/payments/actions.ts");
  const walletService = read("lib/wallets/top-up.ts");
  const feeArchive = read("lib/fees/parent-archive.ts");
  const paymentArchive = read("lib/payments/parent-history-archive.ts");

  assert.match(helper, /import "server-only"/);
  assert.match(helper, /JOIN schools sc ON sc\.id = pp\.school_id/);
  assert.match(helper, /options\.forWrite && scope\.schoolStatus !== "active"/);
  assert.doesNotMatch(helper, /UPDATE parent_profiles/);
  assert.doesNotMatch(studentRecords, /linkParentToStudentByReference/);
  assert.match(studentRecords, /linked_st\.school_id = pp\.school_id/);
  assert.match(studentRecords, /sg\.status = 'active'/);
  for (const source of [paymentAction, walletService, feeArchive, paymentArchive]) {
    assert.match(source, /requireParentSchoolScope\([^;]+forWrite: true/s);
  }
});

test("every parent financial read is constrained to the assigned school", () => {
  const sources = [
    "lib/students/records.ts",
    "lib/fees/records.ts",
    "lib/payments/records.ts",
    "lib/tuition/terms.ts",
    "lib/wallets/records.ts",
    "lib/fees/parent-archive.ts",
    "lib/payments/parent-history-archive.ts",
    "app/parent/payments/actions.ts",
    "lib/wallets/top-up.ts",
  ].map(read);

  for (const source of sources) {
    assert.match(source, /parent_profiles pp_[a-z_]+/);
    assert.match(source, /pp_[a-z_]+\.school_id = st(?:_[a-z]+)?\.school_id|pp_[a-z_]+\.school_id = st\.school_id/);
  }
});

test("unresolved parents are blocked without deleting history", () => {
  const layout = read("app/parent/(portal)/layout.tsx");
  const shell = read("app/parent/_components/parent-shell.tsx");
  const records = read("lib/students/records.ts");

  assert.match(layout, /if \(!parentContext\.schoolScopeReady\)/);
  assert.match(layout, /No records were deleted/);
  assert.match(layout, /Log out/);
  assert.match(records, /schoolScopeReady: Boolean\(row\?\.school_id && row\?\.school_name\)/);
  assert.match(shell, /context\.schoolStatus === "inactive"/);
  assert.match(shell, /Historical records remain available/);
});
