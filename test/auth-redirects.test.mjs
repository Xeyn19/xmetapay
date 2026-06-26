import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const authUi = readFileSync("app/_components/auth-ui.tsx", "utf8");
const authActions = readFileSync("app/auth/actions.ts", "utf8");
const session = readFileSync("lib/auth/session.ts", "utf8");
const homePage = readFileSync("app/page.tsx", "utf8");
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
  assert.match(authUi, /required = field\.required \?\? true/);
  assert.match(authUi, /required=\{required\}/);
  assert.doesNotMatch(authUi, /Remember me/);
  assert.doesNotMatch(authUi, /Forgot password\?/);
});

test("auth pages show fields that match the role-specific schema", () => {
  const adminRegisterPage = readFileSync("app/admin/register/page.tsx", "utf8");
  const parentRegisterPage = readFileSync("app/parent/register/page.tsx", "utf8");

  assert.match(adminLoginPage, /label: "Email or phone"/);
  assert.match(adminLoginPage, /placeholder: "admin@school\.edu\.ph or 0917 000 0000"/);
  assert.doesNotMatch(adminLoginPage, /type: "email"/);

  assert.match(adminRegisterPage, /name: "staffRole"/);
  assert.match(adminRegisterPage, /label: "Staff role"/);
  assert.doesNotMatch(adminRegisterPage, /name: "role"/);
  assert.match(adminRegisterPage, /name: "phone"[\s\S]*required: false/);
  assert.match(parentRegisterPage, /name: "phone"[\s\S]*required: false/);
  assert.match(parentRegisterPage, /name: "studentFirstName"/);
  assert.match(parentRegisterPage, /name: "studentMiddleName"[\s\S]*required: false/);
  assert.match(parentRegisterPage, /name: "studentLastName"/);
  assert.doesNotMatch(parentRegisterPage, /name: "studentName"/);
  assert.doesNotMatch(parentRegisterPage, /UI prototype/);
  assert.doesNotMatch(parentLoginPage, /enrollment/);
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
  assert.match(session, /UPDATE auth_sessions\s+SET revoked_at = CURRENT_TIMESTAMP/);
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

test("auth sessions are database-backed and never expose raw tokens", () => {
  const migration = readFileSync("database/migrations/2026-06-25-auth-sessions.sql", "utf8");
  const fullSchema = readFileSync("database/full-schema-v1.sql", "utf8");
  const envExample = readFileSync(".env.example", "utf8");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS auth_sessions/);
  assert.match(migration, /token_hash CHAR\(64\) NOT NULL/);
  assert.match(migration, /revoked_at DATETIME NULL/);
  assert.match(migration, /UNIQUE KEY uq_auth_sessions_token_hash \(token_hash\)/);
  assert.match(migration, /KEY idx_auth_sessions_user_revoked_expires \(user_id, revoked_at, expires_at\)/);
  assert.match(migration, /CONSTRAINT fk_auth_sessions_user/);
  assert.match(fullSchema, /CREATE TABLE IF NOT EXISTS auth_sessions/);
  assert.match(envExample, /AUTH_SESSION_DAYS=1/);

  assert.match(session, /randomBytes\(32\)\.toString\("base64url"\)/);
  assert.match(session, /hashSessionToken\(token\)/);
  assert.match(session, /INSERT INTO auth_sessions/);
  assert.match(session, /token_hash, expires_at/);
  assert.match(session, /JOIN users u ON u\.id = s\.user_id/);
  assert.match(session, /s\.revoked_at IS NULL/);
  assert.match(session, /s\.expires_at > CURRENT_TIMESTAMP/);
  assert.match(session, /row\.user_status !== "active"/);
  assert.match(session, /row\.user_role !== row\.role/);
  assert.match(session, /UPDATE auth_sessions\s+SET last_used_at = CURRENT_TIMESTAMP/);
  assert.doesNotMatch(session, /signSession/);
  assert.doesNotMatch(session, /verifySessionToken/);
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
  const consumeFlashToastBody = session.match(/export async function consumeAuthFlashToast[\s\S]*?\n}\s*\n\s*export async function clearAuthFlashToast/)?.[0] ?? "";
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

test("login pages redirect already-authenticated users back to their dashboards", () => {
  assert.match(adminLoginPage, /import \{ consumeAuthFlashToast, getSession \} from "@\/lib\/auth\/session";/);
  assert.match(parentLoginPage, /import \{ consumeAuthFlashToast, getSession \} from "@\/lib\/auth\/session";/);
  assert.match(adminLoginPage, /import \{ redirect \} from "next\/navigation";/);
  assert.match(parentLoginPage, /import \{ redirect \} from "next\/navigation";/);
  assert.match(adminLoginPage, /const session = await getSession\(\);/);
  assert.match(parentLoginPage, /const session = await getSession\(\);/);
  assert.match(adminLoginPage, /if \(session\?\.role === "admin"\) \{\s*redirect\("\/admin\/dashboard"\);/);
  assert.match(parentLoginPage, /if \(session\?\.role === "parent"\) \{\s*redirect\("\/parent\/dashboard"\);/);
});

test("home page redirects already-authenticated users to the correct dashboard", () => {
  assert.match(homePage, /import \{ getSession \} from "@\/lib\/auth\/session";/);
  assert.match(homePage, /import \{ redirect \} from "next\/navigation";/);
  assert.match(homePage, /export default async function Home\(\)/);
  assert.match(homePage, /const session = await getSession\(\);/);
  assert.match(homePage, /if \(session\?\.role === "admin"\) \{\s*redirect\("\/admin\/dashboard"\);/);
  assert.match(homePage, /if \(session\?\.role === "parent"\) \{\s*redirect\("\/parent\/dashboard"\);/);
  assert.match(homePage, /Choose where you want to continue/);
});

test("flash toast is not marked shown before the browser toast is emitted", () => {
  const shownAssignmentIndex = flashToast.indexOf("shownToast.current = toastKey");
  const successIndex = flashToast.indexOf("toast.success");

  assert.notEqual(shownAssignmentIndex, -1);
  assert.notEqual(successIndex, -1);
  assert.ok(shownAssignmentIndex < successIndex);
  assert.match(flashToast, /window\.setTimeout\(\(\) => \{\s*shownToast\.current = toastKey;\s*toast\.success/);
});
