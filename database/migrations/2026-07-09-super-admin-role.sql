USE xmetapay_db;

SET @users_role_has_super_admin := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'role'
    AND COLUMN_TYPE LIKE '%super_admin%'
);

SET @sql := IF(
  @users_role_has_super_admin = 0,
  'ALTER TABLE users MODIFY COLUMN role ENUM(''admin'', ''parent'', ''super_admin'') NOT NULL',
  'SELECT ''users.role already supports super_admin'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @auth_sessions_role_has_super_admin := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'auth_sessions'
    AND COLUMN_NAME = 'role'
    AND COLUMN_TYPE LIKE '%super_admin%'
);

SET @sql := IF(
  @auth_sessions_role_has_super_admin = 0,
  'ALTER TABLE auth_sessions MODIFY COLUMN role ENUM(''admin'', ''parent'', ''super_admin'') NOT NULL',
  'SELECT ''auth_sessions.role already supports super_admin'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
