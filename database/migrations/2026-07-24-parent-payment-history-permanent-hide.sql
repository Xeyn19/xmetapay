USE xmetapay_db;

-- Irreversible parent-facing Payment history visibility. Financial records remain unchanged.
-- Safe to import more than once in XAMPP/phpMyAdmin.
SET @parent_payment_deleted_column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'parent_payment_history_archives'
    AND COLUMN_NAME = 'deleted_at'
);

SET @sql := IF(
  @parent_payment_deleted_column_exists = 0,
  'ALTER TABLE parent_payment_history_archives ADD COLUMN deleted_at DATETIME NULL AFTER archived_at',
  'SELECT ''parent_payment_history_archives.deleted_at already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @parent_payment_deleted_index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'parent_payment_history_archives'
    AND INDEX_NAME = 'idx_parent_payment_archives_parent_deleted_archived_payment'
);

SET @sql := IF(
  @parent_payment_deleted_index_exists = 0,
  'ALTER TABLE parent_payment_history_archives ADD KEY idx_parent_payment_archives_parent_deleted_archived_payment (parent_user_id, deleted_at, archived_at, payment_id)',
  'SELECT ''parent Payment history permanent-hide index already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
