-- Adds transition-aware Philippine Senior High School offerings and section assignments.
-- Import after 2026-11-03-tuition-assessment-workflow.sql for an existing database. Safe to rerun.

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

DELIMITER //
CREATE PROCEDURE xmetapay_add_senior_high_section_link()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sections' AND COLUMN_NAME = 'senior_high_offering_id'
  ) THEN
    ALTER TABLE sections ADD COLUMN senior_high_offering_id BIGINT UNSIGNED NULL AFTER grade_level_id;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sections' AND INDEX_NAME = 'idx_sections_senior_high_offering'
  ) THEN
    ALTER TABLE sections ADD KEY idx_sections_senior_high_offering (senior_high_offering_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'sections'
      AND CONSTRAINT_NAME = 'fk_sections_senior_high_offering' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE sections
      ADD CONSTRAINT fk_sections_senior_high_offering
      FOREIGN KEY (senior_high_offering_id) REFERENCES senior_high_offerings(id);
  END IF;
END//
DELIMITER ;

CALL xmetapay_add_senior_high_section_link();
DROP PROCEDURE xmetapay_add_senior_high_section_link;
