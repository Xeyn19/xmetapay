import { expect, test } from "@playwright/test";

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
  test("admin login form submits to the admin dashboard", async ({ page }) => {
    await page.goto("/admin/login");

    await page.getByLabel("Work email").fill("admin@school.edu.ph");
    await page.locator('input[name="password"]').fill("demo-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(
      "/admin/dashboard?email=admin%40school.edu.ph&password=demo-password"
    );
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
    await expect(page.getByText("School administrator")).toBeVisible();
  });

  test("parent login form submits to the parent dashboard", async ({ page }) => {
    await page.goto("/parent/login");

    await page.getByLabel("Email or mobile number").fill("parent@email.com");
    await page.locator('input[name="password"]').fill("demo-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(
      "/parent/dashboard?identifier=parent%40email.com&password=demo-password"
    );
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
    await expect(page.getByText("Parent / guardian")).toBeVisible();
  });
});

test.describe("XMETA Pay dashboard smoke tests", () => {
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
});
