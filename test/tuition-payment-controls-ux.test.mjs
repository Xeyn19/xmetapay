import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("shared table controls provide a backward-compatible compact filter and export mode", () => {
  const controls = read("app/_components/table-controls.tsx");

  assert.match(controls, /layout\?: "expanded" \| "compact"/);
  assert.match(controls, /layout = "expanded"/);
  assert.match(controls, /activeFilterCount\?: number/);
  assert.match(controls, /filterTitle\?: string/);
  assert.match(controls, /filterDescription\?: string/);
  assert.match(controls, /import \{ Menu \} from "@base-ui\/react\/menu"/);
  assert.match(controls, /import \{ Popover \} from "@base-ui\/react\/popover"/);
  assert.match(controls, /<Popover\.Title[^>]*>\{filterTitle\}/);
  assert.match(controls, /<Menu\.Item[\s\S]*Export Excel/);
  assert.match(controls, /<Menu\.Item[\s\S]*Export PDF/);
  assert.match(controls, /w-\[min\(20rem,calc\(100vw-2rem\)\)\]/);
});

test("tuition payments keep important controls while hiding secondary actions until needed", () => {
  const page = read("app/admin/(dashboard)/collections/page.tsx");
  const table = read("app/admin/(dashboard)/collections/collections-table.tsx");

  assert.match(table, /Active payments/);
  assert.match(table, /Archived payments/);
  assert.match(table, /searchPlaceholder="Search payments\.\.\."/);
  assert.match(table, /label: "Status"/);
  assert.match(table, /label: "Channel"/);
  assert.match(table, /layout="compact"/);
  assert.match(table, /aria-label="Select all visible payments"/);
  assert.match(table, /validSelectedIds\.length > 0/);
  assert.match(table, /\{operationLabel\} selected/);
  assert.doesNotMatch(table, /> Select visible/);
  assert.doesNotMatch(page, /Archiving only organizes this Admin view/);
  assert.match(table, /role="alertdialog"/);
  assert.match(table, /never deletes, reverses, or changes a payment/);
});

test("AdminTable accepts keyed React-node headers without breaking string headers", () => {
  const adminUi = read("app/admin/_components/admin-ui.tsx");

  assert.match(adminUi, /headers: Array<\{ key\?: string; label: ReactNode; className\?: string \}>/);
  assert.match(adminUi, /header\.key \?\?/);
});
