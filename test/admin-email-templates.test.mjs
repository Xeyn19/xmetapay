import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const migrationPath = "database/migrations/2026-08-11-school-email-templates.sql";
const migration = read(migrationPath);
const fullSchema = read("database/full-schema-v1.sql");
const contract = read("lib/email/template-contract.ts");
const service = read("lib/email/templates.ts");
const actions = read("app/admin/email-templates/actions.ts");
const setupPage = read("app/admin/(dashboard)/school-setup/page.tsx");
const library = read("app/admin/(dashboard)/school-setup/email-template-library.tsx");
const reminderForm = read("app/admin/(dashboard)/tuition/payment-reminder-form.tsx");
const reminderActions = read("app/admin/reminders/actions.ts");
const mailer = read("lib/email/mailer.ts");
const realData = read("lib/admin/real-data.ts");

test("email template migration and fresh schema preserve school ownership and reminder audit", () => {
  assert.equal(existsSync(migrationPath), true);
  for (const sql of [migration, fullSchema]) {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS school_email_templates/);
    assert.match(sql, /school_id BIGINT UNSIGNED NOT NULL/);
    assert.match(sql, /reminder_type ENUM\('tuition_due', 'overdue_notice', 'final_notice'\)/);
    assert.match(sql, /subject_template VARCHAR\(220\) NOT NULL/);
    assert.match(sql, /message_template TEXT NOT NULL/);
    assert.match(sql, /uq_school_email_templates_name \(school_id, name\)/);
    assert.match(sql, /email_template_id BIGINT UNSIGNED NULL/);
    assert.match(sql, /email_template_name VARCHAR\(120\) NULL/);
    assert.match(sql, /subject_line VARCHAR\(220\) NULL/);
    assert.match(sql, /ON DELETE SET NULL/);
  }
  assert.match(migration, /information_schema\.COLUMNS/);
  assert.match(migration, /information_schema\.STATISTICS/);
  assert.match(migration, /information_schema\.TABLE_CONSTRAINTS/);
  assert.doesNotMatch(migration, /SMTP_PASSWORD|DELETE FROM notification_logs/);
});

test("template contracts provide protected defaults and allowlisted escaped rendering inputs", () => {
  assert.match(contract, /builtInPaymentReminderTemplates/);
  assert.match(contract, /Friendly payment reminder/);
  assert.match(contract, /Overdue payment notice/);
  assert.match(contract, /Final payment notice/);
  assert.match(contract, /emailTemplateVariableKeys/);
  assert.match(contract, /parent_name/);
  assert.match(contract, /total_outstanding/);
  assert.match(contract, /unsupportedEmailTemplateVariables/);
  assert.doesNotMatch(contract, /<script|dangerouslySetInnerHTML/);
});

test("server-only template service scopes templates to a school and serializes default changes", () => {
  assert.match(service, /import "server-only"/);
  assert.match(service, /WHERE id = :templateId\s+AND school_id = :schoolId/);
  assert.match(service, /SELECT id FROM schools WHERE id = :schoolId LIMIT 1 FOR UPDATE/);
  assert.match(service, /SET is_default = 0/);
  assert.match(service, /status = 'active'/);
  assert.match(service, /EmailTemplateValidationError/);
  assert.match(service, /Unsupported placeholder/);
  assert.doesNotMatch(service, /process\.env|SMTP_PASSWORD/);
});

test("only school administrators manage templates while finance staff select active templates", () => {
  assert.match(actions, /await requireRole\("admin"\)/);
  assert.match(actions, /canManageSchoolSetup\(staffRole\)/);
  assert.match(actions, /saveSchoolEmailTemplate/);
  assert.match(actions, /setSchoolEmailTemplateStatus/);
  assert.match(setupPage, /<EmailTemplateLibrary library=\{emailTemplateLibrary\} \/>/);
  assert.match(library, /Create template/);
  assert.match(library, /Protected XMETA templates/);
  assert.match(library, /School templates/);
  assert.match(library, /Copy/);
  assert.match(library, /Preview/);
  assert.match(library, /min-h-11/);
  assert.doesNotMatch(library, /SMTP_HOST|SMTP_PASSWORD|type="password"/);
});

test("reminder delivery resolves templates on the server and snapshots sent content", () => {
  assert.match(reminderForm, /name="templateReference"/);
  assert.match(reminderForm, /Preview selected template/);
  assert.match(reminderForm, /One-time message override/);
  assert.match(reminderActions, /resolvePaymentReminderTemplate/);
  assert.match(reminderActions, /renderEmailTemplateText/);
  assert.match(reminderActions, /email_template_id, email_template_name, subject_line/);
  assert.match(reminderActions, /subjectLine: reminder\.subjectLine/);
  assert.match(mailer, /subject: reminder\.subjectLine/);
  assert.match(realData, /nl\.email_template_name, nl\.subject_line/);
});
