-- Adds purpose-specific, repeatable Philippine other-school-fee charges.
-- Import after 2026-11-03-tuition-assessment-workflow.sql for an existing database. Safe to rerun.

DELIMITER //
CREATE PROCEDURE xmetapay_add_other_fee_type_metadata()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fee_types' AND COLUMN_NAME='other_fee_group') THEN
    ALTER TABLE fee_types ADD COLUMN other_fee_group VARCHAR(40) NULL AFTER category;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fee_types' AND COLUMN_NAME='education_audience') THEN
    ALTER TABLE fee_types ADD COLUMN education_audience ENUM('basic','higher','both') NULL AFTER other_fee_group;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fee_types' AND COLUMN_NAME='collection_policy') THEN
    ALTER TABLE fee_types ADD COLUMN collection_policy ENUM('mandatory','optional','conditional') NULL AFTER education_audience;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fee_types' AND COLUMN_NAME='billing_basis') THEN
    ALTER TABLE fee_types ADD COLUMN billing_basis ENUM('school_year','academic_period','event','recurring') NULL AFTER collection_policy;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fee_types' AND COLUMN_NAME='amount_mode') THEN
    ALTER TABLE fee_types ADD COLUMN amount_mode ENUM('fixed','assignment') NULL AFTER billing_basis;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fee_types' AND COLUMN_NAME='approval_reference') THEN
    ALTER TABLE fee_types ADD COLUMN approval_reference VARCHAR(120) NULL AFTER amount_mode;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fee_types' AND INDEX_NAME='uq_fee_types_year_code') THEN
    UPDATE fee_types ft
    JOIN (
      SELECT school_year_id, code
      FROM fee_types
      WHERE code IS NOT NULL AND code <> ''
      GROUP BY school_year_id, code
      HAVING COUNT(*) > 1
    ) duplicated ON duplicated.school_year_id=ft.school_year_id AND duplicated.code=ft.code
    SET ft.code=NULL;
    ALTER TABLE fee_types ADD UNIQUE KEY uq_fee_types_year_code (school_year_id, code);
  END IF;
END//
DELIMITER ;

CALL xmetapay_add_other_fee_type_metadata();
DROP PROCEDURE xmetapay_add_other_fee_type_metadata;

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

DELIMITER //
CREATE PROCEDURE xmetapay_link_other_fee_charges()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='student_fee_assignments' AND COLUMN_NAME='other_fee_charge_id') THEN
    ALTER TABLE student_fee_assignments ADD COLUMN other_fee_charge_id BIGINT UNSIGNED NULL AFTER academic_period_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='student_fee_assignments' AND INDEX_NAME='idx_student_fee_assignments_other_charge') THEN
    ALTER TABLE student_fee_assignments ADD KEY idx_student_fee_assignments_other_charge (other_fee_charge_id, student_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='student_fee_assignments' AND CONSTRAINT_NAME='fk_student_fee_assignments_other_charge' AND CONSTRAINT_TYPE='FOREIGN KEY') THEN
    ALTER TABLE student_fee_assignments ADD CONSTRAINT fk_student_fee_assignments_other_charge FOREIGN KEY (other_fee_charge_id) REFERENCES other_fee_charges(id);
  END IF;
END//
DELIMITER ;

CALL xmetapay_link_other_fee_charges();
DROP PROCEDURE xmetapay_link_other_fee_charges;
