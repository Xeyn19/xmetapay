import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const fullSchemaPath = "database/full-schema-v1.sql";
const databaseReadmePath = "database/README.md";
const authSchema = readFileSync("database/auth-schema.sql", "utf8");

test("full MVP schema file defines the database layers after auth", () => {
  assert.equal(existsSync(fullSchemaPath), true);
  const sql = readFileSync(fullSchemaPath, "utf8");

  [
    "USE xmetapay_db;",
    "CREATE TABLE IF NOT EXISTS schools",
    "CREATE TABLE IF NOT EXISTS school_years",
    "CREATE TABLE IF NOT EXISTS grade_levels",
    "CREATE TABLE IF NOT EXISTS sections",
    "CREATE TABLE IF NOT EXISTS students",
    "CREATE TABLE IF NOT EXISTS student_guardians",
    "CREATE TABLE IF NOT EXISTS enrollments",
    "CREATE TABLE IF NOT EXISTS enrollment_documents",
    "CREATE TABLE IF NOT EXISTS fee_types",
    "CREATE TABLE IF NOT EXISTS student_fee_assignments",
    "CREATE TABLE IF NOT EXISTS payments",
    "CREATE TABLE IF NOT EXISTS payment_allocations",
    "CREATE TABLE IF NOT EXISTS receipts",
    "CREATE TABLE IF NOT EXISTS wallets",
    "CREATE TABLE IF NOT EXISTS wallet_transactions",
    "CREATE TABLE IF NOT EXISTS store_merchants",
    "CREATE TABLE IF NOT EXISTS store_transactions",
    "CREATE TABLE IF NOT EXISTS notification_logs",
    "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  ].forEach((fragment) => assert.match(sql, new RegExp(fragment.replace(/[()]/g, "\\$&"))));
});

test("full MVP schema preserves the planned keys and auth relationships", () => {
  assert.equal(existsSync(fullSchemaPath), true);
  const sql = readFileSync(fullSchemaPath, "utf8");

  [
    "UNIQUE KEY uq_schools_code (code)",
    "UNIQUE KEY uq_students_school_reference (school_id, student_reference)",
    "UNIQUE KEY uq_student_guardians_pair (student_id, parent_user_id)",
    "UNIQUE KEY uq_enrollments_student_year (student_id, school_year_id)",
    "UNIQUE KEY uq_student_fee_assignments_student_fee_year (student_id, fee_type_id, school_year_id)",
    "UNIQUE KEY uq_payments_reference_number (reference_number)",
    "UNIQUE KEY uq_receipts_number (receipt_number)",
    "UNIQUE KEY uq_wallets_student (student_id)",
    "UNIQUE KEY uq_store_transactions_reference (reference_number)",
    "CONSTRAINT fk_student_guardians_parent FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE",
    "CONSTRAINT fk_payments_payer FOREIGN KEY (payer_user_id) REFERENCES users(id)",
    "CONSTRAINT fk_notification_logs_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id)",
  ].forEach((fragment) => assert.match(sql, new RegExp(fragment.replace(/[()]/g, "\\$&"))));
});

test("database README documents XAMPP import order", () => {
  assert.equal(existsSync(databaseReadmePath), true);
  const readme = readFileSync(databaseReadmePath, "utf8");

  assert.match(readme, /auth-schema\.sql/);
  assert.match(readme, /full-schema-v1\.sql/);
  assert.match(readme, /XAMPP|phpMyAdmin/);
});

test("auth schema remains focused on authentication tables", () => {
  assert.match(authSchema, /CREATE TABLE IF NOT EXISTS users/);
  assert.match(authSchema, /CREATE TABLE IF NOT EXISTS admin_profiles/);
  assert.match(authSchema, /CREATE TABLE IF NOT EXISTS parent_profiles/);
  assert.doesNotMatch(authSchema, /CREATE TABLE IF NOT EXISTS schools/);
  assert.doesNotMatch(authSchema, /CREATE TABLE IF NOT EXISTS payments/);
});
