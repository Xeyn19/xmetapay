import { expect, test } from "@playwright/test";

test.describe("tuition assessment workflow access", () => {
  for (const path of ["/admin/tuition/schedules", "/admin/tuition/assessments/new", "/admin/school-setup/academics"]) {
    test(`protects ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login/);
    });
  }

  test("parent assessment statement route stays guardian authenticated", async ({ page }) => {
    await page.goto("/parent/fees");
    await expect(page).toHaveURL(/\/parent\/login/);
  });
});
