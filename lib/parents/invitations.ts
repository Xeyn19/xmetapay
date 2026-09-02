import "server-only";

import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password.mjs";
import { sendParentClaimOtpEmail, sendParentInvitationEmail } from "@/lib/email/mailer";

export type ParentClaimStage = "code" | "otp" | "account" | "login_required" | "ready" | "completed" | "blocked";
export type ParentClaimState = {
  stage: ParentClaimStage;
  message: string;
  emailHint?: string;
  guardianName?: string;
  schoolName?: string;
  studentName?: string;
  relationship?: string;
  resendAvailableAt?: number;
  errors?: Record<string, string>;
};
type ClaimCompletionResult = { state: ParentClaimState; user?: { userId: number; name: string } };
export type AdminGuardianAccessData = {
  invitations: Array<{ id: number; guardianName: string; emailHint: string; relationship: string; status: string; deliveryStatus: string; expiresAt: string; createdAt: string; sentAt?: string; claimedAt?: string; revokedAt?: string }>;
  guardians: Array<{ linkId: number; guardianName: string; emailHint: string; relationship: string; status: "active" | "revoked" }>;
};

const claimCookieName = "xmetapay_parent_claim";
const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const otpLifetimeMs = 5 * 60 * 1000;
const resendCooldownMs = 60 * 1000;
const completionLifetimeMs = 10 * 60 * 1000;
const sendWindowMs = 60 * 60 * 1000;
const maximumSends = 5;
const maximumAttempts = 5;
const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class ParentInvitationError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "ParentInvitationError";
  }
}

export async function issueParentInvitation(adminUserId: number, input: { studentId: number; guardianName: string; guardianEmail: string; relationship: string }) {
  const guardianName = input.guardianName.trim();
  const guardianEmail = normalizeEmail(input.guardianEmail);
  const relationship = normalizeRelationship(input.relationship);
  if (!Number.isInteger(input.studentId) || input.studentId <= 0 || guardianName.length < 2 || guardianName.length > 120 || !isEmail(guardianEmail) || !relationship) {
    throw new ParentInvitationError("Enter a valid guardian name, email, and relationship.", "invalid_input");
  }

  const claimCode = generateClaimCode();
  const now = Date.now();
  let connection: PoolConnection | null = null;
  let invitationId = 0;
  let schoolName = "";
  let studentName = "";
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const admin = await requireSchoolAdministrator(connection, adminUserId);
    const [students] = await connection.execute<StudentInvitationRow[]>(
      `SELECT st.id, st.school_id, CONCAT_WS(' ', st.first_name, NULLIF(st.middle_name, ''), st.last_name) AS student_name, sc.name AS school_name, sc.status AS school_status
       FROM students st JOIN schools sc ON sc.id = st.school_id
       WHERE st.id = :studentId AND st.school_id = :schoolId LIMIT 1 FOR UPDATE`,
      { studentId: input.studentId, schoolId: admin.school_id },
    );
    const student = students[0];
    if (!student || student.school_status !== "active") throw new ParentInvitationError("That student is unavailable for parent invitations.", "invalid_student");

    const [links] = await connection.execute<RowDataPacket[]>(
      `SELECT sg.id FROM student_guardians sg JOIN users u ON u.id = sg.parent_user_id
       WHERE sg.student_id = :studentId AND LOWER(u.email) = :guardianEmail LIMIT 1 FOR UPDATE`,
      { studentId: student.id, guardianEmail },
    );
    if (links.length > 0) throw new ParentInvitationError("This guardian already has a relationship record for the student. Use access controls instead.", "existing_link");

    const [activeInvitations] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM parent_guardian_invitations
       WHERE student_id = :studentId AND guardian_email = :guardianEmail
         AND claimed_at IS NULL AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
       LIMIT 1 FOR UPDATE`,
      { studentId: student.id, guardianEmail },
    );
    if (activeInvitations.length > 0) throw new ParentInvitationError("An active invitation already exists for this student and email. Resend it instead.", "duplicate_invitation");
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO parent_guardian_invitations
       (school_id, student_id, guardian_name, guardian_email, relationship, claim_code_hash, issued_by_user_id,
        expires_at, delivery_status, resend_available_at, send_window_started_at, send_count)
       VALUES (:schoolId, :studentId, :guardianName, :guardianEmail, :relationship, :claimCodeHash, :adminUserId,
        :expiresAt, 'queued', :resendAt, CURRENT_TIMESTAMP, 1)`,
      { schoolId: student.school_id, studentId: student.id, guardianName, guardianEmail, relationship, claimCodeHash: hashValue(normalizeClaimCode(claimCode)), adminUserId, expiresAt: new Date(now + invitationLifetimeMs), resendAt: new Date(now + resendCooldownMs) },
    );
    invitationId = result.insertId;
    schoolName = student.school_name;
    studentName = student.student_name;
    await connection.commit();
  } catch (error) {
    await rollback(connection);
    throw error;
  } finally {
    connection?.release();
  }

  try {
    await sendParentInvitationEmail({ email: guardianEmail, guardianName, studentName, schoolName, claimCode, expiresAt: new Date(now + invitationLifetimeMs) });
    await pool.execute("UPDATE parent_guardian_invitations SET delivery_status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE id = :invitationId", { invitationId });
    return { ok: true, message: `Invitation sent to ${maskEmail(guardianEmail)}.` };
  } catch (error) {
    await markInvitationDeliveryFailed(invitationId);
    logInvitationError("issue-send", error);
    return { ok: false, message: "The invitation was saved, but email delivery failed. Use Resend after checking SMTP." };
  }
}

export async function resendParentInvitation(adminUserId: number, invitationId: number) {
  const code = generateClaimCode();
  const now = Date.now();
  let connection: PoolConnection | null = null;
  let invitation: InvitationWithStudentRow | undefined;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const admin = await requireSchoolAdministrator(connection, adminUserId);
    const [rows] = await connection.execute<InvitationWithStudentRow[]>(invitationSelect("i.id = :invitationId AND i.school_id = :schoolId", true), { invitationId, schoolId: admin.school_id });
    invitation = rows[0];
    if (!invitation || invitation.claimed_at || invitation.revoked_at) throw new ParentInvitationError("Only pending invitations can be resent.", "not_pending");
    const resendAt = toTimestamp(invitation.resend_available_at);
    if (resendAt > now) throw new ParentInvitationError("Wait before sending another invitation email.", "cooldown");
    const withinWindow = now - toTimestamp(invitation.send_window_started_at) < sendWindowMs;
    const sendCount = withinWindow ? Number(invitation.send_count) + 1 : 1;
    if (withinWindow && sendCount > maximumSends) throw new ParentInvitationError("Email limit reached. Try again later.", "rate_limit");
    await connection.execute(
      `UPDATE parent_guardian_invitations SET claim_code_hash = :codeHash, expires_at = :expiresAt,
       delivery_status = 'queued', sent_at = NULL, resend_available_at = :resendAt,
       send_window_started_at = :windowStart, send_count = :sendCount WHERE id = :invitationId`,
      { codeHash: hashValue(normalizeClaimCode(code)), expiresAt: new Date(now + invitationLifetimeMs), resendAt: new Date(now + resendCooldownMs), windowStart: new Date(withinWindow ? toTimestamp(invitation.send_window_started_at) : now), sendCount, invitationId },
    );
    await connection.execute("UPDATE parent_claim_challenges SET consumed_at = CURRENT_TIMESTAMP WHERE invitation_id = :invitationId AND consumed_at IS NULL", { invitationId });
    await connection.commit();
  } catch (error) { await rollback(connection); throw error; } finally { connection?.release(); }

  try {
    await sendParentInvitationEmail({ email: invitation.guardian_email, guardianName: invitation.guardian_name, studentName: invitation.student_name, schoolName: invitation.school_name, claimCode: code, expiresAt: new Date(now + invitationLifetimeMs) });
    await pool.execute("UPDATE parent_guardian_invitations SET delivery_status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE id = :invitationId", { invitationId });
    return { ok: true, message: `A new invitation code was sent to ${maskEmail(invitation.guardian_email)}.` };
  } catch (error) { await markInvitationDeliveryFailed(invitationId); logInvitationError("resend", error); return { ok: false, message: "Email delivery failed. The old claim code is no longer valid." }; }
}

export async function revokeParentInvitation(adminUserId: number, invitationId: number) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const admin = await requireSchoolAdministrator(connection, adminUserId);
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE parent_guardian_invitations SET revoked_at = CURRENT_TIMESTAMP, revoked_by_user_id = :adminUserId
       WHERE id = :invitationId AND school_id = :schoolId AND claimed_at IS NULL AND revoked_at IS NULL`,
      { adminUserId, invitationId, schoolId: admin.school_id },
    );
    if (result.affectedRows !== 1) throw new ParentInvitationError("That pending invitation is no longer available.", "not_pending");
    await connection.execute("UPDATE parent_claim_challenges SET consumed_at = CURRENT_TIMESTAMP WHERE invitation_id = :invitationId AND consumed_at IS NULL", { invitationId });
    await connection.commit();
  } catch (error) { await rollback(connection); throw error; } finally { connection.release(); }
}

export async function setGuardianAccess(adminUserId: number, linkId: number, action: "revoke" | "restore", reasonInput: string) {
  const reason = reasonInput.trim();
  if (reason.length < 3 || reason.length > 255) throw new ParentInvitationError("Enter a reason between 3 and 255 characters.", "invalid_reason");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const admin = await requireSchoolAdministrator(connection, adminUserId);
    const [rows] = await connection.execute<GuardianLinkRow[]>(
      `SELECT sg.id, sg.status, st.school_id FROM student_guardians sg JOIN students st ON st.id = sg.student_id
       WHERE sg.id = :linkId AND st.school_id = :schoolId LIMIT 1 FOR UPDATE`,
      { linkId, schoolId: admin.school_id },
    );
    const link = rows[0];
    if (!link) throw new ParentInvitationError("Guardian access record not found.", "not_found");
    const target = action === "revoke" ? "revoked" : "active";
    if (link.status === target) throw new ParentInvitationError(`Guardian access is already ${target}.`, "same_state");
    await connection.execute(
      `UPDATE student_guardians SET status = :target,
       revoked_at = CASE WHEN :target = 'revoked' THEN CURRENT_TIMESTAMP ELSE NULL END,
       revoked_by_user_id = CASE WHEN :target = 'revoked' THEN :adminUserId ELSE NULL END,
       revocation_reason = CASE WHEN :target = 'revoked' THEN :reason ELSE NULL END WHERE id = :linkId`,
      { target, adminUserId, reason, linkId },
    );
    await connection.execute(
      `INSERT INTO guardian_access_events (student_guardian_id, school_id, actor_user_id, action, reason)
       VALUES (:linkId, :schoolId, :adminUserId, :eventAction, :reason)`,
      { linkId, schoolId: link.school_id, adminUserId, eventAction: action === "revoke" ? "revoked" : "restored", reason },
    );
    await connection.commit();
  } catch (error) { await rollback(connection); throw error; } finally { connection.release(); }
}

export async function getAdminGuardianAccess(adminUserId: number, studentId: number): Promise<AdminGuardianAccessData> {
  const [admins] = await pool.execute<AdminContextRow[]>(
    "SELECT school_id, staff_role FROM admin_profiles WHERE user_id = :adminUserId LIMIT 1", { adminUserId },
  );
  const admin = admins[0];
  if (!admin?.school_id || admin.staff_role !== "school_administrator") return { invitations: [], guardians: [] };
  const [invitations, guardians] = await Promise.all([
    pool.execute<InvitationWithStudentRow[]>(invitationSelect("i.student_id = :studentId AND i.school_id = :schoolId", false), { studentId, schoolId: admin.school_id }),
    pool.execute<GuardianAdminRow[]>(
      `SELECT sg.id, sg.relationship, sg.status, u.name, u.email FROM student_guardians sg
       JOIN students st ON st.id = sg.student_id JOIN users u ON u.id = sg.parent_user_id
       WHERE sg.student_id = :studentId AND st.school_id = :schoolId ORDER BY sg.created_at DESC`, { studentId, schoolId: admin.school_id }),
  ]);
  return {
    invitations: invitations[0].map((row) => ({
      id: Number(row.id),
      guardianName: row.guardian_name,
      emailHint: maskEmail(row.guardian_email),
      relationship: relationshipLabel(row.relationship),
      status: invitationStatus(row),
      deliveryStatus: relationshipLabel(row.delivery_status),
      expiresAt: formatDateTime(row.expires_at),
      createdAt: formatDateTime(row.created_at),
      sentAt: row.sent_at ? formatDateTime(row.sent_at) : undefined,
      claimedAt: row.claimed_at ? formatDateTime(row.claimed_at) : undefined,
      revokedAt: row.revoked_at ? formatDateTime(row.revoked_at) : undefined,
    })),
    guardians: guardians[0].map((row) => ({ linkId: Number(row.id), guardianName: row.name, emailHint: maskEmail(row.email), relationship: relationshipLabel(row.relationship), status: row.status })),
  };
}

export async function requestParentClaimOtp(codeInput: string): Promise<ParentClaimState> {
  const code = normalizeClaimCode(codeInput);
  if (!/^[A-Z2-9]{16}$/.test(code)) return invalidCodeResult();
  const token = randomBytes(32).toString("base64url");
  const otp = generateOtp();
  const now = Date.now();
  let connection: PoolConnection | null = null;
  let invitation: InvitationWithStudentRow | undefined;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute<InvitationWithStudentRow[]>(invitationSelect("i.claim_code_hash = :codeHash", true), { codeHash: hashValue(code) });
    invitation = rows[0];
    if (!isClaimable(invitation, now)) { await connection.rollback(); return invalidCodeResult(); }
    const [challenges] = await connection.execute<ChallengeRow[]>("SELECT * FROM parent_claim_challenges WHERE invitation_id = :invitationId LIMIT 1 FOR UPDATE", { invitationId: invitation.id });
    const old = challenges[0];
    const withinWindow = old && now - toTimestamp(old.send_window_started_at) < sendWindowMs;
    const sendCount = withinWindow ? Number(old.send_count) + 1 : 1;
    if (withinWindow && sendCount > maximumSends) { await connection.rollback(); return invalidCodeResult(); }
    await connection.execute(
      `INSERT INTO parent_claim_challenges
       (invitation_id, challenge_token_hash, otp_hash, otp_expires_at, resend_available_at, send_window_started_at, send_count, failed_attempts)
       VALUES (:invitationId, :tokenHash, :otpHash, :otpExpiresAt, :resendAt, :windowStart, :sendCount, 0)
       ON DUPLICATE KEY UPDATE challenge_token_hash = VALUES(challenge_token_hash), otp_hash = VALUES(otp_hash),
       otp_expires_at = VALUES(otp_expires_at), resend_available_at = VALUES(resend_available_at),
       send_window_started_at = VALUES(send_window_started_at), send_count = VALUES(send_count), failed_attempts = 0,
       verified_at = NULL, completion_expires_at = NULL, consumed_at = NULL`,
      { invitationId: invitation.id, tokenHash: hashValue(token), otpHash: hashValue(otp), otpExpiresAt: new Date(now + otpLifetimeMs), resendAt: new Date(now + resendCooldownMs), windowStart: new Date(withinWindow ? toTimestamp(old.send_window_started_at) : now), sendCount },
    );
    await connection.commit();
  } catch (error) { await rollback(connection); logInvitationError("request-otp", error); return unavailable("code"); } finally { connection?.release(); }
  await setClaimCookie(token);
  try {
    await sendParentClaimOtpEmail({ email: invitation.guardian_email, guardianName: invitation.guardian_name, otp });
  } catch (error) { await invalidateChallenge(hashValue(token)); logInvitationError("send-otp", error); return unavailable("otp"); }
  return { stage: "otp", message: "A six-digit verification code was sent to the school-recorded email.", emailHint: maskEmail(invitation.guardian_email), resendAvailableAt: now + resendCooldownMs };
}

export async function resendParentClaimOtp(): Promise<ParentClaimState> {
  const current = await getChallenge();
  if (!current) return invalidCodeResult();
  if (toTimestamp(current.resend_available_at) > Date.now()) return stateFromChallenge(current, "otp", "Wait before requesting another code.");
  return requestParentClaimOtpByInvitation(current.invitation_id);
}

async function requestParentClaimOtpByInvitation(invitationId: number): Promise<ParentClaimState> {
  const [rows] = await pool.execute<InvitationWithStudentRow[]>(invitationSelect("i.id = :invitationId", false), { invitationId });
  const invitation = rows[0];
  if (!isClaimable(invitation, Date.now())) return invalidCodeResult();
  // Reuse the still-secret claim hash through a dedicated resend transaction rather than requiring the claim code again.
  const otp = generateOtp(); const token = randomBytes(32).toString("base64url"); const now = Date.now();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [challenges] = await connection.execute<ChallengeRow[]>("SELECT * FROM parent_claim_challenges WHERE invitation_id = :invitationId LIMIT 1 FOR UPDATE", { invitationId });
    const old = challenges[0];
    if (!old || toTimestamp(old.resend_available_at) > now) { await connection.rollback(); return stateFromChallenge(old, "otp", "Wait before requesting another code."); }
    const withinWindow = now - toTimestamp(old.send_window_started_at) < sendWindowMs; const sendCount = withinWindow ? Number(old.send_count) + 1 : 1;
    if (withinWindow && sendCount > maximumSends) { await connection.rollback(); return { stage: "blocked", message: "Email limit reached. Start again later." }; }
    await connection.execute(`UPDATE parent_claim_challenges SET challenge_token_hash=:tokenHash, otp_hash=:otpHash, otp_expires_at=:otpExpiresAt,
      resend_available_at=:resendAt, send_window_started_at=:windowStart, send_count=:sendCount, failed_attempts=0, verified_at=NULL,
      completion_expires_at=NULL, consumed_at=NULL WHERE invitation_id=:invitationId`,
      { tokenHash: hashValue(token), otpHash: hashValue(otp), otpExpiresAt: new Date(now + otpLifetimeMs), resendAt: new Date(now + resendCooldownMs), windowStart: new Date(withinWindow ? toTimestamp(old.send_window_started_at) : now), sendCount, invitationId });
    await connection.commit();
  } catch (error) { await rollback(connection); logInvitationError("resend-otp", error); return unavailable("otp"); } finally { connection.release(); }
  await setClaimCookie(token);
  try { await sendParentClaimOtpEmail({ email: invitation.guardian_email, guardianName: invitation.guardian_name, otp }); }
  catch (error) { await invalidateChallenge(hashValue(token)); logInvitationError("resend-otp-send", error); return unavailable("otp"); }
  return { stage: "otp", message: "A new verification code was sent.", emailHint: maskEmail(invitation.guardian_email), resendAvailableAt: now + resendCooldownMs };
}

export async function verifyParentClaimOtp(otpInput: string): Promise<ParentClaimState> {
  const otp = otpInput.trim();
  if (!/^\d{6}$/.test(otp)) return { stage: "otp", message: "Enter the six-digit code.", errors: { otp: "The code must contain six digits." } };
  const token = await claimToken(); if (!token) return invalidOtpResult();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<ClaimContextRow[]>(claimContextSql(true), { tokenHash: hashValue(token) });
    const row = rows[0]; const now = Date.now();
    if (!isChallengeValid(row, now)) { await connection.rollback(); return invalidOtpResult(); }
    if (!safeHashMatch(row.otp_hash, hashValue(otp))) {
      const attempts = Number(row.failed_attempts) + 1;
      await connection.execute("UPDATE parent_claim_challenges SET failed_attempts=:attempts, consumed_at=CASE WHEN :attempts >= :maximumAttempts THEN CURRENT_TIMESTAMP ELSE consumed_at END WHERE invitation_id=:invitationId", { attempts, maximumAttempts, invitationId: row.invitation_id });
      await connection.commit(); return invalidOtpResult(attempts >= maximumAttempts);
    }
    await connection.execute("UPDATE parent_claim_challenges SET verified_at=CURRENT_TIMESTAMP, completion_expires_at=:expiresAt WHERE invitation_id=:invitationId", { expiresAt: new Date(now + completionLifetimeMs), invitationId: row.invitation_id });
    await connection.commit();
  } catch (error) { await rollback(connection); logInvitationError("verify-otp", error); return unavailable("otp"); } finally { connection.release(); }
  return getParentClaimState();
}

export async function getParentClaimState(sessionUserId?: number): Promise<ParentClaimState> {
  const token = await claimToken(); if (!token) return { stage: "code", message: "Enter the single-use invitation code sent by your school." };
  try {
    const [rows] = await pool.execute<ClaimContextRow[]>(claimContextSql(false), { tokenHash: hashValue(token) });
    const row = rows[0]; const now = Date.now();
    if (!row || row.consumed_at || !isClaimable(row, now)) return { stage: "blocked", message: "This invitation is invalid, expired, revoked, or already used." };
    if (!row.verified_at || !row.completion_expires_at || toTimestamp(row.completion_expires_at) <= now) return stateFromChallenge(row, "otp", "Enter the six-digit code sent to the school-recorded email.");
    const base = claimDetails(row);
    if (!row.existing_user_id) return { ...base, stage: "account", message: "Email verified. Create your parent account." };
    if (row.existing_user_status !== "active") return { ...base, stage: "blocked", message: "The matching parent account is unavailable. Contact the school." };
    return { ...base, stage: sessionUserId === Number(row.existing_user_id) ? "ready" : "login_required", message: sessionUserId === Number(row.existing_user_id) ? "Email and account verified. Finish linking this student." : "Email verified. Enter the password for the existing parent account." };
  } catch (error) { logInvitationError("state", error); return unavailable("code"); }
}

export async function completeNewParentClaim(input: { phone: string; password: string; confirmPassword: string }): Promise<ClaimCompletionResult> {
  const phone = input.phone.trim(); const errors: Record<string, string> = {};
  if (!phone) errors.phone = "Phone number is required.";
  if (input.password.length < 8) errors.password = "Password must be at least 8 characters.";
  if (input.password !== input.confirmPassword) errors.confirmPassword = "Passwords do not match.";
  if (Object.keys(errors).length) return { state: { stage: "account", message: "Please fix the highlighted fields.", errors } as ParentClaimState };
  const passwordHash = await hashPassword(input.password);
  return completeClaimTransaction({ passwordHash, phone });
}

export async function completeExistingParentClaim(sessionUserId?: number, password?: string): Promise<ClaimCompletionResult> {
  return completeClaimTransaction({ sessionUserId, password: password ?? "" });
}

async function completeClaimTransaction(options: { passwordHash?: string; phone?: string; sessionUserId?: number; password?: string }): Promise<ClaimCompletionResult> {
  const token = await claimToken(); if (!token) return { state: invalidCodeResult() };
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<ClaimContextRow[]>(claimContextSql(true), { tokenHash: hashValue(token) });
    const claim = rows[0]; const now = Date.now();
    if (!isVerifiedClaim(claim, now)) throw new ParentInvitationError("Your verified claim expired. Start again.", "expired");
    let parentUserId: number;
    if (claim.existing_user_id) {
      if (claim.existing_user_status !== "active") throw new ParentInvitationError("The matching parent account is unavailable.", "disabled");
      if (options.sessionUserId !== Number(claim.existing_user_id)) {
        if (!options.password || !(await verifyPassword(options.password, claim.existing_password_hash))) throw new ParentInvitationError("The parent account password is incorrect.", "invalid_password");
      }
      parentUserId = Number(claim.existing_user_id);
      const [profiles] = await connection.execute<ParentProfileClaimRow[]>("SELECT school_id FROM parent_profiles WHERE user_id=:parentUserId LIMIT 1 FOR UPDATE", { parentUserId });
      const profile = profiles[0]; if (!profile) throw new ParentInvitationError("Parent profile not found.", "missing_profile");
      if (profile.school_id && Number(profile.school_id) !== Number(claim.school_id)) throw new ParentInvitationError("This invitation belongs to another school.", "school_mismatch");
      if (!profile.school_id) {
        const [schools] = await connection.execute<RowDataPacket[]>(`SELECT DISTINCT st.school_id FROM student_guardians sg JOIN students st ON st.id=sg.student_id WHERE sg.parent_user_id=:parentUserId AND sg.status='active'`, { parentUserId });
        if (schools.some((row) => Number(row.school_id) !== Number(claim.school_id))) throw new ParentInvitationError("This legacy account needs school review.", "legacy_conflict");
        await connection.execute("UPDATE parent_profiles SET school_id=:schoolId WHERE user_id=:parentUserId AND school_id IS NULL", { schoolId: claim.school_id, parentUserId });
      }
    } else {
      if (!options.passwordHash || !options.phone) throw new ParentInvitationError("Create the parent account first.", "account_required");
      const [userResult] = await connection.execute<ResultSetHeader>(`INSERT INTO users (role,name,email,phone,password_hash,status) VALUES ('parent',:name,:email,:phone,:passwordHash,'active')`, { name: claim.guardian_name, email: claim.guardian_email, phone: options.phone, passwordHash: options.passwordHash });
      parentUserId = userResult.insertId;
      await connection.execute(`INSERT INTO parent_profiles (user_id,school_id,student_name,student_reference,relationship) VALUES (:parentUserId,:schoolId,:studentName,:studentReference,:relationship)`, { parentUserId, schoolId: claim.school_id, studentName: claim.student_name, studentReference: claim.student_reference, relationship: claim.relationship });
    }
    const [existing] = await connection.execute<GuardianLinkRow[]>("SELECT id,status,0 AS school_id FROM student_guardians WHERE student_id=:studentId AND parent_user_id=:parentUserId LIMIT 1 FOR UPDATE", { studentId: claim.student_id, parentUserId });
    if (existing.length) throw new ParentInvitationError("This guardian relationship already exists. Contact the school to restore it if needed.", "existing_link");
    const [counts] = await connection.execute<CountRow[]>("SELECT COUNT(*) AS total FROM student_guardians WHERE student_id=:studentId AND status='active'", { studentId: claim.student_id });
    const [linkResult] = await connection.execute<ResultSetHeader>(`INSERT INTO student_guardians (student_id,parent_user_id,relationship,is_primary,status) VALUES (:studentId,:parentUserId,:relationship,:isPrimary,'active')`, { studentId: claim.student_id, parentUserId, relationship: claim.relationship, isPrimary: Number(counts[0]?.total ?? 0) === 0 });
    await connection.execute(`INSERT INTO guardian_access_events (student_guardian_id,school_id,invitation_id,actor_user_id,action,reason) VALUES (:linkId,:schoolId,:invitationId,:parentUserId,'granted','Verified school invitation claim')`, { linkId: linkResult.insertId, schoolId: claim.school_id, invitationId: claim.invitation_id, parentUserId });
    await connection.execute("UPDATE parent_guardian_invitations SET claimed_at=CURRENT_TIMESTAMP, claimed_by_user_id=:parentUserId WHERE id=:invitationId AND claimed_at IS NULL AND revoked_at IS NULL", { parentUserId, invitationId: claim.invitation_id });
    await connection.execute("UPDATE parent_claim_challenges SET consumed_at=CURRENT_TIMESTAMP WHERE invitation_id=:invitationId", { invitationId: claim.invitation_id });
    await connection.commit(); await clearClaimCookie();
    return { user: { userId: parentUserId, name: claim.guardian_name }, state: { stage: "completed", message: "Parent access verified and student linked." } as ParentClaimState };
  } catch (error) {
    await rollback(connection);
    const message = error instanceof ParentInvitationError ? error.message : "Parent claim is temporarily unavailable.";
    if (!(error instanceof ParentInvitationError)) logInvitationError("complete", error);
    return { state: { stage: "blocked", message } as ParentClaimState };
  } finally { connection.release(); }
}

export async function clearParentClaim() { await clearClaimCookie(); }

function invitationSelect(where: string, forUpdate: boolean) { return `SELECT i.*, st.student_reference, CONCAT_WS(' ',st.first_name,NULLIF(st.middle_name,''),st.last_name) AS student_name, sc.name AS school_name, sc.status AS school_status FROM parent_guardian_invitations i JOIN students st ON st.id=i.student_id AND st.school_id=i.school_id JOIN schools sc ON sc.id=i.school_id WHERE ${where} LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`; }
function claimContextSql(forUpdate: boolean) { return `SELECT c.*, i.id AS invitation_id, i.school_id, i.student_id, i.guardian_name, i.guardian_email, i.relationship, i.expires_at, i.claimed_at, i.revoked_at, st.student_reference, CONCAT_WS(' ',st.first_name,NULLIF(st.middle_name,''),st.last_name) AS student_name, sc.name AS school_name, sc.status AS school_status, u.id AS existing_user_id, u.status AS existing_user_status, u.password_hash AS existing_password_hash FROM parent_claim_challenges c JOIN parent_guardian_invitations i ON i.id=c.invitation_id JOIN students st ON st.id=i.student_id AND st.school_id=i.school_id JOIN schools sc ON sc.id=i.school_id LEFT JOIN users u ON u.role='parent' AND LOWER(u.email)=i.guardian_email WHERE c.challenge_token_hash=:tokenHash LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`; }
async function requireSchoolAdministrator(connection: PoolConnection, adminUserId: number) { const [rows] = await connection.execute<AdminContextRow[]>(`SELECT ap.school_id,ap.staff_role FROM admin_profiles ap JOIN schools sc ON sc.id=ap.school_id AND sc.status='active' WHERE ap.user_id=:adminUserId LIMIT 1 FOR UPDATE`, { adminUserId }); const row=rows[0]; if(!row?.school_id || row.staff_role!=="school_administrator") throw new ParentInvitationError("Only the school administrator can manage parent invitations.","forbidden"); return row; }
function isClaimable(row: InvitationWithStudentRow | ClaimContextRow | undefined, now: number) { return Boolean(row && !row.claimed_at && !row.revoked_at && row.school_status==="active" && toTimestamp(row.expires_at)>now); }
function isChallengeValid(row: ClaimContextRow | undefined, now:number) { return Boolean(row && isClaimable(row,now) && !row.consumed_at && Number(row.failed_attempts)<maximumAttempts && toTimestamp(row.otp_expires_at)>now); }
function isVerifiedClaim(row: ClaimContextRow | undefined, now:number) { return Boolean(row && isClaimable(row,now) && !row.consumed_at && row.verified_at && row.completion_expires_at && toTimestamp(row.completion_expires_at)>now); }
function claimDetails(row: ClaimContextRow): ParentClaimState { return { stage:"otp", message:"", emailHint:maskEmail(row.guardian_email), guardianName:row.guardian_name, schoolName:row.school_name, studentName:row.student_name, relationship:relationshipLabel(row.relationship), resendAvailableAt:toTimestamp(row.resend_available_at) }; }
function stateFromChallenge(row: Partial<ClaimContextRow> | ChallengeRow | undefined, stage: ParentClaimStage, message:string): ParentClaimState { return { stage,message,emailHint:"guardian_email" in (row??{})?maskEmail(String((row as ClaimContextRow).guardian_email)):undefined,resendAvailableAt:row?.resend_available_at?toTimestamp(row.resend_available_at):undefined }; }
async function getChallenge(){const token=await claimToken();if(!token)return null;const [rows]=await pool.execute<ChallengeRow[]>("SELECT * FROM parent_claim_challenges WHERE challenge_token_hash=:tokenHash AND consumed_at IS NULL LIMIT 1",{tokenHash:hashValue(token)});return rows[0]??null;}
function invalidCodeResult():ParentClaimState{return{stage:"code",message:"The invitation code is invalid, expired, revoked, or already used.",errors:{claimCode:"Check the code and try again."}};}
function invalidOtpResult(locked=false):ParentClaimState{return{stage:locked?"blocked":"otp",message:locked?"Too many incorrect attempts. Start again later.":"The verification code is invalid or expired.",errors:{otp:"Check the code and try again."}};}
function unavailable(stage:ParentClaimStage):ParentClaimState{return{stage,message:process.env.NODE_ENV==="production"?"Parent invitation verification is temporarily unavailable.":"Parent invitation verification is unavailable. Check MySQL and SMTP."};}
function generateClaimCode(){let raw="";for(let i=0;i<16;i++)raw+=codeAlphabet[randomInt(0,codeAlphabet.length)];return raw.match(/.{1,4}/g)!.join("-");}
function generateOtp(){return randomInt(0,1_000_000).toString().padStart(6,"0");}
function normalizeClaimCode(value:string){return value.toUpperCase().replace(/[^A-Z2-9]/g,"");}
function normalizeEmail(value:string){return value.trim().toLowerCase();}
function normalizeRelationship(value:string){const normalized=value.trim().toLowerCase();return normalized==="mother"||normalized==="father"||normalized==="guardian"?normalized:null;}
function relationshipLabel(value:string){return value.charAt(0).toUpperCase()+value.slice(1);}
function isEmail(value:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);}
function hashValue(value:string){return createHmac("sha256",claimSecret()).update(value).digest("hex");}
function safeHashMatch(a:string,b:string){const x=Buffer.from(a,"hex"),y=Buffer.from(b,"hex");return x.length===y.length&&timingSafeEqual(x,y);}
function claimSecret(){const value=process.env.AUTH_SESSION_SECRET;if(value)return value;if(process.env.NODE_ENV==="production")throw new Error("AUTH_SESSION_SECRET must be set in production.");return "xmetapay-local-dev-session-secret";}
async function setClaimCookie(token:string){(await cookies()).set(claimCookieName,token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:15*60,path:"/parent"});}
async function claimToken(){return(await cookies()).get(claimCookieName)?.value??null;}
async function clearClaimCookie(){(await cookies()).delete({name:claimCookieName,path:"/parent"});}
async function invalidateChallenge(tokenHash:string){try{await pool.execute("UPDATE parent_claim_challenges SET consumed_at=CURRENT_TIMESTAMP WHERE challenge_token_hash=:tokenHash AND consumed_at IS NULL",{tokenHash});}catch{}}
async function markInvitationDeliveryFailed(invitationId:number){try{await pool.execute("UPDATE parent_guardian_invitations SET delivery_status='failed' WHERE id=:invitationId",{invitationId});}catch{}}
async function rollback(connection:PoolConnection|null){if(connection)try{await connection.rollback();}catch{}}
function maskEmail(email:string){const [local,domain]=email.split("@");if(!local||!domain)return"school-recorded email";const visible=local.slice(0,Math.min(2,local.length));return`${visible}${"*".repeat(Math.max(2,local.length-visible.length))}@${domain}`;}
function toTimestamp(value:Date|string){return value instanceof Date?value.getTime():new Date(value).getTime();}
function formatDateTime(value:Date|string){return new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Manila"}).format(new Date(value));}
function invitationStatus(row:InvitationWithStudentRow){if(row.claimed_at)return"Claimed";if(row.revoked_at)return"Revoked";if(toTimestamp(row.expires_at)<=Date.now())return"Expired";return row.delivery_status==="failed"?"Email failed":"Pending";}
function logInvitationError(action:string,error:unknown){const details=error&&typeof error==="object"?{name:"name"in error?String(error.name):undefined,code:"code"in error?String(error.code):undefined,command:"command"in error?String(error.command):undefined,responseCode:"responseCode"in error?String(error.responseCode):undefined,message:"message"in error?String(error.message):undefined}:{message:String(error)};console.error(`[parent-invitation:${action}] ${JSON.stringify(details)}`);}

type AdminContextRow=RowDataPacket&{school_id:number|null;staff_role:string};
type StudentInvitationRow=RowDataPacket&{id:number;school_id:number;student_name:string;school_name:string;school_status:string};
type InvitationWithStudentRow=RowDataPacket&{id:number;school_id:number;student_id:number;guardian_name:string;guardian_email:string;relationship:string;expires_at:Date|string;delivery_status:string;sent_at:Date|string|null;resend_available_at:Date|string;send_window_started_at:Date|string;send_count:number;claimed_at:Date|string|null;revoked_at:Date|string|null;created_at:Date|string;student_reference:string;student_name:string;school_name:string;school_status:string};
type ChallengeRow=RowDataPacket&{invitation_id:number;challenge_token_hash:string;otp_hash:string;otp_expires_at:Date|string;resend_available_at:Date|string;send_window_started_at:Date|string;send_count:number;failed_attempts:number;verified_at:Date|string|null;completion_expires_at:Date|string|null;consumed_at:Date|string|null};
type ClaimContextRow=ChallengeRow&InvitationWithStudentRow&{existing_user_id:number|null;existing_user_status:string|null;existing_password_hash:string};
type ParentProfileClaimRow=RowDataPacket&{school_id:number|null};
type GuardianLinkRow=RowDataPacket&{id:number;status:"active"|"revoked";school_id:number};
type GuardianAdminRow=RowDataPacket&{id:number;relationship:string;status:"active"|"revoked";name:string;email:string};
type CountRow=RowDataPacket&{total:number};
