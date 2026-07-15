import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const helperPath = "lib/admin/real-data.ts";
const adminStudentProfileSelectorPath = "app/admin/(dashboard)/student-profile/admin-student-profile-view.tsx";
const adminSelectedStudentProfilePath = "app/admin/(dashboard)/students/[studentId]/page.tsx";
const adminShellPath = "app/admin/_components/admin-shell.tsx";
const tableControlsPath = "app/_components/table-controls.tsx";
const adminTableComponentPaths = [
  "app/admin/(dashboard)/dashboard/dashboard-recent-tables.tsx",
  "app/admin/(dashboard)/tuition/tuition-report-table.tsx",
  "app/admin/(dashboard)/collections/collections-table.tsx",
  "app/admin/(dashboard)/other-fees/other-fees-table.tsx",
  "app/admin/(dashboard)/allowance/allowance-table.tsx",
  "app/admin/(dashboard)/store-transactions/store-transactions-table.tsx",
  "app/admin/(dashboard)/students/students-table.tsx",
  "app/admin/(dashboard)/parents/parents-table.tsx",
];
const adminPages = [
  "app/admin/(dashboard)/dashboard/page.tsx",
  "app/admin/(dashboard)/tuition/page.tsx",
  "app/admin/(dashboard)/collections/page.tsx",
  "app/admin/(dashboard)/other-fees/page.tsx",
  "app/admin/(dashboard)/allowance/page.tsx",
  "app/admin/(dashboard)/store-transactions/page.tsx",
  "app/admin/(dashboard)/reports/page.tsx",
  "app/admin/(dashboard)/student-profile/page.tsx",
];

test("admin real-data helper reads supported MySQL schema tables with admin school scope", () => {
  assert.equal(existsSync(helperPath), true);
  const helper = readFileSync(helperPath, "utf8");

  assert.match(helper, /import "server-only";/);
  assert.match(helper, /import \{ pool \} from "@\/lib\/auth\/db";/);
  assert.match(helper, /import \{ getResolvedAdminSchoolViewSetup \} from "@\/lib\/school\/setup";/);
  assert.match(helper, /export async function getAdminDashboardRealData\(adminUserId: number\)/);
  assert.match(helper, /recentFeeAssignments/);
  assert.match(helper, /getRecentFeeAssignments\(setup\.schoolId, setup\.schoolYearId\)/);
  assert.match(helper, /export async function getAdminTuitionPageRealData\(adminUserId: number\)/);
  assert.match(helper, /export async function getAdminStudentProfileRealData\(\s+adminUserId: number,\s+studentId\?: number,/);
  assert.match(helper, /export type AdminStudentProfileSummary/);
  assert.match(helper, /gradeName: string;/);
  assert.match(helper, /sectionName: string;/);
  assert.match(helper, /guardianStatus: string;/);
  assert.match(helper, /getAdminStudentProfileSummaries\(setup\.schoolId, setup\.schoolYearId\)/);
  assert.match(helper, /selectedStudentClause = typeof studentId === "number" \? "AND st\.id = :studentId" : ""/);
  assert.match(helper, /profileHref: `\/admin\/students\/\$\{row\.id\}`/);
  assert.match(helper, /const setup = await getResolvedAdminSchoolViewSetup\(adminUserId\)/);
  assert.match(helper, /getPaymentSummary\(setup\.schoolId, setup\.schoolYearId\)/);
  assert.match(helper, /getCollectionRows\(setup\.schoolId, setup\.schoolYearId\)/);
  assert.doesNotMatch(helper, /FROM admin_profiles ap\s+LEFT JOIN school_years sy ON sy\.school_id = ap\.school_id/);
  assert.match(helper, /school_id = :schoolId|school_id = :schoolId/);
  assert.match(helper, /FROM students/);
  assert.match(helper, /FROM enrollments|JOIN enrollments/);
  assert.match(helper, /FROM student_guardians|LEFT JOIN student_guardians/);
  assert.match(helper, /FROM fee_types|JOIN fee_types/);
  assert.match(helper, /FROM student_fee_assignments|JOIN student_fee_assignments/);
  assert.match(helper, /FROM payments|JOIN payments/);
  assert.match(helper, /FROM payment_allocations|JOIN payment_allocations/);
  assert.match(helper, /FROM wallets|JOIN wallets|LEFT JOIN wallets/);
  assert.match(helper, /FROM wallet_transactions|JOIN wallet_transactions|LEFT JOIN wallet_transactions/);
  assert.match(helper, /FROM \(\s+SELECT w\.id AS wallet_id,/);
  assert.match(helper, /GROUP BY w\.id, w\.balance/);
  assert.match(helper, /FROM store_merchants|JOIN store_merchants/);
  assert.match(helper, /FROM store_transactions|JOIN store_transactions/);
  assert.match(helper, /Pending/);
  assert.match(helper, /No payment records yet|No store transactions yet|No wallet records yet/);
});

test("admin student profile route lists students and selected route loads exact profile", () => {
  assert.equal(existsSync(adminStudentProfileSelectorPath), true);
  assert.equal(existsSync(adminSelectedStudentProfilePath), true);
  const profilePage = readFileSync("app/admin/(dashboard)/student-profile/page.tsx", "utf8");
  const selector = readFileSync(adminStudentProfileSelectorPath, "utf8");
  const selectedProfile = readFileSync(adminSelectedStudentProfilePath, "utf8");
  const shell = readFileSync(adminShellPath, "utf8");

  assert.match(profilePage, /AdminStudentProfileSelector/);
  assert.match(profilePage, /data\.students\.length > 0/);
  assert.doesNotMatch(profilePage, /AdminStudentProfileView/);
  assert.match(selector, /Choose a student profile/);
  assert.match(selector, /href=\{student\.profileHref\}/);
  assert.match(selector, /DashboardTableControls/);
  assert.match(selector, /filterByQuery/);
  assert.match(selector, /toFilterOptions/);
  assert.match(selector, /exportRowsToCsv/);
  assert.match(selector, /exportRowsToPdf/);
  assert.match(selector, /searchPlaceholder="Search name, reference, guardian\.\.\."/);
  assert.match(selector, /label: "Grade"/);
  assert.match(selector, /label: "Section"/);
  assert.match(selector, /label: "Enrollment status"/);
  assert.match(selector, /label: "Guardian link"/);
  assert.doesNotMatch(selector, /const \[studentStatus/);
  assert.doesNotMatch(selector, /onChange: setStudentStatus/);
  assert.match(selector, /setGrade\(value\);\s+setSection\("all"\);/);
  assert.match(selector, /student\.gradeName === grade/);
  assert.match(selector, /student\.sectionName === section/);
  assert.match(selector, /student\.guardianStatus === guardianStatus/);
  assert.match(selector, /No students match the current filters\./);
  assert.match(selector, /\`\$\{query\}\|\$\{grade\}\|\$\{section\}\|\$\{enrollmentStatus\}\|\$\{guardianStatus\}\`/);
  assert.match(selector, /DashboardTablePagination/);
  assert.match(selector, /pagination\.pageRows\.map/);
  assert.match(selectedProfile, /params: Promise<\{ studentId: string \}>/);
  assert.match(selectedProfile, /await params/);
  assert.match(selectedProfile, /Number\(studentId\)/);
  assert.match(selectedProfile, /getAdminStudentProfileRealData\(session\.userId, selectedStudentId\)/);
  assert.match(selectedProfile, /notFound\(\)/);
  assert.match(selectedProfile, /AdminStudentProfileView/);
  assert.match(shell, /selectedStudentProfilePath/);
  assert.match(shell, /item\.href === "\/admin\/student-profile"/);
});

test("admin pages use real-data helpers instead of prototype dashboard arrays", () => {
  for (const pagePath of adminPages) {
    assert.equal(existsSync(pagePath), true, `${pagePath} should exist`);
    const page = readFileSync(pagePath, "utf8");

    assert.match(page, /requireRole\("admin"\)/, `${pagePath} should require an admin session`);
    assert.doesNotMatch(page, /_data\/admin-dashboard-data/, `${pagePath} should not import prototype admin data`);
    assert.doesNotMatch(
      page,
      /dashboardKpis|tuitionRows|collectionsRows|allowanceRows|storeRows|reportKpis|profileTransactions|profileFeeStatus|feeItems|otherFeesKpis/,
      `${pagePath} should not import prototype admin data arrays`,
    );
    assert.doesNotMatch(
      page,
      /Juan Miguel Santos|Maria Santos|0917-234-5678|P143,500|P682,500|TXN-4921|STR-4821/,
      `${pagePath} should not render prototype names, contacts, totals, or refs`,
    );
  }
});

test("admin finance pages show empty or pending states when records do not exist", () => {
  const pageText = [
    ...adminPages.map((pagePath) => readFileSync(pagePath, "utf8")),
    readFileSync(adminStudentProfileSelectorPath, "utf8"),
    ...adminTableComponentPaths.map((componentPath) => readFileSync(componentPath, "utf8")),
  ].join("\n");

  assert.match(pageText, /No tuition fee assignments yet/);
  assert.match(pageText, /Recent fee assignments/);
  assert.match(pageText, /No fee assignments yet/);
  assert.match(pageText, /No payment records yet/);
  assert.match(pageText, /No other fee types yet/);
  assert.match(pageText, /No wallet records yet/);
  assert.match(pageText, /No store transactions yet/);
  assert.doesNotMatch(pageText, /Export pending/);
  assert.match(pageText, /Record payment pending/);
});

test("admin real-data tables use working search filters plus CSV and PDF export controls", () => {
  assert.equal(existsSync(tableControlsPath), true);
  const controls = readFileSync(tableControlsPath, "utf8");
  const shell = readFileSync(adminShellPath, "utf8");

  assert.match(controls, /export function DashboardTableControls/);
  assert.match(controls, /import jsPDF from "jspdf"/);
  assert.match(controls, /import autoTable from "jspdf-autotable"/);
  assert.match(controls, /exportRowsToCsv/);
  assert.match(controls, /exportRowsToPdf/);
  assert.match(controls, /filterByQuery/);
  assert.match(controls, /export const DEFAULT_TABLE_PAGE_SIZE = 10/);
  assert.match(controls, /export const TABLE_PAGE_SIZE_OPTIONS = \[5, 10, 25\] as const/);
  assert.match(controls, /export function DashboardTablePagination/);
  assert.match(controls, /export function usePaginatedRows/);
  assert.match(controls, /Showing \{startItem\}-\{endItem\} of \{totalItems\}/);
  assert.match(controls, /Page \{page\} of \{pageCount\}/);
  assert.match(controls, /Prev/);
  assert.match(controls, /Next/);
  assert.match(controls, /requestedPage = paginationState\.resetKey === resetKey \? paginationState\.page : 1/);
  assert.match(controls, /setPageSize = \(nextPageSize: number\)/);
  assert.match(controls, /Export CSV/);
  assert.match(controls, /Export PDF/);

  for (const componentPath of adminTableComponentPaths) {
    assert.equal(existsSync(componentPath), true, `${componentPath} should exist`);
    const component = readFileSync(componentPath, "utf8");

    assert.match(component, /"use client";/, `${componentPath} should be client-side for table controls`);
    assert.match(component, /DashboardTableControls/, `${componentPath} should render working table controls`);
    assert.match(component, /usePaginatedRows/, `${componentPath} should paginate filtered rows`);
    assert.match(component, /DashboardTablePagination/, `${componentPath} should render pagination controls`);
    assert.match(component, /pageRows\.map/, `${componentPath} should render the current page of rows`);
    assert.match(component, /exportRowsToCsv/, `${componentPath} should export filtered rows`);
    assert.match(component, /exportRowsToPdf/, `${componentPath} should export filtered rows to PDF`);
    assert.match(component, /onExportPdf/, `${componentPath} should wire PDF export controls`);
    assert.match(component, /filterByQuery/, `${componentPath} should filter rows before pagination`);
    assert.doesNotMatch(component, /readOnly|Export pending|Filter pending/, `${componentPath} should not keep placeholder controls`);
  }

  assert.match(shell, /\/admin\/tuition#payment-reminders/);
  assert.doesNotMatch(shell, /Reminders future/);
  assert.match(shell, /Manual payment/);
  assert.match(shell, /Coming soon/);
  assert.match(shell, /subtitle === "School dashboard - SY 2025-2026"/);
  assert.doesNotMatch(shell, /Brentwood Academy/);
  assert.doesNotMatch(shell, /AdminModals|data-modal-trigger|openModal/);
});
