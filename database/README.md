# XMETA Pay Database Setup

Use these SQL files for local XAMPP/phpMyAdmin setup.

## Import Order

1. Import `auth-schema.sql` first.
   - Creates `xmetapay_db`.
   - Creates authentication tables for users, admin profiles, and parent profiles.
2. Import `full-schema-v1.sql` second.
   - Adds the MVP project tables for schools, students, enrollment, fees, payments, receipts, wallets, store/canteen transactions, and notifications.
   - Assumes the auth tables already exist because some records reference `users.id`.
3. If `full-schema-v1.sql` was already imported before the admin-school link was added, import `migrations/2026-06-24-admin-school-link.sql`.
   - Adds `admin_profiles.school_id`.
   - Adds the index and foreign key from admin profiles to `schools.id`.
   - This migration is guarded so it can safely report that each piece already exists.
4. If `full-schema-v1.sql` was already imported before reminder message storage was added, import `migrations/2026-07-03-notification-message-body.sql`.
   - Adds `notification_logs.message_body`.
   - Keeps old reminder history rows.
   - This migration is guarded so it can safely report that the column already exists.
5. If `full-schema-v1.sql` was already imported before tuition installment terms were added, import `migrations/2026-07-03-tuition-payment-terms.sql`.
   - Adds `tuition_payment_terms`.
   - Adds `payment_term_allocations`.
   - Keeps existing tuition assignments and payment history.
6. If `full-schema-v1.sql` was already imported before fee type term templates were added, import `migrations/2026-07-04-fee-type-term-templates.sql`.
   - Adds `fee_type_term_templates`.
   - Keeps a reserved table for future reusable installment templates.
   - Current MVP term setup is done per student tuition assignment through Manage terms.
7. If `full-schema-v1.sql` was already imported before multi-year setup was added, import `migrations/2026-07-08-school-year-upcoming-status.sql`.
   - Adds the `upcoming` school year status.
   - Lets a school prepare future school years while keeping one active year for live dashboard work.
8. If `full-schema-v1.sql` was already imported before school-year record isolation was added, import `migrations/2026-07-08-operational-school-year-stamps.sql`.
   - Adds nullable `school_year_id` stamps to payments, wallet transactions, store transactions, and notification logs.
   - Adds indexes and foreign keys for faster selected-year dashboard/report filtering.
   - Existing local history stays valid; new app writes save the active school year.
9. If `auth-schema.sql` was already imported before company super admin access was added, import `migrations/2026-07-09-super-admin-role.sql`.
   - Adds the `super_admin` auth role to `users` and `auth_sessions`.
   - Required before importing the temporary local super admin seed SQL.
10. If `full-schema-v1.sql` was already imported before student demographics and enrollment types were added, import `migrations/2026-07-15-student-demographics-enrollment.sql`.
   - Adds nullable `students.sex` and `enrollments.student_type` columns for existing data compatibility.
   - New enrollment forms require these values; old missing values display as `Pending`.
11. If `full-schema-v1.sql` was already imported before reminder-history archiving was added, import `migrations/2026-07-18-notification-log-archive.sql`.
   - Adds nullable `notification_logs.archived_at` and its selected-year history index.
   - Keeps every delivery status, message, recipient, and sent timestamp unchanged.
   - Safe to import more than once.

12. If `full-schema-v1.sql` was already imported before Collection log archiving was added, import `migrations/2026-07-20-payment-collection-archive.sql`.
   - Adds nullable `payments.archived_at` and its selected-year archive index.
   - Archive only organizes the admin Tuition collection log; payment status, allocations, receipts, reports, balances, and parent history stay unchanged.
   - Safe to import more than once.
## Temporary Super Admin Seed

For local or MVP setup, import `migrations/2026-07-09-super-admin-role.sql` first, then import your local-only `database/local/seed-super-admin-account.sql`.

The `database/local/` folder is ignored by Git. Delete the seed file after importing it in phpMyAdmin.

## Local Verification

After importing both files:

1. Confirm all tables appear in phpMyAdmin.
2. Register a test admin account.
3. Register a test parent account.
4. Log in and log out from both portals.
5. Confirm protected admin and parent dashboards still redirect after logout.

Do not commit database exports, real school data, parent data, student data, payment data, credentials, or local environment files.
