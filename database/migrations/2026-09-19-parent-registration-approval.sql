-- Store every submitted parent reference and retain school review history.
-- Import after the parent single-school scope migration.

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

-- Legacy registrations stored only their first reference. Preserve that reference
-- without changing account status or existing guardian links.
INSERT IGNORE INTO parent_registration_references (parent_user_id, school_id, student_reference)
SELECT pp.user_id, pp.school_id, pp.student_reference
FROM parent_profiles pp
JOIN users u ON u.id = pp.user_id AND u.role = 'parent'
WHERE pp.school_id IS NOT NULL
  AND pp.student_reference <> '';
