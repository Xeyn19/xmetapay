-- Adds school-owned K-12/college tuition schedules, assessment batches, credits, and payment plans.
-- Import after full-schema-v1.sql for an existing database. Safe to rerun.

DELIMITER //
CREATE PROCEDURE xmetapay_add_tuition_assessment_columns()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schools' AND COLUMN_NAME = 'education_scope') THEN
    ALTER TABLE schools ADD COLUMN education_scope ENUM('basic', 'higher', 'both') NOT NULL DEFAULT 'basic' AFTER status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fee_types' AND COLUMN_NAME = 'code') THEN
    ALTER TABLE fee_types ADD COLUMN code VARCHAR(40) NULL AFTER school_year_id, ADD COLUMN description VARCHAR(255) NULL AFTER name;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_fee_assignments' AND COLUMN_NAME = 'assignment_key') THEN
    ALTER TABLE student_fee_assignments
      ADD COLUMN assignment_key VARCHAR(191) NULL AFTER school_year_id,
      ADD COLUMN student_assessment_id BIGINT UNSIGNED NULL AFTER assignment_key,
      ADD COLUMN fee_schedule_item_id BIGINT UNSIGNED NULL AFTER student_assessment_id,
      ADD COLUMN academic_period_id BIGINT UNSIGNED NULL AFTER fee_schedule_item_id,
      ADD COLUMN fee_name_snapshot VARCHAR(120) NULL AFTER academic_period_id,
      ADD COLUMN gross_amount DECIMAL(10,2) NULL AFTER fee_name_snapshot,
      ADD COLUMN credit_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER gross_amount;
  END IF;
  UPDATE student_fee_assignments SET assignment_key = CONCAT('legacy-fee:', fee_type_id) WHERE assignment_key IS NULL;
  ALTER TABLE student_fee_assignments MODIFY COLUMN assignment_key VARCHAR(191) NOT NULL;
  IF EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_fee_assignments' AND INDEX_NAME = 'uq_student_fee_assignments_student_fee_year') THEN
    ALTER TABLE student_fee_assignments DROP INDEX uq_student_fee_assignments_student_fee_year;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_fee_assignments' AND INDEX_NAME = 'uq_student_fee_assignments_identity') THEN
    ALTER TABLE student_fee_assignments ADD UNIQUE KEY uq_student_fee_assignments_identity (student_id, school_year_id, assignment_key);
  END IF;
END//
DELIMITER ;
CALL xmetapay_add_tuition_assessment_columns();
DROP PROCEDURE xmetapay_add_tuition_assessment_columns;

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

DELIMITER //
CREATE PROCEDURE xmetapay_add_tuition_assessment_foreign_keys()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_fee_assignments' AND CONSTRAINT_NAME = 'fk_student_fee_assignments_assessment') THEN
    ALTER TABLE student_fee_assignments ADD CONSTRAINT fk_student_fee_assignments_assessment FOREIGN KEY (student_assessment_id) REFERENCES student_assessments(id),
      ADD CONSTRAINT fk_student_fee_assignments_schedule_item FOREIGN KEY (fee_schedule_item_id) REFERENCES fee_schedule_items(id),
      ADD CONSTRAINT fk_student_fee_assignments_period FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id);
  END IF;
END//
DELIMITER ;
CALL xmetapay_add_tuition_assessment_foreign_keys();
DROP PROCEDURE xmetapay_add_tuition_assessment_foreign_keys;
