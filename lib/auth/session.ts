import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";

export type PortalRole = "admin" | "parent";
export type AuthRole = PortalRole | "super_admin";
export type AuthFlashToast = {
  role: AuthRole;
  title: string;
  description: string;
};

type SessionPayload = {
  userId: number;
  role: AuthRole;
  name: string;
  expiresAt: number;
};

const cookieName = "xmetapay_session";
const flashToastCookieName = "xmetapay_auth_toast";
const defaultMaxAgeSeconds = 60 * 60 * 8;

export async function createSession(payload: Omit<SessionPayload, "expiresAt">) {
  const maxAge = maxAgeSeconds();
  const expiresAt = new Date(Date.now() + maxAge * 1000);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const cookieStore = await cookies();

  await pool.execute(
    `INSERT INTO auth_sessions (user_id, role, token_hash, expires_at)
     VALUES (:userId, :role, :tokenHash, :expiresAt)`,
    {
      userId: payload.userId,
      role: payload.role,
      tokenHash,
      expiresAt,
    },
  );

  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: "/",
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  let row: AuthSessionRow | undefined;

  try {
    const [rows] = await pool.execute<AuthSessionRow[]>(
      `SELECT
         s.id,
         s.user_id,
         s.role,
         s.expires_at,
         u.name,
         u.role AS user_role,
         u.status AS user_status
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = :tokenHash
         AND s.revoked_at IS NULL
         AND s.expires_at > CURRENT_TIMESTAMP
       LIMIT 1`,
      { tokenHash },
    );
    row = rows[0];
  } catch {
    return null;
  }

  if (!row || row.user_status !== "active" || row.user_role !== row.role) {
    return null;
  }

  try {
    await pool.execute(
      `UPDATE auth_sessions
       SET last_used_at = CURRENT_TIMESTAMP
       WHERE id = :id`,
      { id: row.id },
    );
  } catch {
    // Session reads should not fail just because XAMPP reset a bookkeeping write.
  }

  return {
    userId: row.user_id,
    role: row.role,
    name: row.name,
    expiresAt: toTimestamp(row.expires_at),
  };
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;

  if (token) {
    try {
      await pool.execute(
        `UPDATE auth_sessions
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE token_hash = :tokenHash
           AND revoked_at IS NULL`,
        { tokenHash: hashSessionToken(token) },
      );
    } catch {
      // Always clear the browser cookie even if the database is temporarily unavailable.
    }
  }

  cookieStore.delete({
    name: cookieName,
    path: "/",
  });
}

export async function setAuthFlashToast(toast: AuthFlashToast) {
  const cookieStore = await cookies();

  cookieStore.set(flashToastCookieName, Buffer.from(JSON.stringify(toast)).toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30,
    path: "/",
  });
}

export async function consumeAuthFlashToast(role: AuthRole) {
  const cookieStore = await cookies();
  const encodedToast = cookieStore.get(flashToastCookieName)?.value;

  if (!encodedToast) {
    return null;
  }

  try {
    const toast = JSON.parse(Buffer.from(encodedToast, "base64url").toString("utf8")) as AuthFlashToast;

    return toast.role === role ? toast : null;
  } catch {
    return null;
  }
}

export async function clearAuthFlashToast() {
  const cookieStore = await cookies();

  cookieStore.delete({
    name: flashToastCookieName,
    path: "/",
  });
}

export async function requireRole(role: PortalRole) {
  const session = await getSession();

  if (!session || session.role !== role) {
    redirect(`/${role}/login`);
  }

  return session;
}

export async function requireSuperAdmin() {
  const session = await getSession();

  if (!session || session.role !== "super_admin") {
    redirect("/login");
  }

  return session;
}

function hashSessionToken(token: string) {
  return createHmac("sha256", sessionSecret()).update(token).digest("hex");
}

function maxAgeSeconds() {
  const days = Number(process.env.AUTH_SESSION_DAYS);

  if (Number.isFinite(days) && days > 0) {
    return Math.floor(days * 24 * 60 * 60);
  }

  return defaultMaxAgeSeconds;
}

function toTimestamp(value: Date | string) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function sessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SESSION_SECRET must be set in production.");
  }

  return "xmetapay-local-dev-session-secret";
}

type AuthSessionRow = RowDataPacket & {
  id: number;
  user_id: number;
  role: AuthRole;
  expires_at: Date | string;
  name: string;
  user_role: AuthRole;
  user_status: "active" | "pending" | "disabled";
};
