import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const parentUi = readFileSync("app/parent/_components/parent-ui.tsx", "utf8");
const dashboard = readFileSync("app/parent/(portal)/dashboard/page.tsx", "utf8");
const walletTopUp = readFileSync("app/parent/(portal)/wallet/wallet-top-up-form.tsx", "utf8");
const feeTable = readFileSync("app/parent/(portal)/fees/fees-table.tsx", "utf8");
const historyTable = readFileSync("app/parent/(portal)/history/history-table.tsx", "utf8");

test("parent interactive rows and cards use contrast-safe semantic theme states", () => {
  assert.match(parentUi, /hover:bg-muted/);
  assert.match(parentUi, /selected\s*\?\s*"border-\[#e64a19\] bg-accent text-accent-foreground"/);
  assert.match(dashboard, /transition hover:bg-muted/);
  assert.match(walletTopUp, /selected \? "border-\[#e64a19\] bg-accent" : "border-border bg-card hover:bg-muted"/);
});

test("parent table tabs, actions, and dialogs use semantic surfaces in both themes", () => {
  for (const source of [feeTable, historyTable]) {
    assert.match(source, /bg-card text-foreground shadow-sm/);
    assert.match(source, /hover:bg-muted hover:text-foreground/);
    assert.match(source, /border border-border bg-card/);
  }
});

test("parent portal no longer uses pale hard-coded interactive backgrounds", () => {
  const parentSources = [parentUi, dashboard, walletTopUp, feeTable, historyTable];
  const unsafeState = /#fff7f4|#fff5f2|#fff1f1|#fffaf7|hover:bg-\[#f8|hover:bg-\[#f2|hover:bg-white/;

  for (const source of parentSources) {
    assert.doesNotMatch(source, unsafeState);
  }
});
