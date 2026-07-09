USE xmetapay_db;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  role ENUM('admin', 'parent', 'super_admin') NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  last_used_at DATETIME NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_auth_sessions_token_hash (token_hash),
  KEY idx_auth_sessions_user_revoked_expires (user_id, revoked_at, expires_at),
  KEY idx_auth_sessions_role_expires (role, expires_at),

  CONSTRAINT fk_auth_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schools (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  code VARCHAR(40) NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_schools_code (code),
  KEY idx_schools_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @admin_school_column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'admin_profiles'
    AND COLUMN_NAME = 'school_id'
);

SET @sql := IF(
  @admin_school_column_exists = 0,
  'ALTER TABLE admin_profiles ADD COLUMN school_id BIGINT UNSIGNED NULL AFTER user_id',
  'SELECT ''admin_profiles.school_id already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @admin_school_index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'admin_profiles'
    AND INDEX_NAME = 'idx_admin_profiles_school_id'
);

SET @sql := IF(
  @admin_school_index_exists = 0,
  'CREATE INDEX idx_admin_profiles_school_id ON admin_profiles (school_id)',
  'SELECT ''idx_admin_profiles_school_id already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @admin_school_fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'admin_profiles'
    AND CONSTRAINT_NAME = 'fk_admin_profiles_school'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql := IF(
  @admin_school_fk_exists = 0,
  'ALTER TABLE admin_profiles ADD CONSTRAINT fk_admin_profiles_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL',
  'SELECT ''fk_admin_profiles_school already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS school_years (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS grade_levels (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(60) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,

  UNIQUE KEY uq_grade_levels_school_name (school_id, name),
  KEY idx_grade_levels_school_order (school_id, sort_order),
  CONSTRAINT fk_grade_levels_school FOREIGN KEY (school_id) REFERENCES schools(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sections (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS students (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS student_guardians (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enrollments (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enrollment_documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  document_type VARCHAR(80) NOT NULL,
  file_name VARCHAR(180) NULL,
  status ENUM('missing', 'submitted', 'approved', 'rejected') NOT NULL DEFAULT 'missing',
  submitted_at DATETIME NULL,
  reviewed_at DATETIME NULL,

  KEY idx_enrollment_documents_enrollment_status (enrollment_id, status),
  CONSTRAINT fk_enrollment_documents_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fee_types (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fee_type_term_templates (
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
  CONSTRAINT fk_fee_type_term_templates_fee_type
    FOREIGN KEY (fee_type_id) REFERENCES fee_types(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS student_fee_assignments (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
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
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_payments_reference_number (reference_number),
  KEY idx_payments_school_status_paid_at (school_id, status, paid_at),
  KEY idx_payments_school_year_status_paid_at (school_id, school_year_id, status, paid_at),
  KEY idx_payments_student_paid_at (student_id, paid_at),
  KEY idx_payments_payer_paid_at (payer_user_id, paid_at),
  CONSTRAINT fk_payments_school FOREIGN KEY (school_id) REFERENCES schools(id),
  CONSTRAINT fk_payments_school_year FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_payer FOREIGN KEY (payer_user_id) REFERENCES users(id),
  CONSTRAINT fk_payments_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tuition_payment_terms (
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
  CONSTRAINT fk_tuition_terms_assignment
    FOREIGN KEY (student_fee_assignment_id) REFERENCES student_fee_assignments(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_allocations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id BIGINT UNSIGNED NOT NULL,
  student_fee_assignment_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_payment_allocations_payment_fee (payment_id, student_fee_assignment_id),
  KEY idx_payment_allocations_fee (student_fee_assignment_id),
  CONSTRAINT fk_payment_allocations_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_allocations_fee FOREIGN KEY (student_fee_assignment_id) REFERENCES student_fee_assignments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_term_allocations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id BIGINT UNSIGNED NOT NULL,
  tuition_payment_term_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_payment_term_allocations_payment_term (payment_id, tuition_payment_term_id),
  KEY idx_payment_term_allocations_term (tuition_payment_term_id),
  CONSTRAINT fk_payment_term_allocations_payment
    FOREIGN KEY (payment_id) REFERENCES payments(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_payment_term_allocations_term
    FOREIGN KEY (tuition_payment_term_id) REFERENCES tuition_payment_terms(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS receipts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id BIGINT UNSIGNED NOT NULL,
  receipt_number VARCHAR(80) NOT NULL,
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_receipts_payment (payment_id),
  UNIQUE KEY uq_receipts_number (receipt_number),
  CONSTRAINT fk_receipts_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wallets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status ENUM('active', 'frozen', 'closed') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_wallets_student (student_id),
  KEY idx_wallets_status (status),
  CONSTRAINT fk_wallets_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wallet_transactions (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS store_merchants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  type ENUM('canteen', 'school_store', 'other') NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',

  UNIQUE KEY uq_store_merchants_school_name (school_id, name),
  KEY idx_store_merchants_school_status (school_id, status),
  CONSTRAINT fk_store_merchants_school FOREIGN KEY (school_id) REFERENCES schools(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS store_transactions (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  school_year_id BIGINT UNSIGNED NULL,
  recipient_user_id BIGINT UNSIGNED NULL,
  student_id BIGINT UNSIGNED NULL,
  type ENUM('payment_reminder', 'receipt', 'low_wallet', 'enrollment_update') NOT NULL,
  channel ENUM('email', 'sms', 'in_app') NOT NULL,
  status ENUM('queued', 'sent', 'failed') NOT NULL DEFAULT 'queued',
  message_body TEXT NULL,
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_notification_logs_school_type_created (school_id, type, created_at),
  KEY idx_notification_logs_school_year_type_created (school_id, school_year_id, type, created_at),
  KEY idx_notification_logs_recipient_created (recipient_user_id, created_at),
  KEY idx_notification_logs_student_created (student_id, created_at),
  CONSTRAINT fk_notification_logs_school FOREIGN KEY (school_id) REFERENCES schools(id),
  CONSTRAINT fk_notification_logs_school_year FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE SET NULL,
  CONSTRAINT fk_notification_logs_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id),
  CONSTRAINT fk_notification_logs_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
