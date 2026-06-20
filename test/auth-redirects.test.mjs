import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const authUi = readFileSync("app/_components/auth-ui.tsx", "utf8");
const authActions = readFileSync("app/auth/actions.ts", "utf8");
const session = readFileSync("lib/auth/session.ts", "utf8");

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
  assert.match(authActions, /redirect\(role === "admin" \? "\/admin\/login" : "\/parent\/login"\);/);
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
