# Production database migrations

This checklist records which migrations have been applied to production. ✅ means applied; ⬜ means pending.

- ✅ [2026-06-24-admin-school-link.sql](database/migrations/2026-06-24-admin-school-link.sql)
- ✅ [2026-06-25-auth-sessions.sql](database/migrations/2026-06-25-auth-sessions.sql)
- ✅ [2026-07-03-notification-message-body.sql](database/migrations/2026-07-03-notification-message-body.sql)
- ✅ [2026-07-03-tuition-payment-terms.sql](database/migrations/2026-07-03-tuition-payment-terms.sql)
- ✅ [2026-07-04-fee-type-term-templates.sql](database/migrations/2026-07-04-fee-type-term-templates.sql)
- ✅ [2026-07-08-operational-school-year-stamps.sql](database/migrations/2026-07-08-operational-school-year-stamps.sql)
- ✅ [2026-07-08-school-year-upcoming-status.sql](database/migrations/2026-07-08-school-year-upcoming-status.sql)
- ✅ [2026-07-09-super-admin-role.sql](database/migrations/2026-07-09-super-admin-role.sql)
- ✅ [2026-07-15-student-demographics-enrollment.sql](database/migrations/2026-07-15-student-demographics-enrollment.sql)
- ✅ [2026-07-18-notification-log-archive.sql](database/migrations/2026-07-18-notification-log-archive.sql)
- ✅ [2026-07-20-payment-collection-archive.sql](database/migrations/2026-07-20-payment-collection-archive.sql)
- ✅ [2026-07-20-wallet-ledger-archive.sql](database/migrations/2026-07-20-wallet-ledger-archive.sql)
- ✅ [2026-07-21-parent-fee-summary-archive.sql](database/migrations/2026-07-21-parent-fee-summary-archive.sql)
- ✅ [2026-07-22-parent-payment-history-archive.sql](database/migrations/2026-07-22-parent-payment-history-archive.sql)
- ✅ [2026-07-23-password-reset-otp.sql](database/migrations/2026-07-23-password-reset-otp.sql)
- ✅ [2026-07-24-parent-fee-permanent-hide.sql](database/migrations/2026-07-24-parent-fee-permanent-hide.sql)
- ✅ [2026-07-24-parent-payment-history-permanent-hide.sql](database/migrations/2026-07-24-parent-payment-history-permanent-hide.sql)
- ✅ [2026-07-25-wallet-top-up-batches.sql](database/migrations/2026-07-25-wallet-top-up-batches.sql)
- ✅ [2026-08-11-school-email-templates.sql](database/migrations/2026-08-11-school-email-templates.sql)
- ✅ [2026-09-02-parent-single-school-scope.sql](database/migrations/2026-09-02-parent-single-school-scope.sql)
- ⬜ [2026-09-19-parent-registration-approval.sql](database/migrations/2026-09-19-parent-registration-approval.sql)
- ⬜ [2026-09-21-enrollment-parent-email-links.sql](database/migrations/2026-09-21-enrollment-parent-email-links.sql)
- ⬜ [2026-11-03-tuition-assessment-workflow.sql](database/migrations/2026-11-03-tuition-assessment-workflow.sql)

## Tuition assessment migration notes

The Unified Philippine School Academic Setup feature does **not** add another SQL file. It uses `schools.education_scope` and the college academic tables already created by `2026-11-03-tuition-assessment-workflow.sql`. If that migration is already marked applied in your database, deploy the application changes only. If it is still pending, import the three pending migrations above in chronological order.

Apply the pending migrations in chronological order. The tuition assessment migration must run after the September 19 and September 21 migrations.

Before importing `2026-11-03-tuition-assessment-workflow.sql`:

1. Create a recoverable production database backup.
2. Confirm the September 19 and September 21 migrations completed successfully.
3. Put financial writes into a maintenance window so fee assignments or payments cannot change during the import.
4. Select the exact existing XMETA Pay database in phpMyAdmin; do not import the fresh-install production schema bundle over populated data.

The migration is designed to be rerunnable. It preserves historical assignments, backfills their deterministic keys as `legacy-fee:{feeTypeId}`, and does not create synthetic assessments for old charges.

After importing, verify that:

- `schools.education_scope` exists and existing schools default to `basic`.
- `student_fee_assignments.assignment_key` is populated and unique per student and school year.
- Academic, fee-schedule, assessment, credit, and assessment-payment-term tables exist.
- Existing fee assignments, tuition terms, payments, allocations, receipts, and reports still return their original records.
- The application build matching this migration is deployed before administrators use the new assessment routes.

Do not mark the migration as ✅ until the production import and verification checks are complete.

Created: September 21, 2026

Last updated: November 3, 2026
