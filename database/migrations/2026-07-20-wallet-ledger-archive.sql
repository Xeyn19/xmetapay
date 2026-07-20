USE xmetapay_db;

-- Selected-year Allowance ledger visibility only. Wallet balances and transactions stay unchanged.
CREATE TABLE IF NOT EXISTS wallet_ledger_archives (
  wallet_id BIGINT UNSIGNED NOT NULL,
  school_year_id BIGINT UNSIGNED NOT NULL,
  archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (wallet_id, school_year_id),
  KEY idx_wallet_ledger_archives_year_archived_wallet (school_year_id, archived_at, wallet_id),
  CONSTRAINT fk_wallet_ledger_archives_wallet
    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
  CONSTRAINT fk_wallet_ledger_archives_school_year
    FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Repair a partially created table without relying on newer ADD ... IF NOT EXISTS syntax.
DROP PROCEDURE IF EXISTS ensure_wallet_ledger_archive_shape;

DELIMITER $$

CREATE PROCEDURE ensure_wallet_ledger_archive_shape()
BEGIN
  DECLARE CONTINUE HANDLER FOR 1060 BEGIN END;
  DECLARE CONTINUE HANDLER FOR 1061 BEGIN END;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'wallet_ledger_archives'
      AND COLUMN_NAME = 'archived_at'
  ) THEN
    ALTER TABLE wallet_ledger_archives
      ADD COLUMN archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'wallet_ledger_archives'
      AND INDEX_NAME = 'idx_wallet_ledger_archives_year_archived_wallet'
  ) THEN
    ALTER TABLE wallet_ledger_archives
      ADD KEY idx_wallet_ledger_archives_year_archived_wallet
        (school_year_id, archived_at, wallet_id);
  END IF;
END$$

DELIMITER ;

CALL ensure_wallet_ledger_archive_shape();
DROP PROCEDURE IF EXISTS ensure_wallet_ledger_archive_shape;
