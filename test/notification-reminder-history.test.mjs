import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const reminderActionsPath = "app/admin/reminders/actions.ts";
const tuitionPagePath = "app/admin/(dashboard)/tuition/page.tsx";
const tuitionReminderFormPath = "app/admin/(dashboard)/tuition/payment-reminder-form.tsx";
const tuitionReminderHistoryTablePath = "app/admin/(dashboard)/tuition/payment-reminder-history-table.tsx";
const realDataPath = "lib/admin/real-data.ts";
const permissionsPath = "lib/admin/permissions.ts";
const adminShellPath = "app/admin/_components/admin-shell.tsx";
const adminUiPath = "app/admin/_components/admin-ui.tsx";
const checklistPath = "docs/CHECKLIST.md";
const flowchartsPath = "docs/PROJECT_FLOWCHARTS.md";
const schemaPlanPath = "docs/DATABASE_SCHEMA_PLAN.md";
const schemaExplanationPath = "docs/DATABASE_SCHEMA_EXPLANATION.md";
const visualFlowchartsPath = "public/PROJECT_FLOWCHARTS_VISUAL.html";
const visualSchemaPath = "public/DATABASE_SCHEMA_VISUAL_PLAN.html";

test("admin payment reminder action writes queued notification log rows", () => {
  assert.equal(existsSync(reminderActionsPath), true);
  const actions = readFileSync(reminderActionsPath, "utf8");

  assert.match(actions, /"use server";/);
  assert.match(actions, /export async function logPaymentRemindersAction/);
  assert.match(actions, /await requireRole\("admin"\)/);
  assert.match(actions, /getAdminStaffRole/);
  assert.match(actions, /canAccessFinance\(staffRole\)/);
  assert.match(actions, /getResolvedAdminSchoolSetup/);
  assert.match(actions, /FROM student_fee_assignments sfa/);
  assert.match(actions, /JOIN student_guardians sg ON sg\.student_id = st\.id/);
  assert.match(actions, /u\.status = 'active'/);
  assert.match(actions, /sfa\.status IN \('open', 'partial'\)/);
  assert.match(actions, /INSERT INTO notification_logs/);
  assert.match(actions, /'payment_reminder', 'in_app', 'queued'/);
  assert.match(actions, /No linked parents currently have open or partial balances/);
  assert.match(actions, /return actionToast\(/);
  assert.doesNotMatch(actions, /redirect\("\/admin\/tuition#payment-reminders"\)/);
});

test("payment reminder action skips same-day duplicate reminder logs", () => {
  const actions = readFileSync(reminderActionsPath, "utf8");

  assert.match(actions, /LEFT JOIN notification_logs existing_reminder/);
  assert.match(actions, /existing_reminder\.school_id = :schoolId/);
  assert.match(actions, /existing_reminder\.recipient_user_id = sg\.parent_user_id/);
  assert.match(actions, /existing_reminder\.student_id = st\.id/);
  assert.match(actions, /existing_reminder\.type = 'payment_reminder'/);
  assert.match(actions, /existing_reminder\.channel = 'in_app'/);
  assert.match(actions, /DATE\(existing_reminder\.created_at\) = CURRENT_DATE/);
  assert.match(actions, /existing_reminder\.id IS NULL/);
  assert.match(actions, /Reminders already logged today/);
  assert.match(actions, /Each linked parent with an open balance already has a reminder for today\./);
});

test("tuition page exposes real reminder logging and reminder history", () => {
  const page = readFileSync(tuitionPagePath, "utf8");
  const form = readFileSync(tuitionReminderFormPath, "utf8");
  const historyTable = readFileSync(tuitionReminderHistoryTablePath, "utf8");
  const realData = readFileSync(realDataPath, "utf8");

  assert.match(page, /<PaymentReminderForm \/>/);
  assert.match(page, /<PaymentReminderHistoryTable rows=\{data\.reminderRows\} \/>/);
  assert.match(form, /useActionState\(logPaymentRemindersAction, initialReminderActionState\)/);
  assert.match(form, /toast\.success/);
  assert.match(form, /toast\.error/);
  assert.match(historyTable, /usePaginatedRows\(rows, "payment-reminders"\)/);
  assert.match(historyTable, /DashboardTablePagination/);
  assert.match(page, /id="payment-reminders"/);
  assert.match(page, /<DashboardCard\s+id="payment-reminders"/);
  assert.match(page, /className="mb-\[18px\] scroll-mt-24"/);
  assert.match(form, /Log reminders/);
  assert.match(page, /Real email and SMS delivery are still future/);
  assert.match(page, /data\.reminderRows/);
  assert.match(realData, /reminderRows: Array/);
  assert.match(realData, /async function getRecentReminderRows/);
  assert.match(realData, /FROM notification_logs nl/);
  assert.match(realData, /nl\.type = 'payment_reminder'/);
  assert.match(realData, /LEFT JOIN users u ON u\.id = nl\.recipient_user_id/);
  assert.match(realData, /LEFT JOIN students st ON st\.id = nl\.student_id/);
});

test("tuition reminder history uses stable notification ids as React keys", () => {
  const historyTable = readFileSync(tuitionReminderHistoryTablePath, "utf8");
  const realData = readFileSync(realDataPath, "utf8");

  assert.match(realData, /nl\.id AS notification_id/);
  assert.match(realData, /notificationId/);
  assert.match(historyTable, /notificationId/);
  assert.match(historyTable, /<tr key=\{notificationId\}>/);
  assert.doesNotMatch(historyTable, /key=\{`\$\{created\}-\$\{student\}-\$\{parent\}`\}/);
});

test("admin activity feed timeline uses stable notification ids as React keys", () => {
  const realData = readFileSync(realDataPath, "utf8");
  const adminUi = readFileSync(adminUiPath, "utf8");

  assert.match(realData, /export type TimelineRow = \{/);
  assert.match(realData, /id: number;/);
  assert.match(realData, /SELECT id, type, channel, status, created_at, sent_at/);
  assert.match(realData, /id: row\.id/);
  assert.match(adminUi, /items: Array<\{ id: number; title: string; detail: string; time: string; tone: "orange" \| "green" \| "gray" \}>/);
  assert.match(adminUi, /<div key=\{item\.id\}/);
  assert.doesNotMatch(adminUi, /key=\{item\.title\}/);
});

test("admin reminder navigation is finance-scoped instead of future-only", () => {
  const permissions = readFileSync(permissionsPath, "utf8");
  const shell = readFileSync(adminShellPath, "utf8");

  assert.match(permissions, /action: "add_student" \| "record_payment" \| "send_reminder"/);
  assert.match(permissions, /return canAccessFinance\(role\);/);
  assert.match(shell, /canSendReminders/);
  assert.match(shell, /\/admin\/tuition#payment-reminders/);
  assert.match(shell, />\s*Reminders\s*</);
  assert.doesNotMatch(shell, /Reminders future/);
});

test("docs and visual plans mark reminder history current and notification sending future", () => {
  const combinedDocs = [
    checklistPath,
    flowchartsPath,
    schemaPlanPath,
    schemaExplanationPath,
    visualFlowchartsPath,
    visualSchemaPath,
  ].map((path) => readFileSync(path, "utf8")).join("\n");

  assert.match(combinedDocs, /notification_logs/);
  assert.match(combinedDocs, /payment reminder/i);
  assert.match(combinedDocs, /reminder history/i);
  assert.match(combinedDocs, /queued in-app/i);
  assert.match(combinedDocs, /once per day|same-day/i);
  assert.match(combinedDocs, /email and SMS delivery.*future|future.*email and SMS delivery/i);
});
