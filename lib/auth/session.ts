import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type PortalRole = "admin" | "parent";
export type AuthFlashToast = {
  role: PortalRole;
  title: string;
  description: string;
};

type SessionPayload = {
  userId: number;
  role: PortalRole;
  name: string;
  expiresAt: number;
};

const cookieName = "xmetapay_session";
const flashToastCookieName = "xmetapay_auth_toast";
const maxAgeSeconds = 60 * 60 * 8;

export async function createSession(payload: Omit<SessionPayload, "expiresAt">) {
  const expiresAt = Date.now() + maxAgeSeconds * 1000;
  const token = signSession({ ...payload, expiresAt });
  const cookieStore = await cookies();

  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
    path: "/",
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;

  return verifySessionToken(token);
}

export async function deleteSession() {
  const cookieStore = await cookies();

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

export async function consumeAuthFlashToast(role: PortalRole) {
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

export function signSession(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signatureFor(body);

  return `${body}.${signature}`;
}

export function verifySessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [body, signature] = token.split(".");
  if (!body || !signature || !safeEqual(signature, signatureFor(body))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;

    if (payload.expiresAt < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function signatureFor(body: string) {
  return createHmac("sha256", sessionSecret()).update(body).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
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
