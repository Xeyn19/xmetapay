import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const authUi = readFileSync("app/_components/auth-ui.tsx", "utf8");
const authActions = readFileSync("app/auth/actions.ts", "utf8");
const session = readFileSync("lib/auth/session.ts", "utf8");
const rootLayout = readFileSync("app/layout.tsx", "utf8");
const flashToast = readFileSync("app/_components/flash-toast.tsx", "utf8");
const adminLoginPage = readFileSync("app/admin/login/page.tsx", "utf8");
const parentLoginPage = readFileSync("app/parent/login/page.tsx", "utf8");

test("auth forms submit through server actions instead of static redirects", () => {
  assert.match(authUi, /"use client";/);
  assert.match(authUi, /import \{ loginAction, registerAction, type AuthFormState \} from "@\/app\/auth\/actions";/);
  assert.match(authUi, /const serverAction = \(isLogin \? loginAction : registerAction\)\.bind\(null, portal\);/);
  assert.match(authUi, /useActionState<AuthFormState, FormData>\(serverAction/);
  assert.match(authUi, /<form action={action}/);
});

test("dashboard route groups protect admin and parent portals by role", () => {
  const adminLayout = readFileSync("app/admin/(dashboard)/layout.tsx", "utf8");
  const parentLayout = readFileSync("app/parent/(portal)/layout.tsx", "utf8");

  assert.match(adminLayout, /await requireRole\("admin"\);/);
  assert.match(parentLayout, /await requireRole\("parent"\);/);
  assert.equal(existsSync("app/admin/(dashboard)/dashboard/page.tsx"), true);
  assert.equal(existsSync("app/parent/(portal)/dashboard/page.tsx"), true);
});

test("logout clears the auth session and redirects by portal role", () => {
  const adminShell = readFileSync("app/admin/_components/admin-shell.tsx", "utf8");
  const parentShell = readFileSync("app/parent/_components/parent-shell.tsx", "utf8");

  assert.match(session, /export async function deleteSession\(\)/);
  assert.match(session, /cookieStore\.delete\(\{[\s\S]*name: cookieName,[\s\S]*path: "\/",[\s\S]*\}\);/);
  assert.match(authActions, /export async function logoutAction\(role: PortalRole\)/);
  assert.match(authActions, /await deleteSession\(\);/);
  assert.match(authActions, /title: "Signed out"/);
  assert.match(authActions, /redirect\(role === "admin" \? "\/admin\/login\?signedOut=1" : "\/parent\/login\?signedOut=1"\);/);
  assert.match(adminShell, /logoutAction\.bind\(null, "admin"\)/);
  assert.match(parentShell, /logoutAction\.bind\(null, "parent"\)/);
  assert.match(adminShell, /Log out/);
  assert.match(parentShell, /Log out/);
});

test("auth pages do not render the portal promo summary panels", () => {
  [
    "School Admin",
    "Run tuition, enrollment, and allowance operations from one desk.",
    "Parent / Guardian",
    "Track school fees, student enrollment, and allowance wallet activity.",
    "Collections",
    "Students",
    "Children",
    "Wallets",
    "P842k",
    "P1.1k",
    "P470",
  ].forEach((text) => assert.equal(authUi.includes(text), false, text));
});

test("auth flows surface toast feedback for login and register across portals", () => {
  const adminLayout = readFileSync("app/admin/(dashboard)/layout.tsx", "utf8");
  const parentLayout = readFileSync("app/parent/(portal)/layout.tsx", "utf8");

  assert.equal(existsSync("components/ui/sonner.tsx"), true);
  assert.equal(existsSync("app/_components/auth-toast-listener.tsx"), true);
  assert.equal(existsSync("app/_components/flash-toast.tsx"), true);
  assert.match(rootLayout, /import \{ Toaster \} from "@\/components\/ui\/sonner";/);
  assert.match(rootLayout, /<Toaster/);
  assert.match(authUi, /import \{ AuthToastListener \} from "\.\/auth-toast-listener";/);
  assert.match(authUi, /<AuthToastListener state={state} mode={mode} portal={portal} \/>/);
  assert.match(authActions, /setAuthFlashToast\(/);
  assert.match(session, /export async function setAuthFlashToast/);
  assert.match(session, /export async function consumeAuthFlashToast/);
  assert.match(session, /export async function clearAuthFlashToast/);
  const consumeFlashToastBody = session.match(/export async function consumeAuthFlashToast[\s\S]*?\n}\n/)?.[0] ?? "";
  assert.doesNotMatch(consumeFlashToastBody, /cookieStore\.delete/);
  assert.equal(existsSync("app/auth/flash-toast/route.ts"), true);
  assert.match(readFileSync("app/auth/flash-toast/route.ts", "utf8"), /export async function DELETE\(\)/);
  assert.match(flashToast, /fetch\("\/auth\/flash-toast", \{ method: "DELETE" \}\)/);
  assert.match(adminLayout, /const toast = await consumeAuthFlashToast\("admin"\);/);
  assert.match(parentLayout, /const toast = await consumeAuthFlashToast\("parent"\);/);
  assert.match(adminLayout, /<FlashToast toast={toast} \/>/);
  assert.match(parentLayout, /<FlashToast toast={toast} \/>/);
});

test("logout flash toasts render on the redirected login pages", () => {
  assert.match(adminLoginPage, /import \{ FlashToast \} from "@\/app\/_components\/flash-toast";/);
  assert.match(parentLoginPage, /import \{ FlashToast \} from "@\/app\/_components\/flash-toast";/);
  assert.match(adminLoginPage, /searchParams: Promise<\{ signedOut\?: string \}>/);
  assert.match(parentLoginPage, /searchParams: Promise<\{ signedOut\?: string \}>/);
  assert.match(adminLoginPage, /signedOut === "1"/);
  assert.match(parentLoginPage, /signedOut === "1"/);
  assert.match(adminLoginPage, /await consumeAuthFlashToast\("admin"\)/);
  assert.match(parentLoginPage, /await consumeAuthFlashToast\("parent"\)/);
  assert.match(adminLoginPage, /<FlashToast toast={toast} \/>/);
  assert.match(parentLoginPage, /<FlashToast toast={toast} \/>/);
});
