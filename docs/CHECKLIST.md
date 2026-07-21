# XMETA Pay Backend Implementation Checklist

Use this checklist to move from the current auth-only backend into the full XMETA Pay database and dashboard backend step by step. Keep each phase small, test it, then move to the next one.

Source schema reference: `DATABASE_SCHEMA_PLAN.md`

Admin role reference: `ADMIN_ROLES.md`

## Current Project Status

- [x] Admin/school registration works.
- [x] Parent registration works.
- [x] Admin/school login works.
- [x] Parent login works.
- [x] Company super admin login exists at `/login`.
- [x] Company super admin uses a sidebar-based monitoring workspace.
- [x] Company super admin can monitor schools and manage school admin accounts from a dedicated accounts page.
- [x] Company super admin dashboard includes a Recharts-backed school-admin registration trend with daily, weekly, monthly, and custom date views.
- [x] New school/admin registrations require company super admin approval before login.
- [x] Logout clears the session.
- [x] Protected admin and parent dashboards redirect correctly.
- [x] Admin/school staff roles are documented and enforced for key pages/actions.
- [x] Local database environment file is ignored by Git.
- [x] Auth uses database-backed `auth_sessions` with hashed tokens and logout revocation.
- [x] Admin dashboard pages use MySQL-backed reads where tables exist, with honest pending/empty states where feature data is not created yet.
- [x] School administrator dashboard uses a Recharts-backed real-data overview; registrar and finance officer dashboards keep their role-scoped layout.
- [x] Student, enrollment, and guardian-linking backend is implemented.
- [x] Parent local test payments, fee allocations, receipts, and payment history are implemented.
- [x] Parent local wallet top-up and wallet transaction history are implemented.
- [x] Store spending backend is implemented through admin/finance local test purchase recording.
- [x] Admin CSV and PDF report exports are implemented from operational MySQL records.
- [x] Real-data admin and parent tables can paginate on screen and export filtered rows as CSV and PDF.
- [x] Queued SMS/email payment reminder history is recorded in `notification_logs` once per day for the same school, linked parent, student, and selected channel.
- [ ] Real notification sending, real payment gateways, refunds, cashier/POS, item catalog, and admin manual fee payment recording are not implemented yet.

## Completed Foundation Step

This was the first backend milestone before connecting dashboards to real data:

- [x] Create a new reviewed SQL file for the full MVP schema: `database/full-schema-v1.sql`.
- [x] Copy the planned tables from `DATABASE_SCHEMA_PLAN.md` into the new SQL file.
- [x] Keep `database/auth-schema.sql` unchanged until the full schema is reviewed.
- [x] Import the new SQL file into local XAMPP/phpMyAdmin only after reviewing it.
- [x] Confirm all tables and indexes appear in phpMyAdmin.
- [x] Run auth register/login/logout again after import to make sure auth still works.

Done when: the full database structure exists locally and auth still works.

## Phase 1: Database Migration Foundation

- [x] Add `database/full-schema-v1.sql` with school, student, enrollment, fee, payment, wallet, store, and notification tables.
- [x] Use `CREATE TABLE IF NOT EXISTS` so local imports are safer.
- [x] Use InnoDB and `utf8mb4_unicode_ci` for every table.
- [x] Keep foreign keys and indexes from `DATABASE_SCHEMA_PLAN.md`.
- [x] Add a short `database/README.md` explaining import order.
- [x] Verify the SQL imports cleanly in XAMPP/phpMyAdmin.

Done when: the full schema can be imported from a clean local database without errors.

## Phase 2: School Setup Backend

- [x] Add backend helpers for `schools`, `school_years`, `grade_levels`, and `sections`.
- [x] Link admin profiles to a real school record.
- [x] Share the completed school context with same-school registrar and finance staff accounts.
- [x] Support one or many school years with exactly one active school year.
- [x] Add an overview-first School setup hub with school health, all-year counts, compact active-year structure, and focused quick actions.
- [x] Move selected-year grade/section management to `/admin/school-setup/years/[yearId]` and reviewed rollover to `/admin/school-setup/rollover`.
- [x] Use focused modals for school identity and school-year metadata while preserving the combined first-time onboarding form.
- [x] Add an admin school-year selector for viewing historical/upcoming year data.
- [x] Add school-year stamps to payments, wallet transactions, store transactions, and notification logs.
- [x] Let School setup edit grade/section structure for a selected school year.
- [x] Add a reviewable school-year rollover with explicit one-or-many student selection, next-grade suggestions, promote/repeat decisions, and no duplicated student master records.
- [x] Add school-year activation so an upcoming year can become active and the previous active year closes automatically.
- [x] Keep operational write actions tied to the active school year for MVP safety.
- [x] Create grade levels and sections from the admin side or a safe local seed script.
- [x] Replace hard-coded school year/dashboard school labels with database reads.
- [x] Restrict school setup to `school_administrator`.
- [x] Redirect new school administrators to setup-only onboarding before showing the real dashboard.

Done when: the admin dashboard can load school setup data from MySQL, switch admin views by school year, keep new operational records in the active year, prepare target-year enrollments through manual rollover, and activate the next school year when ready.

## Phase 3: Students And Guardian Linking

- [x] Add backend helpers for `students` and `student_guardians`.
- [x] Create an admin flow for adding or listing students.
- [x] Provide one Add students chooser for single new-student entry, validated multi-student batches with shared defaults/per-row overrides, and existing-student enrollment.
- [x] Enroll one or many existing pending students without re-entering identity details; only active-year grade/section enrollment rows are created.
- [x] Capture required sex on new student records and school-year student type on new, existing-student, bulk, and rollover enrollment flows; derive age from birthdate and show legacy missing values as Pending.
- [x] Restrict student creation/enrollment to `school_administrator` and `registrar`.
- [x] Link parent accounts to students using `student_reference`.
- [x] Allow parent registration to submit one or more student references.
- [x] Show linked students on the parent dashboard from the database.
- [x] Add a parent My students page for managing multiple linked students.
- [x] Handle duplicate parent-student links with a friendly already-linked message.
- [x] Keep parent access limited to their linked students only.

Done when: admins can manage students and parents can add or view multiple linked children while only seeing records connected through `student_guardians`.

## Phase 4: Fees And Tuition Backend

- [x] Add backend helpers for `fee_types` and `student_fee_assignments`.
- [x] Create tuition and other fee types for the active school year.
- [x] Assign fees to one or more selected students, with grade/section filters for faster bulk selection.
- [x] Replace admin tuition report mock rows with database rows.
- [x] Replace parent fee summary mock rows with database rows.
- [x] Calculate open, partial, and paid balances from database values.
- [x] Add parent-specific Fee summary archive/restore for settled fees without changing financial records or another guardian's view.

Done when: admin and parent fee screens show real balances from MySQL.

## Phase 5: Payments And Receipts Backend

- [x] Add backend helpers for `payments`, `payment_allocations`, and `receipts`.
- [x] Create a safe local payment flow that records payments without real payment gateway integration.
- [x] Allocate payments to selected fee balances.
- [x] Update fee assignment status after payment.
- [x] Generate receipt records after successful payment.
- [x] Show parent payment history from database records.
- [x] Show admin tuition collections log from database records, excluding wallet-only payments.
- [x] Add reversible active/archived Tuition collection log views with row and bulk controls while preserving financial totals, reports, receipts, balances, and parent history.

Done when: a parent can record a local test payment and both portals show the result.

### Phase 5A: Tuition payment terms

- [x] Add `tuition_payment_terms` for per-student tuition installment schedules.
- [x] Add `payment_term_allocations` so receipts/history can show which term was paid.
- [x] Keep `fee_type_term_templates` in the schema as a reserved future template layer.
- [ ] Re-enable reusable fee type term templates after per-student terms are stable.
- [x] Add admin tuition `Manage terms` action for each student tuition assignment.
- [x] Show tuition term schedules in the parent fee summary.
- [x] Include tuition term schedules in the parent Fee summary PDF export.
- [x] Let parents pay open or partial tuition terms, including early payment before the due date.
- [x] Keep other fees and tuition without terms on the existing full-balance payment flow.
- [x] Keep tuition term parsing, validation, saving, payable checks, payment application, and assignment recalculation in a shared server-only helper.

Done when: admin/finance can split a tuition balance into terms, and parents can pay open or partial installments from the portal.

## Phase 6: Wallet, Store, And Reports

### Phase 6A: Wallet top-up

- [x] Add backend helpers for `wallets` and `wallet_transactions`.
- [x] Create student wallets lazily when the parent tops up allowance.
- [x] Record local allowance top-ups.
- [x] Admin allowance and store pages read database tables and show pending/empty states when no rows exist.
- [x] Add parent wallet top-up write flow.
- [x] Show parent wallet history and admin allowance records from MySQL.
- [x] Calculate admin allowance total balance from one row per wallet, not from joined transaction rows.
- [x] Show admin allowance monthly top-up stats and segmented wallet-balance filters from real wallet data.
- [x] Add reversible selected-year Allowance ledger archive/restore without changing wallet balances, status, transactions, parent visibility, KPIs, or reports.

Done when: wallet balances, top-up history, and admin allowance totals come from MySQL and do not double-count wallets with multiple transactions.

### Phase 6B: Store/canteen transactions

- [x] Add admin/finance merchant setup for `store_merchants`.
- [x] Add admin/finance purchase recording for `store_transactions`.
- [x] Decrease student wallet balance through a `wallet_transactions` purchase row.
- [x] Show store purchases in parent wallet history, not parent payment history.
- [x] Show recent wallet/store activity on the parent dashboard.
- [x] Show selected-student wallet/store activity on the parent student profile.
- [x] Show store transactions in admin store reports with working filters/export.
- [x] Add store purchase write flow.
- [x] Move `Create merchant` and `Record purchase` into focused action modals above the store transaction log.

Done when: a parent can top up a wallet, admin/finance can record a local test store purchase, the parent dashboard and selected student profile show recent wallet/store activity, and both portals show the same wallet/store ledger data.

### Phase 6C: Report CSV and PDF exports

- [x] Add report queries for monthly revenue, tuition collections, outstanding balances, and wallet/store summaries.
- [x] Add protected admin CSV export route for report downloads.
- [x] Replace disabled report export buttons with working CSV download links.
- [x] Add protected admin PDF export downloads for the same report data.
- [x] Show separate CSV and PDF report buttons on the admin reports page.
- [x] Add pagination plus CSV and PDF filtered-row exports to real-data admin and parent tables.

Done when: school administrators and finance officers can download CSV and PDF reports generated from operational MySQL records, and real-data table screens can paginate on screen while exporting their filtered rows in both formats.

### Phase 6D: Payment reminder emails

- [x] Use `notification_logs` for payment reminder history with saved reminder message text.
- [x] Let school administrators and finance officers send email reminders to linked parents with open or partial balances.
- [x] Add reminder modal fields for target, reminder type, specific student, and optional message.
- [x] Send branded plain-text and HTML email through a pooled Nodemailer SMTP transport.
- [x] Include matching fee line items, official assignment due dates, totals, and tuition installment schedules in reminder emails.
- [x] Update reminder rows from `queued` to `sent` with `sent_at`, or to `failed` when delivery fails.
- [x] Prevent same-day duplicates for sent emails and recent queued attempts while allowing failed attempts to retry.
- [x] Show historical email/SMS reminder rows on the tuition page and activity feed.
- [x] Let school administrators and finance officers archive or restore one or many payment-reminder history rows without deleting delivery audit data.
- [ ] Add SMS, scheduled/background notifications, delivery webhooks, bounce handling, cashier/POS portal, item catalog, refunds, real payment gateways, and real-time purchase notifications.

Done when: email reminders are sent from operational fee balances, delivery results are auditable in `notification_logs`, active and archived history can be organized reversibly, repeated clicks remain protected even when a sent row is archived, and SMS remains clearly labeled future.

## Safe Testing Checklist

Run these checks after every backend phase:

- [ ] `npm run test:unit`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Register a test admin account locally.
- [ ] Register a test parent account locally.
- [ ] Log in and log out from both portals.
- [ ] Visit admin dashboard after logout and confirm it redirects to admin login.
- [ ] Visit parent dashboard after logout and confirm it redirects to parent login.
- [ ] Check phpMyAdmin for expected rows and no duplicate broken records.

## Git Checklist Before Pushing

- [ ] Run `git status --short`.
- [ ] Confirm no local environment file is staged.
- [ ] Confirm no database export file is staged.
- [ ] Confirm no local `database/local/` seed SQL file is staged.
- [ ] Confirm no real parent, student, school, payment, or credential data is staged.
- [ ] Run a secret scan before commit for database credential keys, auth session secrets, local environment filenames, and exported private data.

- [ ] Commit only reviewed source files and documentation.
- [ ] Push a feature branch, not directly to `main`.

## Recommended Implementation Order

1. Database tables and indexes.
2. School setup backend.
3. Students and parent/student links.
4. Fees and balances.
5. Payments and receipts.
6. Wallet and store transactions.
7. Reports and notifications.
