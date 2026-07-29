import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globalCss = readFileSync("app/globals.css", "utf8");
const adminShell = readFileSync("app/admin/_components/admin-shell.tsx", "utf8");
const parentShell = readFileSync("app/parent/_components/parent-shell.tsx", "utf8");
const superAdminShell = readFileSync("app/super-admin/_components/super-admin-shell.tsx", "utf8");
const adminReportsPage = readFileSync("app/admin/(dashboard)/reports/page.tsx", "utf8");
const adminTuitionPage = readFileSync("app/admin/(dashboard)/tuition/page.tsx", "utf8");
const adminRealData = readFileSync("lib/admin/real-data.ts", "utf8");

test("every dashboard shell uses the shared theme boundary and toggle", () => {
  for (const shell of [adminShell, parentShell, superAdminShell]) {
    assert.match(shell, /dashboard-theme/);
    assert.match(shell, /<ThemeToggle/);
    assert.match(shell, /dashboard-sidebar/);
  }
});

test("dashboard theming provides adaptive sidebars and semantic operational surfaces", () => {
  assert.match(globalCss, /\.dashboard-theme/);
  assert.match(globalCss, /\.dashboard-theme \.dashboard-sidebar/);
  assert.match(globalCss, /--sidebar: #ffffff/);
  assert.match(globalCss, /\.dark \{[\s\S]*--sidebar: #0b0d13/);
  assert.match(globalCss, /background: var\(--sidebar\)/);
  assert.match(globalCss, /color: var\(--sidebar-foreground\)/);
  assert.match(globalCss, /\.dark \.dashboard-theme \.dashboard-sidebar/);
  assert.match(globalCss, /\.dark \.dashboard-theme/);
  assert.match(globalCss, /--status-success-bg/);
  assert.match(globalCss, /--status-warning-bg/);
  assert.match(globalCss, /--status-danger-bg/);
  assert.match(globalCss, /recharts-cartesian-grid/);
  assert.match(globalCss, /recharts-default-tooltip/);
});

test("dashboard shells use semantic sidebar navigation states", () => {
  for (const shell of [adminShell, parentShell, superAdminShell]) {
    assert.match(shell, /bg-sidebar/);
    assert.match(shell, /text-sidebar-foreground/);
    assert.match(shell, /border-sidebar-border/);
    assert.match(shell, /bg-sidebar-primary/);
    assert.match(shell, /focus-visible:ring-sidebar-ring/);
  }
});

test("admin finance pages keep report hover contrast and separate tuition from other fees", () => {
  assert.match(adminReportsPage, /divide-y divide-border/);
  assert.match(adminReportsPage, /hover:bg-muted/);
  assert.match(adminReportsPage, /text-foreground/);
  assert.match(adminReportsPage, /text-muted-foreground/);
  assert.doesNotMatch(adminReportsPage, /hover:bg-\[#f7f8fa\]/);

  assert.doesNotMatch(adminTuitionPage, /Other fee items|No other fee records yet/);
  assert.doesNotMatch(adminRealData, /otherFeeSummary|getOtherFeeSummary|OtherFeeSummaryRow/);
});
