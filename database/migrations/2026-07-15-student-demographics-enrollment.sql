-- Adds reusable student sex and school-year enrollment type.
-- Safe for existing XAMPP/phpMyAdmin databases; legacy values remain NULL.

DELIMITER //

CREATE PROCEDURE xmetapay_add_student_demographics_enrollment_type()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'students'
      AND COLUMN_NAME = 'sex'
  ) THEN
    ALTER TABLE students
      ADD COLUMN sex ENUM('male', 'female') NULL AFTER birthdate;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'enrollments'
      AND COLUMN_NAME = 'student_type'
  ) THEN
    ALTER TABLE enrollments
      ADD COLUMN student_type ENUM('new', 'transferee', 'returned') NULL AFTER section_id;
  END IF;
END//

CALL xmetapay_add_student_demographics_enrollment_type()//
DROP PROCEDURE xmetapay_add_student_demographics_enrollment_type//

DELIMITER ;
