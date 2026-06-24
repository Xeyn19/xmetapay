# XMETA Pay Database Setup

Use these SQL files for local XAMPP/phpMyAdmin setup.

## Import Order

1. Import `auth-schema.sql` first.
   - Creates `xmetapay_db`.
   - Creates authentication tables for users, admin profiles, and parent profiles.
2. Import `full-schema-v1.sql` second.
   - Adds the MVP project tables for schools, students, enrollment, fees, payments, receipts, wallets, store/canteen transactions, and notifications.
   - Assumes the auth tables already exist because some records reference `users.id`.

## Local Verification

After importing both files:

1. Confirm all tables appear in phpMyAdmin.
2. Register a test admin account.
3. Register a test parent account.
4. Log in and log out from both portals.
5. Confirm protected admin and parent dashboards still redirect after logout.

Do not commit database exports, real school data, parent data, student data, payment data, credentials, or local environment files.
