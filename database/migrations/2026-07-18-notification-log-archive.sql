USE xmetapay_db;

-- Reversible visibility state for reminder history. Delivery status remains unchanged.
-- Safe to import more than once in XAMPP/phpMyAdmin.
SET @notification_archive_column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'notification_logs'
    AND COLUMN_NAME = 'archived_at'
);

SET @sql := IF(
  @notification_archive_column_exists = 0,
  'ALTER TABLE notification_logs ADD COLUMN archived_at DATETIME NULL AFTER sent_at',
  'SELECT ''notification_logs.archived_at already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @notification_archive_index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'notification_logs'
    AND INDEX_NAME = 'idx_notification_logs_school_year_type_archive_created'
);

SET @sql := IF(
  @notification_archive_index_exists = 0,
  'ALTER TABLE notification_logs ADD KEY idx_notification_logs_school_year_type_archive_created (school_id, school_year_id, type, archived_at, created_at)',
  'SELECT ''notification log archive index already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
