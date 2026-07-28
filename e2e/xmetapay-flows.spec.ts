import { expect, test, type BrowserContext, type Download, type Page } from "@playwright/test";
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2/promise";

test.describe("XMETA Pay portal entry", () => {
  test("home page shows both portal choices", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: /school payments, made simple/i,
      })
    ).toBeVisible();
    await expect(page.getByText("School Admin")).toBeVisible();
    await expect(page.getByText("Parent / Guardian")).toBeVisible();
    await expect(page.getByRole("link", { name: "Company login" })).toHaveAttribute("href", "/login");
    await expect(page.getByText("Brentwood Academy of Las Pinas")).toHaveCount(0);
    await expectDarkPublicShell(page);
    await expectBrandLogo(page);
  });

  for (const route of [
    "/login",
    "/admin/login",
    "/admin/register",
    "/parent/login",
    "/parent/register",
    "/admin/forgot-password",
    "/parent/forgot-password",
    "/forgot-password",
  ]) {
    test(`${route} shows the shared brand logo`, async ({ page }) => {
      await page.goto(route);

      await expectDarkPublicShell(page);
      await expectBrandLogo(page);
    });
  }

  for (const route of [
    "/PROJECT_FLOWCHARTS_VISUAL.html",
    "/DATABASE_SCHEMA_VISUAL_PLAN.html",
  ]) {
    test(`${route} shows the documentation brand logo`, async ({ page }) => {
      await page.goto(route);

      await expectBrandLogo(page);
    });
  }

  test("root metadata exposes the XMETA Pay app icon", async ({ page }) => {
    await page.goto("/");

    const icon = page.locator('link[rel="icon"]');
    await expect(icon).toHaveAttribute("href", /\/icon\.png\?/);
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
      page.getByRole("heading", { name: /admin sign in/i })
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
      page.getByRole("heading", { name: /parent sign in/i })
    ).toBeVisible();
  });

  for (const [loginRoute, recoveryRoute] of [
    ["/admin/login", "/admin/forgot-password"],
    ["/parent/login", "/parent/forgot-password"],
    ["/login", "/forgot-password"],
  ]) {
    test(`${loginRoute} opens its role-specific recovery page`, async ({ page }) => {
      await page.goto(loginRoute);

      const forgotPassword = page.getByRole("link", {
        name: "Forgot password?",
      });
      await expect(forgotPassword).toHaveAttribute("href", recoveryRoute);
      await forgotPassword.click();

      await expect(page).toHaveURL(recoveryRoute);
      await expect(
        page.getByRole("heading", { name: "Forgot your password?" }),
      ).toBeVisible();
      await expect(page.getByLabel("Account email")).toBeVisible();
      await expectBrandLogo(page);
    });
  }

  test("public entry stays usable at supported responsive widths", async ({ page }) => {
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");

      const metrics = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));

      expect(metrics.scrollWidth).toBe(metrics.clientWidth);
      await expect(page.getByRole("link", { name: "Company login" })).toBeVisible();
      await expectDarkPublicShell(page);
      await expectBrandLogo(page);
    }
  });

  test("password recovery request pages stay usable at supported responsive widths", async ({ page }) => {
    for (const route of [
      "/admin/forgot-password",
      "/parent/forgot-password",
      "/forgot-password",
    ]) {
      for (const width of [320, 375, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);

        await expect(
          page.getByRole("heading", { name: "Forgot your password?" }),
        ).toBeVisible();
        await expect(page.getByLabel("Account email")).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Send reset code" }),
        ).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectDarkPublicShell(page);
        await expectBrandLogo(page);
      }
    }
  });

  test("password recovery presents the OTP stage without revealing an unknown account", async ({ page }) => {
    await page.goto("/admin/forgot-password");
    await page.getByLabel("Account email").fill("unknown-recovery-user@example.com");
    await page.getByRole("button", { name: "Send reset code" }).click();

    await expect(page.getByLabel("Six-digit code")).toBeVisible();
    await expect(page.getByRole("button", { name: "Verify code" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Resend code in \d+s/ }),
    ).toBeDisabled();
    await expect(page.getByRole("button", { name: "Use a different email" })).toBeVisible();

    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalOverflow(page);
      await expect(page.getByLabel("Six-digit code")).toBeInViewport();
    }
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
      await expectBrandLogo(page);
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
      { path: "/parent/history", heading: "Payment history" },
      { path: "/parent/wallet", heading: "Wallet & allowance top-up" },
    ];

    for (const route of routes) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { level: 1, name: route.heading })
      ).toBeVisible();
      await expectBrandLogo(page);
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

  test("multi-student wallet top-up and protected result stay responsive", async ({ page }) => {
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/parent/wallet", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1, name: "Wallet & allowance top-up" })).toBeVisible();

      const selectAll = page.getByRole("button", { name: "Select all eligible" });
      if (await selectAll.count()) {
        await expect(selectAll).toBeVisible();
        await selectAll.click();
        await expect(page.getByRole("button", { name: /Review .* top-up/ })).toBeEnabled();
      } else {
        await expect(page.getByText(/Link a student/).first()).toBeVisible();
      }
      await expectNoHorizontalOverflow(page);

      await page.goto("/parent/wallet/top-up-result?batch=WTB-NOT-AVAILABLE", { waitUntil: "domcontentloaded" });
      await expect(page.getByText("This wallet top-up batch is unavailable.")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("parent Fee summary stays usable at supported responsive widths", async ({ page }) => {
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/parent/fees", { waitUntil: "domcontentloaded" });

      await expect(
        page.getByRole("heading", { level: 1, name: "Fee summary" }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Export Excel" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Export PDF" })).toBeVisible();
      const removedTab = page.getByRole("tab", { name: /Removed/ });
      await removedTab.focus();
      await page.keyboard.press("Enter");
      await expect(removedTab).toHaveAttribute("aria-selected", "true");
      await expect(page.getByText(/restored to Archived for 30 days/)).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("parent Payment history removal recovery stays usable at supported responsive widths", async ({ page }) => {
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/parent/history", { waitUntil: "domcontentloaded" });

      await expect(
        page.getByRole("heading", { level: 1, name: "Payment history" }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Export Excel" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Export PDF" })).toBeVisible();
      await page.getByRole("tab", { name: /Archived/ }).click();
      await expect(page.getByRole("button", { name: "Remove selected" })).toBeVisible();
      const removedTab = page.getByRole("tab", { name: /Removed/ });
      await removedTab.focus();
      await page.keyboard.press("Enter");
      await expect(removedTab).toHaveAttribute("aria-selected", "true");
      await expect(page.getByText(/restored to Archived for 30 days/)).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });
});

test.describe("XMETA Pay admin branded Excel exports", () => {
  test.beforeEach(async ({ context }) => {
    await addDatabaseSessionCookie(context, "admin");
  });

  test("all admin table exports stay responsive and download readable workbooks", async ({ page }) => {
    test.setTimeout(180_000);
    const reports = [
      {
        path: "/admin/dashboard",
        heading: "Dashboard",
        filename: "admin-recent-payments.xlsx",
        worksheetName: "Recent payments",
        title: "Recent payment activity",
        headers: ["Time", "Student", "Type", "Amount", "Channel", "Status"],
      },
      {
        path: "/admin/tuition",
        heading: "Tuition report",
        filename: "admin-tuition-report.xlsx",
        worksheetName: "Tuition report",
        title: "Tuition report",
        headers: ["Student name", "Grade", "Section", "Fee due", "Paid", "Balance", "Last payment", "Status", "Terms"],
      },
      {
        path: "/admin/collections",
        heading: "Collections log",
        filename: "admin-collections-active.xlsx",
        worksheetName: "Active collections",
        title: "Active tuition collections",
        headers: ["Reference", "Student", "Grade", "Tuition record", "Amount", "Date and time", "Channel", "Status"],
      },
      {
        path: "/admin/other-fees",
        heading: "Other school fees",
        filename: "admin-other-fees.xlsx",
        worksheetName: "Other fees",
        title: "Other fees",
        headers: ["Fee type", "Description", "Default amount", "Assigned total", "Collected", "Outstanding", "Paid count", "Status"],
      },
      {
        path: "/admin/students",
        heading: "Enrolled students",
        filename: "admin-students.xlsx",
        worksheetName: "Enrolled students",
        title: "Enrolled students",
        headers: ["Reference", "Full name", "Grade", "Section", "Parent or guardian", "Contact", "Enrollment status", "Student status", "Sex", "Student type"],
      },
      {
        path: "/admin/student-profile",
        heading: "Student profile",
        filename: "admin-student-profiles.xlsx",
        worksheetName: "Student profiles",
        title: "Student profile selector",
        headers: ["Reference", "Full name", "Grade", "Section", "Parent or guardian", "Guardian link", "Enrollment status", "Student status", "Sex", "Student type"],
      },
      {
        path: "/admin/parents",
        heading: "Parent contacts",
        filename: "admin-parent-contacts.xlsx",
        worksheetName: "Parent contacts",
        title: "Parent contacts",
        headers: ["Parent name", "Students", "Grade", "Contact number", "Email address", "Relationship", "Status"],
      },
      {
        path: "/admin/allowance",
        heading: "Allowance ledger",
        filename: "admin-allowance-wallets.xlsx",
        worksheetName: "Active allowance",
        title: "Active allowance wallets",
        headers: ["Student", "Grade", "Current balance", "Last top-up", "Month spend", "Total top-ups", "Status"],
      },
      {
        path: "/admin/store-transactions",
        heading: "Store transactions",
        filename: "admin-store-transactions.xlsx",
        worksheetName: "Store transactions",
        title: "Store transactions",
        headers: ["Ref #", "Student", "Grade", "Store", "Amount", "Txn fee", "Time"],
      },
    ];

    for (const report of reports) {
      for (const width of [320, 375, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(report.path, { waitUntil: "domcontentloaded" });
        test.skip(page.url().includes("/admin/onboarding/"), "Local E2E admin school setup is incomplete.");
        await expect(page.getByRole("heading", { level: 1, name: report.heading })).toBeVisible();
        await expect(page.getByRole("button", { name: "Export Excel" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Export PDF" })).toBeVisible();
        await expectNoHorizontalOverflow(page);
      }

      const exportButton = page.getByRole("button", { name: "Export Excel" });
      if (await exportButton.isEnabled()) {
        const downloadPromise = page.waitForEvent("download");
        await exportButton.click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe(report.filename);
        await expectExcelWorkbook(download, report);
      }
    }
  });

  test("protected Reports page serves branded Excel and PDF downloads", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/admin/reports", { waitUntil: "domcontentloaded" });
    test.skip(page.url().includes("/admin/onboarding/"), "Local E2E admin school setup is incomplete.");
    await expect(page.getByRole("heading", { level: 1, name: "Financial reports" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Excel" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "PDF" }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const excelDownloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Excel" }).first().click();
    const excelDownload = await excelDownloadPromise;
    expect(excelDownload.suggestedFilename()).toBe("xmetapay-monthly-revenue.xlsx");
    await expectExcelWorkbook(excelDownload, {
      worksheetName: "Monthly revenue",
      title: "Monthly revenue",
      headers: ["Month", "Paid payment count", "Paid amount"],
    });

    const pdfDownloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "PDF" }).first().click();
    const pdfDownload = await pdfDownloadPromise;
    expect(pdfDownload.suggestedFilename()).toBe("xmetapay-monthly-revenue.pdf");
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

test.describe("XMETA Pay super admin branding", () => {
  test.beforeEach(async ({ context }) => {
    await addDatabaseSessionCookie(context, "super_admin");
  });

  test("company dashboard renders the shared brand logo", async ({ page }) => {
    await page.goto("/super-admin/dashboard", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { level: 1, name: "Super admin dashboard" })
    ).toBeVisible();
    await expectBrandLogo(page);
  });

  test("school admin account exports stay responsive and download", async ({ page }) => {
    test.setTimeout(60_000);
    await ensureE2EUser("admin");

    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/super-admin/admin-accounts", { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("heading", { level: 1, name: "School admin accounts" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Export Excel" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Export PDF" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }

    await page.waitForLoadState("networkidle");
    const excelDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export Excel" }).click();
    const excelDownload = await excelDownloadPromise;
    expect(excelDownload.suggestedFilename()).toBe("super-admin-school-admins.xlsx");
    await expectExcelWorkbook(excelDownload, {
      worksheetName: "School admin accounts",
      title: "School admin accounts",
      headers: ["Name", "Email", "Phone", "School", "Staff role", "Status", "Last login", "Created"],
    });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PDF" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("super-admin-school-admins.pdf");
  });

  test("pending admin registration exports stay responsive and download", async ({ page }) => {
    test.setTimeout(60_000);
    await ensureE2EUser("admin", {
      name: "=E2E Pending Admin",
      email: "e2e-pending-admin@xmetapay.test",
      status: "pending",
    });

    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/super-admin/registrations", { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("heading", { level: 1, name: "Admin registrations" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Export Excel" })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Export PDF" })).toBeEnabled();
      await expectNoHorizontalOverflow(page);
    }

    await page.waitForLoadState("networkidle");
    const excelDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export Excel" }).click();
    const excelDownload = await excelDownloadPromise;
    expect(excelDownload.suggestedFilename()).toBe("super-admin-pending-registrations.xlsx");
    await expectExcelWorkbook(excelDownload, {
      worksheetName: "Pending registrations",
      title: "Pending school admin registrations",
      headers: ["Name", "Email", "Phone", "School", "Staff role", "Created"],
      expectedTextCell: "=E2E Pending Admin",
    });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PDF" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("super-admin-pending-registrations.pdf");
  });
});

type E2ERole = "admin" | "parent" | "super_admin";

async function addDatabaseSessionCookie(context: BrowserContext, role: E2ERole) {
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

async function ensureE2EUser(
  role: E2ERole,
  options: {
    name?: string;
    email?: string;
    status?: "active" | "pending";
  } = {},
) {
  const connection = await mysql.createConnection(databaseConfig());
  const profiles = {
    admin: { name: "E2E Admin", email: "e2e-admin@xmetapay.test" },
    parent: { name: "E2E Parent", email: "e2e-parent@xmetapay.test" },
    super_admin: { name: "E2E Super Admin", email: "e2e-super-admin@xmetapay.test" },
  } as const;
  const profileName = options.name ?? profiles[role].name;
  const email = options.email ?? profiles[role].email;
  const status = options.status ?? "active";

  try {
    await connection.execute(
      `INSERT INTO users (role, name, email, phone, password_hash, status)
       VALUES (:role, :name, :email, NULL, :passwordHash, :status)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         status = VALUES(status)`,
      {
        role,
        name: profileName,
        email,
        passwordHash: "scrypt$e2e$0",
        status,
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
    } else if (role === "parent") {
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

async function expectDarkPublicShell(page: Page) {
  const shell = page.locator("main.public-auth-shell");

  await expect(shell).toBeVisible();
  await expect(shell).toHaveCSS("overflow-x", "hidden");
}

async function expectBrandLogo(page: Page) {
  const logo = page.locator("[data-brand-logo]");

  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute("src", /xmetapay-logo\.jpg/);
  await expect.poll(() => logo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
}

async function expectExcelWorkbook(
  download: Download,
  expected: {
    worksheetName: string;
    title: string;
    headers: string[];
    expectedTextCell?: string;
  },
) {
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const ExcelJS = await import("exceljs");
  const Workbook = ExcelJS.Workbook ?? ExcelJS.default.Workbook;
  const workbook = new Workbook();
  await workbook.xlsx.readFile(downloadPath!);
  const worksheet = workbook.getWorksheet(expected.worksheetName);

  expect(worksheet).toBeTruthy();
  expect(worksheet!.getCell("B1").value).toBe("XMETA Pay");
  expect(worksheet!.getCell("B2").value).toBe(expected.title);
  expect(worksheet!.views[0]?.state).toBe("frozen");
  expect(worksheet!.autoFilter).toBeTruthy();

  let headerRowNumber = 0;
  worksheet!.eachRow((row, rowNumber) => {
    if (row.getCell(1).value === "Name") headerRowNumber = rowNumber;
  });
  expect(headerRowNumber).toBeGreaterThan(0);
  expect(
    expected.headers.map((_, index) => worksheet!.getRow(headerRowNumber).getCell(index + 1).value),
  ).toEqual(expected.headers);

  if (expected.expectedTextCell) {
    const values: unknown[] = [];
    worksheet!.eachRow((row) => row.eachCell((cell) => values.push(cell.value)));
    expect(values).toContain(expected.expectedTextCell);
  }
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
