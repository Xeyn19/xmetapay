import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const helper = readFileSync("lib/admin/tuition-collections.ts", "utf8");
const page = readFileSync("app/admin/(dashboard)/collections/page.tsx", "utf8");
const table = readFileSync("app/admin/(dashboard)/collections/collections-table.tsx", "utf8");
const actions = readFileSync("app/admin/collections/actions.ts", "utf8");
const schema = readFileSync("database/full-schema-v1.sql", "utf8");
const migrationPath = "database/migrations/2026-07-20-payment-collection-archive.sql";
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

test("tuition collections support reversible school-year-scoped archiving", () => {
  assert.match(helper, /TuitionCollectionArchiveScope = "active" \| "archived" \| "all"/);
  assert.match(helper, /options\.archiveScope \?\? "all"/);
  assert.match(helper, /p\.archived_at IS NULL/);
  assert.match(helper, /p\.archived_at IS NOT NULL/);
  assert.match(helper, /updateTuitionCollectionArchiveState/);
  assert.match(helper, /SELECT p\.id[\s\S]*AND \$\{tuitionPaymentScope\}/);
  assert.match(helper, /UPDATE payments[\s\S]*SET archived_at/);
  assert.match(helper, /return eligibleIds\.length/);
  assert.doesNotMatch(helper, /SET status = 'archived'/);
  assert.match(reports, /getTuitionCollectionRows\(schoolId, schoolYearId\)/);
});

test("collection archive actions require finance access and selected-year ownership", () => {
  assert.match(actions, /archiveTuitionCollectionsAction/);
  assert.match(actions, /restoreTuitionCollectionsAction/);
  assert.match(actions, /await requireRole\("admin"\)/);
  assert.match(actions, /canAccessFinance\(staffRole\)/);
  assert.match(actions, /getResolvedAdminSchoolViewSetup/);
  assert.match(actions, /paymentIds/);
  assert.match(actions, /slice\(0, 100\)/);
  assert.match(actions, /revalidatePath\("\/admin\/collections"\)/);
});

test("collections table switches archive views locally and preserves controls", () => {
  assert.match(table, /role="tablist"/);
  assert.match(table, /Active collections/);
  assert.match(table, /Archived collections/);
  assert.doesNotMatch(table, /href=.*collectionView/);
  assert.match(table, /Select visible/);
  assert.match(table, /Clear selection/);
  assert.match(table, /const operationLabel = view === "archived" \? "Restore" : "Archive"/);
  assert.match(table, /\{operationLabel\} selected/);
  assert.match(table, /role="alertdialog"/);
  assert.match(table, /exportRowsToCsv/);
  assert.match(table, /exportRowsToPdf/);
  assert.match(table, /DashboardTablePagination/);
  assert.match(table, /setActiveCollectionRows/);
  assert.match(table, /setArchivedCollectionRows/);
  assert.match(table, /router\.refresh\(\)/);
});

test("payment collection archive migration is idempotent and audit-safe", () => {
  assert.equal(existsSync(migrationPath), true);
  const migration = readFileSync(migrationPath, "utf8");

  assert.match(migration, /information_schema\.COLUMNS/);
  assert.match(migration, /ALTER TABLE payments\s+ADD COLUMN archived_at DATETIME NULL/);
  assert.match(migration, /DECLARE CONTINUE HANDLER FOR 1060/);
  assert.match(migration, /DECLARE CONTINUE HANDLER FOR 1061/);
  assert.match(migration, /idx_payments_school_year_archive_paid_at/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS payments/);
  assert.match(schema, /archived_at DATETIME NULL/);
  assert.match(schema, /idx_payments_school_year_archive_paid_at/);
  assert.doesNotMatch(migration, /DELETE FROM payments/);
  assert.doesNotMatch(migration, /UPDATE payments SET status/);
});
