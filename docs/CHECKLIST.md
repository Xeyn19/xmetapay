# XMETA Pay Backend Implementation Checklist

Use this checklist to move from the current auth-only backend into the full XMETA Pay database and dashboard backend step by step. Keep each phase small, test it, then move to the next one.

Source schema reference: `DATABASE_SCHEMA_PLAN.md`

Admin role reference: `ADMIN_ROLES.md`

## Current Project Status

- [x] Admin/school registration works.
- [x] Parent registration works.
- [x] Admin/school login works.
- [x] Parent login works.
- [x] Logout clears the session.
- [x] Protected admin and parent dashboards redirect correctly.
- [x] Admin/school staff roles are documented and enforced for key pages/actions.
- [x] Local database environment file is ignored by Git.
- [x] Auth uses database-backed `auth_sessions` with hashed tokens and logout revocation.
- [x] Admin dashboard pages use MySQL-backed reads where tables exist, with honest pending/empty states where feature data is not created yet.
- [x] Student, enrollment, and guardian-linking backend is implemented.
- [x] Parent local test payments, fee allocations, receipts, and payment history are implemented.
- [x] Parent local wallet top-up and wallet transaction history are implemented.
- [ ] Store spending, notification sending, report exports, real payment gateways, refunds, and admin manual payment recording are not implemented yet.

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
- [x] Create one active school year for the local test school.
- [x] Create grade levels and sections from the admin side or a safe local seed script.
- [x] Replace hard-coded school year/dashboard school labels with database reads.
- [x] Restrict school setup to `school_administrator`.

Done when: the admin dashboard can load school setup data from MySQL.

## Phase 3: Students And Guardian Linking

- [x] Add backend helpers for `students` and `student_guardians`.
- [x] Create an admin flow for adding or listing students.
- [x] Restrict student creation/enrollment to `school_administrator` and `registrar`.
- [x] Link parent accounts to students using `student_reference`.
- [x] Show linked students on the parent dashboard from the database.
- [x] Keep parent access limited to their linked students only.

Done when: admins can manage students and parents can see only their linked children.

## Phase 4: Fees And Tuition Backend

- [x] Add backend helpers for `fee_types` and `student_fee_assignments`.
- [x] Create tuition and other fee types for the active school year.
- [x] Assign fees to students.
- [x] Replace admin tuition report mock rows with database rows.
- [x] Replace parent fee summary mock rows with database rows.
- [x] Calculate open, partial, and paid balances from database values.

Done when: admin and parent fee screens show real balances from MySQL.

## Phase 5: Payments And Receipts Backend

- [x] Add backend helpers for `payments`, `payment_allocations`, and `receipts`.
- [x] Create a safe local payment flow that records payments without real payment gateway integration.
- [x] Allocate payments to selected fee balances.
- [x] Update fee assignment status after payment.
- [x] Generate receipt records after successful payment.
- [x] Show parent payment history from database records.
- [x] Show admin collections log from database records.

Done when: a parent can record a local test payment and both portals show the result.

## Phase 6: Wallet, Store, And Reports

### Phase 6A: Wallet top-up

- [x] Add backend helpers for `wallets` and `wallet_transactions`.
- [x] Create student wallets lazily when the parent tops up allowance.
- [x] Record local allowance top-ups.
- [x] Admin allowance and store pages read database tables and show pending/empty states when no rows exist.
- [x] Add parent wallet top-up write flow.
- [x] Show parent wallet history and admin allowance records from MySQL.

Done when: wallet balances and top-up history come from MySQL.

### Phase 6B: Store/canteen transactions

- [ ] Add admin/finance merchant setup for `store_merchants`.
- [ ] Add admin/finance purchase recording for `store_transactions`.
- [ ] Decrease student wallet balance through a `wallet_transactions` purchase row.
- [ ] Show store purchases in parent wallet/history screens.
- [ ] Show store transactions in admin store reports with working filters/export.
- [ ] Add store purchase write flow.

Done when: a parent can top up a wallet, admin/finance can record a local test store purchase, and both portals show the same wallet/store activity.

### Future Phase 6C+

- [ ] Add report queries for tuition, collections, wallet, and store summaries.
- [ ] Add `notification_logs` after reminders are ready.
- [ ] Add cashier/POS portal, item catalog, refunds, and real-time purchase notifications.

Done when: reports and notification flows are generated from the operational MySQL records.

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
