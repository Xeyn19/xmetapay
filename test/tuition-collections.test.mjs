import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const helper = readFileSync("lib/admin/tuition-collections.ts", "utf8");
const page = readFileSync("app/admin/(dashboard)/collections/page.tsx", "utf8");
const table = readFileSync("app/admin/(dashboard)/collections/collections-table.tsx", "utf8");
const reports = readFileSync("lib/admin/report-exports.ts", "utf8");
const docs = [
  readFileSync("docs/PROJECT_FLOWCHARTS.md", "utf8"),
  readFileSync("docs/DATABASE_SCHEMA_PLAN.md", "utf8"),
  readFileSync("docs/DATABASE_SCHEMA_EXPLANATION.md", "utf8"),
  readFileSync("public/PROJECT_FLOWCHARTS_VISUAL.html", "utf8"),
].join("\n");

test("tuition collection helper scopes through fee and term allocations", () => {
  assert.match(helper, /FROM payments p/);
  assert.match(helper, /payment_allocations pa_scope/);
  assert.match(helper, /payment_term_allocations pta_scope/);
  assert.match(helper, /ft_scope\.category = 'tuition'/);
  assert.match(helper, /term_ft_scope\.category = 'tuition'/);
  assert.match(helper, /p\.school_id = :schoolId/);
  assert.match(helper, /sfa_scope\.school_year_id = :schoolYearId/);
  assert.doesNotMatch(helper, /wallet_transactions/);
  assert.doesNotMatch(helper, /store_transactions/);
});

test("collections page and exports use the shared tuition reader", () => {
  assert.match(page, /getAdminCollectionsPageRealData/);
  assert.match(page, /Tuition collection log/);
  assert.match(table, /Search student, ref, tuition term/);
  assert.match(table, /No tuition payment records yet/);
  assert.match(reports, /getTuitionCollectionRows/);
  assert.match(reports, /Tuition collections report/);
});

test("docs separate tuition collections from wallet and store activity", () => {
  assert.match(docs, /Tuition collections/);
  assert.match(docs, /wallet top-ups.*allowance ledger|allowance ledger.*wallet top-ups/i);
  assert.match(docs, /store purchases.*Store transactions|Store transactions.*store purchases/i);
});
