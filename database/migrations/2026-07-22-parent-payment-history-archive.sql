-- Parent-specific, reversible visibility for Payment history.
-- Safe to import more than once in XAMPP/phpMyAdmin.
CREATE TABLE IF NOT EXISTS parent_payment_history_archives (
  parent_user_id BIGINT UNSIGNED NOT NULL,
  payment_id BIGINT UNSIGNED NOT NULL,
  archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (parent_user_id, payment_id),
  KEY idx_parent_payment_archives_parent_archived_payment (parent_user_id, archived_at, payment_id),
  KEY idx_parent_payment_archives_payment (payment_id),
  CONSTRAINT fk_parent_payment_archives_parent
    FOREIGN KEY (parent_user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_parent_payment_archives_payment
    FOREIGN KEY (payment_id) REFERENCES payments(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
