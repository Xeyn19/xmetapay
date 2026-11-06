import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("tuition balances and tuition payments are connected without merging their ledgers", () => {
  const nav = read("app/admin/_components/tuition-workspace-nav.tsx");
  const balancesPage = read("app/admin/(dashboard)/tuition/page.tsx");
  const paymentsPage = read("app/admin/(dashboard)/collections/page.tsx");

  assert.match(nav, /aria-label="Tuition workspace"/);
  assert.match(nav, /Student balances/);
  assert.match(nav, /Payment history/);
  assert.match(nav, /href: "\/admin\/tuition"/);
  assert.match(nav, /href: "\/admin\/collections"/);
  assert.match(nav, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(nav, /min-\[520px\]:grid-cols-2/);
  assert.match(balancesPage, /<TuitionWorkspaceNav current="balances"/);
  assert.match(paymentsPage, /<TuitionWorkspaceNav current="payments"/);
  assert.match(balancesPage, /getAdminTuitionPageRealData/);
  assert.match(paymentsPage, /getAdminCollectionsPageRealData/);
});

test("tuition workspace uses clear finance labels and preserves route compatibility", () => {
  const metadata = read("app/admin/_data/admin-dashboard-data.ts");
  const realData = read("lib/admin/real-data.ts");
  const paymentTable = read("app/admin/(dashboard)/collections/collections-table.tsx");

  assert.match(metadata, /title: "Tuition balances"/);
  assert.match(metadata, /title: "Tuition payments"/);
  assert.match(metadata, /label: "Tuition balances", href: "\/admin\/tuition"/);
  assert.match(metadata, /label: "Tuition payments", href: "\/admin\/collections"/);
  for (const label of ["Total tuition billed", "Paid toward tuition", "Outstanding balance", "Student tuition records", "Payment records", "Total tuition collected", "Pending payments", "Failed or voided payments"]) {
    assert.match(realData, new RegExp(label));
  }
  assert.match(paymentTable, /Active payments/);
  assert.match(paymentTable, /Archived payments/);
  assert.match(paymentTable, /Applied to/);
  assert.match(paymentTable, /admin-collections-active\.xlsx/);
  assert.match(paymentTable, /admin-collections-archived\.xlsx/);
});

test("payment archive language explains that financial truth remains unchanged", () => {
  const page = read("app/admin/(dashboard)/collections/page.tsx");
  const table = read("app/admin/(dashboard)/collections/collections-table.tsx");
  const actions = read("app/admin/collections/actions.ts");

  assert.doesNotMatch(page, /Archiving only organizes this Admin view/);
  assert.match(table, /Archiving only organizes this Admin view\. It never deletes, reverses, or changes a payment/);
  assert.match(table, /Payment status, receipts, balances, allocations, and parent history stay unchanged/);
  assert.match(actions, /updateTuitionCollectionArchiveState/);
  assert.match(actions, /revalidatePath\("\/admin\/collections"\)/);
});

test("tuition balances and payments retain the existing finance permission boundary", () => {
  const permissions = read("lib/admin/permissions.ts");

  assert.match(permissions, /const financeAdminPaths = \[[\s\S]*"\/admin\/tuition"[\s\S]*"\/admin\/collections"/);
  assert.match(
    permissions,
    /export function canAccessFinance[\s\S]*?return normalizedRole === "school_administrator" \|\| normalizedRole === "finance_officer";\r?\n}/,
  );
});
