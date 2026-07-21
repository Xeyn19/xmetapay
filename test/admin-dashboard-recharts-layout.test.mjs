import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const packagePath = "package.json";
const dashboardPagePath = "app/admin/(dashboard)/dashboard/page.tsx";
const chartPath = "app/admin/(dashboard)/dashboard/tuition-collected-chart.tsx";
const recentTablesPath = "app/admin/(dashboard)/dashboard/dashboard-recent-tables.tsx";
const realDataPath = "lib/admin/real-data.ts";
const checklistPath = "docs/CHECKLIST.md";
const projectFlowchartsPath = "docs/PROJECT_FLOWCHARTS.md";
const projectFlowVisualPath = "public/PROJECT_FLOWCHARTS_VISUAL.html";

test("administrator dashboard has a Recharts-backed client chart", () => {
  assert.equal(existsSync(chartPath), true);
  const pkg = readFileSync(packagePath, "utf8");
  const chart = readFileSync(chartPath, "utf8");

  assert.match(pkg, /"recharts":/);
  assert.match(chart, /"use client";/);
  assert.match(chart, /from "recharts"/);
  assert.match(chart, /ResponsiveContainer/);
  assert.match(chart, /BarChart/);
  assert.match(chart, /layout="vertical"/);
  assert.match(chart, /rows: BarRow\[\]/);
  assert.match(chart, /amount: Number\(row\.amount\)/);
});

test("school administrator dashboard uses the new layout while staff dashboards keep the existing layout", () => {
  const dashboard = readFileSync(dashboardPagePath, "utf8");
  const recentTables = readFileSync(recentTablesPath, "utf8");

  assert.match(dashboard, /staffRole === "school_administrator"/);
  assert.match(dashboard, /SchoolAdministratorDashboard/);
  assert.match(dashboard, /TuitionCollectedByGradeChart/);
  assert.match(dashboard, /RecentPaymentsTable rows=\{payments\}/);
  assert.match(dashboard, /BarList rows=\{data\.tuitionByGrade\}/);
  assert.match(recentTables, /export function RecentPaymentsTable/);
  assert.doesNotMatch(dashboard, /RecentFeeAssignmentsTable|DashboardRecentTables|feeAssignmentAction/);
  assert.doesNotMatch(recentTables, /Recent fee assignments|RecentFeeAssignmentsTable/);
});

test("admin dashboard real data returns numeric chart rows and top-up-today KPIs", () => {
  const helper = readFileSync(realDataPath, "utf8");

  assert.match(helper, /export type BarRow = \{\s+label: string;\s+value: string;\s+amount: number;/);
  assert.match(helper, /amount,/);
  assert.match(helper, /today_top_ups/);
  assert.match(helper, /today_top_up_count/);
  assert.match(helper, /todayTopUps: decimalValue\(row\?\.today_top_ups\)/);
  assert.match(helper, /todayTopUpCount: numberValue\(row\?\.today_top_up_count\)/);
  assert.match(helper, /label: "Top-ups today"/);
  assert.match(helper, /Allowance top-ups this month/);
  assert.match(helper, /Store transactions this month/);
});

test("dashboard docs mention the Recharts administrator overview", () => {
  const checklist = readFileSync(checklistPath, "utf8");
  const flowcharts = readFileSync(projectFlowchartsPath, "utf8");
  const visual = readFileSync(projectFlowVisualPath, "utf8");

  assert.match(checklist, /Recharts-backed real-data overview/);
  assert.match(flowcharts, /Recharts-backed real-data overview/);
  assert.match(visual, /Recharts-backed real-data overview/);
});
