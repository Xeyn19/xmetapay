import "server-only";

import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { hashPassword } from "@/lib/auth/password.mjs";
import type { AuthRole } from "@/lib/auth/session";
import { sendPasswordResetOtpEmail } from "@/lib/email/mailer";

export type PasswordResetStage = "request" | "otp" | "password";
export type PasswordResetResult = {
  stage: PasswordResetStage;
  message: string;
  errors?: Record<string, string>;
  emailHint?: string;
  resendAvailableAt?: number;
};

const cookieName = "xmetapay_password_reset";
const otpLifetimeMs = 5 * 60 * 1000;
const resendCooldownMs = 60 * 1000;
const resetLifetimeMs = 10 * 60 * 1000;
const sendWindowMs = 60 * 60 * 1000;
const maximumSends = 5;
const maximumAttempts = 5;
const genericRequestMessage =
  "If an active account matches that email, a six-digit code has been sent.";

export async function getPasswordResetStage(role: AuthRole): Promise<PasswordResetStage> {
  const token = await getChallengeToken();

  if (!token) {
    return "request";
  }

  try {
    const [rows] = await pool.execute<ChallengeStageRow[]>(
      `SELECT c.verified_at, c.reset_expires_at
       FROM password_reset_challenges c
       JOIN users u ON u.id = c.user_id
       WHERE c.challenge_token_hash = :tokenHash
         AND u.role = :role
         AND u.status = 'active'
         AND c.consumed_at IS NULL
       LIMIT 1`,
      {
        tokenHash: hashValue(token),
        role,
      },
    );
    const row = rows[0];

    if (
      row?.verified_at &&
      row.reset_expires_at &&
      toTimestamp(row.reset_expires_at) > Date.now()
    ) {
      return "password";
    }
  } catch {
    return "otp";
  }

  return "otp";
}

export async function requestPasswordReset(
  role: AuthRole,
  emailInput: string,
): Promise<PasswordResetResult> {
  const email = emailInput.trim().toLowerCase();

  if (!isEmail(email)) {
    return {
      stage: "request",
      message: "Enter the email address used for this account.",
      errors: { email: "Enter a valid email address." },
    };
  }

  const challengeToken = randomBytes(32).toString("base64url");
  const challengeTokenHash = hashValue(challengeToken);
  const otp = generateOtp();
  const now = Date.now();
  let user: ResetUserRow | undefined;
  let connection: PoolConnection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [users] = await connection.execute<ResetUserRow[]>(
      `SELECT id, name, email, role, status
       FROM users
       WHERE role = :role
         AND email = :email
       LIMIT 1
       FOR UPDATE`,
      { role, email },
    );
    user = users[0];

    if (!user || user.status !== "active") {
      await connection.commit();
      await setChallengeCookie(challengeToken);

      return genericOtpResult(email, now + resendCooldownMs);
    }

    const [challenges] = await connection.execute<ChallengeRow[]>(
      `SELECT *
       FROM password_reset_challenges
       WHERE user_id = :userId
       LIMIT 1
       FOR UPDATE`,
      { userId: user.id },
    );
    const challenge = challenges[0];
    const withinWindow =
      challenge &&
      now - toTimestamp(challenge.send_window_started_at) < sendWindowMs;
    const sendCount = withinWindow ? challenge.send_count + 1 : 1;

    if (withinWindow && sendCount > maximumSends) {
      await connection.rollback();
      await setChallengeCookie(challengeToken);

      return genericOtpResult(email, now + resendCooldownMs);
    }

    await connection.execute(
      `INSERT INTO password_reset_challenges (
         user_id,
         challenge_token_hash,
         otp_hash,
         otp_expires_at,
         resend_available_at,
         send_window_started_at,
         send_count,
         failed_attempts,
         verified_at,
         reset_expires_at,
         consumed_at
       )
       VALUES (
         :userId,
         :challengeTokenHash,
         :otpHash,
         :otpExpiresAt,
         :resendAvailableAt,
         :sendWindowStartedAt,
         :sendCount,
         0,
         NULL,
         NULL,
         NULL
       )
       ON DUPLICATE KEY UPDATE
         challenge_token_hash = VALUES(challenge_token_hash),
         otp_hash = VALUES(otp_hash),
         otp_expires_at = VALUES(otp_expires_at),
         resend_available_at = VALUES(resend_available_at),
         send_window_started_at = VALUES(send_window_started_at),
         send_count = VALUES(send_count),
         failed_attempts = 0,
         verified_at = NULL,
         reset_expires_at = NULL,
         consumed_at = NULL`,
      {
        userId: user.id,
        challengeTokenHash,
        otpHash: hashValue(otp),
        otpExpiresAt: new Date(now + otpLifetimeMs),
        resendAvailableAt: new Date(now + resendCooldownMs),
        sendWindowStartedAt: new Date(
          withinWindow ? toTimestamp(challenge.send_window_started_at) : now,
        ),
        sendCount,
      },
    );
    await connection.commit();
  } catch (error) {
    await rollback(connection);
    logPasswordResetError("request", error);

    return unavailableResult("request");
  } finally {
    connection?.release();
  }

  await setChallengeCookie(challengeToken);

  try {
    await sendPasswordResetOtpEmail({
      email: user.email,
      name: user.name,
      otp,
      portalLabel: portalLabel(role),
    });
  } catch (error) {
    await invalidateChallenge(challengeTokenHash);
    await setChallengeCookie(challengeToken);
    logPasswordResetError("send", error);

    return genericOtpResult(email, now + resendCooldownMs);
  }

  return genericOtpResult(email, now + resendCooldownMs);
}

export async function resendPasswordReset(
  role: AuthRole,
): Promise<PasswordResetResult> {
  const token = await getChallengeToken();
  const now = Date.now();

  if (!token) {
    return {
      stage: "request",
      message: "Start again and enter your account email.",
    };
  }

  const tokenHash = hashValue(token);
  const otp = generateOtp();
  let connection: PoolConnection | null = null;
  let user: ResetUserRow | undefined;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute<ChallengeWithUserRow[]>(
      `SELECT c.*, u.name, u.email, u.role, u.status
       FROM password_reset_challenges c
       JOIN users u ON u.id = c.user_id
       WHERE c.challenge_token_hash = :tokenHash
         AND u.role = :role
       LIMIT 1
       FOR UPDATE`,
      { tokenHash, role },
    );
    const challenge = rows[0];

    if (!challenge || challenge.status !== "active") {
      await connection.commit();

      return genericOtpResult("", now + resendCooldownMs);
    }

    const resendAt = toTimestamp(challenge.resend_available_at);

    if (resendAt > now) {
      await connection.rollback();

      return genericOtpResult("", resendAt);
    }

    const withinWindow =
      now - toTimestamp(challenge.send_window_started_at) < sendWindowMs;
    const sendCount = withinWindow ? challenge.send_count + 1 : 1;

    if (withinWindow && sendCount > maximumSends) {
      await connection.rollback();

      return genericOtpResult("", now + resendCooldownMs);
    }

    await connection.execute(
      `UPDATE password_reset_challenges
       SET otp_hash = :otpHash,
           otp_expires_at = :otpExpiresAt,
           resend_available_at = :resendAvailableAt,
           send_window_started_at = :sendWindowStartedAt,
           send_count = :sendCount,
           failed_attempts = 0,
           verified_at = NULL,
           reset_expires_at = NULL,
           consumed_at = NULL
       WHERE user_id = :userId`,
      {
        otpHash: hashValue(otp),
        otpExpiresAt: new Date(now + otpLifetimeMs),
        resendAvailableAt: new Date(now + resendCooldownMs),
        sendWindowStartedAt: new Date(
          withinWindow ? toTimestamp(challenge.send_window_started_at) : now,
        ),
        sendCount,
        userId: challenge.user_id,
      },
    );
    await connection.commit();
    user = challenge;
  } catch (error) {
    await rollback(connection);
    logPasswordResetError("resend", error);

    return unavailableResult("otp");
  } finally {
    connection?.release();
  }

  try {
    await sendPasswordResetOtpEmail({
      email: user.email,
      name: user.name,
      otp,
      portalLabel: portalLabel(role),
    });
  } catch (error) {
    await invalidateChallenge(tokenHash);
    logPasswordResetError("resend-send", error);

    return genericOtpResult("", now + resendCooldownMs);
  }

  return genericOtpResult("", now + resendCooldownMs);
}

export async function verifyPasswordResetOtp(
  role: AuthRole,
  otpInput: string,
): Promise<PasswordResetResult> {
  const otp = otpInput.trim();

  if (!/^\d{6}$/.test(otp)) {
    return {
      stage: "otp",
      message: "Enter the six-digit code from your email.",
      errors: { otp: "The code must contain six digits." },
    };
  }

  const token = await getChallengeToken();

  if (!token) {
    return invalidOtpResult();
  }

  let connection: PoolConnection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute<ChallengeWithUserRow[]>(
      `SELECT c.*, u.name, u.email, u.role, u.status
       FROM password_reset_challenges c
       JOIN users u ON u.id = c.user_id
       WHERE c.challenge_token_hash = :tokenHash
         AND u.role = :role
       LIMIT 1
       FOR UPDATE`,
      {
        tokenHash: hashValue(token),
        role,
      },
    );
    const challenge = rows[0];
    const now = Date.now();

    if (
      !challenge ||
      challenge.status !== "active" ||
      challenge.consumed_at ||
      challenge.failed_attempts >= maximumAttempts ||
      toTimestamp(challenge.otp_expires_at) <= now
    ) {
      await connection.rollback();

      return invalidOtpResult();
    }

    if (!safeHashMatch(challenge.otp_hash, hashValue(otp))) {
      const attempts = challenge.failed_attempts + 1;

      await connection.execute(
        `UPDATE password_reset_challenges
         SET failed_attempts = :attempts,
             consumed_at = CASE
               WHEN :attempts >= :maximumAttempts THEN CURRENT_TIMESTAMP
               ELSE consumed_at
             END
         WHERE user_id = :userId`,
        {
          attempts,
          maximumAttempts,
          userId: challenge.user_id,
        },
      );
      await connection.commit();

      return invalidOtpResult(attempts >= maximumAttempts);
    }

    await connection.execute(
      `UPDATE password_reset_challenges
       SET verified_at = CURRENT_TIMESTAMP,
           reset_expires_at = :resetExpiresAt
       WHERE user_id = :userId`,
      {
        resetExpiresAt: new Date(now + resetLifetimeMs),
        userId: challenge.user_id,
      },
    );
    await connection.commit();

    return {
      stage: "password",
      message: "Code verified. Create your new password.",
    };
  } catch (error) {
    await rollback(connection);
    logPasswordResetError("verify", error);

    return unavailableResult("otp");
  } finally {
    connection?.release();
  }
}

export async function completePasswordReset(
  role: AuthRole,
  password: string,
  confirmPassword: string,
): Promise<PasswordResetResult & { completed?: boolean }> {
  const errors: Record<string, string> = {};

  if (password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      stage: "password",
      message: "Please fix the highlighted fields.",
      errors,
    };
  }

  const token = await getChallengeToken();

  if (!token) {
    return {
      stage: "request",
      message: "Your reset session expired. Request a new code.",
    };
  }

  const passwordHash = await hashPassword(password);
  let connection: PoolConnection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute<ChallengeWithUserRow[]>(
      `SELECT c.*, u.name, u.email, u.role, u.status
       FROM password_reset_challenges c
       JOIN users u ON u.id = c.user_id
       WHERE c.challenge_token_hash = :tokenHash
         AND u.role = :role
       LIMIT 1
       FOR UPDATE`,
      {
        tokenHash: hashValue(token),
        role,
      },
    );
    const challenge = rows[0];

    if (
      !challenge ||
      challenge.status !== "active" ||
      challenge.consumed_at ||
      !challenge.verified_at ||
      !challenge.reset_expires_at ||
      toTimestamp(challenge.reset_expires_at) <= Date.now()
    ) {
      await connection.rollback();

      return {
        stage: "request",
        message: "Your reset session expired. Request a new code.",
      };
    }

    await connection.execute(
      `UPDATE users
       SET password_hash = :passwordHash
       WHERE id = :userId
         AND role = :role
         AND status = 'active'`,
      {
        passwordHash,
        userId: challenge.user_id,
        role,
      },
    );
    await connection.execute(
      `UPDATE password_reset_challenges
       SET consumed_at = CURRENT_TIMESTAMP
       WHERE user_id = :userId
         AND consumed_at IS NULL`,
      { userId: challenge.user_id },
    );
    await connection.execute(
      `UPDATE auth_sessions
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE user_id = :userId
         AND revoked_at IS NULL`,
      { userId: challenge.user_id },
    );
    await connection.commit();
    await clearPasswordResetCookie();

    return {
      stage: "password",
      message: "Your password has been reset.",
      completed: true,
    };
  } catch (error) {
    await rollback(connection);
    logPasswordResetError("complete", error);

    return unavailableResult("password");
  } finally {
    connection?.release();
  }
}

export async function clearPasswordReset() {
  await clearPasswordResetCookie();
}

export function passwordResetLoginPath(role: AuthRole) {
  if (role === "admin") return "/admin/login";
  if (role === "parent") return "/parent/login";
  return "/login";
}

function generateOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashValue(value: string) {
  return createHmac("sha256", resetSecret()).update(value).digest("hex");
}

function safeHashMatch(storedHash: string, submittedHash: string) {
  const stored = Buffer.from(storedHash, "hex");
  const submitted = Buffer.from(submittedHash, "hex");

  return stored.length === submitted.length && timingSafeEqual(stored, submitted);
}

function resetSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SESSION_SECRET must be set in production.");
  }

  return "xmetapay-local-dev-session-secret";
}

async function setChallengeCookie(token: string) {
  const cookieStore = await cookies();

  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 15 * 60,
    path: "/",
  });
}

async function getChallengeToken() {
  return (await cookies()).get(cookieName)?.value ?? null;
}

async function clearPasswordResetCookie() {
  (await cookies()).delete({
    name: cookieName,
    path: "/",
  });
}

async function invalidateChallenge(tokenHash: string) {
  try {
    await pool.execute(
      `UPDATE password_reset_challenges
       SET consumed_at = CURRENT_TIMESTAMP
       WHERE challenge_token_hash = :tokenHash
         AND consumed_at IS NULL`,
      { tokenHash },
    );
  } catch {
    // The original SMTP error remains the actionable server diagnostic.
  }
}

async function rollback(connection: PoolConnection | null) {
  if (!connection) return;

  try {
    await connection.rollback();
  } catch {
    // Preserve the original failure.
  }
}

function genericOtpResult(
  email: string,
  resendAvailableAt: number,
): PasswordResetResult {
  return {
    stage: "otp",
    message: genericRequestMessage,
    emailHint: maskEmail(email),
    resendAvailableAt,
  };
}

function invalidOtpResult(locked = false): PasswordResetResult {
  return {
    stage: "otp",
    message: locked
      ? "Too many incorrect attempts. Request a new code."
      : "The code is invalid or expired.",
    errors: { otp: "Check the code and try again." },
  };
}

function unavailableResult(stage: PasswordResetStage): PasswordResetResult {
  return {
    stage,
    message:
      process.env.NODE_ENV === "production"
        ? "Password recovery is temporarily unavailable. Try again later."
        : "Password recovery is unavailable. Check MySQL and SMTP, then try again.",
  };
}

function portalLabel(role: AuthRole) {
  if (role === "admin") return "school admin";
  if (role === "parent") return "parent";
  return "company";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");

  if (!local || !domain) {
    return "your account email";
  }

  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

function toTimestamp(value: Date | string) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function logPasswordResetError(action: string, error: unknown) {
  const details =
    error && typeof error === "object"
      ? {
          code: "code" in error ? String(error.code) : undefined,
          message: "message" in error ? String(error.message) : undefined,
        }
      : { message: String(error) };

  console.error(`[password-reset:${action}]`, details);
}

type ResetUserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  role: AuthRole;
  status: "active" | "pending" | "disabled";
};

type ChallengeRow = RowDataPacket & {
  user_id: number;
  challenge_token_hash: string;
  otp_hash: string;
  otp_expires_at: Date | string;
  resend_available_at: Date | string;
  send_window_started_at: Date | string;
  send_count: number;
  failed_attempts: number;
  verified_at: Date | string | null;
  reset_expires_at: Date | string | null;
  consumed_at: Date | string | null;
};

type ChallengeWithUserRow = ChallengeRow & ResetUserRow;

type ChallengeStageRow = RowDataPacket & {
  verified_at: Date | string | null;
  reset_expires_at: Date | string | null;
};
