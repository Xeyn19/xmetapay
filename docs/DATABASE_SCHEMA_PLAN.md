# XMETA EDU Database Schema Plan

## Project Database Overview

XMETA EDU uses one MySQL database for three connected access areas:

- Company super admin: XMETA EDU monitoring for schools, school admin account access, and read-only aggregate school population profiles.
- Admin/school portal: school setup, student records, parent directory, tuition, collections, allowance, store transactions, and reports.
- Parent portal: invitation and email-OTP claim, active linked-student access, fee viewing, tuition payment, receipts, payment history, wallet top-up, dashboard wallet activity, selected student wallet activity, and full wallet/store-spending history.

Related role guide: `ADMIN_ROLES.md` explains the company `super_admin` role plus the `school_administrator`, `registrar`, and `finance_officer` permissions used by the admin/school portal.

The public entry page exposes only admin and parent portal choices through the shared responsive XMETA EDU shell used by role login, registration, recovery, and all dashboard portals. The app defaults to Dark and remembers an optional Light preference in the browser; theme state is never stored in MySQL. Dashboard sidebars use semantic light surfaces in Light mode and XMETA charcoal in Dark mode, and Parent top-level and nested routes use one declarative current-page interaction model plus contrast-safe semantic hover and selection surfaces. Admin report-download rows use the same semantic surfaces so hover never hides their labels; disabled Admin controls use opaque neutral state tokens, while alerts and status badges use semantic state tokens in both themes. The Tuition report remains tuition-specific while the dedicated Other fees page owns non-tuition summaries. Company super-admin access remains available only by directly opening the unlisted sign-in route `/login`; authentication still uses `users` and `auth_sessions`, so this navigation change adds no schema fields and the schema does not support public company-account registration.

Login, registration, and recovery placeholders are fixed professional instructions rather than sample emails, phone numbers, or account-derived values. This presentation rule does not alter the `users` schema, form field contracts, normalization, or authentication queries.

The current database already starts with shared authentication tables. The practical MVP should keep that foundation and add school, student, enrollment, billing, payment, wallet, and reporting tables around it. The super-admin school profile requires no new schema: it derives distinct current and total population counts through `schools`, `admin_profiles`, `school_years`, `students`, `student_guardians`, `users`, `enrollments`, and `grade_levels`.

Recommended database defaults for XAMPP MySQL:

```sql
CREATE DATABASE IF NOT EXISTS xmetapay_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE xmetapay_db;
```

All tables should use:

```sql
ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## Current Auth Schema Recap

The existing auth design is still the correct foundation.

### `users`

Shared login table for company super admin, school admin, and parent accounts.

| Column | Purpose |
| --- | --- |
| `id` | Primary key |
| `role` | `super_admin`, `admin`, or `parent` |
| `name` | Display name |
| `email` | Login/contact email |
| `phone` | Optional login/contact phone |
| `password_hash` | Hashed password only |
| `status` | `active`, `pending`, or `disabled`; school admin registration starts as `pending` until company super admin approval |
| `last_login_at` | Last successful login time |
| `created_at`, `updated_at` | Audit timestamps |

Important indexes:

```sql
UNIQUE KEY uq_users_role_email (role, email),
UNIQUE KEY uq_users_role_phone (role, phone),
KEY idx_users_role_status (role, status),
KEY idx_users_created_at (created_at)
```

### `auth_sessions`

Server-managed sessions for public web auth.

| Column | Purpose |
| --- | --- |
| `id` | Primary key |
| `user_id` | Links to `users.id` |
| `role` | Session role: `super_admin`, `admin`, or `parent` |
| `token_hash` | HMAC hash of the browser session token |
| `expires_at` | Session expiry time |
| `last_used_at` | Last valid session read |
| `revoked_at` | Logout/revocation timestamp |
| `created_at` | Creation timestamp |

Company sign-in uses `users.status` only after password verification when it needs to explain inactive access. Logout revokes this session row and deletes the browser session cookie; its one-time user feedback is presentation state on the destination login route, so no additional authentication column or table is required.

Important indexes:

```sql
UNIQUE KEY uq_auth_sessions_token_hash (token_hash),
KEY idx_auth_sessions_user_revoked_expires (user_id, revoked_at, expires_at),
KEY idx_auth_sessions_role_expires (role, expires_at)
```

### `password_reset_challenges`

One row per user owns the current email OTP password-recovery lifecycle. The table stores HMAC hashes for the browser challenge and OTP, five-minute OTP expiry, 60-second resend timing, a rolling hourly send counter, failed attempts, verification/reset expiry, and one-time consumption.

The user foreign key uses `ON DELETE CASCADE`. A successful password update and challenge consumption occur in one transaction, which also revokes every open `auth_sessions` row for that user. Account status is never modified by password recovery.

### `admin_profiles`

One admin profile per admin user.

| Column | Purpose |
| --- | --- |
| `id` | Primary key |
| `user_id` | Links to `users.id` |
| `school_id` | Nullable link to `schools.id` after school setup is initialized |
| `school_name` | School name captured during admin registration |
| `staff_role` | Admin staff permission: `school_administrator`, `registrar`, or `finance_officer` |

Implementation note: `school_name` stays for display, registration history, and fallback matching. After the full schema is imported, a `school_administrator` manually sets up school records and links the admin profile to the real `schools.id` record through `admin_profiles.school_id`. The setup is school-wide: registrar and finance officer profiles with the same exact `school_name` are also linked to that same `schools.id` so they can share the completed school context instead of setting up the school again.

### `parent_profiles`

One parent profile per parent user.

| Column | Purpose |
| --- | --- |
| `id` | Primary key |
| `user_id` | Links to `users.id` |
| `school_id` | Nullable immutable link to the one assigned `schools.id`; unresolved legacy profiles remain null |
| `student_name` | Legacy pending-link display label retained for compatibility; verified invitations use the authoritative student row |
| `student_reference` | Legacy saved reference retained for conservative migration only; it cannot grant Parent access |
| `relationship` | Mother, father, or guardian |

Invitation completion derives the active school from the locked invitation and student rows before inserting this profile. Existing databases use the idempotent `2026-09-02-parent-single-school-scope.sql` migration, which backfills only unambiguous single-school profiles and never deletes legacy guardian or financial records. A null assignment blocks Parent portal data and actions. An inactive assigned school permits historical reads but no new Parent writes.

## Full Practical MVP Schema

The following tables extend the current auth schema into the full dashboard and parent portal data model.

### School Setup

#### `schools`

Stores schools using XMETA EDU.

```sql
CREATE TABLE schools (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  code VARCHAR(40) NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_schools_code (code),
  KEY idx_schools_status (status)
);
```

#### `school_years`

Stores one or many school years per school. One row should be `active` for the live dashboard, future rows can be `upcoming`, and old rows can be `closed`. The overview-first setup hub and focused year-structure/rollover routes reuse these records, so the management UX adds no table or column. Activation turns an upcoming year into the active year and closes the previous active year.

```sql
CREATE TABLE school_years (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(40) NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status ENUM('upcoming', 'active', 'closed') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_school_years_school_name (school_id, name),
  KEY idx_school_years_school_status (school_id, status),
  CONSTRAINT fk_school_years_school FOREIGN KEY (school_id) REFERENCES schools(id)
);
```

#### `grade_levels`

Stores grade levels per school.

```sql
CREATE TABLE grade_levels (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(60) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,

  UNIQUE KEY uq_grade_levels_school_name (school_id, name),
  KEY idx_grade_levels_school_order (school_id, sort_order),
  CONSTRAINT fk_grade_levels_school FOREIGN KEY (school_id) REFERENCES schools(id)
);
```

#### `sections`

Stores class sections per grade level and school year.

```sql
CREATE TABLE sections (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  school_year_id BIGINT UNSIGNED NOT NULL,
  grade_level_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(60) NOT NULL,

  UNIQUE KEY uq_sections_year_grade_name (school_year_id, grade_level_id, name),
  KEY idx_sections_school_year (school_id, school_year_id),
  CONSTRAINT fk_sections_school FOREIGN KEY (school_id) REFERENCES schools(id),
  CONSTRAINT fk_sections_school_year FOREIGN KEY (school_year_id) REFERENCES school_years(id),
  CONSTRAINT fk_sections_grade_level FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id)
);
```

### Student Records

#### `students`

Stores each student profile.

The admin exact-profile correction workflow updates this existing row in place. Reference changes remain unique within the school and do not replace the student ID, so existing guardian, fee, payment, wallet, and audit relationships stay connected. Student lifecycle status is read-only in this workflow.

```sql
CREATE TABLE students (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  student_reference VARCHAR(60) NOT NULL,
  first_name VARCHAR(80) NOT NULL,
  middle_name VARCHAR(80) NULL,
  last_name VARCHAR(80) NOT NULL,
  birthdate DATE NULL,
  sex ENUM('male', 'female') NULL,
  status ENUM('active', 'inactive', 'graduated', 'transferred') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_students_school_reference (school_id, student_reference),
  KEY idx_students_school_status (school_id, status),
  KEY idx_students_name (last_name, first_name),
  CONSTRAINT fk_students_school FOREIGN KEY (school_id) REFERENCES schools(id)
);
```

#### `student_guardians`

Links parent accounts to students. This supports multiple guardians per student and multiple same-school students per Parent. Each verified invitation creates one row for one exact student; later children require separate same-school invitations. `status` makes access revocable without deleting the relationship. Every Parent query requires `status = 'active'` and the student's school to equal the Parent profile school, so revoked or stale cross-school rows grant no portal access.

```sql
CREATE TABLE student_guardians (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  parent_user_id BIGINT UNSIGNED NOT NULL,
  relationship ENUM('mother', 'father', 'guardian') NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('active', 'revoked') NOT NULL DEFAULT 'active',
  revoked_at DATETIME NULL,
  revoked_by_user_id BIGINT UNSIGNED NULL,
  revocation_reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_student_guardians_pair (student_id, parent_user_id),
  KEY idx_student_guardians_parent (parent_user_id),
  KEY idx_student_guardians_student_primary (student_id, is_primary),
  CONSTRAINT fk_student_guardians_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_guardians_parent FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### Parent invitation and access audit tables

- `parent_guardian_invitations` owns one school-issued invitation for one student and one normalized guardian identity. It stores only the claim-code hash, seven-day expiry, issuing administrator, delivery state, claim state, and revocation state.
- `parent_claim_challenges` owns the hashed browser challenge and hashed six-digit OTP, five-minute OTP expiry, resend/attempt limits, ten-minute verified completion window, and consumption timestamps.
- `guardian_access_events` is append-only for `granted`, `revoked`, and `restored` events and records the school, relationship, actor, reason, and time.

The idempotent `2026-09-02-parent-invitation-otp.sql` migration adds these structures and marks all existing guardian rows active. It contains no record deletion and does not fabricate past audit events.

### Enrollment

#### `enrollments`

Stores a student's enrollment per school year.

The school-year rollover workflow lets an administrator explicitly select one or many source-year students, review per-student promote, repeat, or skip decisions, and insert new target-year enrollments only for checked promote/repeat rows. The shared `students` record and all year-specific fee, payment, wallet, store, and reminder records remain separate.

The admin uses one Add students chooser for three focused workflows: one new student, multiple new students with optional shared grade/section/student-type defaults and per-row overrides, or one/many existing Pending students. The Enrolled students page renders one contextual trigger; the shared Admin header links to the same chooser only from other authorized pages. Existing-student enrollment creates only missing `enrollments` rows and never inserts a second `students` row or re-enters identity and guardian-link data. This workflow organization requires no schema change.

The exact Student Profile may correct grade, section, and student type only on an enrollment that already belongs to the active school year. Historical enrollment placement and enrollment status are read-only, and the profile editor never creates a missing enrollment. These rules reuse the existing table and require no migration.

```sql
CREATE TABLE enrollments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  school_year_id BIGINT UNSIGNED NOT NULL,
  grade_level_id BIGINT UNSIGNED NOT NULL,
  section_id BIGINT UNSIGNED NULL,
  student_type ENUM('new', 'transferee', 'returned') NULL,
  status ENUM('draft', 'submitted', 'enrolled', 'rejected', 'withdrawn') NOT NULL DEFAULT 'draft',
  submitted_at DATETIME NULL,
  enrolled_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_enrollments_student_year (student_id, school_year_id),
  KEY idx_enrollments_year_status (school_year_id, status),
  KEY idx_enrollments_grade_section (grade_level_id, section_id),
  CONSTRAINT fk_enrollments_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_enrollments_school_year FOREIGN KEY (school_year_id) REFERENCES school_years(id),
  CONSTRAINT fk_enrollments_grade_level FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id),
  CONSTRAINT fk_enrollments_section FOREIGN KEY (section_id) REFERENCES sections(id)
);
```

`students.sex` is reusable student-master data. `enrollments.student_type` is specific to the school year, so a student can be `new`, `transferee`, or `returned` in different years. Existing null values remain valid and display as `Pending`; age is calculated from `birthdate` and is never stored.

#### `enrollment_documents`

Tracks required enrollment document submissions.

```sql
CREATE TABLE enrollment_documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  document_type VARCHAR(80) NOT NULL,
  file_name VARCHAR(180) NULL,
  status ENUM('missing', 'submitted', 'approved', 'rejected') NOT NULL DEFAULT 'missing',
  submitted_at DATETIME NULL,
  reviewed_at DATETIME NULL,

  KEY idx_enrollment_documents_enrollment_status (enrollment_id, status),
  CONSTRAINT fk_enrollment_documents_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
);
```

### Fees And Billing

#### `fee_types`

Defines tuition and other school fees. Current MVP tuition installments are managed per student assignment through `tuition_payment_terms`; `fee_type_term_templates` remains in the schema as a reserved future template layer.

```sql
CREATE TABLE fee_types (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  school_year_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  category ENUM('tuition', 'other', 'allowance') NOT NULL,
  default_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_fee_types_year_name (school_year_id, name),
  KEY idx_fee_types_school_category_status (school_id, category, status),
  CONSTRAINT fk_fee_types_school FOREIGN KEY (school_id) REFERENCES schools(id),
  CONSTRAINT fk_fee_types_school_year FOREIGN KEY (school_year_id) REFERENCES school_years(id)
);
```

#### `fee_type_term_templates`

Stores reusable tuition payment term templates for a tuition fee type. This table is reserved for future template reuse; the current MVP does not expose template inputs in the Add fee type modal and does not auto-create terms during fee assignment. Admin/finance creates final per-student schedules through row-level Manage terms.

```sql
CREATE TABLE fee_type_term_templates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fee_type_id BIGINT UNSIGNED NOT NULL,
  term_name VARCHAR(120) NOT NULL,
  sort_order INT UNSIGNED NOT NULL,
  amount_due DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_fee_type_term_templates_order (fee_type_id, sort_order),
  UNIQUE KEY uq_fee_type_term_templates_name (fee_type_id, term_name),
  KEY idx_fee_type_term_templates_fee_type (fee_type_id),
  CONSTRAINT fk_fee_type_term_templates_fee_type FOREIGN KEY (fee_type_id) REFERENCES fee_types(id) ON DELETE CASCADE
);
```

#### `student_fee_assignments`

Assigns fees to students and tracks balances. The admin UI can assign one fee type to one or more selected enrolled students; the unique key prevents duplicate charges for the same student, fee type, and school year.

```sql
CREATE TABLE student_fee_assignments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  fee_type_id BIGINT UNSIGNED NOT NULL,
  school_year_id BIGINT UNSIGNED NOT NULL,
  amount_due DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  due_date DATE NULL,
  status ENUM('open', 'partial', 'paid', 'cancelled') NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_student_fee_assignments_student_fee_year (student_id, fee_type_id, school_year_id),
  KEY idx_student_fee_assignments_student_status_due (student_id, status, due_date),
  KEY idx_student_fee_assignments_year_status_due (school_year_id, status, due_date),
  CONSTRAINT fk_student_fee_assignments_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_fee_assignments_fee_type FOREIGN KEY (fee_type_id) REFERENCES fee_types(id),
  CONSTRAINT fk_student_fee_assignments_school_year FOREIGN KEY (school_year_id) REFERENCES school_years(id)
);
```

#### `parent_fee_summary_archives`

Keeps Fee summary organization private to each parent account. It supports reversible archive/restore plus an irreversible parent-facing tombstone, and never changes the fee assignment or another guardian's view.

```sql
CREATE TABLE parent_fee_summary_archives (
  parent_user_id BIGINT UNSIGNED NOT NULL,
  student_fee_assignment_id BIGINT UNSIGNED NOT NULL,
  archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,

  PRIMARY KEY (parent_user_id, student_fee_assignment_id),
  KEY idx_parent_fee_archives_parent_archived_assignment (parent_user_id, archived_at, student_fee_assignment_id),
  KEY idx_parent_fee_archives_parent_deleted_archived_assignment (parent_user_id, deleted_at, archived_at, student_fee_assignment_id),
  KEY idx_parent_fee_archives_assignment (student_fee_assignment_id),
  CONSTRAINT fk_parent_fee_archives_parent FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_parent_fee_archives_assignment FOREIGN KEY (student_fee_assignment_id) REFERENCES student_fee_assignments(id) ON DELETE CASCADE
);
```

The parent portal permits archiving and removal only for settled assignments. `deleted_at` starts a database-timed 30-day recovery window; clearing it returns a recoverable row to Archived while preserving `archived_at`. Expired tombstones remain visible as Permanently hidden without changing financial truth.

#### `tuition_payment_terms`

Stores per-student tuition installment schedules. These apply only to tuition assignments; other fees remain normal fee assignments. The application derives each student's inclusive term window from `school_years.starts_on` through `student_fee_assignments.due_date`, displays those dates in Manage terms, and reloads them inside the locked save transaction. The application keeps tuition term validation, payable checks, payment application, and assignment recalculation in one shared server-only helper for maintainability. No additional schedule-boundary columns or migration are required.

```sql
CREATE TABLE tuition_payment_terms (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_fee_assignment_id BIGINT UNSIGNED NOT NULL,
  term_name VARCHAR(120) NOT NULL,
  sort_order INT UNSIGNED NOT NULL,
  amount_due DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  due_date DATE NOT NULL,
  status ENUM('open', 'partial', 'paid', 'cancelled') NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_tuition_terms_assignment_order (student_fee_assignment_id, sort_order),
  UNIQUE KEY uq_tuition_terms_assignment_name (student_fee_assignment_id, term_name),
  KEY idx_tuition_terms_assignment_status_due (student_fee_assignment_id, status, due_date),
  KEY idx_tuition_terms_status_due (status, due_date),
  CONSTRAINT fk_tuition_terms_assignment FOREIGN KEY (student_fee_assignment_id) REFERENCES student_fee_assignments(id) ON DELETE CASCADE
);
```

### Payments And Receipts

#### `payments`

Stores payment transactions from parent or admin-entered channels.

```sql
CREATE TABLE payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  school_year_id BIGINT UNSIGNED NULL,
  payer_user_id BIGINT UNSIGNED NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  reference_number VARCHAR(80) NOT NULL,
  channel ENUM('xmeta_wallet', 'cash', 'card', 'online_banking', 'gcash', 'maya') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'paid', 'failed', 'voided', 'refunded') NOT NULL DEFAULT 'pending',
  paid_at DATETIME NULL,
  archived_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_payments_reference_number (reference_number),
  KEY idx_payments_school_status_paid_at (school_id, status, paid_at),
  KEY idx_payments_school_year_status_paid_at (school_id, school_year_id, status, paid_at),
  KEY idx_payments_school_year_archive_paid_at (school_id, school_year_id, archived_at, paid_at),
  KEY idx_payments_student_paid_at (student_id, paid_at),
  KEY idx_payments_payer_paid_at (payer_user_id, paid_at),
  CONSTRAINT fk_payments_school FOREIGN KEY (school_id) REFERENCES schools(id),
  CONSTRAINT fk_payments_school_year FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_payer FOREIGN KEY (payer_user_id) REFERENCES users(id),
  CONSTRAINT fk_payments_student FOREIGN KEY (student_id) REFERENCES students(id)
);
```

`school_year_id` is nullable for older migrated records, but new payment writes store the active school year so admin selected-year reports do not have to guess from related allocation rows. `archived_at` powers reversible active/archived Tuition collection log views only; payment status, allocations, receipts, balances, official reports, and parent history remain authoritative and unchanged.

#### `parent_payment_history_archives`

Keeps Payment history organization private to the paying parent. Archive remains reversible indefinitely; `deleted_at` starts a 30-day recovery window, after which the tombstone remains visible as Permanently hidden.

```sql
CREATE TABLE parent_payment_history_archives (
  parent_user_id BIGINT UNSIGNED NOT NULL,
  payment_id BIGINT UNSIGNED NOT NULL,
  archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,

  PRIMARY KEY (parent_user_id, payment_id),
  KEY idx_parent_payment_archives_parent_archived_payment (parent_user_id, archived_at, payment_id),
  KEY idx_parent_payment_archives_parent_deleted_archived_payment (parent_user_id, deleted_at, archived_at, payment_id),
  KEY idx_parent_payment_archives_payment (payment_id),
  CONSTRAINT fk_parent_payment_archives_parent FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_parent_payment_archives_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
);
```

Only finished payment statuses are archive-eligible; pending payments remain in Current payments. Archive metadata never changes receipts, allocations, balances, wallet top-ups, reports, or payment status.

#### `payment_allocations`

Splits one payment across one or more student fee balances.

```sql
CREATE TABLE payment_allocations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id BIGINT UNSIGNED NOT NULL,
  student_fee_assignment_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_payment_allocations_payment_fee (payment_id, student_fee_assignment_id),
  KEY idx_payment_allocations_fee (student_fee_assignment_id),
  CONSTRAINT fk_payment_allocations_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_allocations_fee FOREIGN KEY (student_fee_assignment_id) REFERENCES student_fee_assignments(id)
);
```

#### `payment_term_allocations`

Links payments to tuition installment terms.

```sql
CREATE TABLE payment_term_allocations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id BIGINT UNSIGNED NOT NULL,
  tuition_payment_term_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_payment_term_allocations_payment_term (payment_id, tuition_payment_term_id),
  KEY idx_payment_term_allocations_term (tuition_payment_term_id),
  CONSTRAINT fk_payment_term_allocations_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_term_allocations_term FOREIGN KEY (tuition_payment_term_id) REFERENCES tuition_payment_terms(id) ON DELETE CASCADE
);
```

#### `receipts`

Stores receipt records generated after successful payments.

```sql
CREATE TABLE receipts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id BIGINT UNSIGNED NOT NULL,
  receipt_number VARCHAR(80) NOT NULL,
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_receipts_payment (payment_id),
  UNIQUE KEY uq_receipts_number (receipt_number),
  CONSTRAINT fk_receipts_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
);
```

### Wallet And Allowance

#### `wallets`

Stores one wallet per student.

```sql
CREATE TABLE wallets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status ENUM('active', 'frozen', 'closed') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_wallets_student (student_id),
  KEY idx_wallets_status (status),
  CONSTRAINT fk_wallets_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
```

#### `wallet_transactions`

Tracks top-ups, store spending, adjustments, and reversals.

```sql
CREATE TABLE wallet_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  wallet_id BIGINT UNSIGNED NOT NULL,
  payment_id BIGINT UNSIGNED NULL,
  school_year_id BIGINT UNSIGNED NULL,
  type ENUM('top_up', 'purchase', 'adjustment', 'reversal') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  description VARCHAR(180) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_wallet_transactions_wallet_created (wallet_id, created_at),
  KEY idx_wallet_transactions_payment (payment_id),
  KEY idx_wallet_transactions_type_created (type, created_at),
  KEY idx_wallet_transactions_year_type_created (school_year_id, type, created_at),
  CONSTRAINT fk_wallet_transactions_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
  CONSTRAINT fk_wallet_transactions_payment FOREIGN KEY (payment_id) REFERENCES payments(id),
  CONSTRAINT fk_wallet_transactions_school_year FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE SET NULL
);
```

#### `wallet_ledger_archives`

Keeps Allowance ledger archive state separate from the operational wallet and scoped to one school year.

```sql
CREATE TABLE wallet_ledger_archives (
  wallet_id BIGINT UNSIGNED NOT NULL,
  school_year_id BIGINT UNSIGNED NOT NULL,
  archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (wallet_id, school_year_id),
  KEY idx_wallet_ledger_archives_year_archived_wallet (school_year_id, archived_at, wallet_id),
  CONSTRAINT fk_wallet_ledger_archives_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
  CONSTRAINT fk_wallet_ledger_archives_school_year FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE CASCADE
);
```

Dashboard calculation note:

- `wallets.balance` stores the current student allowance balance.
- Admin allowance total balance should sum one row per wallet.
- Admin allowance monthly top-up stats should sum current-month `wallet_transactions` rows where `type = 'top_up'`.
- `wallet_transactions` should drive full wallet history, parent dashboard wallet activity, selected student profile wallet activity, monthly spend, and store spending reports.
- New wallet top-up and purchase ledger rows store `school_year_id` for selected-year admin reporting.
- One-or-many parent top-ups use `wallet_top_up_batches` for atomic processing and idempotency. Each selected student still receives separate `payments`, `receipts`, and `wallet_transactions` records linked by `payments.wallet_top_up_batch_id`.
- Store purchases stay out of parent payment history because they are wallet ledger events, not payment records.
- Avoid summing `wallets.balance` after joining to `wallet_transactions`, because multiple ledger rows for the same wallet can duplicate the displayed total.
- `wallet_ledger_archives` supports reversible Active/Archived Allowance views for the selected year only. It is excluded from wallet writes, balances, KPIs, parent history, and official reports.

### Store And Canteen

#### `store_merchants`

Stores school store or canteen merchants.

```sql
CREATE TABLE store_merchants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  type ENUM('canteen', 'school_store', 'other') NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',

  UNIQUE KEY uq_store_merchants_school_name (school_id, name),
  KEY idx_store_merchants_school_status (school_id, status),
  CONSTRAINT fk_store_merchants_school FOREIGN KEY (school_id) REFERENCES schools(id)
);
```

#### `store_transactions`

Tracks wallet spending at canteen and school store merchants.

```sql
CREATE TABLE store_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  merchant_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  school_year_id BIGINT UNSIGNED NULL,
  wallet_transaction_id BIGINT UNSIGNED NOT NULL,
  reference_number VARCHAR(80) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_store_transactions_reference (reference_number),
  KEY idx_store_transactions_student_date (student_id, purchased_at),
  KEY idx_store_transactions_merchant_date (merchant_id, purchased_at),
  KEY idx_store_transactions_year_date (school_year_id, purchased_at),
  CONSTRAINT fk_store_transactions_merchant FOREIGN KEY (merchant_id) REFERENCES store_merchants(id),
  CONSTRAINT fk_store_transactions_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_store_transactions_school_year FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE SET NULL,
  CONSTRAINT fk_store_transactions_wallet_txn FOREIGN KEY (wallet_transaction_id) REFERENCES wallet_transactions(id)
);
```

### Notifications And Reporting

#### `school_email_templates`

Stores school-owned subject and introductory-message templates for the three implemented payment-reminder types. Only school administrators manage these rows. Templates contain plain text plus allowlisted placeholders; SMTP credentials and raw HTML are never stored. Protected XMETA defaults remain in application code, so a school without custom rows can still send reminders.

```sql
CREATE TABLE school_email_templates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  reminder_type ENUM('tuition_due', 'overdue_notice', 'final_notice') NOT NULL,
  name VARCHAR(120) NOT NULL,
  subject_template VARCHAR(220) NOT NULL,
  message_template TEXT NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_school_email_templates_name (school_id, name)
);
```

#### `notification_logs`

Stores reminder and notification history for parents.

```sql
CREATE TABLE notification_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  school_year_id BIGINT UNSIGNED NULL,
  recipient_user_id BIGINT UNSIGNED NULL,
  student_id BIGINT UNSIGNED NULL,
  type ENUM('payment_reminder', 'receipt', 'low_wallet', 'enrollment_update') NOT NULL,
  channel ENUM('email', 'sms', 'in_app') NOT NULL,
  status ENUM('queued', 'sent', 'failed') NOT NULL DEFAULT 'queued',
  message_body TEXT NULL,
  email_template_id BIGINT UNSIGNED NULL,
  email_template_name VARCHAR(120) NULL,
  subject_line VARCHAR(220) NULL,
  sent_at DATETIME NULL,
  archived_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_notification_logs_school_type_created (school_id, type, created_at),
  KEY idx_notification_logs_school_year_type_created (school_id, school_year_id, type, created_at),
  KEY idx_notification_logs_school_year_type_archive_created (school_id, school_year_id, type, archived_at, created_at),
  KEY idx_notification_logs_recipient_created (recipient_user_id, created_at),
  KEY idx_notification_logs_student_created (student_id, created_at),
  CONSTRAINT fk_notification_logs_school FOREIGN KEY (school_id) REFERENCES schools(id),
  CONSTRAINT fk_notification_logs_school_year FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE SET NULL,
  CONSTRAINT fk_notification_logs_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id),
  CONSTRAINT fk_notification_logs_student FOREIGN KEY (student_id) REFERENCES students(id)
);
```

Implementation status: real payment reminder delivery uses pooled Nodemailer SMTP plus protected XMETA or school-owned templates. School administrators manage template lifecycle; finance-authorized staff select active matching templates. The server resolves and locks school ownership, replaces only allowlisted placeholders, escapes rendered HTML, and always appends the authoritative fee and tuition-term statement. New `notification_logs` rows snapshot `email_template_id`, `email_template_name`, `subject_line`, and the rendered introductory `message_body`, then move from `queued` to `sent` or `failed`. Legacy rows keep nullable audit fields. Archive, same-day duplicate protection, and failed retries remain unchanged. SMTP credentials stay in deployment configuration; SMS, scheduling, webhooks, and report alerts remain future.

Reports are generated from query views over payments, fee assignments, wallets, store transactions, and reminder history instead of storing separate report rows. Every visible Admin and Parent table export uses branded Excel/PDF. School Admin, Super Admin, and protected Reports-page PDF controls share an outlined semantic XMETA red/orange style; Excel controls keep their existing treatment. Parent coverage includes Fee summary, Payment history, dashboard recent payments, and wallet activity on Dashboard, Wallet, and Student Profile, including Current, Archived, and Removed scopes where applicable. Browser ExcelJS loads only on export; protected Admin reports generate workbooks server-side from authorized queries. Legacy protected CSV URLs remain compatible, and this presentation change adds no report storage or accounting fields.

## Indexing Strategy

Use indexes based on the screens and workflows in the app.

| Workflow | Indexes |
| --- | --- |
| Login | `users(role, email)`, `users(role, phone)` |
| Admin account status | `users(role, status)` |
| Student lookup | `students(school_id, student_reference)`, `students(last_name, first_name)` |
| Student lists | `students(school_id, status)` |
| Enrollment dashboard | `enrollments(school_year_id, status)` |
| Grade/section lists | `enrollments(grade_level_id, section_id)` |
| Parent linked students | `student_guardians(parent_user_id)` |
| Student guardian list | `student_guardians(student_id, is_primary)` |
| Fee summary | `student_fee_assignments(student_id, status, due_date)` plus parent-specific `parent_fee_summary_archives(parent_user_id, archived_at, deleted_at, student_fee_assignment_id)` |
| Tuition report | `student_fee_assignments(school_year_id, status, due_date)` |
| Tuition collections log | `payments(school_id, school_year_id, archived_at, paid_at)` plus `payment_allocations`/`payment_term_allocations` and tuition `fee_types` |
| Parent payment history | `payments(payer_user_id, paid_at)` plus parent-specific `parent_payment_history_archives(parent_user_id, archived_at, deleted_at, payment_id)` |
| Student payment history | `payments(student_id, paid_at)` |
| Wallet ledger | `wallet_transactions(wallet_id, created_at)`; selected-year admin archive view uses `wallet_ledger_archives(school_year_id, archived_at, wallet_id)` |
| Store report | `store_transactions(student_id, purchased_at)`, `store_transactions(merchant_id, purchased_at)` |
| Notification history | `notification_logs(school_id, type, created_at)` |

## ERD

```mermaid
erDiagram
  USERS ||--o| ADMIN_PROFILES : "has admin profile"
  USERS ||--o{ AUTH_SESSIONS : "has sessions"
  USERS ||--o| PARENT_PROFILES : "has parent profile"
  USERS ||--o{ STUDENT_GUARDIANS : "parent account links"
  USERS ||--o{ PAYMENTS : "pays"
  USERS ||--o{ NOTIFICATION_LOGS : "receives"

  SCHOOLS ||--o{ SCHOOL_YEARS : "has"
  SCHOOLS ||--o{ ADMIN_PROFILES : "linked admins"
  SCHOOLS ||--o{ GRADE_LEVELS : "has"
  SCHOOLS ||--o{ SECTIONS : "has"
  SCHOOLS ||--o{ STUDENTS : "has"
  SCHOOLS ||--o{ FEE_TYPES : "defines"
  SCHOOLS ||--o{ PAYMENTS : "collects"
  SCHOOLS ||--o{ STORE_MERCHANTS : "has"
  SCHOOLS ||--o{ NOTIFICATION_LOGS : "sends"

  SCHOOL_YEARS ||--o{ SECTIONS : "organizes"
  SCHOOL_YEARS ||--o{ ENROLLMENTS : "contains"
  SCHOOL_YEARS ||--o{ FEE_TYPES : "prices"
  SCHOOL_YEARS ||--o{ STUDENT_FEE_ASSIGNMENTS : "bills"

  GRADE_LEVELS ||--o{ SECTIONS : "has"
  GRADE_LEVELS ||--o{ ENROLLMENTS : "places"
  SECTIONS ||--o{ ENROLLMENTS : "groups"

  STUDENTS ||--o{ STUDENT_GUARDIANS : "has"
  STUDENTS ||--o{ ENROLLMENTS : "enrolls"
  STUDENTS ||--o{ STUDENT_FEE_ASSIGNMENTS : "owes"
  STUDENTS ||--o{ PAYMENTS : "paid for"
  STUDENTS ||--o| WALLETS : "owns"
  STUDENTS ||--o{ STORE_TRANSACTIONS : "spends"
  STUDENTS ||--o{ NOTIFICATION_LOGS : "about"

  ENROLLMENTS ||--o{ ENROLLMENT_DOCUMENTS : "requires"
  FEE_TYPES ||--o{ STUDENT_FEE_ASSIGNMENTS : "assigned as"
  STUDENT_FEE_ASSIGNMENTS ||--o{ PAYMENT_ALLOCATIONS : "paid by"

  PAYMENTS ||--o{ PAYMENT_ALLOCATIONS : "allocates"
  PAYMENTS ||--o| RECEIPTS : "generates"
  PAYMENTS ||--o{ WALLET_TRANSACTIONS : "may fund"

  WALLETS ||--o{ WALLET_TRANSACTIONS : "records"
  WALLET_TRANSACTIONS ||--o| STORE_TRANSACTIONS : "may create"
  STORE_MERCHANTS ||--o{ STORE_TRANSACTIONS : "records"
```

## Step-by-Step Admin/School Flowcharts

### Admin/School Setup Flow

```mermaid
flowchart TD
  A["Admin opens /admin/register"] --> B["Create user and admin profile only"]
  B --> C["Set users.status to pending"]
  C --> D["Redirect to admin login with approval message"]
  D --> E["Company super admin approves account"]
  E --> F["Admin logs in"]
  F --> G["Redirect to setup-only onboarding"]
  G --> H{"School setup complete?"}
  H -->|Yes| I["Use linked school context"]
  H -->|No| J{"staff_role is school_administrator?"}
  J -->|No| K["Ask a school administrator to complete setup"]
  J -->|Yes| L["Complete school setup form"]
  L --> M["Save school, school years, one active year, grades, and sections"]
  M --> N["Link same-school admin profiles to schools.id"]
  N --> I
```

### Admin Student and Enrollment Flow

```mermaid
flowchart TD
  A["Admin opens students page"] --> B["Open unified Add students chooser"]
  B -->|One new| C["Create one student record"]
  B -->|Multiple new| D["Apply shared defaults and validate each student row"]
  B -->|Existing| D1["Create only missing active-year enrollments"]
  D --> E["Create valid student records"]
  C --> F["Create enrollment for active school year"]
  E --> F
  D1 --> F
  F --> G["Assign grade level and section"]
  G --> H["Student appears in admin student table"]
  H --> I["Student profile selector links to /admin/students/studentId"]
  H --> J["School administrator can issue exact-student Parent invitation"]
```

### Admin Payment Monitoring Flow

```mermaid
flowchart TD
  A["Admin opens dashboard"] --> B["Read payments, fees, wallets, and store transactions"]
  B --> C["Show collection KPIs"]
  C --> D["Open tuition report"]
  D --> E["Filter by status, grade, section, or due date"]
  E --> F["Open collections log"]
  F --> G["Review payment records and receipts"]
  G --> H["Open reports page"]
  H --> I["Download CSV and PDF reports from report query"]
  I --> J["Reminder history uses notification_logs"]
  J --> K["Scheduled report delivery and report-alert notifications remain future"]
```

## Step-by-Step Parent Flowcharts

### Invite-Only Parent Claim Flow

```mermaid
flowchart TD
  A["School admin issues exact-student invitation"] --> B["Email single-use claim code"]
  B --> C["Parent enters code and receives separate email OTP"]
  C --> D{"OTP and invitation valid?"}
  D -->|No| E["Generic retry or blocked state"]
  D -->|Yes| F{"Matching Parent exists?"}
  F -->|No| G["Create Parent and immutable school profile"]
  F -->|Yes| H["Require matching session or password"]
  G --> I["Create active guardian link and grant event"]
  H --> I
  I --> J["Consume invitation and challenge atomically"]
  J --> K["Redirect to parent dashboard"]
```

### Parent Payment Flow

```mermaid
flowchart TD
  A["Parent opens fee summary"] --> B["Load linked students"]
  B --> C["Load open and partial fee assignments"]
  C --> D["Parent selects payable fees"]
  D --> E["Create payment with pending status"]
  E --> F["Payment channel confirms payment"]
  F --> G["Update payment status to paid"]
  G --> H["Create payment allocations"]
  H --> I["Update student fee balances and statuses"]
  I --> J["Create receipt"]
  J --> K["Show receipt and payment history"]
```

### Parent Wallet and Allowance Flow

Wallet top-up supports atomic one-or-many student batches. Store purchases use the same wallet ledger as allowance top-ups. In the admin Store transactions page, `Create merchant` and `Record purchase` open focused action modals above the real transaction log.

```mermaid
flowchart TD
  A["Parent opens wallet page"] --> B["Select 1-20 eligible student wallets"]
  B --> C["Set amount per student and review total"]
  C --> D["Lock and validate every linked wallet"]
  D --> E["Create idempotent parent batch"]
  E --> F["Create one payment, receipt, and wallet transaction per student"]
  F --> G["Commit all records or roll back all"]
  G --> H["Admin or finance records canteen/store purchase"]
  H --> I["Create wallet purchase transaction"]
  I --> J["Create store transaction"]
  J --> K["Parent sees wallet history and dashboard wallet activity"]
  K --> L["Selected student profile shows that student's wallet activity"]
  L --> M["Admin sees store reports"]
  M --> N["Admin allowance total sums each wallet balance once"]
```

## Suggested Implementation Order

1. Keep the current auth schema working first.
2. Add school setup tables: `schools`, `school_years`, `grade_levels`, `sections`.
3. Add student and guardian tables: `students`, `student_guardians`.
4. Add enrollment tables: `enrollments`, `enrollment_documents`.
5. Add fee tables: `fee_types`, `student_fee_assignments`.
6. Add payment and receipt tables: `payments`, `payment_allocations`, `receipts`.
7. Add wallet tables: `wallets`, `wallet_transactions`, `wallet_top_up_batches`, `wallet_ledger_archives`.
8. Add store tables: `store_merchants`, `store_transactions`.
9. Use notification logs for SMTP email payment reminder delivery and queued/sent/failed history.
10. Build branded Excel and PDF report exports from existing operational queries and authorized filtered dashboard rows instead of adding report storage tables; retain protected Admin CSV URLs only for compatibility.
11. Add SMS, scheduled/background delivery, webhooks, bounce handling, and report alerts later.

## Production Fresh-Schema Import

The canonical bootstrap SQL stays under `database/`. `utilities/database/xmetapay-production-schema.sql` is a generated schema-only bundle for importing all current tables into a new empty GoDaddy Hosted Database or cPanel/phpMyAdmin database. It contains no row data and omits database creation and selection statements so the hosting provider remains in control of the target.

The bundle is checked against both canonical schema files and rejected by tests if it contains insert, update, delete, bulk-load, table-drop, database-drop, or truncate statements. It is not an upgrade mechanism for an existing database. Application startup and every portal role remain unable to import or modify the schema.

Runtime database configuration prefers the GoDaddy Hosted Database variables `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. The existing `MYSQL_*` names remain a local XAMPP fallback, so deployments use provider-managed credentials without changing local development or the persistent schema.

## MySQL/XAMPP Notes

- Use InnoDB so foreign keys work correctly.
- Use `utf8mb4_unicode_ci` so names and school text support broad character sets.
- Store money as `DECIMAL(10,2)`, not floating point.
- Keep authentication secrets in `.env`, not in SQL or Markdown.
- Do not commit real parent, student, school, payment, or credential data.
- Add full SQL migrations only after reviewing this plan and confirming the app screens that should become database-backed first.
- Provision production databases and backups through the hosting provider; the fresh-schema bundle does not create databases, seed accounts, export data, upgrade live records, or perform automatic backups.
