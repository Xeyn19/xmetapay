import { expect, test, type BrowserContext } from "@playwright/test";
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2/promise";

test.describe("XMETA Pay portal entry", () => {
  test("home page shows both portal choices", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: /choose where you want to continue/i,
      })
    ).toBeVisible();
    await expect(page.getByText("School Admin")).toBeVisible();
    await expect(page.getByText("Parent / Guardian")).toBeVisible();
  });

  test("school admin sign in opens the admin login page", async ({ page }) => {
    await page.goto("/");

    const adminSignIn = page
      .locator("article")
      .filter({ hasText: "School Admin" })
      .getByRole("link", { name: "Sign in" });

    await expect(adminSignIn).toHaveAttribute("href", "/admin/login");
    await adminSignIn.click();

    await expect(page).toHaveURL("/admin/login");
    await expect(
      page.getByRole("heading", { name: /sign in to admin/i })
    ).toBeVisible();
  });

  test("parent sign in opens the parent login page", async ({ page }) => {
    await page.goto("/");

    const parentSignIn = page
      .locator("article")
      .filter({ hasText: "Parent / Guardian" })
      .getByRole("link", { name: "Sign in" });

    await expect(parentSignIn).toHaveAttribute("href", "/parent/login");
    await parentSignIn.click();

    await expect(page).toHaveURL("/parent/login");
    await expect(
      page.getByRole("heading", { name: /sign in to parent portal/i })
    ).toBeVisible();
  });
});

test.describe("XMETA Pay login flows", () => {
  test("admin login form handles invalid or unavailable credentials without query-string passwords", async ({ page }) => {
    await page.goto("/admin/login");

    await page.getByLabel("Email or phone").fill("missing-admin@school.edu.ph");
    await page.locator('input[name="password"]').fill("demo-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/admin/login");
    await expect(page).not.toHaveURL(/password=/);
    await expect(page.locator('p[aria-live="polite"]')).toContainText(/invalid login details|unable to sign in/i);
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Sign in failed" })).toBeVisible();
  });

  test("parent login form handles invalid or unavailable credentials without query-string passwords", async ({ page }) => {
    await page.goto("/parent/login");

    await page.getByLabel("Email or mobile number").fill("missing-parent@email.com");
    await page.locator('input[name="password"]').fill("demo-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/parent/login");
    await expect(page).not.toHaveURL(/password=/);
    await expect(page.locator('p[aria-live="polite"]')).toContainText(/invalid login details|unable to sign in/i);
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Sign in failed" })).toBeVisible();
  });
});

test.describe("XMETA Pay dashboard smoke tests", () => {
  test.beforeEach(async ({ context }) => {
    await addDatabaseSessionCookie(context, "admin");
  });

  test("important admin dashboard routes render without crashing", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const routes = [
      { path: "/admin/dashboard", heading: "Dashboard" },
      { path: "/admin/tuition", heading: "Tuition report" },
      { path: "/admin/students", heading: "Enrolled students" },
      { path: "/admin/reports", heading: "Financial reports" },
    ];

    for (const route of routes) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { level: 1, name: route.heading })
      ).toBeVisible();
    }
  });

  test("admin logout clears the session and returns to admin login", async ({
    page,
  }) => {
    await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Log out" }).press("Enter");

    await expect(page).toHaveURL("/admin/login?signedOut=1");
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Signed out" })).toBeVisible();
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL("/admin/login");
  });

  test("admin mobile menu opens, navigates, and keeps the page within the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Open admin menu" }).click();
    const adminDrawer = page.getByRole("dialog", { name: "Admin navigation" });
    await expect(adminDrawer).toBeVisible();
    await expect(adminDrawer).toBeInViewport();

    await adminDrawer.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL("/admin/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(adminDrawer).not.toBeInViewport();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("XMETA Pay parent portal smoke tests", () => {
  test.beforeEach(async ({ context }) => {
    await addDatabaseSessionCookie(context, "parent");
  });

  test("important parent portal routes render without crashing", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const routes = [
      { path: "/parent/dashboard", heading: "Dashboard" },
      { path: "/parent/fees", heading: "Fee summary" },
      { path: "/parent/pay-tuition", heading: "Pay tuition & fees" },
      { path: "/parent/wallet", heading: "Wallet & allowance top-up" },
    ];

    for (const route of routes) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { level: 1, name: route.heading })
      ).toBeVisible();
    }
  });

  test("parent logout clears the session and returns to parent login", async ({
    page,
  }) => {
    await page.goto("/parent/dashboard", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Log out" }).press("Enter");

    await expect(page).toHaveURL("/parent/login?signedOut=1");
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Signed out" })).toBeVisible();
    await page.goto("/parent/dashboard");
    await expect(page).toHaveURL("/parent/login");
  });

  test("parent mobile menu opens, navigates, and keeps the page within the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/parent/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Open parent menu" }).click();
    const parentDrawer = page.getByRole("dialog", { name: "Parent navigation" });
    await expect(parentDrawer).toBeVisible();
    await expect(parentDrawer).toBeInViewport();

    await parentDrawer.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL("/parent/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(parentDrawer).not.toBeInViewport();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("XMETA Pay dashboard protection", () => {
  test("admin dashboard redirects to admin login without a session", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL("/admin/login");
  });

  test("parent dashboard redirects to parent login without a session", async ({ page }) => {
    await page.goto("/parent/dashboard");
    await expect(page).toHaveURL("/parent/login");
  });
});

async function addDatabaseSessionCookie(context: BrowserContext, role: "admin" | "parent") {
  const userId = await ensureE2EUser(role);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHmac("sha256", testSessionSecret()).update(token).digest("hex");
  const expires = Math.floor(Date.now() / 1000) + 60 * 60;
  const connection = await mysql.createConnection(databaseConfig());

  try {
    await connection.execute(
      `INSERT INTO auth_sessions (user_id, role, token_hash, expires_at)
       VALUES (:userId, :role, :tokenHash, FROM_UNIXTIME(:expires))`,
      { userId, role, tokenHash, expires },
    );
  } finally {
    await connection.end();
  }

  await context.addCookies([
    {
      name: "xmetapay_session",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      expires,
    },
  ]);
}

async function ensureE2EUser(role: "admin" | "parent") {
  const connection = await mysql.createConnection(databaseConfig());
  const profileName = role === "admin" ? "E2E Admin" : "E2E Parent";
  const email = role === "admin" ? "e2e-admin@xmetapay.test" : "e2e-parent@xmetapay.test";

  try {
    await connection.execute(
      `INSERT INTO users (role, name, email, phone, password_hash, status)
       VALUES (:role, :name, :email, NULL, :passwordHash, 'active')
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         status = 'active'`,
      {
        role,
        name: profileName,
        email,
        passwordHash: "scrypt$e2e$0",
      },
    );

    const [rows] = await connection.execute<Array<{ id: number } & RowDataPacket>>(
      "SELECT id FROM users WHERE role = :role AND email = :email LIMIT 1",
      { role, email },
    );
    const userId = rows[0].id;

    if (role === "admin") {
      await connection.execute(
        `INSERT INTO admin_profiles (user_id, school_name, staff_role)
         VALUES (:userId, 'E2E Test School', 'school_administrator')
         ON DUPLICATE KEY UPDATE
           school_name = VALUES(school_name),
           staff_role = VALUES(staff_role)`,
        { userId },
      );
    } else {
      await connection.execute(
        `INSERT INTO parent_profiles (user_id, student_name, student_reference, relationship)
         VALUES (:userId, 'E2E Student', 'E2E-001', 'guardian')
         ON DUPLICATE KEY UPDATE
           student_name = VALUES(student_name),
           student_reference = VALUES(student_reference),
           relationship = VALUES(relationship)`,
        { userId },
      );
    }

    return userId;
  } finally {
    await connection.end();
  }
}

function databaseConfig() {
  return {
    host: process.env.MYSQL_HOST ?? "127.0.0.1",
    port: Number(process.env.MYSQL_PORT ?? "3306"),
    database: process.env.MYSQL_DATABASE ?? "xmetapay_db",
    user: process.env.MYSQL_USER ?? "root",
    password: process.env.MYSQL_PASSWORD ?? "",
    namedPlaceholders: true,
  };
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  expect(overflow).toBeLessThanOrEqual(1);
}

function testSessionSecret() {
  if (process.env.AUTH_SESSION_SECRET) {
    return process.env.AUTH_SESSION_SECRET;
  }

  try {
    const env = readFileSync(".env", "utf8");
    const line = env
      .split(/\r?\n/)
      .find((entry) => entry.startsWith("AUTH_SESSION_SECRET="));

    return line?.slice("AUTH_SESSION_SECRET=".length) || "xmetapay-local-dev-session-secret";
  } catch {
    return "xmetapay-local-dev-session-secret";
  }
}
