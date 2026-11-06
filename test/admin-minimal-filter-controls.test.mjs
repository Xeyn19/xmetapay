import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("requested admin record lists use the shared compact minimal controls", () => {
  const paths = [
    "app/admin/(dashboard)/tuition/tuition-report-table.tsx",
    "app/admin/(dashboard)/students/students-table.tsx",
    "app/admin/(dashboard)/student-profile/admin-student-profile-view.tsx",
    "app/admin/(dashboard)/parents/parents-table.tsx",
    "app/admin/(dashboard)/parents/registration-requests-table.tsx",
    "app/admin/(dashboard)/parents/student-link-requests-table.tsx",
    "app/admin/(dashboard)/allowance/allowance-table.tsx",
    "app/admin/(dashboard)/store-transactions/store-transactions-table.tsx",
  ];

  for (const path of paths) {
    const source = read(path);
    assert.match(source, /layout="compact"/, `${path} should use compact controls`);
    assert.match(source, /activeFilterCount=/, `${path} should expose active filter state`);
    assert.match(source, /filterTitle=/, `${path} should name its filter panel`);
  }
});

test("compact controls keep secondary filters and export formats progressively disclosed", () => {
  const controls = read("app/_components/table-controls.tsx");

  assert.match(controls, /filterTitle = "Filter records"/);
  assert.match(controls, /filterDescription\?: string/);
  assert.match(controls, /<Popover\.Trigger/);
  assert.match(controls, /activeFilterCount > 0/);
  assert.match(controls, /<Menu\.Trigger/);
  assert.match(controls, /Export Excel/);
  assert.match(controls, /Export PDF/);
  assert.match(controls, /!clearDisabled \? \(/);
});

test("minimal lists remove duplicate counts while preserving filtered recovery", () => {
  for (const path of [
    "app/admin/(dashboard)/students/students-table.tsx",
    "app/admin/(dashboard)/student-profile/admin-student-profile-view.tsx",
    "app/admin/(dashboard)/parents/parents-table.tsx",
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /shown<\/p>/);
    assert.match(source, /No .* match the current filters/);
    assert.match(source, /Reset filters/);
  }

  const registration = read("app/admin/(dashboard)/parents/registration-requests-table.tsx");
  assert.doesNotMatch(registration, /Export CSV/);
});

test("student connection requests support compact search filters pagination and review actions", () => {
  const source = read("app/admin/(dashboard)/parents/student-link-requests-table.tsx");

  assert.match(source, /Search student connection requests by parent, student, email, or reference/);
  assert.match(source, /label: "Request status"/);
  assert.match(source, /usePaginatedRows/);
  assert.match(source, /DashboardTablePagination/);
  assert.match(source, /reviewParentStudentLinkRequestAction/);
  assert.match(source, /name="decision" value="approve"/);
  assert.match(source, /name="decision" value="reject"/);
});

test("allowance and reminder bulk actions stay contextual with header selection", () => {
  const allowance = read("app/admin/(dashboard)/allowance/allowance-table.tsx");
  const reminders = read("app/admin/(dashboard)/tuition/payment-reminder-history-table.tsx");

  assert.match(allowance, /aria-label="Select all visible allowance wallets"/);
  assert.match(allowance, /indeterminate = somePageRowsSelected/);
  assert.match(allowance, /validSelectedIds\.length > 0/);
  assert.doesNotMatch(allowance, /SegmentedTabs/);
  assert.match(reminders, /aria-label="Select all visible reminders"/);
  assert.match(reminders, /indeterminate = somePageRowsSelected/);
  assert.match(reminders, /selectedIds\.length > 0/);
  assert.doesNotMatch(reminders, /> Select visible/);
});

test("financial reports use one accessible download menu per report", () => {
  const page = read("app/admin/(dashboard)/reports/page.tsx");
  const menu = read("app/admin/(dashboard)/reports/report-download-menu.tsx");

  assert.match(page, /ReportDownloadMenu/);
  assert.doesNotMatch(page, /ReportDownloadLink/);
  assert.match(menu, /Menu\.Root/);
  assert.match(menu, /Menu\.LinkItem/);
  assert.match(menu, /Download .* as Excel/);
  assert.match(menu, /Download .* as PDF/);
});
