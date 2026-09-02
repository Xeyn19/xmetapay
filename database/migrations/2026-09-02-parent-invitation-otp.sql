-- Invite-only parent claims with email OTP and reversible guardian access.
-- Non-destructive and safe to import more than once.

SET @sg_status_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_guardians' AND COLUMN_NAME = 'status'
);
SET @sql := IF(@sg_status_exists = 0,
  "ALTER TABLE student_guardians ADD COLUMN status ENUM('active', 'revoked') NOT NULL DEFAULT 'active' AFTER is_primary",
  "SELECT 'student_guardians.status already exists' AS migration_note");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sg_revoked_at_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_guardians' AND COLUMN_NAME = 'revoked_at'
);
SET @sql := IF(@sg_revoked_at_exists = 0,
  'ALTER TABLE student_guardians ADD COLUMN revoked_at DATETIME NULL AFTER status',
  "SELECT 'student_guardians.revoked_at already exists' AS migration_note");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sg_revoked_by_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_guardians' AND COLUMN_NAME = 'revoked_by_user_id'
);
SET @sql := IF(@sg_revoked_by_exists = 0,
  'ALTER TABLE student_guardians ADD COLUMN revoked_by_user_id BIGINT UNSIGNED NULL AFTER revoked_at',
  "SELECT 'student_guardians.revoked_by_user_id already exists' AS migration_note");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sg_reason_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_guardians' AND COLUMN_NAME = 'revocation_reason'
);
SET @sql := IF(@sg_reason_exists = 0,
  'ALTER TABLE student_guardians ADD COLUMN revocation_reason VARCHAR(255) NULL AFTER revoked_by_user_id',
  "SELECT 'student_guardians.revocation_reason already exists' AS migration_note");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sg_access_index_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_guardians' AND INDEX_NAME = 'idx_student_guardians_parent_status_student'
);
SET @sql := IF(@sg_access_index_exists = 0,
  'CREATE INDEX idx_student_guardians_parent_status_student ON student_guardians (parent_user_id, status, student_id)',
  "SELECT 'idx_student_guardians_parent_status_student already exists' AS migration_note");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sg_revoker_fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'student_guardians' AND CONSTRAINT_NAME = 'fk_student_guardians_revoker'
);
SET @sql := IF(@sg_revoker_fk_exists = 0,
  'ALTER TABLE student_guardians ADD CONSTRAINT fk_student_guardians_revoker FOREIGN KEY (revoked_by_user_id) REFERENCES users(id) ON DELETE SET NULL',
  "SELECT 'fk_student_guardians_revoker already exists' AS migration_note");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS parent_guardian_invitations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  guardian_name VARCHAR(120) NOT NULL,
  guardian_email VARCHAR(150) NOT NULL,
  relationship ENUM('mother', 'father', 'guardian') NOT NULL,
  claim_code_hash CHAR(64) NOT NULL,
  issued_by_user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  delivery_status ENUM('queued', 'sent', 'failed') NOT NULL DEFAULT 'queued',
  sent_at DATETIME NULL,
  resend_available_at DATETIME NOT NULL,
  send_window_started_at DATETIME NOT NULL,
  send_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  claimed_at DATETIME NULL,
  claimed_by_user_id BIGINT UNSIGNED NULL,
  revoked_at DATETIME NULL,
  revoked_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_parent_guardian_invitations_code_hash (claim_code_hash),
  KEY idx_parent_guardian_invitations_student_state (student_id, claimed_at, revoked_at, expires_at),
  KEY idx_parent_guardian_invitations_school_email (school_id, guardian_email, created_at),
  CONSTRAINT fk_parent_guardian_invitations_school FOREIGN KEY (school_id) REFERENCES schools(id),
  CONSTRAINT fk_parent_guardian_invitations_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_parent_guardian_invitations_issuer FOREIGN KEY (issued_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_parent_guardian_invitations_claimed_parent FOREIGN KEY (claimed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_parent_guardian_invitations_revoker FOREIGN KEY (revoked_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parent_claim_challenges (
  invitation_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  challenge_token_hash CHAR(64) NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  otp_expires_at DATETIME NOT NULL,
  resend_available_at DATETIME NOT NULL,
  send_window_started_at DATETIME NOT NULL,
  send_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  verified_at DATETIME NULL,
  completion_expires_at DATETIME NULL,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_parent_claim_challenges_token (challenge_token_hash),
  KEY idx_parent_claim_challenges_expiry (otp_expires_at, consumed_at),
  KEY idx_parent_claim_challenges_resend (resend_available_at),
  CONSTRAINT fk_parent_claim_challenges_invitation FOREIGN KEY (invitation_id)
    REFERENCES parent_guardian_invitations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS guardian_access_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_guardian_id BIGINT UNSIGNED NOT NULL,
  school_id BIGINT UNSIGNED NOT NULL,
  invitation_id BIGINT UNSIGNED NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  action ENUM('granted', 'revoked', 'restored') NOT NULL,
  reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_guardian_access_events_guardian_created (student_guardian_id, created_at),
  KEY idx_guardian_access_events_school_created (school_id, created_at),
  CONSTRAINT fk_guardian_access_events_guardian FOREIGN KEY (student_guardian_id) REFERENCES student_guardians(id),
  CONSTRAINT fk_guardian_access_events_school FOREIGN KEY (school_id) REFERENCES schools(id),
  CONSTRAINT fk_guardian_access_events_invitation FOREIGN KEY (invitation_id) REFERENCES parent_guardian_invitations(id) ON DELETE SET NULL,
  CONSTRAINT fk_guardian_access_events_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT COUNT(*) AS preserved_guardian_links FROM student_guardians;
