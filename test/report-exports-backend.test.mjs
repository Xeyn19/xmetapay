import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const reportExportsPath = "lib/admin/report-exports.ts";
const reportRoutePath = "app/admin/(dashboard)/reports/export/route.ts";
const reportsPagePath = "app/admin/(dashboard)/reports/page.tsx";
const adminRealDataPath = "lib/admin/real-data.ts";
const checklistPath = "docs/CHECKLIST.md";
const flowchartsPath = "docs/PROJECT_FLOWCHARTS.md";
const schemaPlanPath = "docs/DATABASE_SCHEMA_PLAN.md";
const schemaExplanationPath = "docs/DATABASE_SCHEMA_EXPLANATION.md";
const visualFlowchartsPath = "public/PROJECT_FLOWCHARTS_VISUAL.html";
const visualSchemaPath = "public/DATABASE_SCHEMA_VISUAL_PLAN.html";

test("admin report export route is protected and returns CSV downloads", () => {
  assert.equal(existsSync(reportRoutePath), true);
  const route = readFileSync(reportRoutePath, "utf8");

  assert.match(route, /export async function GET\(request: Request\)/);
  assert.match(route, /await requireRole\("admin"\)/);
  assert.match(route, /requireAdminPageAccess\(session\.userId, "\/admin\/reports"\)/);
  assert.match(route, /isReportExportType\(type\)/);
  assert.match(route, /status: 400/);
  assert.match(route, /getAdminReportExport\(session\.userId, type\)/);
  assert.match(route, /Content-Disposition/);
  assert.match(route, /text\/csv/);
});

test("admin report export helper has four school-scoped real SQL reports", () => {
  assert.equal(existsSync(reportExportsPath), true);
  const helper = readFileSync(reportExportsPath, "utf8");

  assert.match(helper, /import "server-only";/);
  assert.match(helper, /getResolvedAdminSchoolSetup\(adminUserId\)/);
  assert.match(helper, /"monthly-revenue"/);
  assert.match(helper, /"collections"/);
  assert.match(helper, /"outstanding-balances"/);
  assert.match(helper, /"wallet-store"/);
  assert.match(helper, /FROM payments p/);
  assert.match(helper, /p\.school_id = :schoolId/);
  assert.match(helper, /FROM student_fee_assignments sfa/);
  assert.match(helper, /ft\.school_id = :schoolId AND sfa\.school_year_id = :schoolYearId/);
  assert.match(helper, /FROM wallet_transactions wt/);
  assert.match(helper, /WHERE st\.school_id = :schoolId/);
  assert.match(helper, /LEFT JOIN store_transactions stx ON stx\.wallet_transaction_id = wt\.id/);
  assert.match(helper, /function toCsv/);
  assert.match(helper, /function csvCell/);
  assert.match(helper, /replaceAll\("\\"", "\\"\\""\)/);
});

test("admin reports page links to implemented CSV exports", () => {
  const page = readFileSync(reportsPagePath, "utf8");
  const realData = readFileSync(adminRealDataPath, "utf8");

  assert.match(page, /ReportDownloadLink/);
  assert.match(page, /\/admin\/reports\/export\?type=monthly-revenue/);
  assert.match(page, /href=\{report\.href\}/);
  assert.doesNotMatch(page, /Export pending/);
  assert.match(realData, /function reportDownloads/);
  assert.match(realData, /href: "\/admin\/reports\/export\?type=collections"/);
  assert.match(realData, /href: "\/admin\/reports\/export\?type=outstanding-balances"/);
  assert.match(realData, /href: "\/admin\/reports\/export\?type=wallet-store"/);
  assert.doesNotMatch(realData, /Export backend pending/);
});

test("docs and visual plans mark CSV reports implemented and future items future", () => {
  const combinedDocs = [
    checklistPath,
    flowchartsPath,
    schemaPlanPath,
    schemaExplanationPath,
    visualFlowchartsPath,
    visualSchemaPath,
  ].map((path) => readFileSync(path, "utf8")).join("\n");

  assert.match(combinedDocs, /CSV report exports/i);
  assert.match(combinedDocs, /monthly revenue/i);
  assert.match(combinedDocs, /collections/i);
  assert.match(combinedDocs, /outstanding balances/i);
  assert.match(combinedDocs, /wallet and store/i);
  assert.match(combinedDocs, /notifications?|notification sending/i);
  assert.match(combinedDocs, /future/i);
});
