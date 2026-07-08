-- Stamps operational history records with a school year.
-- Import this once into existing XAMPP/cPanel databases after full-schema-v1.sql.
-- Columns stay nullable so existing local history remains valid.

DELIMITER //

CREATE PROCEDURE xmetapay_add_operational_school_year_stamps()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'payments'
      AND COLUMN_NAME = 'school_year_id'
  ) THEN
    ALTER TABLE payments
      ADD COLUMN school_year_id BIGINT UNSIGNED NULL AFTER school_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'wallet_transactions'
      AND COLUMN_NAME = 'school_year_id'
  ) THEN
    ALTER TABLE wallet_transactions
      ADD COLUMN school_year_id BIGINT UNSIGNED NULL AFTER payment_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'store_transactions'
      AND COLUMN_NAME = 'school_year_id'
  ) THEN
    ALTER TABLE store_transactions
      ADD COLUMN school_year_id BIGINT UNSIGNED NULL AFTER student_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notification_logs'
      AND COLUMN_NAME = 'school_year_id'
  ) THEN
    ALTER TABLE notification_logs
      ADD COLUMN school_year_id BIGINT UNSIGNED NULL AFTER school_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'payments'
      AND INDEX_NAME = 'idx_payments_school_year_status_paid_at'
  ) THEN
    ALTER TABLE payments
      ADD KEY idx_payments_school_year_status_paid_at (school_id, school_year_id, status, paid_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'wallet_transactions'
      AND INDEX_NAME = 'idx_wallet_transactions_year_type_created'
  ) THEN
    ALTER TABLE wallet_transactions
      ADD KEY idx_wallet_transactions_year_type_created (school_year_id, type, created_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'store_transactions'
      AND INDEX_NAME = 'idx_store_transactions_year_date'
  ) THEN
    ALTER TABLE store_transactions
      ADD KEY idx_store_transactions_year_date (school_year_id, purchased_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notification_logs'
      AND INDEX_NAME = 'idx_notification_logs_school_year_type_created'
  ) THEN
    ALTER TABLE notification_logs
      ADD KEY idx_notification_logs_school_year_type_created (school_id, school_year_id, type, created_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'payments'
      AND CONSTRAINT_NAME = 'fk_payments_school_year'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT fk_payments_school_year
        FOREIGN KEY (school_year_id) REFERENCES school_years(id)
        ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'wallet_transactions'
      AND CONSTRAINT_NAME = 'fk_wallet_transactions_school_year'
  ) THEN
    ALTER TABLE wallet_transactions
      ADD CONSTRAINT fk_wallet_transactions_school_year
        FOREIGN KEY (school_year_id) REFERENCES school_years(id)
        ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'store_transactions'
      AND CONSTRAINT_NAME = 'fk_store_transactions_school_year'
  ) THEN
    ALTER TABLE store_transactions
      ADD CONSTRAINT fk_store_transactions_school_year
        FOREIGN KEY (school_year_id) REFERENCES school_years(id)
        ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notification_logs'
      AND CONSTRAINT_NAME = 'fk_notification_logs_school_year'
  ) THEN
    ALTER TABLE notification_logs
      ADD CONSTRAINT fk_notification_logs_school_year
        FOREIGN KEY (school_year_id) REFERENCES school_years(id)
        ON DELETE SET NULL;
  END IF;
END//

DELIMITER ;

CALL xmetapay_add_operational_school_year_stamps();
DROP PROCEDURE xmetapay_add_operational_school_year_stamps;
