USE xmetapay_db;

-- Link existing admin profiles to the real schools table after full-schema-v1.sql is imported.
SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'admin_profiles'
    AND COLUMN_NAME = 'school_id'
);

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE admin_profiles ADD COLUMN school_id BIGINT UNSIGNED NULL AFTER user_id',
  'SELECT ''admin_profiles.school_id already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'admin_profiles'
    AND INDEX_NAME = 'idx_admin_profiles_school_id'
);

SET @sql := IF(
  @index_exists = 0,
  'CREATE INDEX idx_admin_profiles_school_id ON admin_profiles (school_id)',
  'SELECT ''idx_admin_profiles_school_id already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'admin_profiles'
    AND CONSTRAINT_NAME = 'fk_admin_profiles_school'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql := IF(
  @fk_exists = 0,
  'ALTER TABLE admin_profiles ADD CONSTRAINT fk_admin_profiles_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL',
  'SELECT ''fk_admin_profiles_school already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
