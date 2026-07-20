USE xmetapay_db;

-- Reversible Collection log visibility. Financial status and allocations stay unchanged.
-- Safe to import more than once, including after a partially completed phpMyAdmin import.
DROP PROCEDURE IF EXISTS migrate_payment_collection_archive;

DELIMITER $$

CREATE PROCEDURE migrate_payment_collection_archive()
BEGIN
  -- Older XAMPP/MySQL versions do not support ADD COLUMN IF NOT EXISTS.
  -- These handlers also protect against stale metadata or concurrent imports.
  DECLARE CONTINUE HANDLER FOR 1060 BEGIN END;
  DECLARE CONTINUE HANDLER FOR 1061 BEGIN END;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'payments'
      AND COLUMN_NAME = 'archived_at'
  ) THEN
    ALTER TABLE payments
      ADD COLUMN archived_at DATETIME NULL AFTER paid_at;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'payments'
      AND INDEX_NAME = 'idx_payments_school_year_archive_paid_at'
  ) THEN
    ALTER TABLE payments
      ADD KEY idx_payments_school_year_archive_paid_at
        (school_id, school_year_id, archived_at, paid_at);
  END IF;
END$$

DELIMITER ;

CALL migrate_payment_collection_archive();
DROP PROCEDURE IF EXISTS migrate_payment_collection_archive;
