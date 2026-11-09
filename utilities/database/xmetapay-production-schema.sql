-- XMETA EDU production schema for a new, empty cPanel/phpMyAdmin database.
-- Generated from database/auth-schema.sql and database/full-schema-v1.sql.
-- Select the target database in phpMyAdmin before importing this file.
-- Schema only: no accounts, schools, students, payments, seeds, or other row data.

SET NAMES utf8mb4;

-- Authentication foundation
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role ENUM('admin', 'parent', 'super_admin') NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active', 'pending', 'disabled') NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_users_role_email (role, email),
  UNIQUE KEY uq_users_role_phone (role, phone),
  KEY idx_users_role_status (role, status),
  KEY idx_users_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS password_reset_challenges (
  user_id BIGINT UNSIGNED NOT NULL,
  challenge_token_hash CHAR(64) NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  otp_expires_at DATETIME NOT NULL,
  resend_available_at DATETIME NOT NULL,
  send_window_started_at DATETIME NOT NULL,
  send_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  verified_at DATETIME NULL,
  reset_expires_at DATETIME NULL,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (user_id),
  UNIQUE KEY uq_password_reset_challenge_token (challenge_token_hash),
  KEY idx_password_reset_expiry_consumed (otp_expires_at, consumed_at),
  KEY idx_password_reset_resend (resend_available_at),

  CONSTRAINT fk_password_reset_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  school_name VARCHAR(180) NOT NULL,
  staff_role ENUM('finance_officer', 'registrar', 'school_administrator') NOT NULL,

  UNIQUE KEY uq_admin_profiles_user_id (user_id),
  KEY idx_admin_profiles_school_name (school_name),

  CONSTRAINT fk_admin_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parent_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  student_name VARCHAR(120) NOT NULL,
  student_reference VARCHAR(60) NOT NULL,
  relationship ENUM('mother', 'father', 'guardian') NOT NULL,

  UNIQUE KEY uq_parent_profiles_user_id (user_id),
  KEY idx_parent_profiles_student_reference (student_reference),
  KEY idx_parent_profiles_student_name (student_name),

  CONSTRAINT fk_parent_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Application schema
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

CREATE TABLE IF NOT EXISTS password_reset_challenges (
  user_id BIGINT UNSIGNED NOT NULL,
  challenge_token_hash CHAR(64) NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  otp_expires_at DATETIME NOT NULL,
  resend_available_at DATETIME NOT NULL,
  send_window_started_at DATETIME NOT NULL,
  send_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  verified_at DATETIME NULL,
  reset_expires_at DATETIME NULL,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (user_id),
  UNIQUE KEY uq_password_reset_challenge_token (challenge_token_hash),
  KEY idx_password_reset_expiry_consumed (otp_expires_at, consumed_at),
  KEY idx_password_reset_resend (resend_available_at),

  CONSTRAINT fk_password_reset_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schools (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  code VARCHAR(40) NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  education_scope ENUM('basic', 'higher', 'both') NOT NULL DEFAULT 'basic',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_schools_code (code),
  KEY idx_schools_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS school_email_templates (
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

  UNIQUE KEY uq_school_email_templates_name (school_id, name),
  KEY idx_school_email_templates_type_status (school_id, reminder_type, status, is_default),
  CONSTRAINT fk_school_email_templates_school
    FOREIGN KEY (school_id) REFERENCES schools(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_school_email_templates_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_school_email_templates_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL
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

SET @parent_school_column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'parent_profiles'
    AND COLUMN_NAME = 'school_id'
);

SET @sql := IF(
  @parent_school_column_exists = 0,
  'ALTER TABLE parent_profiles ADD COLUMN school_id BIGINT UNSIGNED NULL AFTER user_id',
  'SELECT ''parent_profiles.school_id already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @parent_school_index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'parent_profiles'
    AND INDEX_NAME = 'idx_parent_profiles_school_id'
);

SET @sql := IF(
  @parent_school_index_exists = 0,
  'CREATE INDEX idx_parent_profiles_school_id ON parent_profiles (school_id)',
  'SELECT ''idx_parent_profiles_school_id already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @parent_school_fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'parent_profiles'
    AND CONSTRAINT_NAME = 'fk_parent_profiles_school'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql := IF(
  @parent_school_fk_exists = 0,
  'ALTER TABLE parent_profiles ADD CONSTRAINT fk_parent_profiles_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL',
  'SELECT ''fk_parent_profiles_school already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS parent_registration_references (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_user_id BIGINT UNSIGNED NOT NULL,
  school_id BIGINT UNSIGNED NOT NULL,
  student_reference VARCHAR(60) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_parent_registration_reference (parent_user_id, student_reference),
  KEY idx_parent_registration_references_school (school_id, parent_user_id),
  CONSTRAINT fk_parent_registration_references_parent FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_parent_registration_references_school FOREIGN KEY (school_id) REFERENCES schools(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parent_registration_reviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_user_id BIGINT UNSIGNED NOT NULL,
  school_id BIGINT UNSIGNED NOT NULL,
  reviewer_user_id BIGINT UNSIGNED NULL,
  decision ENUM('approved', 'rejected', 'reopened') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_parent_registration_reviews_school (school_id, parent_user_id, id),
  KEY idx_parent_registration_reviews_parent_latest (parent_user_id, id),
  CONSTRAINT fk_parent_registration_reviews_parent FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_parent_registration_reviews_school FOREIGN KEY (school_id) REFERENCES schools(id),
  CONSTRAINT fk_parent_registration_reviews_reviewer FOREIGN KEY (reviewer_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS senior_high_offerings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  school_year_id BIGINT UNSIGNED NOT NULL,
  grade_level_id BIGINT UNSIGNED NOT NULL,
  curriculum_version ENUM('legacy', 'strengthened') NOT NULL,
  offering_type ENUM('track', 'strand') NOT NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(120) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_senior_high_offerings_year_grade_code (school_year_id, grade_level_id, code),
  KEY idx_senior_high_offerings_school_year (school_id, school_year_id),
  CONSTRAINT fk_senior_high_offerings_school FOREIGN KEY (school_id) REFERENCES schools(id),
  CONSTRAINT fk_senior_high_offerings_year FOREIGN KEY (school_year_id) REFERENCES school_years(id),
  CONSTRAINT fk_senior_high_offerings_grade FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sections (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  school_year_id BIGINT UNSIGNED NOT NULL,
  grade_level_id BIGINT UNSIGNED NOT NULL,
  senior_high_offering_id BIGINT UNSIGNED NULL,
  name VARCHAR(60) NOT NULL,

  UNIQUE KEY uq_sections_year_grade_name (school_year_id, grade_level_id, name),
  KEY idx_sections_school_year (school_id, school_year_id),
  KEY idx_sections_senior_high_offering (senior_high_offering_id),
  CONSTRAINT fk_sections_school FOREIGN KEY (school_id) REFERENCES schools(id),
  CONSTRAINT fk_sections_school_year FOREIGN KEY (school_year_id) REFERENCES school_years(id),
  CONSTRAINT fk_sections_grade_level FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id),
  CONSTRAINT fk_sections_senior_high_offering FOREIGN KEY (senior_high_offering_id) REFERENCES senior_high_offerings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS students (
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

CREATE TABLE IF NOT EXISTS pending_student_guardians (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  parent_email VARCHAR(150) NOT NULL,
  guardian_name VARCHAR(120) NOT NULL,
  relationship ENUM('mother', 'father', 'guardian') NOT NULL,
  status ENUM('pending', 'linked', 'cancelled') NOT NULL DEFAULT 'pending',
  parent_user_id BIGINT UNSIGNED NULL,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pending_student_guardian_email (student_id, parent_email),
  KEY idx_pending_guardians_school_email (school_id, parent_email, status),
  KEY idx_pending_guardians_parent (parent_user_id),
  CONSTRAINT fk_pending_guardians_school FOREIGN KEY (school_id) REFERENCES schools(id),
  CONSTRAINT fk_pending_guardians_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_pending_guardians_parent FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_pending_guardians_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parent_student_link_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_user_id BIGINT UNSIGNED NOT NULL,
  school_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  student_reference_snapshot VARCHAR(60) NOT NULL,
  student_name_snapshot VARCHAR(180) NOT NULL,
  relationship_snapshot ENUM('mother', 'father', 'guardian') NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewer_user_id BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_parent_student_link_request (parent_user_id, student_id),
  KEY idx_parent_student_link_requests_school_status (school_id, status, created_at),
  CONSTRAINT fk_parent_student_link_requests_parent FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_parent_student_link_requests_school FOREIGN KEY (school_id) REFERENCES schools(id),
  CONSTRAINT fk_parent_student_link_requests_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_parent_student_link_requests_reviewer FOREIGN KEY (reviewer_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enrollments (
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
  code VARCHAR(40) NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  category ENUM('tuition', 'other', 'allowance') NOT NULL,
  other_fee_group VARCHAR(40) NULL,
  education_audience ENUM('basic', 'higher', 'both') NULL,
  collection_policy ENUM('mandatory', 'optional', 'conditional') NULL,
  billing_basis ENUM('school_year', 'academic_period', 'event', 'recurring') NULL,
  amount_mode ENUM('fixed', 'assignment') NULL,
  approval_reference VARCHAR(120) NULL,
  default_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_fee_types_year_name (school_year_id, name),
  UNIQUE KEY uq_fee_types_year_code (school_year_id, code),
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
  assignment_key VARCHAR(191) NOT NULL,
  student_assessment_id BIGINT UNSIGNED NULL,
  fee_schedule_item_id BIGINT UNSIGNED NULL,
  academic_period_id BIGINT UNSIGNED NULL,
  other_fee_charge_id BIGINT UNSIGNED NULL,
  fee_name_snapshot VARCHAR(120) NULL,
  gross_amount DECIMAL(10,2) NULL,
  credit_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  amount_due DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  due_date DATE NULL,
  status ENUM('open', 'partial', 'paid', 'cancelled') NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_student_fee_assignments_identity (student_id, school_year_id, assignment_key),
  KEY idx_student_fee_assignments_student_status_due (student_id, status, due_date),
  KEY idx_student_fee_assignments_year_status_due (school_year_id, status, due_date),
  KEY idx_student_fee_assignments_other_charge (other_fee_charge_id, student_id),
  CONSTRAINT fk_student_fee_assignments_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_fee_assignments_fee_type FOREIGN KEY (fee_type_id) REFERENCES fee_types(id),
  CONSTRAINT fk_student_fee_assignments_school_year FOREIGN KEY (school_year_id) REFERENCES school_years(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parent_fee_summary_archives (
  parent_user_id BIGINT UNSIGNED NOT NULL,
  student_fee_assignment_id BIGINT UNSIGNED NOT NULL,
  archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,

  PRIMARY KEY (parent_user_id, student_fee_assignment_id),
  KEY idx_parent_fee_archives_parent_archived_assignment (parent_user_id, archived_at, student_fee_assignment_id),
  KEY idx_parent_fee_archives_parent_deleted_archived_assignment (parent_user_id, deleted_at, archived_at, student_fee_assignment_id),
  KEY idx_parent_fee_archives_assignment (student_fee_assignment_id),
  CONSTRAINT fk_parent_fee_archives_parent
    FOREIGN KEY (parent_user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_parent_fee_archives_assignment
    FOREIGN KEY (student_fee_assignment_id) REFERENCES student_fee_assignments(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wallet_top_up_batches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_user_id BIGINT UNSIGNED NOT NULL,
  batch_reference VARCHAR(80) NOT NULL,
  submission_token_hash CHAR(64) NOT NULL,
  channel ENUM('card', 'online_banking', 'gcash', 'maya') NOT NULL,
  item_count SMALLINT UNSIGNED NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  status ENUM('completed') NOT NULL DEFAULT 'completed',
  completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_wallet_top_up_batches_reference (batch_reference),
  UNIQUE KEY uq_wallet_top_up_batches_submission (parent_user_id, submission_token_hash),
  KEY idx_wallet_top_up_batches_parent_completed (parent_user_id, completed_at),
  CONSTRAINT fk_wallet_top_up_batches_parent
    FOREIGN KEY (parent_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  school_year_id BIGINT UNSIGNED NULL,
  payer_user_id BIGINT UNSIGNED NULL,
  wallet_top_up_batch_id BIGINT UNSIGNED NULL,
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
  KEY idx_payments_wallet_top_up_batch (wallet_top_up_batch_id),
  CONSTRAINT fk_payments_school FOREIGN KEY (school_id) REFERENCES schools(id),
  CONSTRAINT fk_payments_school_year FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_payer FOREIGN KEY (payer_user_id) REFERENCES users(id),
  CONSTRAINT fk_payments_wallet_top_up_batch FOREIGN KEY (wallet_top_up_batch_id) REFERENCES wallet_top_up_batches(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parent_payment_history_archives (
  parent_user_id BIGINT UNSIGNED NOT NULL,
  payment_id BIGINT UNSIGNED NOT NULL,
  archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,

  PRIMARY KEY (parent_user_id, payment_id),
  KEY idx_parent_payment_archives_parent_archived_payment (parent_user_id, archived_at, payment_id),
  KEY idx_parent_payment_archives_parent_deleted_archived_payment (parent_user_id, deleted_at, archived_at, payment_id),
  KEY idx_parent_payment_archives_payment (payment_id),
  CONSTRAINT fk_parent_payment_archives_parent
    FOREIGN KEY (parent_user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_parent_payment_archives_payment
    FOREIGN KEY (payment_id) REFERENCES payments(id)
    ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS wallet_ledger_archives (
  wallet_id BIGINT UNSIGNED NOT NULL,
  school_year_id BIGINT UNSIGNED NOT NULL,
  archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (wallet_id, school_year_id),
  KEY idx_wallet_ledger_archives_year_archived_wallet (school_year_id, archived_at, wallet_id),
  CONSTRAINT fk_wallet_ledger_archives_wallet
    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
  CONSTRAINT fk_wallet_ledger_archives_school_year
    FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE CASCADE
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
  KEY idx_notification_logs_email_template (email_template_id),
  CONSTRAINT fk_notification_logs_school FOREIGN KEY (school_id) REFERENCES schools(id),
  CONSTRAINT fk_notification_logs_school_year FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE SET NULL,
  CONSTRAINT fk_notification_logs_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id),
  CONSTRAINT fk_notification_logs_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_notification_logs_email_template
    FOREIGN KEY (email_template_id) REFERENCES school_email_templates(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_periods (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, school_id BIGINT UNSIGNED NOT NULL, school_year_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL, period_type ENUM('semester','trimester','summer','custom') NOT NULL, sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  starts_on DATE NOT NULL, ends_on DATE NOT NULL, status ENUM('upcoming','active','closed') NOT NULL DEFAULT 'upcoming',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_academic_periods_year_name (school_year_id, name), KEY idx_academic_periods_school_year_status (school_id, school_year_id, status),
  CONSTRAINT fk_academic_periods_school FOREIGN KEY (school_id) REFERENCES schools(id), CONSTRAINT fk_academic_periods_year FOREIGN KEY (school_year_id) REFERENCES school_years(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_programs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, school_id BIGINT UNSIGNED NOT NULL, code VARCHAR(30) NOT NULL, name VARCHAR(140) NOT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_academic_programs_school_code (school_id, code), KEY idx_academic_programs_school_status (school_id, status),
  CONSTRAINT fk_academic_programs_school FOREIGN KEY (school_id) REFERENCES schools(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS program_year_levels (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, program_id BIGINT UNSIGNED NOT NULL, level_number SMALLINT UNSIGNED NOT NULL, name VARCHAR(60) NOT NULL,
  UNIQUE KEY uq_program_year_levels_program_number (program_id, level_number), CONSTRAINT fk_program_year_levels_program FOREIGN KEY (program_id) REFERENCES academic_programs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS college_sections (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, school_id BIGINT UNSIGNED NOT NULL, academic_period_id BIGINT UNSIGNED NOT NULL, program_year_level_id BIGINT UNSIGNED NOT NULL, name VARCHAR(60) NOT NULL,
  UNIQUE KEY uq_college_sections_period_level_name (academic_period_id, program_year_level_id, name), KEY idx_college_sections_school_period (school_id, academic_period_id),
  CONSTRAINT fk_college_sections_school FOREIGN KEY (school_id) REFERENCES schools(id), CONSTRAINT fk_college_sections_period FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
  CONSTRAINT fk_college_sections_level FOREIGN KEY (program_year_level_id) REFERENCES program_year_levels(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS college_enrollments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, student_id BIGINT UNSIGNED NOT NULL, school_year_id BIGINT UNSIGNED NOT NULL, academic_period_id BIGINT UNSIGNED NOT NULL,
  program_id BIGINT UNSIGNED NOT NULL, program_year_level_id BIGINT UNSIGNED NOT NULL, college_section_id BIGINT UNSIGNED NULL,
  status ENUM('draft','submitted','enrolled','rejected','withdrawn') NOT NULL DEFAULT 'draft', enrolled_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_college_enrollments_student_period (student_id, academic_period_id), KEY idx_college_enrollments_period_status (academic_period_id, status),
  CONSTRAINT fk_college_enrollments_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_college_enrollments_year FOREIGN KEY (school_year_id) REFERENCES school_years(id), CONSTRAINT fk_college_enrollments_period FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
  CONSTRAINT fk_college_enrollments_program FOREIGN KEY (program_id) REFERENCES academic_programs(id), CONSTRAINT fk_college_enrollments_level FOREIGN KEY (program_year_level_id) REFERENCES program_year_levels(id),
  CONSTRAINT fk_college_enrollments_section FOREIGN KEY (college_section_id) REFERENCES college_sections(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS other_fee_charges (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  school_year_id BIGINT UNSIGNED NOT NULL,
  academic_period_id BIGINT UNSIGNED NULL,
  fee_type_id BIGINT UNSIGNED NOT NULL,
  education_audience ENUM('basic', 'higher') NOT NULL,
  reference_number VARCHAR(80) NOT NULL,
  submission_token_hash CHAR(64) NOT NULL,
  charge_title VARCHAR(140) NOT NULL,
  fee_name_snapshot VARCHAR(120) NOT NULL,
  description_snapshot VARCHAR(255) NOT NULL,
  amount_per_student DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  approval_reference VARCHAR(120) NULL,
  internal_note VARCHAR(255) NULL,
  amount_override_reason VARCHAR(255) NULL,
  selected_count SMALLINT UNSIGNED NOT NULL,
  assigned_count SMALLINT UNSIGNED NOT NULL,
  duplicate_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('completed', 'cancelled') NOT NULL DEFAULT 'completed',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_other_fee_charges_reference (reference_number),
  UNIQUE KEY uq_other_fee_charges_submission (school_id, submission_token_hash),
  KEY idx_other_fee_charges_school_year (school_id, school_year_id, status),
  KEY idx_other_fee_charges_fee_type (fee_type_id, academic_period_id),
  CONSTRAINT fk_other_fee_charges_school FOREIGN KEY (school_id) REFERENCES schools(id),
  CONSTRAINT fk_other_fee_charges_year FOREIGN KEY (school_year_id) REFERENCES school_years(id),
  CONSTRAINT fk_other_fee_charges_period FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
  CONSTRAINT fk_other_fee_charges_fee_type FOREIGN KEY (fee_type_id) REFERENCES fee_types(id),
  CONSTRAINT fk_other_fee_charges_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fee_schedules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, school_id BIGINT UNSIGNED NOT NULL, school_year_id BIGINT UNSIGNED NOT NULL, academic_period_id BIGINT UNSIGNED NULL,
  name VARCHAR(140) NOT NULL, education_level ENUM('basic','higher') NOT NULL, version_no SMALLINT UNSIGNED NOT NULL DEFAULT 1, cloned_from_id BIGINT UNSIGNED NULL,
  status ENUM('draft','approved','archived') NOT NULL DEFAULT 'draft', created_by_user_id BIGINT UNSIGNED NOT NULL, approved_by_user_id BIGINT UNSIGNED NULL, approved_at DATETIME NULL,
  archived_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fee_schedules_year_name_version (school_year_id, name, version_no), KEY idx_fee_schedules_school_year_status (school_id, school_year_id, status),
  CONSTRAINT fk_fee_schedules_school FOREIGN KEY (school_id) REFERENCES schools(id), CONSTRAINT fk_fee_schedules_year FOREIGN KEY (school_year_id) REFERENCES school_years(id),
  CONSTRAINT fk_fee_schedules_period FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id), CONSTRAINT fk_fee_schedules_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_fee_schedules_approver FOREIGN KEY (approved_by_user_id) REFERENCES users(id), CONSTRAINT fk_fee_schedules_clone FOREIGN KEY (cloned_from_id) REFERENCES fee_schedules(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fee_schedule_grade_targets (
  fee_schedule_id BIGINT UNSIGNED NOT NULL, grade_level_id BIGINT UNSIGNED NOT NULL, PRIMARY KEY (fee_schedule_id, grade_level_id),
  CONSTRAINT fk_fee_schedule_grade_targets_schedule FOREIGN KEY (fee_schedule_id) REFERENCES fee_schedules(id) ON DELETE CASCADE,
  CONSTRAINT fk_fee_schedule_grade_targets_grade FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fee_schedule_program_targets (
  fee_schedule_id BIGINT UNSIGNED NOT NULL, program_year_level_id BIGINT UNSIGNED NOT NULL, PRIMARY KEY (fee_schedule_id, program_year_level_id),
  CONSTRAINT fk_fee_schedule_program_targets_schedule FOREIGN KEY (fee_schedule_id) REFERENCES fee_schedules(id) ON DELETE CASCADE,
  CONSTRAINT fk_fee_schedule_program_targets_level FOREIGN KEY (program_year_level_id) REFERENCES program_year_levels(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fee_schedule_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, fee_schedule_id BIGINT UNSIGNED NOT NULL, fee_type_id BIGINT UNSIGNED NOT NULL, sort_order SMALLINT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL, payment_timing ENUM('upfront','installment') NOT NULL DEFAULT 'upfront', due_date DATE NULL,
  UNIQUE KEY uq_fee_schedule_items_order (fee_schedule_id, sort_order), UNIQUE KEY uq_fee_schedule_items_type (fee_schedule_id, fee_type_id),
  CONSTRAINT fk_fee_schedule_items_schedule FOREIGN KEY (fee_schedule_id) REFERENCES fee_schedules(id) ON DELETE CASCADE, CONSTRAINT fk_fee_schedule_items_type FOREIGN KEY (fee_type_id) REFERENCES fee_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_plan_templates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, school_id BIGINT UNSIGNED NOT NULL, school_year_id BIGINT UNSIGNED NOT NULL, academic_period_id BIGINT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL, status ENUM('active','inactive') NOT NULL DEFAULT 'active', created_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payment_plan_templates_year_name (school_year_id, name), KEY idx_payment_plan_templates_school_status (school_id, status),
  CONSTRAINT fk_payment_plan_templates_school FOREIGN KEY (school_id) REFERENCES schools(id), CONSTRAINT fk_payment_plan_templates_year FOREIGN KEY (school_year_id) REFERENCES school_years(id),
  CONSTRAINT fk_payment_plan_templates_period FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id), CONSTRAINT fk_payment_plan_templates_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_plan_template_terms (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, payment_plan_template_id BIGINT UNSIGNED NOT NULL, name VARCHAR(120) NOT NULL, sort_order SMALLINT UNSIGNED NOT NULL,
  percentage DECIMAL(5,2) NOT NULL, due_date DATE NOT NULL, UNIQUE KEY uq_payment_plan_terms_order (payment_plan_template_id, sort_order),
  CONSTRAINT fk_payment_plan_terms_template FOREIGN KEY (payment_plan_template_id) REFERENCES payment_plan_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fee_schedule_payment_plans (
  fee_schedule_id BIGINT UNSIGNED NOT NULL, payment_plan_template_id BIGINT UNSIGNED NOT NULL, is_default BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (fee_schedule_id, payment_plan_template_id), CONSTRAINT fk_fee_schedule_plans_schedule FOREIGN KEY (fee_schedule_id) REFERENCES fee_schedules(id) ON DELETE CASCADE,
  CONSTRAINT fk_fee_schedule_plans_template FOREIGN KEY (payment_plan_template_id) REFERENCES payment_plan_templates(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_credit_types (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, school_id BIGINT UNSIGNED NOT NULL, code VARCHAR(40) NOT NULL, name VARCHAR(120) NOT NULL,
  source_kind ENUM('government','school','manual') NOT NULL, requires_reference BOOLEAN NOT NULL DEFAULT FALSE, max_amount DECIMAL(10,2) NULL, max_percent DECIMAL(5,2) NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active', created_by_user_id BIGINT UNSIGNED NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_assessment_credit_types_school_code (school_id, code), CONSTRAINT fk_assessment_credit_types_school FOREIGN KEY (school_id) REFERENCES schools(id),
  CONSTRAINT fk_assessment_credit_types_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_batches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, school_id BIGINT UNSIGNED NOT NULL, school_year_id BIGINT UNSIGNED NOT NULL, academic_period_id BIGINT UNSIGNED NULL,
  fee_schedule_id BIGINT UNSIGNED NOT NULL, reference_number VARCHAR(80) NOT NULL, submission_token_hash CHAR(64) NOT NULL, preview_fingerprint CHAR(64) NOT NULL,
  selected_count SMALLINT UNSIGNED NOT NULL, posted_count SMALLINT UNSIGNED NOT NULL, duplicate_count SMALLINT UNSIGNED NOT NULL DEFAULT 0, excluded_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  gross_total DECIMAL(12,2) NOT NULL, credit_total DECIMAL(12,2) NOT NULL, net_total DECIMAL(12,2) NOT NULL, posted_by_user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('completed') NOT NULL DEFAULT 'completed', posted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_assessment_batches_reference (reference_number), UNIQUE KEY uq_assessment_batches_submission (school_id, submission_token_hash),
  CONSTRAINT fk_assessment_batches_school FOREIGN KEY (school_id) REFERENCES schools(id), CONSTRAINT fk_assessment_batches_year FOREIGN KEY (school_year_id) REFERENCES school_years(id),
  CONSTRAINT fk_assessment_batches_period FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id), CONSTRAINT fk_assessment_batches_schedule FOREIGN KEY (fee_schedule_id) REFERENCES fee_schedules(id),
  CONSTRAINT fk_assessment_batches_poster FOREIGN KEY (posted_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS student_assessments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, assessment_batch_id BIGINT UNSIGNED NOT NULL, student_id BIGINT UNSIGNED NOT NULL, fee_schedule_id BIGINT UNSIGNED NOT NULL,
  enrollment_id BIGINT UNSIGNED NULL, college_enrollment_id BIGINT UNSIGNED NULL, payment_plan_template_id BIGINT UNSIGNED NULL,
  gross_amount DECIMAL(10,2) NOT NULL, credit_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00, net_amount DECIMAL(10,2) NOT NULL,
  status ENUM('open','partial','paid','cancelled') NOT NULL DEFAULT 'open', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_assessments_student_schedule (student_id, fee_schedule_id), KEY idx_student_assessments_batch (assessment_batch_id),
  CONSTRAINT fk_student_assessments_batch FOREIGN KEY (assessment_batch_id) REFERENCES assessment_batches(id), CONSTRAINT fk_student_assessments_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_student_assessments_schedule FOREIGN KEY (fee_schedule_id) REFERENCES fee_schedules(id), CONSTRAINT fk_student_assessments_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id),
  CONSTRAINT fk_student_assessments_college_enrollment FOREIGN KEY (college_enrollment_id) REFERENCES college_enrollments(id),
  CONSTRAINT fk_student_assessments_plan FOREIGN KEY (payment_plan_template_id) REFERENCES payment_plan_templates(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS student_assessment_credits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, student_assessment_id BIGINT UNSIGNED NOT NULL, assessment_credit_type_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL, reference_number VARCHAR(120) NULL, note VARCHAR(255) NULL, status ENUM('applied','reversed') NOT NULL DEFAULT 'applied',
  applied_by_user_id BIGINT UNSIGNED NOT NULL, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, reversed_by_user_id BIGINT UNSIGNED NULL, reversed_at DATETIME NULL,
  KEY idx_student_assessment_credits_assessment (student_assessment_id, status), CONSTRAINT fk_student_assessment_credits_assessment FOREIGN KEY (student_assessment_id) REFERENCES student_assessments(id),
  CONSTRAINT fk_student_assessment_credits_type FOREIGN KEY (assessment_credit_type_id) REFERENCES assessment_credit_types(id),
  CONSTRAINT fk_student_assessment_credits_applier FOREIGN KEY (applied_by_user_id) REFERENCES users(id), CONSTRAINT fk_student_assessment_credits_reverser FOREIGN KEY (reversed_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS student_assessment_credit_allocations (
  student_assessment_credit_id BIGINT UNSIGNED NOT NULL, student_fee_assignment_id BIGINT UNSIGNED NOT NULL, amount DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (student_assessment_credit_id, student_fee_assignment_id), CONSTRAINT fk_assessment_credit_allocations_credit FOREIGN KEY (student_assessment_credit_id) REFERENCES student_assessment_credits(id) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_credit_allocations_assignment FOREIGN KEY (student_fee_assignment_id) REFERENCES student_fee_assignments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_payment_terms (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, student_assessment_id BIGINT UNSIGNED NOT NULL, name VARCHAR(120) NOT NULL, sort_order SMALLINT UNSIGNED NOT NULL,
  percentage DECIMAL(5,2) NOT NULL, amount_due DECIMAL(10,2) NOT NULL, amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00, due_date DATE NOT NULL,
  status ENUM('open','partial','paid','cancelled') NOT NULL DEFAULT 'open', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_assessment_payment_terms_order (student_assessment_id, sort_order), KEY idx_assessment_payment_terms_status_due (status, due_date),
  CONSTRAINT fk_assessment_payment_terms_assessment FOREIGN KEY (student_assessment_id) REFERENCES student_assessments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_assessment_term_allocations (
  payment_id BIGINT UNSIGNED NOT NULL, assessment_payment_term_id BIGINT UNSIGNED NOT NULL, amount DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (payment_id, assessment_payment_term_id), CONSTRAINT fk_payment_assessment_terms_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_assessment_terms_term FOREIGN KEY (assessment_payment_term_id) REFERENCES assessment_payment_terms(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE student_fee_assignments
  ADD CONSTRAINT fk_student_fee_assignments_assessment FOREIGN KEY (student_assessment_id) REFERENCES student_assessments(id),
  ADD CONSTRAINT fk_student_fee_assignments_schedule_item FOREIGN KEY (fee_schedule_item_id) REFERENCES fee_schedule_items(id),
  ADD CONSTRAINT fk_student_fee_assignments_period FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
  ADD CONSTRAINT fk_student_fee_assignments_other_charge FOREIGN KEY (other_fee_charge_id) REFERENCES other_fee_charges(id);
