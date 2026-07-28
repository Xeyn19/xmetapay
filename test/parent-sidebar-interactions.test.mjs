import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const navData = readFileSync("app/parent/_data/parent-portal-data.ts", "utf8");
const parentShell = readFileSync("app/parent/_components/parent-shell.tsx", "utf8");

test("parent sidebar centralizes active routes for every nested portal flow", () => {
  assert.match(navData, /isParentNavItemActive/);
  assert.match(navData, /\{ path: "\/parent\/receipt" \}/);
  assert.match(navData, /\{ path: "\/parent\/wallet", match: "prefix" \}/);
  assert.match(navData, /\{ path: "\/parent\/students", match: "descendant" \}/);
  assert.match(navData, /pathname\.startsWith\(`\$\{path\}\/`\)/);
  assert.match(parentShell, /isParentNavItemActive\(pathname, item\)/);
});

test("parent navigation exposes consistent hover, press, focus, and current-page states", () => {
  assert.match(parentShell, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(parentShell, /min-h-11/);
  assert.match(parentShell, /hover:bg-sidebar-accent/);
  assert.match(parentShell, /active:scale-\[0\.98\]/);
  assert.match(parentShell, /active:border-sidebar-ring/);
  assert.match(parentShell, /focus-visible:ring-sidebar-ring/);
  assert.match(parentShell, /active && "border-sidebar-ring bg-sidebar-primary/);
});
