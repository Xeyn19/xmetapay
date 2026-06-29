# XMETA Pay Database Schema Plan

## Project Database Overview

XMETA Pay uses one MySQL database for two connected portals:

- Admin/school portal: school setup, student records, parent directory, tuition, collections, allowance, store transactions, and reports.
- Parent portal: registration, student linking by reference, linked enrolled student access, fee viewing, tuition payment, receipts, payment history, wallet top-up, dashboard wallet activity, selected student wallet activity, and full wallet/store-spending history.

Related role guide: `ADMIN_ROLES.md` explains the `school_administrator`, `registrar`, and `finance_officer` permissions used by the admin/school portal.

The current database already starts with shared authentication tables. The practical MVP should keep that foundation and add school, student, enrollment, billing, payment, wallet, and reporting tables around it.

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

Shared login table for both admin and parent accounts.

| Column | Purpose |
| --- | --- |
| `id` | Primary key |
| `role` | `admin` or `parent` |
| `name` | Display name |
| `email` | Login/contact email |
| `phone` | Optional login/contact phone |
| `password_hash` | Hashed password only |
| `status` | `active`, `pending`, or `disabled` |
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
| `role` | Session portal role: `admin` or `parent` |
| `token_hash` | HMAC hash of the browser session token |
| `expires_at` | Session expiry time |
| `last_used_at` | Last valid session read |
| `revoked_at` | Logout/revocation timestamp |
| `created_at` | Creation timestamp |

Important indexes:

```sql
UNIQUE KEY uq_auth_sessions_token_hash (token_hash),
KEY idx_auth_sessions_user_revoked_expires (user_id, revoked_at, expires_at),
KEY idx_auth_sessions_role_expires (role, expires_at)
```

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
| `student_name` | Combined student first/middle/last name captured during parent registration for pending-link display |
| `student_reference` | Student reference captured during registration |
| `relationship` | Mother, father, or guardian |

## Full Practical MVP Schema

The following tables extend the current auth schema into the full dashboard and parent portal data model.

### School Setup

#### `schools`

Stores schools using XMETA Pay.

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

Stores school years per school.

```sql
CREATE TABLE school_years (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(40) NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status ENUM('active', 'closed') NOT NULL DEFAULT 'active',
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

```sql
CREATE TABLE students (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  student_reference VARCHAR(60) NOT NULL,
  first_name VARCHAR(80) NOT NULL,
  middle_name VARCHAR(80) NULL,
  last_name VARCHAR(80) NOT NULL,
  birthdate DATE NULL,
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

Links parent accounts to students. This supports multiple guardians per student and multiple students per parent.

```sql
CREATE TABLE student_guardians (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  parent_user_id BIGINT UNSIGNED NOT NULL,
  relationship ENUM('mother', 'father', 'guardian') NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_student_guardians_pair (student_id, parent_user_id),
  KEY idx_student_guardians_parent (parent_user_id),
  KEY idx_student_guardians_student_primary (student_id, is_primary),
  CONSTRAINT fk_student_guardians_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_guardians_parent FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Enrollment

#### `enrollments`

Stores a student's enrollment per school year.

```sql
CREATE TABLE enrollments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  school_year_id BIGINT UNSIGNED NOT NULL,
  grade_level_id BIGINT UNSIGNED NOT NULL,
  section_id BIGINT UNSIGNED NULL,
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

Defines tuition and other school fees.

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

#### `student_fee_assignments`

Assigns fees to students and tracks balances.

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

### Payments And Receipts

#### `payments`

Stores payment transactions from parent or admin-entered channels.

```sql
CREATE TABLE payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  payer_user_id BIGINT UNSIGNED NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  reference_number VARCHAR(80) NOT NULL,
  channel ENUM('xmeta_wallet', 'cash', 'card', 'online_banking', 'gcash', 'maya') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'paid', 'failed', 'voided', 'refunded') NOT NULL DEFAULT 'pending',
  paid_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_payments_reference_number (reference_number),
  KEY idx_payments_school_status_paid_at (school_id, status, paid_at),
  KEY idx_payments_student_paid_at (student_id, paid_at),
  KEY idx_payments_payer_paid_at (payer_user_id, paid_at),
  CONSTRAINT fk_payments_school FOREIGN KEY (school_id) REFERENCES schools(id),
  CONSTRAINT fk_payments_payer FOREIGN KEY (payer_user_id) REFERENCES users(id),
  CONSTRAINT fk_payments_student FOREIGN KEY (student_id) REFERENCES students(id)
);
```

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
  type ENUM('top_up', 'purchase', 'adjustment', 'reversal') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  description VARCHAR(180) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_wallet_transactions_wallet_created (wallet_id, created_at),
  KEY idx_wallet_transactions_payment (payment_id),
  KEY idx_wallet_transactions_type_created (type, created_at),
  CONSTRAINT fk_wallet_transactions_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
  CONSTRAINT fk_wallet_transactions_payment FOREIGN KEY (payment_id) REFERENCES payments(id)
);
```

Dashboard calculation note:

- `wallets.balance` stores the current student allowance balance.
- Admin allowance total balance should sum one row per wallet.
- `wallet_transactions` should drive full wallet history, parent dashboard wallet activity, selected student profile wallet activity, monthly spend, and store spending reports.
- Store purchases stay out of parent payment history because they are wallet ledger events, not payment records.
- Avoid summing `wallets.balance` after joining to `wallet_transactions`, because multiple ledger rows for the same wallet can duplicate the displayed total.

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
  wallet_transaction_id BIGINT UNSIGNED NOT NULL,
  reference_number VARCHAR(80) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_store_transactions_reference (reference_number),
  KEY idx_store_transactions_student_date (student_id, purchased_at),
  KEY idx_store_transactions_merchant_date (merchant_id, purchased_at),
  CONSTRAINT fk_store_transactions_merchant FOREIGN KEY (merchant_id) REFERENCES store_merchants(id),
  CONSTRAINT fk_store_transactions_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_store_transactions_wallet_txn FOREIGN KEY (wallet_transaction_id) REFERENCES wallet_transactions(id)
);
```

### Notifications And Reporting

#### `notification_logs`

Stores reminders and payment notifications sent to parents.

```sql
CREATE TABLE notification_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  recipient_user_id BIGINT UNSIGNED NULL,
  student_id BIGINT UNSIGNED NULL,
  type ENUM('payment_reminder', 'receipt', 'low_wallet', 'enrollment_update') NOT NULL,
  channel ENUM('email', 'sms', 'in_app') NOT NULL,
  status ENUM('queued', 'sent', 'failed') NOT NULL DEFAULT 'queued',
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_notification_logs_school_type_created (school_id, type, created_at),
  KEY idx_notification_logs_recipient_created (recipient_user_id, created_at),
  KEY idx_notification_logs_student_created (student_id, created_at),
  CONSTRAINT fk_notification_logs_school FOREIGN KEY (school_id) REFERENCES schools(id),
  CONSTRAINT fk_notification_logs_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id),
  CONSTRAINT fk_notification_logs_student FOREIGN KEY (student_id) REFERENCES students(id)
);
```

Reports should usually be generated from query views over payments, fee assignments, wallets, and store transactions instead of storing separate report rows. CSV/PDF exports can be generated from those queries.

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
| Fee summary | `student_fee_assignments(student_id, status, due_date)` |
| Tuition report | `student_fee_assignments(school_year_id, status, due_date)` |
| Collections log | `payments(school_id, status, paid_at)` |
| Parent payment history | `payments(payer_user_id, paid_at)` |
| Student payment history | `payments(student_id, paid_at)` |
| Wallet ledger | `wallet_transactions(wallet_id, created_at)` |
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
  B --> C["Admin lands on dashboard"]
  C --> D{"School setup complete?"}
  D -->|Yes| E["Use linked school context"]
  D -->|No| F{"staff_role is school_administrator?"}
  F -->|No| G["Ask a school administrator to complete setup"]
  F -->|Yes| H["Open Set up school records"]
  H --> I["Save school, active year, grade levels, and sections"]
  I --> J["Link same-school admin profiles to schools.id"]
  J --> E
```

### Admin Student and Enrollment Flow

```mermaid
flowchart TD
  A["Admin opens students page"] --> B["Create or search student by reference"]
  B --> C{"Student exists?"}
  C -->|No| D["Create student record"]
  C -->|Yes| E["Open existing student record"]
  D --> F["Create enrollment for active school year"]
  E --> F
  F --> G["Assign grade level and section"]
  G --> H["Student appears in admin student table"]
  H --> I["Student profile selector links to /admin/students/studentId"]
  H --> J["Parent can link later using student_reference"]
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
  H --> I["Export CSV or PDF from report query"]
```

## Step-by-Step Parent Flowcharts

### Parent Registration and Login Flow

```mermaid
flowchart TD
  A["Parent opens register page"] --> B["Submit guardian details and student reference"]
  B --> C["Create user with role parent"]
  C --> D["Create parent profile"]
  D --> E["Find student by student_reference"]
  E --> F{"Student found?"}
  F -->|Yes| G["Create student_guardians link"]
  F -->|No| H["Keep profile pending for school review"]
  G --> I["Create session"]
  H --> I
  I --> J["Redirect to parent dashboard"]
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

Wallet top-up and store/canteen purchase recording are implemented now. Store purchases use the same wallet ledger as allowance top-ups.

```mermaid
flowchart TD
  A["Parent opens wallet page"] --> B["Load student wallets"]
  B --> C["Parent chooses top-up amount"]
  C --> D["Create payment for wallet top-up"]
  D --> E["Payment succeeds"]
  E --> F["Increase wallet balance"]
  F --> G["Create wallet top_up transaction"]
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
7. Add wallet tables: `wallets`, `wallet_transactions`.
8. Add store tables: `store_merchants`, `store_transactions`.
9. Add notification logs after fee/payment reminders are implemented.
10. Build report queries from existing operational tables instead of adding report storage tables.

## MySQL/XAMPP Notes

- Use InnoDB so foreign keys work correctly.
- Use `utf8mb4_unicode_ci` so names and school text support broad character sets.
- Store money as `DECIMAL(10,2)`, not floating point.
- Keep authentication secrets in `.env`, not in SQL or Markdown.
- Do not commit real parent, student, school, payment, or credential data.
- Add full SQL migrations only after reviewing this plan and confirming the app screens that should become database-backed first.
