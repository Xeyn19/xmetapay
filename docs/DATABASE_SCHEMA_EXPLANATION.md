# XMETA Pay Database Schema Explanation

This document explains the purpose of the XMETA Pay database schema in `database/full-schema-v1.sql`. The schema extends the existing authentication database into the full project backend for school administration, parent access, student records, enrollment, fees, payments, receipts, wallet activity, store/canteen spending, and notifications.

Related role guide: `ADMIN_ROLES.md` explains what `school_administrator`, `registrar`, and `finance_officer` can do in the admin/school portal.

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

This is the shared login table for both admin and parent accounts. It stores account identity, role, contact details, password hash, status, and login timestamps. It does not store plain-text passwords.

Important behavior:

- `role` separates admin users from parent users.
- Unique email and phone indexes are scoped by role, so an email or phone can be handled safely per portal.
- `status` supports active, pending, and disabled accounts.
- Other tables reference `users.id` when a parent pays, receives notifications, or links to a student.

### `auth_sessions`

This stores server-managed login sessions. The browser receives a random `xmetapay_session` cookie token, while MySQL stores only a hashed token in `auth_sessions.token_hash`.

Important behavior:

- Sessions can expire through `expires_at`.
- Logout revokes the active session by setting `revoked_at`.
- Protected pages only accept sessions that are not expired, not revoked, and belong to an active user with the matching portal role.
- `last_used_at` updates when a valid session is read.

### `admin_profiles`

This stores school-side profile details for users with the `admin` role. It records the school name entered during registration and the staff role: `school_administrator`, `registrar`, or `finance_officer`.

After a school administrator completes manual school setup, `admin_profiles.school_id` links the admin profile to the real `schools.id` record. The original `school_name` field remains useful for display, registration history, and fallback matching for older local accounts.

School setup is shared across staff accounts. If a registrar or finance officer has the same exact `school_name`, XMETA Pay resolves that account to the existing `schools.id` and saves the matched `school_id` back to `admin_profiles`. This keeps staff accounts accurate after the first school administrator has finished setup. A future production version should use invite codes or school codes for stricter matching.

### `parent_profiles`

This stores parent-side profile details for users with the `parent` role. Parent registration asks for the student's first name, optional middle name, and last name so it matches the admin enrollment form; those fields are combined into `parent_profiles.student_name` for pending-link display. Student access is still linked by `student_reference`, not by matching the typed name.

## School Setup Tables

### `schools`

Stores each school using XMETA Pay. This table is the top-level owner for most school data.

Main purpose:

- Identify schools by name and unique code.
- Track whether a school is active or inactive.
- Serve as the parent record for school years, grade levels, sections, students, fees, payments, store merchants, and notifications.

### `school_years`

Stores academic years per school, such as `2026-2027`.

Main purpose:

- Define the active or closed school year.
- Let fees, sections, enrollments, and reports be grouped by school year.
- Prevent duplicate school year names within the same school.

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

Stores the official student record.

Main purpose:

- Keep a unique `student_reference` per school.
- Store student name, optional birthdate, and status.
- Link students to school records, enrollments, fees, payments, wallets, store transactions, and notifications.

The `student_reference` is important because parent registration can use it to connect a parent account to the correct student.

### `student_guardians`

Links parent accounts to students.

Main purpose:

- Support multiple guardians for one student.
- Support one parent account linked to multiple students.
- Store the relationship type: mother, father, or guardian.
- Mark a primary guardian when needed.

This table is what lets the parent portal show only the children linked to the signed-in parent.

## Enrollment Tables

### `enrollments`

Stores a student's enrollment record for a specific school year.

Main purpose:

- Track the student's grade level and optional section.
- Track enrollment status from draft to submitted, enrolled, rejected, or withdrawn.
- Prevent duplicate enrollment records for the same student in the same school year.

This table becomes the core source for enrollment dashboards and class assignments.

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

### `student_fee_assignments`

Assigns fees to students and tracks balances.

Main purpose:

- Store how much a student owes for a fee.
- Track how much has already been paid.
- Track due dates and payment status: open, partial, paid, or cancelled.
- Support selected-student bulk assignment while the unique key prevents duplicate fee charges for the same student, fee, and school year.
- Support both admin tuition reports and parent fee summaries.

This table is the main source for outstanding balances.

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
- Store payment channel, amount, status, and paid timestamp.
- Use a unique reference number for tracking.

Payment status starts as pending and can become paid, failed, voided, or refunded.

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

- Record the merchant, student, wallet transaction, amount, and purchase timestamp.
- Store a unique transaction reference number.
- Support admin store reports, parent dashboard store snapshots, selected student profile spending snapshots, and full parent wallet spending history.

Each store transaction should connect to a wallet transaction so spending affects the wallet ledger.

Implementation status: these tables already exist in the full schema and the Phase 6B admin/finance write flow records local test purchases. The admin Store transactions page exposes `Create merchant` and `Record purchase` as focused action modals above the real transaction log. A store purchase decreases the wallet balance, inserts a `wallet_transactions` purchase row, and links it to a `store_transactions` row.

## Report Export Queries

Reports are generated from operational tables rather than stored in separate report tables.

Current implemented CSV and PDF report exports:

- Monthly revenue from paid `payments`.
- Collections from `payments` and linked `students`.
- Outstanding balances from `student_fee_assignments`, `fee_types`, and enrollment context.
- Wallet and store activity from `wallet_transactions`, `wallets`, `store_transactions`, and `store_merchants`.

Scheduled reports and notification-driven report delivery are future features. Queued in-app payment reminder history is implemented separately through `notification_logs`.

Real-data dashboard tables also support browser-side pagination plus CSV and PDF exports. Those table exports use the rows already loaded for the signed-in admin or parent after search/filter controls are applied, so they do not require extra database tables.

## Notification Table

### `notification_logs`

Stores reminders and system notification history.

Main purpose:

- Track payment reminders, receipts, low wallet alerts, and enrollment updates.
- Store the channel: email, SMS, or in-app.
- Track status: queued, sent, or failed.
- Connect notifications to a school, recipient user, and optionally a student.

Current implementation: school administrators and finance officers can open a reminder modal and log queued payment reminders for linked parents with open or partial balances. The action logs at most one queued `payment_reminder` per school, linked parent, student, selected channel, and calendar day. Each new reminder row stores the custom or generated text in `message_body`. The tuition page shows recent reminder history, and the admin dashboard activity feed reads the same table. This table is for audit and history. It does not send notifications by itself; real email/SMS delivery remains future work.

## Main Data Flow

The schema supports this practical backend flow:

1. Admin registers and logs in through the existing auth tables.
2. A school record is created and linked to school setup records.
3. Admin creates school years, grade levels, and sections.
4. Admin creates student records.
5. Parent registers and can be linked to a student through `student_guardians`.
6. Admin enrolls students for the active school year.
7. Admin creates fee types and assigns fees to one or more selected students.
8. Parent views fee balances from `student_fee_assignments`, including tuition terms when configured.
9. Parent records payments in `payments` for regular balances or open/partial tuition terms.
10. Payments are allocated through `payment_allocations` or `payment_term_allocations`.
11. Receipts are created in `receipts`.
12. Student wallets and store activity are tracked through wallet and store tables. Wallet balances come from `wallets.balance`; transaction rows explain how the balance changed and power the parent dashboard, selected student profile, and full wallet ledger views.
13. Admin downloads CSV and PDF reports from existing operational tables, while admin and parent table screens paginate loaded rows and export filtered rows as CSV or PDF.
14. Queued in-app payment reminder history is recorded in `notification_logs`; real notification delivery remains future work.

## Relationship Summary

- `schools` owns school years, grade levels, sections, students, fees, payments, store merchants, and notifications.
- `users` owns admin and parent login identity.
- `student_guardians` connects parent users to students.
- `enrollments` connects students to a school year, grade level, and section.
- `fee_types` defines what can be charged.
- `student_fee_assignments` records what each student owes.
- `tuition_payment_terms` breaks tuition balances into scheduled installments.
- Tuition term parsing, payable checks, payments, and assignment recalculation are handled by a shared server-only tuition helper.
- `payments` records money received.
- `payment_allocations` applies payment money to student balances.
- `payment_term_allocations` applies payment money to tuition installment terms.
- `receipts` documents paid payments.
- `wallets` and `wallet_transactions` track student allowance balances, dashboard wallet activity, selected student wallet activity, and full wallet ledger history.
- `store_transactions` records wallet spending at school merchants.
- Report CSV and PDF exports read from operational tables and do not require separate report storage tables.
- `notification_logs` records communication history.

## Safety Notes

Do not commit:

- Real student records.
- Real parent records.
- Real school payment records.
- Database exports from phpMyAdmin.
- `.env` files or credentials.
- Authentication secrets.

Use this schema first for local development and testing. After importing the SQL files, verify that registration, login, logout, protected dashboard redirects, and phpMyAdmin table creation still work.
