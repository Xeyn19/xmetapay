import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const authUi = readFileSync("app/_components/auth-ui.tsx", "utf8");
const globalCss = readFileSync("app/globals.css", "utf8");
const home = readFileSync("app/page.tsx", "utf8");
const companyLogin = readFileSync("app/login/page.tsx", "utf8");
const resetPage = readFileSync("app/_components/password-reset-page.tsx", "utf8");
const resetFlow = readFileSync("app/_components/password-reset-flow.tsx", "utf8");
const passwordInput = readFileSync("app/_components/password-input.tsx", "utf8");

test("public and authentication pages share a scoped dark XMETA shell", () => {
  assert.match(authUi, /public-auth-shell/);
  assert.match(authUi, /bg-\[#202122\]\/90/);
  assert.match(globalCss, /\.public-auth-shell/);
  assert.match(globalCss, /radial-gradient/);
  assert.match(globalCss, /\.public-auth-shell::after/);
  assert.match(globalCss, /pointer-events: none/);
  assert.match(home, /<PublicPageShell/);
  assert.match(companyLogin, /<PublicPageShell/);
  assert.match(resetPage, /<PublicPageShell/);
});

test("landing keeps two public portals and discreet sign-in-only company access", () => {
  assert.match(home, /title="School Admin"/);
  assert.match(home, /title="Parent \/ Guardian"/);
  assert.match(home, /href="\/admin\/login"/);
  assert.match(home, /registerHref="\/admin\/register"/);
  assert.match(home, /href="\/parent\/login"/);
  assert.match(home, /registerHref="\/parent\/register"/);
  assert.match(home, /href="\/login"/);
  assert.doesNotMatch(home, /company.*register|super-admin.*register/i);
});

test("dark authentication treatment includes recovery and accessible password controls", () => {
  assert.match(resetFlow, /text-white/);
  assert.match(resetFlow, /Six-digit code/);
  assert.match(resetFlow, /Resend code in/);
  assert.match(resetFlow, /focus-visible:ring/);
  assert.match(passwordInput, /aria-label=\{visible \? "Hide password" : "Show password"\}/);
  assert.match(passwordInput, /min-h-12/);
  assert.match(passwordInput, /bg-white\/\[0\.055\]/);
});
