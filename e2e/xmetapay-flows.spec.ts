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

  test("public theme defaults to dark and remembers light across public routes", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");

    await expect(page.locator("html")).toHaveClass(/dark/);
    const lightToggle = page.getByRole("button", { name: "Switch to light mode" });
    await expect(lightToggle).toBeVisible();
    await expect(lightToggle).toHaveAttribute("aria-pressed", "false");
    await lightToggle.click();

    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(page.getByRole("button", { name: "Switch to dark mode" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.goto("/admin/login");
    await expect(page.locator("html")).toHaveClass(/light/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/light/);

    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
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
      await expect(page.getByRole("button", { name: /Switch to (light|dark) mode/ })).toBeVisible();
      await expectDarkPublicShell(page);
      await expectBrandLogo(page);
    }
  });

  test("parent registration relationship options remain readable in both themes", async ({ page }) => {
    await page.goto("/parent/register", { waitUntil: "domcontentloaded" });
    const relationship = page.getByLabel("Relationship");
    const motherOption = relationship.getByRole("option", { name: "Mother", exact: true });

    await expect(relationship).toBeVisible();
    await expect(motherOption).toHaveCSS("color", "rgb(23, 25, 29)");
    await expect(motherOption).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await relationship.selectOption({ label: "Mother" });
    await expect(relationship).toHaveValue("Mother");

    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(motherOption).toHaveCSS("color", "rgb(23, 25, 29)");
    await expect(motherOption).toHaveCSS("background-color", "rgb(255, 255, 255)");

    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalOverflow(page);
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

  test("Enrolled students keeps one contextual Add students action while other Admin pages retain the shortcut", async ({
    page,
  }) => {
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin/students", { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("link", { name: "Add students", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Add students", exact: true })).toHaveCount(1);
      await expect(page.locator("html")).not.toHaveCSS("overflow-x", "scroll");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }

    await page.goto("/admin/students", { waitUntil: "networkidle" });
    const contextualAction = page.getByRole("button", { name: "Add students", exact: true });
    await expect(contextualAction).toBeEnabled();
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(contextualAction).toBeVisible();
    await contextualAction.click();
    await expect(page.getByRole("dialog", { name: "Add students" })).toBeVisible();
    await page.getByRole("button", { name: "Close modal" }).click();

    await page.goto("/admin/dashboard", { waitUntil: "networkidle" });
    const shortcut = page.getByRole("link", { name: "Add students", exact: true });
    await expect(shortcut).toBeVisible();
    await shortcut.click();
    await expect(page).toHaveURL(/\/admin\/students\?intake=choose$/);
    await expect(page.getByRole("dialog", { name: "Add students" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add students", exact: true })).toHaveCount(0);
  });

  test("admin dashboard shares the persisted app theme with an adaptive sidebar", async ({
    page,
  }) => {
    await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator(".dashboard-sidebar")).toHaveCSS(
      "background-color",
      "rgb(11, 13, 19)"
    );

    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(page.locator("html")).toHaveClass(/light/);
    await page.goto("/admin/tuition", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(page.locator(".dashboard-sidebar")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)"
    );
  });

  test("tuition term dates use the student schedule window in both themes", async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);
    const adminUserId = await ensureE2ETuitionTermWindow();
    await addDatabaseSessionCookieForUser(context, adminUserId, "admin");
    await page.goto("/admin/tuition", { waitUntil: "domcontentloaded" });

    const openTerms = page.getByRole("button", { name: "Manage tuition terms for E2E Window Student" });
    await expect(openTerms).toBeVisible();
    await openTerms.click();

    let dialog = page.getByRole("dialog", { name: "Manage tuition terms" });
    await expect(dialog.getByText("Term schedule window")).toBeVisible();
    await expect(dialog.getByText("June 1, 2026")).toBeVisible();
    await expect(dialog.getByText("January 15, 2027")).toBeVisible();

    let termDates = dialog.getByLabel("Term due date");
    await expect(termDates).toHaveCount(3);
    const firstTermDate = termDates.first();
    await expect(firstTermDate).toHaveAttribute("min", "2026-06-01");
    await expect(firstTermDate).toHaveAttribute("max", "2027-01-15");

    await firstTermDate.fill("2026-05-31");
    expect(await firstTermDate.evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(true);
    await firstTermDate.fill("2027-01-16");
    expect(await firstTermDate.evaluate((input: HTMLInputElement) => input.validity.rangeOverflow)).toBe(true);
    await firstTermDate.fill("2026-06-01");
    expect(await firstTermDate.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(true);

    await dialog.getByRole("button", { name: "Close modal" }).click();
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(page.locator("html")).toHaveClass(/light/);
    await openTerms.click();
    dialog = page.getByRole("dialog", { name: "Manage tuition terms" });
    termDates = dialog.getByLabel("Term due date");
    await expect(termDates.first()).toHaveAttribute("min", "2026-06-01");
    await expect(termDates.first()).toHaveAttribute("max", "2027-01-15");

    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(dialog).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("admin edits a student profile responsively in both themes", async ({ context, page }) => {
    test.setTimeout(90_000);
    const fixture = await ensureE2EAdminStudentProfileEdit();
    await addDatabaseSessionCookieForUser(context, fixture.adminUserId, "admin");
    await page.goto(`/admin/students/${fixture.studentId}`, { waitUntil: "domcontentloaded" });

    const editButton = page.getByRole("button", { name: "Edit details" });
    await expect(editButton).toBeVisible();
    await editButton.click();

    let dialog = page.getByRole("dialog", { name: "Edit student details" });
    await expect(dialog.getByLabel("Student reference")).toHaveValue("E2E-PROFILE-001");
    await expect(dialog.getByLabel("Student status")).toContainText("Active");
    await expect(dialog.getByLabel("Enrollment status")).toContainText("Enrolled");
    await expect(dialog.getByLabel("Grade level")).toBeEnabled();
    await expect(dialog.getByLabel("Section")).toBeEnabled();

    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(dialog).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }

    await dialog.getByLabel("First name").fill("E2E Edited");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Student details updated" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /E2E Edited Profile Student/ })).toBeVisible();

    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await editButton.click();
    dialog = page.getByRole("dialog", { name: "Edit student details" });
    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(dialog.getByText("Student information")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(editButton).toBeFocused();
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
      { path: "/parent/dashboard", heading: "Dashboard", navLabel: "Dashboard" },
      { path: "/parent/students", heading: "My students", navLabel: "My students" },
      { path: "/parent/student-profile", heading: "Student profile", navLabel: "Student profile" },
      { path: "/parent/fees", heading: "Fee summary", navLabel: "Fee summary" },
      { path: "/parent/pay-tuition", heading: "Pay tuition & fees", navLabel: "Pay tuition" },
      { path: "/parent/history", heading: "Payment history", navLabel: "Payment history" },
      { path: "/parent/wallet", heading: "Wallet & allowance top-up", navLabel: "Wallet & top-up" },
    ];

    for (const route of routes) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { level: 1, name: route.heading })
      ).toBeVisible();
      await expect(
        page.getByLabel("Parent navigation").getByRole("link", { name: route.navLabel })
      ).toHaveAttribute("aria-current", "page");
      await expectBrandLogo(page);
    }

    await page.goto("/parent/receipt", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByLabel("Parent navigation").getByRole("link", { name: "Payment history" })
    ).toHaveAttribute("aria-current", "page");

    await page.goto("/parent/wallet/top-up-result?batch=WTB-NOT-AVAILABLE", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByLabel("Parent navigation").getByRole("link", { name: "Wallet & top-up" })
    ).toHaveAttribute("aria-current", "page");
  });

  test("parent dashboard switches its sidebar with the shared theme", async ({
    page,
  }) => {
    await page.goto("/parent/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(page.locator(".dashboard-sidebar")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)"
    );
  });

  test("parent hover and selected controls keep readable dark-theme contrast", async ({
    page,
  }) => {
    await page.goto("/parent/dashboard", { waitUntil: "domcontentloaded" });
    const feeSummaryLink = page.getByRole("link", { name: "View fee summary" });
    await feeSummaryLink.hover();
    await expect(feeSummaryLink).toHaveCSS("background-color", "rgb(34, 40, 58)");
    await expect(feeSummaryLink).toHaveCSS(
      "color",
      "rgb(247, 248, 250)"
    );

    await page.goto("/parent/wallet", { waitUntil: "domcontentloaded" });
    const mayaMethod = page.getByRole("button", { name: /Maya/ });
    if (await mayaMethod.count()) {
      await mayaMethod.click();
      await expect(mayaMethod).toHaveCSS("background-color", "rgb(58, 35, 29)");
      await expect(mayaMethod.getByText("Maya", { exact: true })).toHaveCSS(
        "color",
        "rgb(247, 248, 250)"
      );
    }

    await page.goto("/parent/fees", { waitUntil: "domcontentloaded" });
    const archivedTab = page.getByRole("tab", { name: /Archived/ });
    await archivedTab.click();
    await expect(archivedTab).toHaveCSS("color", "rgb(247, 248, 250)");
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

  test("Admin finance pages keep report hover text readable and tuition content focused", async ({ page }) => {
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin/reports", { waitUntil: "domcontentloaded" });
      test.skip(page.url().includes("/admin/onboarding/"), "Local E2E admin school setup is incomplete.");
      await expect(page.locator('[data-report-row="Monthly revenue"]')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }

    const reportRow = page.locator('[data-report-row="Monthly revenue"]');
    const reportTitle = reportRow.getByText("Monthly revenue", { exact: true });
    const reportDescription = reportRow.getByText("Paid payment totals grouped by month", { exact: true });
    await reportRow.hover();
    await expect(reportRow).toHaveCSS("background-color", "rgb(34, 40, 58)");
    await expect(reportTitle).toHaveCSS("color", "rgb(247, 248, 250)");
    await expect(reportDescription).toHaveCSS("color", "rgb(185, 192, 204)");

    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await reportRow.hover();
    await expect(reportRow).toHaveCSS("background-color", "rgb(241, 243, 245)");
    await expect(reportTitle).toHaveCSS("color", "rgb(17, 19, 26)");
    await expect(reportDescription).toHaveCSS("color", "rgb(95, 102, 115)");

    await page.goto("/admin/tuition", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Other fee items" })).toHaveCount(0);
    await expect(page.getByText("No other fee records yet.")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Outstanding by grade" })).toBeVisible();
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
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(page.locator(".dashboard-sidebar")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)"
    );
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

  test("school profile shows aggregate current and total population responsively", async ({ page }) => {
    const schoolId = await ensureE2ESchoolProfile();

    await page.goto("/super-admin/admin-accounts", { waitUntil: "domcontentloaded" });
    await expect(page.locator(`a[href="/super-admin/schools/${schoolId}"]`, { hasText: "View school" }).first()).toHaveAttribute(
      "href",
      `/super-admin/schools/${schoolId}`,
    );

    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/super-admin/schools/${schoolId}`, { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("heading", { level: 1, name: "School profile" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: "E2E Test School" })).toBeVisible();
      await expect(page.getByText("Current students", { exact: true })).toBeVisible();
      await expect(page.getByText("Current parents", { exact: true })).toBeVisible();
      await expect(page.getByText("Active-year enrollment", { exact: true })).toBeVisible();
      await expect(page.getByText("Enrolled students by grade", { exact: true })).toBeVisible();
      await expect(
        page.getByLabel("Company navigation").getByRole("link", { name: "School admin accounts" })
      ).toHaveAttribute("aria-current", "page");
      await expectNoHorizontalOverflow(page);
    }

    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(page.getByRole("heading", { level: 2, name: "E2E Test School" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/super-admin/schools/not-a-school", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("This page could not be found.")).toBeVisible();
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
  await addDatabaseSessionCookieForUser(context, userId, role);
}

async function addDatabaseSessionCookieForUser(
  context: BrowserContext,
  userId: number,
  role: E2ERole,
) {
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

async function ensureE2ESchoolProfile() {
  const adminUserId = await ensureE2EUser("admin", {
    name: "E2E School Profile Admin",
    email: "e2e-school-profile-admin@xmetapay.test",
  });
  const parentUserId = await ensureE2EUser("parent", {
    name: "E2E School Profile Parent",
    email: "e2e-school-profile-parent@xmetapay.test",
  });
  const connection = await mysql.createConnection(databaseConfig());

  try {
    await connection.execute(
      `INSERT INTO schools (name, code, status)
       VALUES ('E2E Test School', 'E2E-SCHOOL', 'active')
       ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status)`,
    );
    const [schoolRows] = await connection.execute<Array<{ id: number } & RowDataPacket>>(
      "SELECT id FROM schools WHERE code = 'E2E-SCHOOL' LIMIT 1",
    );
    const schoolId = schoolRows[0].id;

    await connection.execute(
      "UPDATE admin_profiles SET school_id = :schoolId WHERE user_id = :adminUserId",
      { schoolId, adminUserId },
    );
    await connection.execute(
      `INSERT INTO school_years (school_id, name, starts_on, ends_on, status)
       VALUES (:schoolId, 'E2E 2026-2027', '2026-06-01', '2027-03-31', 'active')
       ON DUPLICATE KEY UPDATE status = 'active'`,
      { schoolId },
    );
    const [yearRows] = await connection.execute<Array<{ id: number } & RowDataPacket>>(
      "SELECT id FROM school_years WHERE school_id = :schoolId AND name = 'E2E 2026-2027' LIMIT 1",
      { schoolId },
    );
    const schoolYearId = yearRows[0].id;

    await connection.execute(
      `INSERT INTO grade_levels (school_id, name, sort_order)
       VALUES (:schoolId, 'Grade E2E', 1)
       ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order)`,
      { schoolId },
    );
    const [gradeRows] = await connection.execute<Array<{ id: number } & RowDataPacket>>(
      "SELECT id FROM grade_levels WHERE school_id = :schoolId AND name = 'Grade E2E' LIMIT 1",
      { schoolId },
    );
    const gradeLevelId = gradeRows[0].id;

    await connection.execute(
      `INSERT INTO sections (school_id, school_year_id, grade_level_id, name)
       VALUES (:schoolId, :schoolYearId, :gradeLevelId, 'Section E2E')
       ON DUPLICATE KEY UPDATE grade_level_id = VALUES(grade_level_id)`,
      { schoolId, schoolYearId, gradeLevelId },
    );

    await connection.execute(
      `INSERT INTO students (school_id, student_reference, first_name, last_name, status)
       VALUES (:schoolId, 'E2E-PROFILE-001', 'E2E', 'Profile Student', 'active')
       ON DUPLICATE KEY UPDATE status = 'active'`,
      { schoolId },
    );
    const [studentRows] = await connection.execute<Array<{ id: number } & RowDataPacket>>(
      "SELECT id FROM students WHERE school_id = :schoolId AND student_reference = 'E2E-PROFILE-001' LIMIT 1",
      { schoolId },
    );
    const studentId = studentRows[0].id;

    await connection.execute(
      `INSERT INTO enrollments (student_id, school_year_id, grade_level_id, status, enrolled_at)
       VALUES (:studentId, :schoolYearId, :gradeLevelId, 'enrolled', CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         grade_level_id = VALUES(grade_level_id),
         status = 'enrolled',
         enrolled_at = COALESCE(enrolled_at, CURRENT_TIMESTAMP)`,
      { studentId, schoolYearId, gradeLevelId },
    );
    await connection.execute(
      `INSERT INTO student_guardians (student_id, parent_user_id, relationship, is_primary)
       VALUES (:studentId, :parentUserId, 'guardian', TRUE)
       ON DUPLICATE KEY UPDATE is_primary = TRUE`,
      { studentId, parentUserId },
    );

    return schoolId;
  } finally {
    await connection.end();
  }
}

async function ensureE2EAdminStudentProfileEdit() {
  await ensureE2ESchoolProfile();
  const connection = await mysql.createConnection(databaseConfig());

  try {
    const [adminRows] = await connection.execute<Array<{ id: number } & RowDataPacket>>(
      "SELECT id FROM users WHERE role = 'admin' AND email = 'e2e-school-profile-admin@xmetapay.test' LIMIT 1",
    );
    const [studentRows] = await connection.execute<Array<{ id: number } & RowDataPacket>>(
      `SELECT st.id
       FROM students st
       JOIN schools sc ON sc.id = st.school_id
       WHERE sc.code = 'E2E-SCHOOL' AND st.student_reference = 'E2E-PROFILE-001'
       LIMIT 1`,
    );
    const [sectionRows] = await connection.execute<Array<{ id: number; school_year_id: number } & RowDataPacket>>(
      `SELECT s.id, s.school_year_id
       FROM sections s
       JOIN schools sc ON sc.id = s.school_id
       JOIN school_years sy ON sy.id = s.school_year_id AND sy.status = 'active'
       WHERE sc.code = 'E2E-SCHOOL' AND s.name = 'Section E2E'
       LIMIT 1`,
    );
    const adminUserId = adminRows[0].id;
    const studentId = studentRows[0].id;
    const section = sectionRows[0];

    await connection.execute(
      `UPDATE students
       SET first_name = 'E2E', middle_name = NULL, last_name = 'Profile Student',
           birthdate = '2014-05-20', sex = 'male', status = 'active'
       WHERE id = :studentId`,
      { studentId },
    );
    await connection.execute(
      `UPDATE enrollments
       SET section_id = :sectionId, student_type = 'returned', status = 'enrolled'
       WHERE student_id = :studentId AND school_year_id = :schoolYearId`,
      { studentId, sectionId: section.id, schoolYearId: section.school_year_id },
    );

    return { adminUserId, studentId };
  } finally {
    await connection.end();
  }
}

async function ensureE2ETuitionTermWindow() {
  const adminUserId = await ensureE2EUser("admin", {
    name: "E2E Tuition Window Admin",
    email: "e2e-tuition-window-admin@xmetapay.test",
  });
  const connection = await mysql.createConnection(databaseConfig());

  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO schools (name, code, status)
       VALUES ('E2E Tuition Test School', 'E2E-TUITION', 'active')
       ON DUPLICATE KEY UPDATE name = VALUES(name), status = 'active'`,
    );
    const [schoolRows] = await connection.execute<Array<{ id: number } & RowDataPacket>>(
      "SELECT id FROM schools WHERE code = 'E2E-TUITION' LIMIT 1",
    );
    const schoolId = schoolRows[0].id;

    await connection.execute(
      `UPDATE admin_profiles
       SET school_id = :schoolId, school_name = 'E2E Tuition Test School', staff_role = 'school_administrator'
       WHERE user_id = :adminUserId`,
      { schoolId, adminUserId },
    );
    await connection.execute(
      `INSERT INTO school_years (school_id, name, starts_on, ends_on, status)
       VALUES (:schoolId, 'E2E Tuition 2026-2027', '2026-06-01', '2027-03-31', 'active')
       ON DUPLICATE KEY UPDATE
         starts_on = VALUES(starts_on),
         ends_on = VALUES(ends_on),
         status = 'active'`,
      { schoolId },
    );
    const [yearRows] = await connection.execute<Array<{ id: number } & RowDataPacket>>(
      "SELECT id FROM school_years WHERE school_id = :schoolId AND name = 'E2E Tuition 2026-2027' LIMIT 1",
      { schoolId },
    );
    const schoolYearId = yearRows[0].id;

    await connection.execute(
      `INSERT INTO grade_levels (school_id, name, sort_order)
       VALUES (:schoolId, 'Grade Window', 1)
       ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order)`,
      { schoolId },
    );
    const [gradeRows] = await connection.execute<Array<{ id: number } & RowDataPacket>>(
      "SELECT id FROM grade_levels WHERE school_id = :schoolId AND name = 'Grade Window' LIMIT 1",
      { schoolId },
    );
    const gradeLevelId = gradeRows[0].id;

    await connection.execute(
      `INSERT INTO sections (school_id, school_year_id, grade_level_id, name)
       VALUES (:schoolId, :schoolYearId, :gradeLevelId, 'Section Window')
       ON DUPLICATE KEY UPDATE grade_level_id = VALUES(grade_level_id)`,
      { schoolId, schoolYearId, gradeLevelId },
    );

    await connection.execute(
      `INSERT INTO students (school_id, student_reference, first_name, last_name, status)
       VALUES (:schoolId, 'E2E-WINDOW-001', 'E2E Window', 'Student', 'active')
       ON DUPLICATE KEY UPDATE first_name = VALUES(first_name), last_name = VALUES(last_name), status = 'active'`,
      { schoolId },
    );
    const [studentRows] = await connection.execute<Array<{ id: number } & RowDataPacket>>(
      "SELECT id FROM students WHERE school_id = :schoolId AND student_reference = 'E2E-WINDOW-001' LIMIT 1",
      { schoolId },
    );
    const studentId = studentRows[0].id;

    await connection.execute(
      `INSERT INTO enrollments (student_id, school_year_id, grade_level_id, status, enrolled_at)
       VALUES (:studentId, :schoolYearId, :gradeLevelId, 'enrolled', CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE grade_level_id = VALUES(grade_level_id), status = 'enrolled'`,
      { studentId, schoolYearId, gradeLevelId },
    );
    await connection.execute(
      `INSERT INTO fee_types (school_id, school_year_id, name, category, default_amount, status)
       VALUES (:schoolId, :schoolYearId, 'E2E Window Tuition', 'tuition', 30000.00, 'active')
       ON DUPLICATE KEY UPDATE default_amount = VALUES(default_amount), status = 'active'`,
      { schoolId, schoolYearId },
    );
    const [feeRows] = await connection.execute<Array<{ id: number } & RowDataPacket>>(
      "SELECT id FROM fee_types WHERE school_year_id = :schoolYearId AND name = 'E2E Window Tuition' LIMIT 1",
      { schoolYearId },
    );
    const feeTypeId = feeRows[0].id;

    await connection.execute(
      `INSERT INTO student_fee_assignments (
         student_id, fee_type_id, school_year_id, amount_due, amount_paid, due_date, status
       )
       VALUES (:studentId, :feeTypeId, :schoolYearId, 30000.00, 0.00, '2027-01-15', 'open')
       ON DUPLICATE KEY UPDATE
         amount_due = 30000.00,
         amount_paid = 0.00,
         due_date = '2027-01-15',
         status = 'open'`,
      { studentId, feeTypeId, schoolYearId },
    );
    const [assignmentRows] = await connection.execute<Array<{ id: number } & RowDataPacket>>(
      `SELECT id
       FROM student_fee_assignments
       WHERE student_id = :studentId AND fee_type_id = :feeTypeId AND school_year_id = :schoolYearId
       LIMIT 1`,
      { studentId, feeTypeId, schoolYearId },
    );
    await connection.execute(
      "DELETE FROM tuition_payment_terms WHERE student_fee_assignment_id = :assignmentId",
      { assignmentId: assignmentRows[0].id },
    );
    await connection.commit();
    return adminUserId;
  } catch (error) {
    await connection.rollback();
    throw error;
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
