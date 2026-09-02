import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("invitation migration is idempotent, non-destructive, and contains no plaintext secrets", () => {
  const migration = read("database/migrations/2026-09-02-parent-invitation-otp.sql");
  const schema = read("database/full-schema-v1.sql");
  const production = read("utilities/database/xmetapay-production-schema.sql");

  for (const sql of [migration, schema, production]) {
    assert.match(sql, /parent_guardian_invitations/);
    assert.match(sql, /parent_claim_challenges/);
    assert.match(sql, /guardian_access_events/);
    assert.match(sql, /claim_code_hash CHAR\(64\)/);
    assert.match(sql, /otp_hash CHAR\(64\)/);
    assert.match(sql, /status ENUM\('active', 'revoked'\)/);
    assert.doesNotMatch(sql, /claim_code\s+VARCHAR|otp\s+(?:CHAR|VARCHAR)/i);
  }

  assert.match(migration, /CREATE TABLE IF NOT EXISTS/g);
  assert.match(migration, /information_schema\.COLUMNS/);
  assert.match(migration, /information_schema\.STATISTICS/);
  assert.match(migration, /information_schema\.TABLE_CONSTRAINTS/);
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\b|\bTRUNCATE\b|\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);
});

test("server invitation domain owns issuance, OTP verification, and atomic claims", () => {
  const domain = read("lib/parents/invitations.ts");

  assert.match(domain, /import "server-only"/);
  assert.match(domain, /randomBytes/);
  assert.match(domain, /createHmac/);
  assert.match(domain, /timingSafeEqual/);
  assert.match(domain, /invitationLifetimeMs = 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(domain, /otpLifetimeMs = 5 \* 60 \* 1000/);
  assert.match(domain, /resendCooldownMs = 60 \* 1000/);
  assert.match(domain, /maximumSends = 5/);
  assert.match(domain, /maximumAttempts = 5/);
  assert.match(domain, /completionLifetimeMs = 10 \* 60 \* 1000/);
  assert.match(domain, /httpOnly\s*:\s*true/);
  assert.match(domain, /sameSite\s*:\s*"lax"/);
  assert.match(domain, /beginTransaction\(\)/);
  assert.match(domain, /FOR UPDATE/);
  assert.match(domain, /INSERT INTO guardian_access_events/);
  assert.match(domain, /UPDATE parent_guardian_invitations SET claimed_at=/);
  assert.match(domain, /await connection\.commit\(\)/);
  assert.doesNotMatch(domain, /console\.(?:log|info|debug).*claim|console\.(?:log|info|debug).*otp/i);
});

test("only the exact school administrator can manage invitations and guardian access", () => {
  const domain = read("lib/parents/invitations.ts");
  const actions = read("app/admin/parent-invitations/actions.ts");
  const studentPage = read("app/admin/(dashboard)/students/[studentId]/page.tsx");
  const panel = read("app/admin/(dashboard)/student-profile/guardian-access-panel.tsx");

  assert.match(domain, /row\.staff_role!=="school_administrator"/);
  assert.match(domain, /st\.school_id = :schoolId/);
  assert.match(domain, /sc\.status='active'/);
  assert.match(actions, /requireRole\("admin"\)/g);
  assert.match(actions, /issueParentInvitation/);
  assert.match(actions, /resendParentInvitation/);
  assert.match(actions, /revokeParentInvitation/);
  assert.match(actions, /setGuardianAccess/);
  assert.match(studentPage, /staffRole === "school_administrator"/);
  assert.match(panel, /Guardian access/);
  assert.match(panel, /const initialParentInvitationActionState/);
  assert.doesNotMatch(actions, /export const initialParentInvitationActionState/);
  assert.match(panel, /Revoke access/);
  assert.match(panel, /Restore access/);
});

test("parent claim UI is staged, accessible, and never asks for school or student references", () => {
  const page = read("app/parent/register/page.tsx");
  const flow = read("app/parent/register/parent-claim-flow.tsx");
  const actions = read("app/parent/claim/actions.ts");

  assert.match(page, /getParentClaimState/);
  assert.match(flow, /state\.stage === "code"/);
  assert.match(flow, /state\.stage === "otp"/);
  assert.match(flow, /state\.stage === "account"/);
  assert.match(flow, /state\.stage === "login_required"/);
  assert.match(flow, /state\.stage === "ready"/);
  assert.match(flow, /aria-live="polite"/);
  assert.match(flow, /min-h-11/);
  assert.match(flow, /disabled=\{pending\}/);
  assert.doesNotMatch(flow, /name="schoolId"|name="studentReference/);
  assert.match(actions, /requestParentClaimOtp/);
  assert.match(actions, /verifyParentClaimOtp/);
  assert.match(actions, /completeNewParentClaim/);
  assert.match(actions, /completeExistingParentClaim/);
});

test("all parent record boundaries require active guardian access", () => {
  const paths = [
    "lib/students/records.ts",
    "lib/fees/records.ts",
    "lib/payments/records.ts",
    "lib/tuition/terms.ts",
    "lib/wallets/records.ts",
    "lib/fees/parent-archive.ts",
    "lib/payments/parent-history-archive.ts",
    "app/parent/payments/actions.ts",
    "lib/wallets/top-up.ts",
  ];

  for (const path of paths) {
    assert.match(read(path), /sg(?:_[a-z]+)?\.status = 'active'/, path);
  }
});

test("Nodemailer sends escaped claim-code and OTP templates without exposing SMTP details", () => {
  const mailer = read("lib/email/mailer.ts");

  assert.match(mailer, /sendParentInvitationEmail/);
  assert.match(mailer, /sendParentClaimOtpEmail/);
  assert.match(mailer, /secureCodeEmailHtml/);
  assert.match(mailer, /escapeHtml/);
  assert.match(mailer, /text:/);
  assert.match(mailer, /html:/);
  assert.doesNotMatch(mailer, /console\.(?:log|info|debug).*smtp|console\.(?:log|info|debug).*otp/i);
});
