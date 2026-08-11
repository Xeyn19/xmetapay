USE xmetapay_db;

CREATE TABLE IF NOT EXISTS school_email_templates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  reminder_type ENUM('tuition_due', 'overdue_notice', 'final_notice') NOT NULL,
  name VARCHAR(120) NOT NULL,
  subject_template VARCHAR(220) NOT NULL,
  message_template TEXT NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_school_email_templates_name (school_id, name),
  KEY idx_school_email_templates_type_status (school_id, reminder_type, status, is_default),
  CONSTRAINT fk_school_email_templates_school
    FOREIGN KEY (school_id) REFERENCES schools(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_school_email_templates_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_school_email_templates_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS xmetapay_add_email_template_audit_fields;
DELIMITER //
CREATE PROCEDURE xmetapay_add_email_template_audit_fields()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notification_logs'
      AND COLUMN_NAME = 'email_template_id'
  ) THEN
    ALTER TABLE notification_logs
      ADD COLUMN email_template_id BIGINT UNSIGNED NULL AFTER message_body;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notification_logs'
      AND COLUMN_NAME = 'email_template_name'
  ) THEN
    ALTER TABLE notification_logs
      ADD COLUMN email_template_name VARCHAR(120) NULL AFTER email_template_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notification_logs'
      AND COLUMN_NAME = 'subject_line'
  ) THEN
    ALTER TABLE notification_logs
      ADD COLUMN subject_line VARCHAR(220) NULL AFTER email_template_name;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notification_logs'
      AND INDEX_NAME = 'idx_notification_logs_email_template'
  ) THEN
    ALTER TABLE notification_logs
      ADD KEY idx_notification_logs_email_template (email_template_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notification_logs'
      AND CONSTRAINT_NAME = 'fk_notification_logs_email_template'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE notification_logs
      ADD CONSTRAINT fk_notification_logs_email_template
      FOREIGN KEY (email_template_id) REFERENCES school_email_templates(id)
      ON DELETE SET NULL;
  END IF;
END//
DELIMITER ;

CALL xmetapay_add_email_template_audit_fields();
DROP PROCEDURE IF EXISTS xmetapay_add_email_template_audit_fields;
