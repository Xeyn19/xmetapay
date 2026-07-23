import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const migrationPath =
  "database/migrations/2026-07-23-password-reset-otp.sql";
const migration = read(migrationPath);
const authSchema = read("database/auth-schema.sql");
const fullSchema = read("database/full-schema-v1.sql");
const recovery = read("lib/auth/password-reset.ts");
const actions = read("app/auth/password-reset/actions.ts");
const mailer = read("lib/email/mailer.ts");
const flow = read("app/_components/password-reset-flow.tsx");

test("password reset migration and fresh schemas define secure challenges", () => {
  assert.equal(existsSync(migrationPath), true);

  for (const sql of [migration, authSchema, fullSchema]) {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS password_reset_challenges/);
    assert.match(sql, /PRIMARY KEY \(user_id\)/);
    assert.match(
      sql,
      /UNIQUE KEY uq_password_reset_challenge_token \(challenge_token_hash\)/,
    );
    assert.match(sql, /otp_expires_at DATETIME NOT NULL/);
    assert.match(sql, /resend_available_at DATETIME NOT NULL/);
    assert.match(sql, /send_window_started_at DATETIME NOT NULL/);
    assert.match(sql, /failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0/);
    assert.match(sql, /verified_at DATETIME NULL/);
    assert.match(sql, /reset_expires_at DATETIME NULL/);
    assert.match(sql, /consumed_at DATETIME NULL/);
    assert.match(sql, /FOREIGN KEY \(user_id\) REFERENCES users\(id\)/);
    assert.match(sql, /ON DELETE CASCADE/);
  }
});

test("password reset service hashes OTPs and enforces lifecycle limits", () => {
  assert.match(recovery, /import "server-only"/);
  assert.match(recovery, /randomInt\(0, 1_000_000\)/);
  assert.match(recovery, /createHmac\("sha256", resetSecret\(\)\)/);
  assert.match(recovery, /timingSafeEqual/);
  assert.match(recovery, /const otpLifetimeMs = 5 \* 60 \* 1000/);
  assert.match(recovery, /const resendCooldownMs = 60 \* 1000/);
  assert.match(recovery, /const resetLifetimeMs = 10 \* 60 \* 1000/);
  assert.match(recovery, /const maximumSends = 5/);
  assert.match(recovery, /const maximumAttempts = 5/);
  assert.match(recovery, /AUTH_SESSION_SECRET/);
  assert.doesNotMatch(
    `${migration}\n${authSchema}\n${fullSchema}`,
    /\botp\b\s+(?:VARCHAR|CHAR)/i,
  );
});

test("password reset is role scoped, active only, and enumeration safe", () => {
  assert.match(recovery, /WHERE role = :role\s+AND email = :email/);
  assert.match(recovery, /user\.status !== "active"/);
  assert.match(
    recovery,
    /If an active account matches that email, a six-digit code has been sent/,
  );
  assert.match(recovery, /u\.role = :role/);
  assert.match(recovery, /u\.status = 'active'/);
  assert.ok(
    (recovery.match(/return genericOtpResult\(/g) ?? []).length >= 7,
    "request and resend edge paths should retain the generic response",
  );
  assert.doesNotMatch(recovery, /Too many codes were requested/);
  assert.doesNotMatch(recovery, /UPDATE users[\s\S]*SET status/);
});

test("password reset uses row locks, transactions, one-time use, and session revocation", () => {
  assert.match(recovery, /beginTransaction\(\)/);
  assert.match(recovery, /FOR UPDATE/);
  assert.match(recovery, /ON DUPLICATE KEY UPDATE/);
  assert.match(recovery, /SET password_hash = :passwordHash/);
  assert.match(recovery, /SET consumed_at = CURRENT_TIMESTAMP/);
  assert.match(
    recovery,
    /UPDATE auth_sessions\s+SET revoked_at = CURRENT_TIMESTAMP/,
  );
  assert.match(recovery, /connection\.commit\(\)/);
  assert.match(recovery, /connection\.rollback\(\)/);
});

test("password reset actions remain thin and redirect by role", () => {
  assert.match(actions, /requestPasswordReset\(role/);
  assert.match(actions, /resendPasswordReset\(role\)/);
  assert.match(actions, /verifyPasswordResetOtp\(role/);
  assert.match(actions, /completePasswordReset\(/);
  assert.match(actions, /setAuthFlashToast/);
  assert.match(actions, /passwordResetLoginPath\(role\)/);
});

test("SMTP mailer sends a branded expiring OTP without logging it", () => {
  assert.match(mailer, /export async function sendPasswordResetOtpEmail/);
  assert.match(mailer, /Your XMETA Pay password reset code/);
  assert.match(mailer, /This code expires in 5 minutes/);
  assert.match(mailer, /Do not share it with anyone/);
  assert.match(mailer, /passwordResetOtpHtml/);
  assert.doesNotMatch(recovery, /console\.(?:log|error)\([^)]*otp/i);
});

test("all login roles expose responsive staged recovery pages", () => {
  const adminLogin = read("app/_components/auth-ui.tsx");
  const companyLogin = read("app/login/super-admin-login-form.tsx");
  const routes = [
    "app/admin/forgot-password/page.tsx",
    "app/parent/forgot-password/page.tsx",
    "app/forgot-password/page.tsx",
  ];

  assert.match(adminLogin, /href={`\/\${portal}\/forgot-password`}/);
  assert.match(companyLogin, /href="\/forgot-password"/);
  assert.match(flow, /inputMode="numeric"/);
  assert.match(flow, /autoComplete="one-time-code"/);
  assert.match(flow, /pattern="\[0-9\]\{6\}"/);
  assert.match(flow, /Resend code in \$\{remaining\}s/);
  assert.match(flow, /min-h-12/);
  assert.match(flow, /focus-visible:ring/);

  for (const route of routes) {
    assert.equal(existsSync(route), true);
    assert.match(read(route), /<PasswordResetPage/);
  }
});

test("project documentation describes implemented OTP recovery", () => {
  const docs = [
    "docs/ADMIN_ROLES.md",
    "docs/CHECKLIST.md",
    "docs/DATABASE_SCHEMA_EXPLANATION.md",
    "docs/DATABASE_SCHEMA_PLAN.md",
    "docs/PROJECT_FLOWCHARTS.md",
    "public/PROJECT_FLOWCHARTS_VISUAL.html",
    "public/DATABASE_SCHEMA_VISUAL_PLAN.html",
    "database/README.md",
  ]
    .map(read)
    .join("\n");

  assert.match(docs, /password_reset_challenges/);
  assert.match(docs, /six-digit|6-digit/i);
  assert.match(docs, /five minutes|5-minute/i);
  assert.match(docs, /60 seconds|60-second/i);
  assert.match(docs, /revoke/i);
});
