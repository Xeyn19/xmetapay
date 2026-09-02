-- Binds each parent profile to at most one school without deleting any existing records.

SET @parent_school_column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'parent_profiles'
    AND COLUMN_NAME = 'school_id'
);

SET @sql := IF(
  @parent_school_column_exists = 0,
  'ALTER TABLE parent_profiles ADD COLUMN school_id BIGINT UNSIGNED NULL AFTER user_id',
  'SELECT ''parent_profiles.school_id already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @parent_school_index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'parent_profiles'
    AND INDEX_NAME = 'idx_parent_profiles_school_id'
);

SET @sql := IF(
  @parent_school_index_exists = 0,
  'CREATE INDEX idx_parent_profiles_school_id ON parent_profiles (school_id)',
  'SELECT ''idx_parent_profiles_school_id already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @parent_school_fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'parent_profiles'
    AND CONSTRAINT_NAME = 'fk_parent_profiles_school'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql := IF(
  @parent_school_fk_exists = 0,
  'ALTER TABLE parent_profiles ADD CONSTRAINT fk_parent_profiles_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL',
  'SELECT ''fk_parent_profiles_school already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Existing guardian links are authoritative only when they all belong to one school.
UPDATE parent_profiles pp
JOIN (
  SELECT sg.parent_user_id, MIN(st.school_id) AS school_id
  FROM student_guardians sg
  JOIN students st ON st.id = sg.student_id
  GROUP BY sg.parent_user_id
  HAVING COUNT(DISTINCT st.school_id) = 1
) linked_school ON linked_school.parent_user_id = pp.user_id
SET pp.school_id = linked_school.school_id
WHERE pp.school_id IS NULL;

-- For an unlinked parent, use the saved reference only when it identifies one school.
UPDATE parent_profiles pp
JOIN (
  SELECT pp_match.user_id, MIN(st.school_id) AS school_id
  FROM parent_profiles pp_match
  JOIN students st ON st.student_reference = pp_match.student_reference
  LEFT JOIN student_guardians sg ON sg.parent_user_id = pp_match.user_id
  WHERE sg.id IS NULL
  GROUP BY pp_match.user_id
  HAVING COUNT(DISTINCT st.school_id) = 1
) reference_school ON reference_school.user_id = pp.user_id
SET pp.school_id = reference_school.school_id
WHERE pp.school_id IS NULL;

-- NULL rows are intentionally preserved for review or removal as test data.
SELECT COUNT(*) AS unresolved_parent_profiles
FROM parent_profiles
WHERE school_id IS NULL;
