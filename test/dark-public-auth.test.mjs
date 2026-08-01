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
const themeProvider = readFileSync("app/_components/app-theme-provider.tsx", "utf8");
const themeToggle = readFileSync("app/_components/theme-toggle.tsx", "utf8");
const rootLayout = readFileSync("app/layout.tsx", "utf8");
const toaster = readFileSync("components/ui/sonner.tsx", "utf8");

test("public and authentication pages share a scoped light and dark XMETA shell", () => {
  assert.match(authUi, /public-auth-shell/);
  assert.match(authUi, /public-surface/);
  assert.match(globalCss, /\.public-auth-shell/);
  assert.match(globalCss, /\.light \.public-auth-shell/);
  assert.match(globalCss, /radial-gradient/);
  assert.match(globalCss, /\.public-auth-shell::after/);
  assert.match(globalCss, /pointer-events: none/);
  assert.match(home, /<PublicPageShell/);
  assert.match(companyLogin, /<PublicPageShell/);
  assert.match(resetPage, /<PublicPageShell/);
});

test("landing keeps two public portals while company access stays unlisted", () => {
  assert.match(home, /title="School Admin"/);
  assert.match(home, /title="Parent \/ Guardian"/);
  assert.match(home, /href="\/admin\/login"/);
  assert.match(home, /registerHref="\/admin\/register"/);
  assert.match(home, /href="\/parent\/login"/);
  assert.match(home, /registerHref="\/parent\/register"/);
  assert.doesNotMatch(home, /href="\/login"|Company login/i);
  assert.match(companyLogin, /Company sign in/);
  assert.doesNotMatch(home, /company.*register|super-admin.*register/i);
});

test("authentication treatment includes recovery and accessible password controls", () => {
  assert.match(resetFlow, /var\(--public-text\)/);
  assert.match(resetFlow, /Six-digit code/);
  assert.match(resetFlow, /Resend code in/);
  assert.match(resetFlow, /focus-visible:ring/);
  assert.match(passwordInput, /aria-label=\{visible \? "Hide password" : "Show password"\}/);
  assert.match(passwordInput, /min-h-12/);
  assert.match(passwordInput, /public-field/);
});

test("native public auth select options stay readable on the Windows popup surface", () => {
  assert.match(authUi, /<select[\s\S]*className="public-field/);
  assert.match(globalCss, /\.public-auth-shell select\.public-field option\s*\{/);
  assert.match(globalCss, /color: #17191d;/);
  assert.match(globalCss, /background-color: #ffffff;/);
  assert.match(globalCss, /\.public-auth-shell select\.public-field option:disabled/);
});

test("public theme defaults to dark, persists locally, and exposes an accessible toggle", () => {
  assert.match(themeProvider, /defaultTheme="dark"/);
  assert.match(themeProvider, /enableSystem=\{false\}/);
  assert.match(themeProvider, /enableColorScheme=\{false\}/);
  assert.match(themeProvider, /storageKey=\{THEME_STORAGE_KEY\}/);
  assert.match(themeProvider, /xmetapay-public-theme/);
  assert.match(themeProvider, /attribute="class"/);
  assert.match(themeToggle, /Switch to light mode/);
  assert.match(themeToggle, /Switch to dark mode/);
  assert.match(themeToggle, /aria-pressed=\{isLight\}/);
  assert.match(themeToggle, /size-11/);
  assert.match(authUi, /<ThemeToggle \/>/);
  assert.match(rootLayout, /suppressHydrationWarning/);
  assert.match(rootLayout, /<AppThemeProvider>/);
  assert.match(toaster, /theme=\{theme as ToasterProps\["theme"\]\}/);
});
