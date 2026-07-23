import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("shared XMETA Pay brand logo uses the canonical optimized image contract", () => {
  const component = read("app/_components/brand-logo.tsx");

  assert.equal(existsSync("public/xmetapay-logo.jpg"), true);
  assert.match(component, /import Image from "next\/image"/);
  assert.match(component, /src="\/xmetapay-logo\.jpg"/);
  assert.match(component, /alt=""/);
  assert.match(component, /loading="eager"/);
  assert.match(component, /size\?: "compact" \| "default"/);
});

test("all shared app shells consume the canonical brand logo", () => {
  const brandedFiles = [
    "app/_components/auth-ui.tsx",
    "app/_components/dashboard-ui.tsx",
    "app/admin/_components/admin-shell.tsx",
    "app/admin/onboarding/school-setup/page.tsx",
    "app/parent/_components/parent-shell.tsx",
    "app/super-admin/_components/super-admin-shell.tsx",
  ];

  for (const path of brandedFiles) {
    assert.match(read(path), /<BrandLogo/);
  }

  assert.doesNotMatch(read("app/_components/auth-ui.tsx"), />\s*XP\s*</);
  assert.doesNotMatch(read("app/_components/dashboard-ui.tsx"), />\s*XP\s*</);
});

test("public visual plans and app metadata use the XMETA Pay logo", () => {
  for (const path of [
    "public/PROJECT_FLOWCHARTS_VISUAL.html",
    "public/DATABASE_SCHEMA_VISUAL_PLAN.html",
  ]) {
    const visual = read(path);

    assert.match(visual, /rel="icon" href="\/xmetapay-logo\.jpg"/);
    assert.match(visual, /src="\/xmetapay-logo\.jpg"[^>]*data-brand-logo/);
  }

  assert.equal(existsSync("app/icon.png"), true);
  assert.equal(existsSync("app/favicon.ico"), false);
});
