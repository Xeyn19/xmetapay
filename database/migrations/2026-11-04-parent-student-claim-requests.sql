-- Adds auditable Parent-dashboard student connection requests.
-- Registration school inference reuses existing student and parent registration tables.
-- Safe to import more than once into the selected existing database.

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
