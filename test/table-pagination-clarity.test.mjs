import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controls = readFileSync("app/_components/table-controls.tsx", "utf8");

test("pagination hides inert row and navigation controls for five or fewer records", () => {
  assert.match(controls, /hasUsefulPagination = totalItems > TABLE_PAGE_SIZE_OPTIONS\[0\]/);
  assert.match(controls, /Total: \{totalItems\} records/);
  assert.match(controls, /hasMultiplePages = pageCount > 1/);
  assert.match(controls, /\{hasUsefulPagination \? <div/);
});

test("pagination keeps row size and previous-next navigation for larger result sets and supports all rows", () => {
  assert.match(controls, /aria-label="Rows per page"/);
  assert.match(controls, /option === ALL_TABLE_ROWS \? "All" : option/);
  assert.match(controls, /showAllRows = pageSize === ALL_TABLE_ROWS/);
  assert.match(controls, /effectivePageSize = showAllRows \? Math\.max\(rows\.length, 1\) : pageSize/);
  assert.match(controls, /onPageChange\(page - 1\)/);
  assert.match(controls, /onPageChange\(page \+ 1\)/);
  assert.match(controls, /disabled=\{page >= pageCount\}/);
});
