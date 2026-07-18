# XMETA Pay Database Schema Explanation

This document explains the purpose of the XMETA Pay database schema in `database/full-schema-v1.sql`. The schema extends the existing authentication database into the full project backend for company monitoring, school administration, parent access, student records, enrollment, fees, payments, receipts, wallet activity, store/canteen spending, and notifications.

Related role guide: `ADMIN_ROLES.md` explains what company `super_admin`, `school_administrator`, `registrar`, and `finance_officer` accounts can do.

## Import Order

The database is split into two SQL files so the current authentication work stays stable.

1. `database/auth-schema.sql`
   - Creates the `xmetapay_db` database.
   - Creates shared authentication tables: `users`, `auth_sessions`, `admin_profiles`, and `parent_profiles`.
   - Must be imported first because the full schema references `users.id`.
2. `database/full-schema-v1.sql`
   - Adds the full MVP database layer.
   - Assumes the authentication tables already exist.
   - Does not include seed data, real school data, real student data, credentials, or payment records.

## Design Principles

The schema uses MySQL with XAMPP/phpMyAdmin in mind. Every table uses `InnoDB` so foreign keys work correctly, and `utf8mb4_unicode_ci` so names and school text can support broad characters. Money values use `DECIMAL(10,2)` instead of floating point numbers to avoid rounding errors.

Most tables include indexes based on the screens XMETA Pay will need: student lookup, parent linked students, fee summaries, tuition reports, payment history, wallet ledgers, store reports, and notification history. The schema is intentionally additive, meaning it builds around the current auth backend without changing the working sign-in, sign-out, registration, session, and protected dashboard flow.

## Existing Authentication Foundation

### `users`

This is the shared login table for company super admin, school admin, and parent accounts. It stores account identity, role, contact details, password hash, status, and login timestamps. It does not store plain-text passwords.

Important behavior:

- `role` separates company `super_admin`, school `admin`, and `parent` users.
- Unique email and phone indexes are scoped by role, so an email or phone can be handled safely per portal.
- `status` supports active, pending, and disabled accounts. New school/admin registrations start as pending until a company super admin approves or rejects them.
- Other tables reference `users.id` when a parent pays, receives notifications, or links to a student.

### `auth_sessions`

This stores server-managed login sessions. The browser receives a random `xmetapay_session` cookie token, while MySQL stores only a hashed token in `auth_sessions.token_hash`.

Important behavior:

- Sessions can expire through `expires_at`.
- Logout revokes the active session by setting `revoked_at`.
- Protected pages only accept sessions that are not expired, not revoked, and belong to an active user with the matching portal role.
- `last_used_at` updates when a valid session is read.
- Company super admin sessions use the same table and cookie model, but they are only accepted by `/super-admin/*` routes.

### `admin_profiles`

This stores school-side profile details for users with the `admin` role. It records the school name entered during registration and the staff role: `school_administrator`, `registrar`, or `finance_officer`.

After a school administrator completes manual school setup, `admin_profiles.school_id` links the admin profile to the real `schools.id` record. The original `school_name` field remains useful for display, registration history, and fallback matching for older local accounts.

School setup is shared across staff accounts. If a registrar or finance officer has the same exact `school_name`, XMETA Pay resolves that account to the existing `schools.id` and saves the matched `school_id` back to `admin_profiles`. This keeps staff accounts accurate after the first school administrator has finished setup. A future production version should use invite codes or school codes for stricter matching.

### `parent_profiles`

This stores parent-side profile details for users with the `parent` role. Parent registration asks for guardian details, required phone number, relationship, and one or more student references. The first submitted reference is stored in `parent_profiles.student_reference` and `parent_profiles.student_name` as a pending-link display label because those columns are required, but official student identity still comes from the school-created `students` records after linking.

## School Setup Tables

### `schools`

Stores each school using XMETA Pay. This table is the top-level owner for most school data.

Main purpose:

- Identify schools by name and unique code.
- Track whether a school is active or inactive.
- Serve as the parent record for school years, grade levels, sections, students, fees, payments, store merchants, and notifications.

### `school_years`

Stores academic years per school, such as `2026-2027`. A school can keep many years for history and planning, but only one should be `active` for live dashboard work.

Main purpose:

- Define upcoming, active, or closed school years.
- Let fees, sections, enrollments, and reports be grouped by school year.
- Prevent duplicate school year names within the same school.
- Support the School setup activation flow: an upcoming year can become active, and the previous active year is closed automatically.

### `grade_levels`

Stores grade levels for a school, such as Grade 1, Grade 2, or Grade 10.

Main purpose:

- Organize students and sections by grade.
- Provide a `sort_order` so grades can be displayed in the correct order.
- Prevent duplicate grade names within the same school.

### `sections`

Stores class sections for a grade level and school year.

Main purpose:

- Connect a school year, grade level, and section name.
- Support class lists and enrollment grouping.
- Prevent duplicate section names within the same grade and year.

## Student And Guardian Tables

### `students`

Stores the official student record. If existing students are Pending for a school year, the admin can select one or many and create only the missing `enrollments` rows; identity and guardian-link data are not entered again.

Main purpose:

- Keep a unique `student_reference` per school.
- Store student name, optional birthdate, reusable sex, and status. Age is calculated from birthdate at read time and is never stored.
- Link students to school records, enrollments, fees, payments, wallets, store transactions, and notifications.

The `student_reference` is important because parent registration can use it to connect a parent account to the correct student.

### `student_guardians`

Links parent accounts to students.

Main purpose:

- Support multiple guardians for one student.
- Support one parent account linked to multiple students.
- Store the relationship type: mother, father, or guardian.
- Mark a primary guardian when needed.

This table is what lets the parent portal show only the children linked to the signed-in parent. Parent registration can create multiple links by looping through submitted `student_reference` values, and the parent dashboard or My students page can add more linked students later by inserting additional `student_guardians` rows. The unique student-parent pair prevents duplicate links.

## Enrollment Tables

### `enrollments`

Stores a student's enrollment record for a specific school year.

Main purpose:

- Track the student's grade level and optional section.
- Track enrollment status from draft to submitted, enrolled, rejected, or withdrawn, plus the school-year classification `new`, `transferee`, or `returned`.
- Prevent duplicate enrollment records for the same student in the same school year.

This table becomes the core source for enrollment dashboards and class assignments.

Legacy records may have missing sex or student type and display `Pending`. New student and enrollment writes validate these values, while rollover defaults the target enrollment type to `Returned` and allows an administrator to change it per student.

During manual rollover, the school administrator explicitly checks one or many source-year students, reviews each target grade and section, and saves only selected promote/repeat placements. The system creates the new year-specific enrollment and does not copy the student master record or financial history.

### `enrollment_documents`

Tracks required enrollment documents.

Main purpose:

- Store the document type, optional file name, and review status.
- Track whether a document is missing, submitted, approved, or rejected.
- Keep document records tied to a specific enrollment.

The schema stores metadata only. Actual uploaded files should be stored separately, with this table keeping the file name or reference.

## Fees And Billing Tables

### `fee_types`

Defines school fees for a school year.

Main purpose:

- Create tuition, other fees, and allowance-related fee definitions.
- Store a default amount.
- Track active or inactive fees.
- Prevent duplicate fee names within the same school year.

Examples include tuition, miscellaneous fee, lab fee, activity fee, and allowance-related charges.

### `fee_type_term_templates`

Stores optional reusable installment templates for tuition fee types. This table is present for future template reuse, but the current MVP keeps term creation in row-level Manage terms for each student tuition assignment.

Main purpose:

- Let admin/finance define payment terms once in the Add tuition fee type modal.
- Keep term name, order, amount, and term due date connected to the tuition fee type.
- Automatically create per-student tuition terms when that templated tuition fee is assigned.
- Leave other fees on the normal single-balance assignment flow.

If an assignment uses a custom amount, the template term amounts are scaled proportionally and the final term absorbs any cent-rounding difference. The generated student-specific terms are still editable later through Manage terms.

### `student_fee_assignments`

Assigns fees to students and tracks balances.

Main purpose:

- Store how much a student owes for a fee.
- Track how much has already been paid.
- Track the fee due date and payment status: open, partial, paid, or cancelled.
- Support selected-student bulk assignment with grade/section filtering while the unique key prevents duplicate fee charges for the same student, fee, and school year.
- Support both admin tuition reports and parent fee summaries.

This table is the main source for outstanding balances.

The parent-facing payment deadline comes from `student_fee_assignments.due_date`, even when a tuition assignment has installment terms. When terms exist, `tuition_payment_terms.due_date` is shown as installment schedule detail.

### `tuition_payment_terms`

Stores per-student tuition installment schedules.

Main purpose:

- Split one tuition assignment into due terms.
- Track each term amount, paid amount, due date, and status.
- Let parents pay open or partial terms, including early payment before the due date.
- Keep other fees on the normal fee-assignment flow.

The parent portal reads these rows through `student_guardians`, so parents only see terms for linked students.

## Payments And Receipts Tables

### `payments`

Stores payment transactions.

Main purpose:

- Record which school collected the payment.
- Record which student the payment is for.
- Optionally record which parent user paid.
- Store the school year for new payment history rows.
- Store payment channel, amount, status, and paid timestamp.
- Use a unique reference number for tracking.

Payment status starts as pending and can become paid, failed, voided, or refunded.
`school_year_id` is nullable for migrated history, but new payment writes store the active school year.

### `payment_allocations`

Splits a payment across one or more student fee balances.

Main purpose:

- Connect one payment to one or more fee assignments.
- Store how much of the payment applies to each fee.
- Allow one payment to pay tuition and other fees together.

For example, one parent payment can cover part of tuition and all of a lab fee.

### `payment_term_allocations`

Links a payment to one or more tuition terms.

Main purpose:

- Store which installment terms were paid by a payment.
- Let receipts and payment history show labels like Tuition - Term 1.
- Keep term payments separate from regular `payment_allocations`.

### `receipts`

Stores receipt records generated after successful payments.

Main purpose:

- Link one receipt to one payment.
- Store a unique receipt number.
- Track when the receipt was issued.

Receipts should be generated only after payment success.

## Wallet And Allowance Tables

### `wallets`

Stores one wallet per student.

Main purpose:

- Track the student's current wallet balance.
- Track whether the wallet is active, frozen, or closed.
- Support allowance and store/canteen spending.

### `wallet_transactions`

Stores the wallet ledger.

Main purpose:

- Track top-ups, purchases, adjustments, and reversals.
- Store the amount and resulting balance after each transaction.
- Optionally connect wallet top-ups to payment records.
- Store the school year for new wallet ledger rows.

This table provides an audit trail for all wallet changes.

Dashboard calculation note:

- Current allowance balance comes from `wallets.balance`.
- Admin allowance total balance should count each wallet once.
- Admin allowance monthly top-up stats come from current-month `wallet_transactions` rows with `type = 'top_up'`.
- Wallet transaction rows should be used for full wallet ledger history, parent dashboard wallet activity, selected student profile wallet activity, monthly spend, and store purchase reporting.
- Store purchases should not be mixed into parent payment history because they do not create fee payment or receipt records.
- Do not sum `wallets.balance` after joining directly to `wallet_transactions`, because one wallet can have many transaction rows and the balance would be duplicated.

## Store And Canteen Tables

### `store_merchants`

Stores school store or canteen merchants.

Main purpose:

- Identify canteens, school stores, or other merchants inside a school.
- Track merchant status.
- Prevent duplicate merchant names within the same school.

### `store_transactions`

Tracks purchases made through the student wallet.

Main purpose:

- Record the merchant, student, school year, wallet transaction, amount, and purchase timestamp.
- Store a unique transaction reference number.
- Support admin store reports, parent dashboard store snapshots, selected student profile spending snapshots, and full parent wallet spending history.

Each store transaction should connect to a wallet transaction so spending affects the wallet ledger.

Implementation status: these tables already exist in the full schema and the Phase 6B admin/finance write flow records local test purchases. The admin Store transactions page exposes `Create merchant` and `Record purchase` as focused action modals above the real transaction log. A store purchase decreases the wallet balance, inserts a `wallet_transactions` purchase row, and links it to a `store_transactions` row.

## Report Export Queries

Reports are generated from operational tables rather than stored in separate report tables.

Current implemented CSV and PDF report exports:

- Monthly revenue from paid `payments`.
- Tuition collections from `payments` linked through `payment_allocations` or `payment_term_allocations` to tuition `fee_types` and `students`. Wallet-only payments are intentionally excluded from this view.
- Outstanding balances from `student_fee_assignments`, `fee_types`, and enrollment context.
- Wallet and store activity from `wallet_transactions`, `wallets`, `store_transactions`, and `store_merchants`.

Scheduled reports and notification-driven report delivery are future features. Immediate payment reminder email delivery is implemented separately through `notification_logs` and SMTP.

Real-data dashboard tables also support browser-side pagination plus CSV and PDF exports. Those table exports use the rows already loaded for the signed-in admin or parent after search/filter controls are applied, so they do not require extra database tables.

## Notification Table

### `notification_logs`

Stores reminders and system notification history.

Main purpose:

- Track payment reminders, receipts, low wallet alerts, and enrollment updates.
- Store the channel: email, SMS, or in-app.
- Track status: queued, sent, or failed.
- Connect notifications to a school, recipient user, and optionally a student.
- Store the school year for new reminder history rows.

Current implementation: school administrators and finance officers can send real payment reminder emails to linked parents with open or partial balances. The server reads matching `student_fee_assignments`, `fee_types`, and optional `tuition_payment_terms` in bounded bulk queries, then builds matching HTML and plain-text statements. Assignment due dates remain the official deadlines; term dates are schedule details. The server verifies SMTP, creates an email `payment_reminder` row as `queued`, sends through pooled Nodemailer, then updates the row to `sent` with `sent_at` or `failed`. Each row stores the custom or generated introductory text in `message_body`. Sent rows and recent queued attempts block duplicate same-day sends; failed rows may be retried. SMS, scheduled delivery, and delivery webhooks remain future work.

## Main Data Flow

The schema supports this practical backend flow:

1. Admin registers and logs in through the existing auth tables.
2. A school record is created and linked to school setup records.
3. Admin creates one or many school years, chooses one active year, then creates grade levels and selected-year sections.
4. Admin creates student records individually or through the validated multi-student batch form; each valid student still receives its own master record.
5. Parent registers and can be linked to a student through `student_guardians`.
6. Admin enrolls students for the active school year.
7. When a school year changes, the school administrator reviews suggested promote/repeat placements and the system creates target-year `enrollments` without duplicating `students`.
8. When the upcoming year is ready, the school administrator activates it; the previous active year becomes closed.
8. Admin creates fee types and assigns fees to one or more selected students.
9. Parent views fee balances from `student_fee_assignments`, including tuition terms when configured.
10. Parent records payments in `payments` for regular balances or open/partial tuition terms.
11. Payments are allocated through `payment_allocations` or `payment_term_allocations`.
12. Receipts are created in `receipts`.
13. Student wallets and store activity are tracked through wallet and store tables. Wallet balances come from `wallets.balance`; transaction rows explain how the balance changed and power the parent dashboard, selected student profile, and full wallet ledger views.
14. Admin downloads CSV and PDF reports from existing operational tables, while admin and parent table screens paginate loaded rows and export filtered rows as CSV or PDF.
15. Payment reminder emails are sent through SMTP and audited in `notification_logs`; SMS and scheduled/background notification delivery remain future work.

## Relationship Summary

- `schools` owns school years, grade levels, sections, students, fees, payments, store merchants, and notifications.
- `users` owns admin and parent login identity.
- `student_guardians` connects parent users to students.
- `students` is the reusable student master record across school years.
- `enrollments` connects students to a school year, grade level, and section.
- `fee_types` defines what can be charged.
- `student_fee_assignments` records what each student owes.
- `tuition_payment_terms` breaks tuition balances into scheduled installments.
- Tuition term parsing, payable checks, payments, and assignment recalculation are handled by a shared server-only tuition helper.
- `payments` records money received and stores the active school year for new rows.
- `payment_allocations` applies payment money to student balances.
- `payment_term_allocations` applies payment money to tuition installment terms.
- `receipts` documents paid payments.
- `wallets` and `wallet_transactions` track student allowance balances, dashboard wallet activity, selected student wallet activity, full wallet ledger history, and the school year for new ledger rows.
- `store_transactions` records wallet spending at school merchants and stores the school year for new purchase rows.
- Report CSV and PDF exports read from operational tables and do not require separate report storage tables.
- `notification_logs` records communication history and stores the school year for new reminder rows.

## Safety Notes

Do not commit:

- Real student records.
- Real parent records.
- Real school payment records.
- Database exports from phpMyAdmin.
- `.env` files or credentials.
- Authentication secrets.

Use this schema first for local development and testing. After importing the SQL files, verify that registration, login, logout, protected dashboard redirects, and phpMyAdmin table creation still work.
