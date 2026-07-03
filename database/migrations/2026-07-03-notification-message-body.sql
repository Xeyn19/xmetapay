USE xmetapay_db;

-- Store the reminder message text shown in admin reminder history.
-- Safe to import more than once in local XAMPP/phpMyAdmin.
ALTER TABLE notification_logs
  ADD COLUMN IF NOT EXISTS message_body TEXT NULL AFTER status;
