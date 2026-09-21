-- School-recorded guardian emails can wait for a matching Parent account and school approval.
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
