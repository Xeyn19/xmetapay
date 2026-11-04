import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const authUiPath = "app/_components/auth-ui.tsx";
const parentRegisterPath = "app/parent/register/page.tsx";
const testCredentialInput = "not-a-real-test-login-value";

test("auth schema creates role-scoped users and profile indexes for MySQL", () => {
  assert.equal(existsSync("database/auth-schema.sql"), true);
  const sql = readFileSync("database/auth-schema.sql", "utf8");

  [
    "CREATE DATABASE IF NOT EXISTS xmetapay_db",
    "CREATE TABLE IF NOT EXISTS users",
    "role ENUM('admin', 'parent', 'super_admin') NOT NULL",
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

  const hash = await hashPassword(testCredentialInput);

  assert.notEqual(hash, testCredentialInput);
  assert.match(hash, /^scrypt\$/);
  assert.equal(await verifyPassword(testCredentialInput, hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
});

test("auth validation normalizes role-specific registration payloads", async () => {
  const { parseRegisterForm, parseLoginForm } = await import("../lib/auth/validation.mjs");

  const admin = parseRegisterForm("admin", new Map([
    ["adminName", " Maria Dela Cruz "],
    ["schoolName", " Brentwood Academy "],
    ["email", "REGISTRAR@SCHOOL.EDU.PH"],
    ["phone", "0917 111 2222"],
    ["password", testCredentialInput],
    ["confirmPassword", testCredentialInput],
  ]));

  assert.equal(admin.ok, true);
  assert.equal(admin.data.name, "Maria Dela Cruz");
  assert.equal(admin.data.email, "registrar@school.edu.ph");
  assert.equal(admin.data.phone, "0917 111 2222");
  assert.equal(admin.data.profile.staffRole, "school_administrator");

  const adminMissingPhone = parseRegisterForm("admin", new Map([
    ["adminName", " Maria Dela Cruz "],
    ["schoolName", " Brentwood Academy "],
    ["email", "registrar@school.edu.ph"],
    ["phone", ""],
    ["password", testCredentialInput],
    ["confirmPassword", testCredentialInput],
  ]));

  assert.equal(adminMissingPhone.ok, false);
  assert.equal(adminMissingPhone.errors.phone, "Phone number is required.");

  const adminShortPassword = parseRegisterForm("admin", new Map([
    ["adminName", " Maria Dela Cruz "],
    ["schoolName", " Brentwood Academy "],
    ["email", "registrar@school.edu.ph"],
    ["password", "short"],
    ["confirmPassword", "short"],
  ]));

  assert.equal(adminShortPassword.ok, false);
  assert.equal(adminShortPassword.errors.password, "Password must be at least 8 characters.");

  const parentForm = new FormData();
  parentForm.append("guardianName", " Maria Santos ");
  parentForm.append("email", "PARENT@EMAIL.COM");
  parentForm.append("phone", "0917 000 0000");
  parentForm.append("studentReferences", "BWA-001");
  parentForm.append("studentFirstNames", "Juan");
  parentForm.append("studentLastNames", "Santos");
  parentForm.append("studentReferences", " BWA-002 ");
  parentForm.append("studentFirstNames", "Maria");
  parentForm.append("studentLastNames", "Santos");
  parentForm.append("studentReferences", "bwa-001");
  parentForm.append("studentFirstNames", "juan");
  parentForm.append("studentLastNames", "santos");
  parentForm.append("relationship", "Mother");
  parentForm.append("password", testCredentialInput);
  parentForm.append("confirmPassword", testCredentialInput);
  const parent = parseRegisterForm("parent", parentForm);

  assert.equal(parent.ok, true);
  assert.equal(parent.data.name, "Maria Santos");
  assert.equal(parent.data.phone, "0917 000 0000");
  assert.equal(parent.data.profile.studentName, "BWA-001");
  assert.equal(parent.data.profile.studentReference, "BWA-001");
  assert.deepEqual(parent.data.profile.studentReferences, ["BWA-001", "BWA-002"]);
  assert.deepEqual(parent.data.profile.studentClaims, [
    { reference: "BWA-001", firstName: "Juan", lastName: "Santos" },
    { reference: "BWA-002", firstName: "Maria", lastName: "Santos" },
  ]);
  assert.equal(parent.data.profile.relationship, "mother");

  const parentMissingPhone = parseRegisterForm("parent", new Map([
    ["guardianName", " Maria Santos "],
    ["email", "parent2@email.com"],
    ["phone", ""],
    ["studentReferences", "BWA-002"],
    ["studentFirstNames", "Juan"],
    ["studentLastNames", "Santos"],
    ["relationship", "Guardian"],
    ["password", testCredentialInput],
    ["confirmPassword", testCredentialInput],
  ]));

  assert.equal(parentMissingPhone.ok, false);
  assert.equal(parentMissingPhone.errors.phone, "Phone number is required.");

  const parentMissingReferences = parseRegisterForm("parent", new Map([
    ["guardianName", " Maria Santos "],
    ["email", "parent4@email.com"],
    ["phone", "0999 111 2222"],
    ["relationship", "Guardian"],
    ["password", testCredentialInput],
    ["confirmPassword", testCredentialInput],
  ]));

  assert.equal(parentMissingReferences.ok, true);
  assert.deepEqual(parentMissingReferences.data.profile.studentReferences, []);

  const parentWithoutStudentNames = parseRegisterForm("parent", new Map([
    ["guardianName", " Maria Santos "],
    ["email", "parent3@email.com"],
    ["phone", "0999 111 2222"],
    ["studentReferences", "BWA-003"],
    ["relationship", "Mother"],
    ["password", testCredentialInput],
    ["confirmPassword", testCredentialInput],
  ]));

  assert.equal(parentWithoutStudentNames.ok, false);
  assert.match(parentWithoutStudentNames.errors.studentClaims, /Complete the reference/);

  const adminPhoneLogin = parseLoginForm("admin", new Map([
    ["email", " 0917 000 0000 "],
    ["password", testCredentialInput],
  ]));

  assert.deepEqual(adminPhoneLogin, {
    ok: true,
    data: {
      role: "admin",
      identifier: "0917 000 0000",
      password: testCredentialInput,
    },
  });

  const login = parseLoginForm("parent", new Map([
    ["identifier", " PARENT@EMAIL.COM "],
    ["password", testCredentialInput],
  ]));

  assert.deepEqual(login, {
    ok: true,
    data: {
      role: "parent",
      identifier: "parent@email.com",
      password: testCredentialInput,
    },
  });
});

test("parent registration infers one school and renders exact student identity controls", () => {
  const parentRegister = readFileSync(parentRegisterPath, "utf8");
  const authUi = readFileSync(authUiPath, "utf8");

  assert.match(parentRegister, /review the connection before sign-in/);
  assert.doesNotMatch(parentRegister, /getActiveParentRegistrationSchools/);
  assert.doesNotMatch(parentRegister, /name: "schoolId"/);
  assert.doesNotMatch(parentRegister, /Select your school/);
  assert.match(parentRegister, /name: "studentClaims"/);
  assert.match(parentRegister, /type: "studentClaims"/);
  assert.match(parentRegister, /name: "schoolCode"/);
  assert.match(parentRegister, /type: "schoolCodeWhenNeeded"/);
  assert.match(authUi, /function StudentClaimsField/);
  assert.match(authUi, /field\.type === "schoolCodeWhenNeeded" && !error/);
  assert.match(authUi, /name="studentReferences"/);
  assert.match(authUi, /name="studentFirstNames"/);
  assert.match(authUi, /name="studentLastNames"/);
  assert.match(authUi, /Add another student/);
  assert.match(authUi, /Remove/);
  assert.match(authUi, /reference and official first and last name/);
  assert.match(authUi, /Up to 10 students/);
});

