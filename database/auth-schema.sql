CREATE DATABASE IF NOT EXISTS xmetapay_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE xmetapay_db;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role ENUM('admin', 'parent', 'super_admin') NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active', 'pending', 'disabled') NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_users_role_email (role, email),
  UNIQUE KEY uq_users_role_phone (role, phone),
  KEY idx_users_role_status (role, status),
  KEY idx_users_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  role ENUM('admin', 'parent', 'super_admin') NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  last_used_at DATETIME NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_auth_sessions_token_hash (token_hash),
  KEY idx_auth_sessions_user_revoked_expires (user_id, revoked_at, expires_at),
  KEY idx_auth_sessions_role_expires (role, expires_at),

  CONSTRAINT fk_auth_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS admin_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  school_name VARCHAR(180) NOT NULL,
  staff_role ENUM('finance_officer', 'registrar', 'school_administrator') NOT NULL,

  UNIQUE KEY uq_admin_profiles_user_id (user_id),
  KEY idx_admin_profiles_school_name (school_name),

  CONSTRAINT fk_admin_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parent_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  student_name VARCHAR(120) NOT NULL,
  student_reference VARCHAR(60) NOT NULL,
  relationship ENUM('mother', 'father', 'guardian') NOT NULL,

  UNIQUE KEY uq_parent_profiles_user_id (user_id),
  KEY idx_parent_profiles_student_reference (student_reference),
  KEY idx_parent_profiles_student_name (student_name),

  CONSTRAINT fk_parent_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
