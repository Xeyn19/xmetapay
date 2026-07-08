-- Adds an upcoming status for future school years.
-- Import this once into existing XAMPP/cPanel databases after full-schema-v1.sql.

ALTER TABLE school_years
  MODIFY COLUMN status ENUM('upcoming', 'active', 'closed') NOT NULL DEFAULT 'active';
