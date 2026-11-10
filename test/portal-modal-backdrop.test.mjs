import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const portalDialogFiles = [
  "app/admin/_components/school-year-activation-control.tsx",
  "app/admin/_components/school-setup-management-modals.tsx",
  "app/admin/_components/school-academic-offering-control.tsx",
  "app/admin/(dashboard)/tuition/tuition-report-table.tsx",
  "app/admin/(dashboard)/tuition/payment-reminder-message-dialog.tsx",
  "app/admin/(dashboard)/tuition/payment-reminder-history-table.tsx",
  "app/admin/(dashboard)/tuition/payment-reminder-form.tsx",
  "app/admin/(dashboard)/store-transactions/store-action-modal.tsx",
  "app/admin/(dashboard)/other-fees/other-fees-management-modal.tsx",
  "app/admin/(dashboard)/collections/collections-table.tsx",
  "app/admin/(dashboard)/allowance/allowance-table.tsx",
  "app/admin/(dashboard)/student-profile/student-profile-edit-modal.tsx",
  "app/admin/(dashboard)/students/student-intake.tsx",
  "app/admin/(dashboard)/students/enroll-existing-student-modal.tsx",
  "app/admin/(dashboard)/students/single-student-enrollment-modal.tsx",
  "app/admin/(dashboard)/students/bulk-student-enrollment-modal.tsx",
  "app/admin/(dashboard)/school-setup/email-template-library.tsx",
  "app/parent/(portal)/history/history-table.tsx",
  "app/parent/(portal)/fees/fees-table.tsx",
  "app/parent/(portal)/wallet/wallet-top-up-form.tsx",
];

test("portal dialogs share one theme-safe dark backdrop", () => {
  const globals = read("app/globals.css");
  assert.match(globals, /--dialog-backdrop: rgb\(11 15 23 \/ 0\.52\)/);
  assert.match(globals, /--dialog-backdrop: rgb\(3 6 12 \/ 0\.64\)/);
  assert.match(globals, /\.portal-dialog-backdrop\s*\{[^}]*background-color: var\(--dialog-backdrop\)/s);
  assert.match(globals, /backdrop-filter: blur\(2px\)/);

  for (const path of portalDialogFiles) {
    const source = read(path);
    assert.match(source, /portal-dialog-backdrop/, `${path} should use the shared portal backdrop`);
    assert.doesNotMatch(source, /fixed inset-0[^"\n]*(?:bg-foreground\/45|bg-black\/45|bg-\[#0f1117\]|bg-\[#050812\])/, `${path} should not keep a one-off dialog backdrop`);
  }
});

test("navigation overlays stay separate from dialog backdrops", () => {
  for (const path of [
    "app/admin/_components/admin-shell.tsx",
    "app/parent/_components/parent-shell.tsx",
    "app/super-admin/_components/super-admin-shell.tsx",
  ]) {
    assert.doesNotMatch(read(path), /portal-dialog-backdrop/);
  }
});
