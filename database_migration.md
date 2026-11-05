# Production database migrations

This checklist records which migrations have been applied to production. ✅ means applied; ⬜ means pending.

> **Admin dashboard UI/UX organization (2026-11-05):** no SQL file is required. The redesign changes presentation, responsive navigation, table controls, page hierarchy, and selection safety only. It does not add or alter database tables, columns, indexes, records, Server Action payloads, or financial logic. Keep the migration checklist below unchanged.

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
- ⬜ [2026-11-04-senior-high-offerings.sql](database/migrations/2026-11-04-senior-high-offerings.sql)
- ⬜ [2026-11-04-parent-student-claim-requests.sql](database/migrations/2026-11-04-parent-student-claim-requests.sql)

## Tuition assessment and Senior High migration notes

The transition-aware Senior High setup adds `2026-11-04-senior-high-offerings.sql`. Import it after the tuition-assessment migration. It creates school-year/grade offerings and a nullable section relationship; existing K–12 sections and enrollments are preserved.

### SQL to import for this feature

For an **existing database** that already has the tuition-assessment tables, import only:

```text
database/migrations/2026-11-04-senior-high-offerings.sql
```

If `2026-11-03-tuition-assessment-workflow.sql` is still pending, import these in order:

1. `database/migrations/2026-11-03-tuition-assessment-workflow.sql`
2. `database/migrations/2026-11-04-senior-high-offerings.sql`

For a **new empty database**, do not import the individual migration. Import the regenerated schema-only bundle:

```text
utilities/database/xmetapay-production-schema.sql
```

The Senior High migration is additive and rerunnable. It does not delete, rename, or automatically reclassify existing Grade 11/12 sections. Existing sections keep a null offering link until the administrator assigns them to a configured Senior High offering.

## Parent student claim and connection-request migration

### SQL to import for this feature

For an **existing database** where the September Parent migrations are already applied, import only:

```text
database/migrations/2026-11-04-parent-student-claim-requests.sql
```

If the required Parent migrations are still pending, import these files into the **same existing database** in this order:

1. `database/migrations/2026-09-19-parent-registration-approval.sql`
2. `database/migrations/2026-09-21-enrollment-parent-email-links.sql`
3. `database/migrations/2026-11-04-parent-student-claim-requests.sql`

For a **new empty database**, do not import these migrations individually. Import the regenerated schema-only bundle instead:

```text
utilities/database/xmetapay-production-schema.sql
```

The Parent claim migration adds only `parent_student_link_requests`, the auditable approval queue used when an active Parent requests another student connection and the school has not already recorded the Parent email for that student. Parent registration now infers the school from the exact student reference, first name, and last name; that registration refinement reuses existing tables. The migration is additive, rerunnable, and does not modify existing Parent, student, guardian, financial, or historical rows.

After importing, confirm that `parent_student_link_requests` appears in phpMyAdmin. Keep the checklist entry marked ⬜ until the actual target database has been imported and verified; then change only that entry to ✅.

Apply the pending migrations in chronological order. The tuition assessment migration must run after the September 19 and September 21 migrations, the Senior High migration must run after tuition assessment, and the Parent claim-request migration must run before deploying the new Parent dashboard connection form.

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
- `senior_high_offerings` exists and `sections.senior_high_offering_id` is nullable for legacy compatibility.
- Grade 11 and Grade 12 setup can save Strengthened SHS tracks or legacy tracks/strands with their own sections.
- `parent_student_link_requests` exists, and a non-email-matched Parent dashboard claim appears for the correct school administrator without creating a `student_guardians` row before approval.

Do not mark the migration as ✅ until the production import and verification checks are complete.

Created: September 21, 2026

## Tuition balances and payments UX organization

No new SQL file is required for the connected **Tuition balances** and **Tuition payments** workspace. This change only updates navigation, labels, page organization, and visible export titles while preserving the existing `/admin/tuition` and `/admin/collections` routes, queries, payment records, allocations, receipts, archive metadata, and export filenames.

Do not import or re-import the production schema for this UI refinement. Existing databases continue using their current migration state, and new empty databases still follow the normal schema-bundle instructions above.

Last updated: November 5, 2026
