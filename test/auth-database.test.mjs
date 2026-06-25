import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("auth schema creates role-scoped users and profile indexes for MySQL", () => {
  assert.equal(existsSync("database/auth-schema.sql"), true);
  const sql = readFileSync("database/auth-schema.sql", "utf8");

  [
    "CREATE DATABASE IF NOT EXISTS xmetapay_db",
    "CREATE TABLE IF NOT EXISTS users",
    "role ENUM('admin', 'parent') NOT NULL",
    "password_hash VARCHAR(255) NOT NULL",
    "UNIQUE KEY uq_users_role_email (role, email)",
    "UNIQUE KEY uq_users_role_phone (role, phone)",
    "KEY idx_users_role_status (role, status)",
    "CREATE TABLE IF NOT EXISTS auth_sessions",
    "token_hash CHAR(64) NOT NULL",
    "expires_at DATETIME NOT NULL",
    "revoked_at DATETIME NULL",
    "UNIQUE KEY uq_auth_sessions_token_hash (token_hash)",
    "KEY idx_auth_sessions_user_revoked_expires (user_id, revoked_at, expires_at)",
    "KEY idx_auth_sessions_role_expires (role, expires_at)",
    "CONSTRAINT fk_auth_sessions_user",
    "CREATE TABLE IF NOT EXISTS admin_profiles",
    "UNIQUE KEY uq_admin_profiles_user_id (user_id)",
    "KEY idx_admin_profiles_school_name (school_name)",
    "CREATE TABLE IF NOT EXISTS parent_profiles",
    "UNIQUE KEY uq_parent_profiles_user_id (user_id)",
    "KEY idx_parent_profiles_student_reference (student_reference)",
    "KEY idx_parent_profiles_student_name (student_name)",
    "ON DELETE CASCADE",
    "ENGINE=InnoDB",
  ].forEach((fragment) => assert.match(sql, new RegExp(fragment.replace(/[()]/g, "\\$&"))));
});

test("password helper hashes without storing the raw password", async () => {
  const { hashPassword, verifyPassword } = await import("../lib/auth/password.mjs");

  const hash = await hashPassword("SchoolPay#123");

  assert.notEqual(hash, "SchoolPay#123");
  assert.match(hash, /^scrypt\$/);
  assert.equal(await verifyPassword("SchoolPay#123", hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
});

test("auth validation normalizes role-specific registration payloads", async () => {
  const { parseRegisterForm, parseLoginForm } = await import("../lib/auth/validation.mjs");

  const admin = parseRegisterForm("admin", new Map([
    ["adminName", " Maria Dela Cruz "],
    ["schoolName", " Brentwood Academy "],
    ["email", "REGISTRAR@SCHOOL.EDU.PH"],
    ["phone", ""],
    ["staffRole", "Finance officer"],
    ["password", "SchoolPay#123"],
    ["confirmPassword", "SchoolPay#123"],
  ]));

  assert.equal(admin.ok, true);
  assert.equal(admin.data.name, "Maria Dela Cruz");
  assert.equal(admin.data.email, "registrar@school.edu.ph");
  assert.equal(admin.data.phone, null);
  assert.equal(admin.data.profile.staffRole, "finance_officer");

  const parent = parseRegisterForm("parent", new Map([
    ["guardianName", " Maria Santos "],
    ["email", "PARENT@EMAIL.COM"],
    ["phone", ""],
    ["studentName", "Juan Miguel Santos"],
    ["studentReference", "BWA-001"],
    ["relationship", "Mother"],
    ["password", "SchoolPay#123"],
    ["confirmPassword", "SchoolPay#123"],
  ]));

  assert.equal(parent.ok, true);
  assert.equal(parent.data.name, "Maria Santos");
  assert.equal(parent.data.phone, null);
  assert.equal(parent.data.profile.relationship, "mother");

  const adminPhoneLogin = parseLoginForm("admin", new Map([
    ["email", " 0917 000 0000 "],
    ["password", "SchoolPay#123"],
  ]));

  assert.deepEqual(adminPhoneLogin, {
    ok: true,
    data: {
      role: "admin",
      identifier: "0917 000 0000",
      password: "SchoolPay#123",
    },
  });

  const login = parseLoginForm("parent", new Map([
    ["identifier", " PARENT@EMAIL.COM "],
    ["password", "SchoolPay#123"],
  ]));

  assert.deepEqual(login, {
    ok: true,
    data: {
      role: "parent",
      identifier: "parent@email.com",
      password: "SchoolPay#123",
    },
  });
});

