-- Adds parent-owned, idempotent multi-student wallet top-up batches.
-- Import after full-schema-v1.sql for existing XAMPP/MariaDB databases.

CREATE TABLE IF NOT EXISTS wallet_top_up_batches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_user_id BIGINT UNSIGNED NOT NULL,
  batch_reference VARCHAR(80) NOT NULL,
  submission_token_hash CHAR(64) NOT NULL,
  channel ENUM('card', 'online_banking', 'gcash', 'maya') NOT NULL,
  item_count SMALLINT UNSIGNED NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  status ENUM('completed') NOT NULL DEFAULT 'completed',
  completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_wallet_top_up_batches_reference (batch_reference),
  UNIQUE KEY uq_wallet_top_up_batches_submission (parent_user_id, submission_token_hash),
  KEY idx_wallet_top_up_batches_parent_completed (parent_user_id, completed_at),
  CONSTRAINT fk_wallet_top_up_batches_parent
    FOREIGN KEY (parent_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER //

CREATE PROCEDURE xmetapay_add_wallet_top_up_batch_payment_link()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'payments'
      AND COLUMN_NAME = 'wallet_top_up_batch_id'
  ) THEN
    ALTER TABLE payments
      ADD COLUMN wallet_top_up_batch_id BIGINT UNSIGNED NULL AFTER payer_user_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'payments'
      AND INDEX_NAME = 'idx_payments_wallet_top_up_batch'
  ) THEN
    ALTER TABLE payments
      ADD KEY idx_payments_wallet_top_up_batch (wallet_top_up_batch_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'payments'
      AND CONSTRAINT_NAME = 'fk_payments_wallet_top_up_batch'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT fk_payments_wallet_top_up_batch
        FOREIGN KEY (wallet_top_up_batch_id) REFERENCES wallet_top_up_batches(id)
        ON DELETE SET NULL;
  END IF;
END//

DELIMITER ;

CALL xmetapay_add_wallet_top_up_batch_payment_link();
DROP PROCEDURE xmetapay_add_wallet_top_up_batch_payment_link;
