import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const reminderActionsPath = "app/admin/reminders/actions.ts";
const mailerPath = "lib/email/mailer.ts";
const envExamplePath = ".env.example";
const packagePath = "package.json";
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

test("admin payment reminder action queues and sends real email reminders", () => {
  assert.equal(existsSync(reminderActionsPath), true);
  const actions = readFileSync(reminderActionsPath, "utf8");

  assert.match(actions, /"use server";/);
  assert.match(actions, /export async function sendPaymentReminderEmailsAction/);
  assert.match(actions, /await requireRole\("admin"\)/);
  assert.match(actions, /getAdminStaffRole/);
  assert.match(actions, /canAccessFinance\(staffRole\)/);
  assert.match(actions, /getResolvedAdminSchoolSetup/);
  assert.match(actions, /FROM student_fee_assignments sfa/);
  assert.match(actions, /JOIN student_guardians sg ON sg\.student_id = st\.id/);
  assert.match(actions, /u\.status = 'active'/);
  assert.match(actions, /u\.email AS parent_email/);
  assert.match(actions, /sfa\.status IN \('open', 'partial'\)/);
  assert.match(actions, /INSERT INTO notification_logs/);
  assert.match(actions, /message_body/);
  assert.match(actions, /:messageBody/);
  assert.match(actions, /reminderMessageFor\(row, options\)/);
  assert.match(actions, /customMessage/);
  assert.match(actions, /'payment_reminder', 'email', 'queued'/);
  assert.match(actions, /verifyEmailTransport\(\)/);
  assert.match(actions, /sendPaymentReminderEmail/);
  assert.match(actions, /updateReminderDeliveryStatus\(reminder\.notificationId, "sent"\)/);
  assert.match(actions, /updateReminderDeliveryStatus\(reminder\.notificationId, "failed"\)/);
  assert.match(actions, /sent_at = CASE WHEN :status = 'sent' THEN CURRENT_TIMESTAMP ELSE NULL END/);
  assert.match(actions, /No linked parents currently have open or partial balances/);
  assert.match(actions, /return actionToast\(/);
  assert.doesNotMatch(actions, /redirect\("\/admin\/tuition#payment-reminders"\)/);
});

test("payment reminder action blocks sent and recent queued rows while allowing failed retries", () => {
  const actions = readFileSync(reminderActionsPath, "utf8");

  assert.match(actions, /FROM notification_logs existing_reminder/);
  assert.match(actions, /existing_reminder\.school_id = :schoolId/);
  assert.match(actions, /existing_reminder\.recipient_user_id = sg\.parent_user_id/);
  assert.match(actions, /existing_reminder\.student_id = st\.id/);
  assert.match(actions, /existing_reminder\.type = 'payment_reminder'/);
  assert.match(actions, /existing_reminder\.channel = 'email'/);
  assert.match(actions, /DATE\(existing_reminder\.created_at\) = CURRENT_DATE/);
  assert.match(actions, /existing_reminder\.status = 'sent'/);
  assert.match(actions, /existing_reminder\.status = 'queued'/);
  assert.match(actions, /INTERVAL 15 MINUTE/);
  assert.match(actions, /Failed emails may be retried/);
  assert.match(actions, /countAvailableReminderTargets/);
  assert.match(actions, /eligibleTargetCount - availableTargetCount/);
  assert.match(actions, /each request is limited to 100 emails/);
  assert.doesNotMatch(actions, /existing_reminder\.status = 'failed'/);
});

test("nodemailer uses a server-only pooled SMTP transport and safe environment configuration", () => {
  assert.equal(existsSync(mailerPath), true);
  const mailer = readFileSync(mailerPath, "utf8");
  const envExample = readFileSync(envExamplePath, "utf8");
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

  assert.equal(typeof packageJson.dependencies.nodemailer, "string");
  assert.equal(typeof packageJson.devDependencies["@types/nodemailer"], "string");
  assert.match(mailer, /import "server-only"/);
  assert.match(mailer, /nodemailer\.createTransport/);
  assert.match(mailer, /pool: true/);
  assert.match(mailer, /maxConnections: 3/);
  assert.match(mailer, /rateLimit: 5/);
  assert.match(mailer, /emailTransport\.verify\(\)/);
  assert.match(mailer, /emailTransport\.sendMail/);
  assert.match(mailer, /escapeHtml/);
  assert.match(mailer, /SMTP_HOST/);
  assert.match(mailer, /SMTP_PASSWORD/);
  assert.match(mailer, /APP_BASE_URL/);
  assert.match(envExample, /SMTP_HOST=smtp\.gmail\.com/);
  assert.match(envExample, /SMTP_PORT=465/);
  assert.match(envExample, /SMTP_PASSWORD=\r?\n/);
  assert.doesNotMatch(envExample, /SMTP_PASSWORD=\S+/);
});

test("tuition page exposes real reminder logging and reminder history", () => {
  const page = readFileSync(tuitionPagePath, "utf8");
  const form = readFileSync(tuitionReminderFormPath, "utf8");
  const historyTable = readFileSync(tuitionReminderHistoryTablePath, "utf8");
  const realData = readFileSync(realDataPath, "utf8");

  assert.match(page, /<PaymentReminderForm \/>/);
  assert.match(page, /<PaymentReminderHistoryTable rows=\{data\.reminderRows\} \/>/);
  assert.match(form, /useActionState\(async \(previousState: ReminderActionState, formData: FormData\)/);
  assert.match(form, /sendPaymentReminderEmailsAction\(previousState, formData\)/);
  assert.match(form, /toast\.success/);
  assert.match(form, /toast\.error/);
  assert.match(form, /toast\.info/);
  assert.match(form, /Send payment reminder emails/);
  assert.match(form, /name="sendTo"/);
  assert.match(form, /All parents with unpaid fees/);
  assert.match(form, /Parents with overdue tuition only/);
  assert.match(form, /Specific student/);
  assert.match(form, /name="studentReference"/);
  assert.match(form, /name="reminderType"/);
  assert.match(form, /Tuition due reminder/);
  assert.match(form, /Overdue notice/);
  assert.match(form, /Final notice/);
  assert.doesNotMatch(form, /name="channel"/);
  assert.doesNotMatch(form, /SMS \+ Email/);
  assert.doesNotMatch(form, /SMS only/);
  assert.match(form, /Emails are sent immediately to linked parent email addresses/);
  assert.match(form, /name="customMessage"/);
  assert.match(form, /Custom message text is saved in reminder history/);
  assert.match(historyTable, /usePaginatedRows\(rows, "payment-reminders"\)/);
  assert.match(historyTable, /DashboardTablePagination/);
  assert.match(historyTable, /Message/);
  assert.match(historyTable, /title=\{message\}/);
  assert.match(page, /id="payment-reminders"/);
  assert.match(page, /<DashboardCard\s+id="payment-reminders"/);
  assert.match(page, /className="mb-\[18px\] scroll-mt-24"/);
  assert.match(form, /Send email reminders/);
  assert.match(form, /Sending emails/);
  assert.match(page, /records each delivery result/);
  assert.match(page, /SMS delivery remains future/);
  assert.match(page, /data\.reminderRows/);
  assert.match(realData, /reminderRows: Array/);
  assert.match(realData, /async function getRecentReminderRows/);
  assert.match(realData, /FROM notification_logs nl/);
  assert.match(realData, /nl\.message_body/);
  assert.match(realData, /Default reminder/);
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

test("docs and visual plans mark real email reminders current and SMS future", () => {
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
  assert.match(combinedDocs, /Nodemailer|SMTP/i);
  assert.match(combinedDocs, /message_body/);
  assert.match(combinedDocs, /channel = [`']?email|email.*channel/i);
  assert.match(combinedDocs, /once per day|same-day/i);
  assert.match(combinedDocs, /SMS.*future|future.*SMS/i);
  assert.match(combinedDocs, /sent_at/);
});
