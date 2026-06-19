import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const authUi = readFileSync("app/_components/auth-ui.tsx", "utf8");

test("login forms submit directly to the app dashboard pages", () => {
  assert.match(authUi, /admin:\s*{[\s\S]*loginHref:\s*"\/admin\/dashboard"/);
  assert.match(authUi, /parent:\s*{[\s\S]*loginHref:\s*"\/parent\/dashboard"/);
  assert.match(authUi, /const action = mode === "login" \? theme\.loginHref : theme\.href;/);
  assert.match(authUi, /const method = "get";/);
  assert.match(authUi, /<form action={action} method={method}/);
});

test("dashboard urls are exposed through app pages", () => {
  assert.equal(existsSync("app/admin/(dashboard)/dashboard/page.tsx"), true);
  assert.equal(existsSync("app/parent/(portal)/dashboard/page.tsx"), true);
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
