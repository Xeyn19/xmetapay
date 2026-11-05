import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("admin presentation primitives use semantic tokens and expose a shared workflow header", () => {
  const ui = read("app/admin/_components/admin-ui.tsx");

  assert.match(ui, /export function AdminWorkflowHeader/);
  assert.match(ui, /border-border bg-card/);
  assert.match(ui, /text-muted-foreground/);
  assert.match(ui, /focus-visible:ring-ring/);
  assert.match(ui, /title\?: string/);
  assert.match(ui, /detail\?: string/);
});

test("nested admin routes have task-specific page metadata", () => {
  const metadata = read("app/admin/_data/admin-dashboard-data.ts");
  const shell = read("app/admin/_components/admin-shell.tsx");

  assert.match(metadata, /"\/admin\/school-setup\/academics"/);
  assert.match(metadata, /"\/admin\/tuition\/schedules"/);
  assert.match(metadata, /"\/admin\/tuition\/assessments\/new"/);
  assert.match(metadata, /"\/admin\/tuition\/assessments\/result"/);
  assert.match(shell, /\^\\\/admin\\\/school-setup\\\/years\\\/\\d\+\$/);
  assert.match(shell, /\^\\\/admin\\\/tuition\\\/assessments\\\/\[\^\/\]\+\$/);
});

test("operational pages put primary tasks before supporting insights and review queues", () => {
  const students = read("app/admin/(dashboard)/students/page.tsx");
  const store = read("app/admin/(dashboard)/store-transactions/page.tsx");
  const reports = read("app/admin/(dashboard)/reports/page.tsx");

  assert.ok(students.indexOf("Student registry") < students.indexOf("Parent connection review"));
  assert.ok(students.indexOf("<StudentIntake") < students.indexOf("Parent connection review"));
  assert.ok(store.indexOf("Store transaction log") < store.indexOf("Spend by grade"));
  assert.ok(reports.indexOf("Downloadable reports") < reports.indexOf("Monthly revenue trend"));
});

test("record tables provide explicit search guidance, consistent reset controls, and filtered recovery", () => {
  const paths = [
    "app/admin/(dashboard)/students/students-table.tsx",
    "app/admin/(dashboard)/parents/parents-table.tsx",
    "app/admin/(dashboard)/other-fees/other-fees-table.tsx",
    "app/admin/(dashboard)/store-transactions/store-transactions-table.tsx",
  ];

  for (const path of paths) {
    const source = read(path);
    assert.match(source, /searchLabel="Search /, `${path} should explain searchable fields`);
    assert.match(source, /clearLabel="Reset filters"/, `${path} should use the shared reset label`);
    assert.match(source, /clearDisabled=/, `${path} should disable reset in the default state`);
    assert.match(source, /Reset filters/, `${path} should offer recovery when filters return no records`);
  }
});

test("archive workflows clear hidden selections and pending confirmations when their view changes", () => {
  for (const path of [
    "app/admin/(dashboard)/collections/collections-table.tsx",
    "app/admin/(dashboard)/allowance/allowance-table.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /const clearSelectionState = \(\) =>/);
    assert.match(source, /setSelectedIds\(\[\]\)/);
    assert.match(source, /setConfirmationIds\(\[\]\)/);
    assert.match(source, /clearSelectionState\(\)/);
    assert.match(source, /clearLabel="Reset filters"/);
  }
});
