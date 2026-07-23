-- One active, role-aware password recovery challenge per user.
-- Safe to import more than once in XAMPP/phpMyAdmin.
CREATE TABLE IF NOT EXISTS password_reset_challenges (
  user_id BIGINT UNSIGNED NOT NULL,
  challenge_token_hash CHAR(64) NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  otp_expires_at DATETIME NOT NULL,
  resend_available_at DATETIME NOT NULL,
  send_window_started_at DATETIME NOT NULL,
  send_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  verified_at DATETIME NULL,
  reset_expires_at DATETIME NULL,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (user_id),
  UNIQUE KEY uq_password_reset_challenge_token (challenge_token_hash),
  KEY idx_password_reset_expiry_consumed (otp_expires_at, consumed_at),
  KEY idx_password_reset_resend (resend_available_at),

  CONSTRAINT fk_password_reset_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
