-- Parent-specific Fee summary organization. Financial records remain unchanged.
-- Safe to import more than once in XAMPP/phpMyAdmin.
CREATE TABLE IF NOT EXISTS parent_fee_summary_archives (
  parent_user_id BIGINT UNSIGNED NOT NULL,
  student_fee_assignment_id BIGINT UNSIGNED NOT NULL,
  archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (parent_user_id, student_fee_assignment_id),
  KEY idx_parent_fee_archives_parent_archived_assignment (parent_user_id, archived_at, student_fee_assignment_id),
  KEY idx_parent_fee_archives_assignment (student_fee_assignment_id),
  CONSTRAINT fk_parent_fee_archives_parent
    FOREIGN KEY (parent_user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_parent_fee_archives_assignment
    FOREIGN KEY (student_fee_assignment_id) REFERENCES student_fee_assignments(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
