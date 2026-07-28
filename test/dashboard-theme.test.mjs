import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globalCss = readFileSync("app/globals.css", "utf8");
const adminShell = readFileSync("app/admin/_components/admin-shell.tsx", "utf8");
const parentShell = readFileSync("app/parent/_components/parent-shell.tsx", "utf8");
const superAdminShell = readFileSync("app/super-admin/_components/super-admin-shell.tsx", "utf8");

test("every dashboard shell uses the shared theme boundary and toggle", () => {
  for (const shell of [adminShell, parentShell, superAdminShell]) {
    assert.match(shell, /dashboard-theme/);
    assert.match(shell, /<ThemeToggle/);
    assert.match(shell, /dashboard-sidebar/);
  }
});

test("dashboard theming keeps charcoal sidebars and semantic operational surfaces", () => {
  assert.match(globalCss, /\.dashboard-theme/);
  assert.match(globalCss, /\.dashboard-theme \.dashboard-sidebar/);
  assert.match(globalCss, /background: #0f1117/);
  assert.match(globalCss, /\.dark \.dashboard-theme/);
  assert.match(globalCss, /--status-success-bg/);
  assert.match(globalCss, /--status-warning-bg/);
  assert.match(globalCss, /--status-danger-bg/);
  assert.match(globalCss, /recharts-cartesian-grid/);
  assert.match(globalCss, /recharts-default-tooltip/);
});
