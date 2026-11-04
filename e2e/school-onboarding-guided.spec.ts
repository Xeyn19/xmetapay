import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import mysql, { type RowDataPacket } from "mysql2/promise";

test.describe("Philippine school setup guided onboarding", () => {
  test("Both K–12 and College completes the adaptive five-step workflow", async ({ page, context }) => {
    test.setTimeout(90_000);
    const fixture = await prepareOnboardingAdmin("both");
    await addSessionCookie(context, fixture.userId);

    await page.goto("/admin/onboarding/school-setup");
    await expect(page.getByRole("heading", { name: "Set up your school profile" })).toBeVisible();
    await page.getByLabel("Official school name").fill(fixture.schoolName);
    await page.getByLabel("School code").fill(fixture.schoolCode);
    await page.getByText("Both K–12 and College", { exact: true }).click();
    await page.getByRole("button", { name: "Continue to School Year" }).click();

    await expect(page.getByRole("heading", { name: "Add the active school year" })).toBeVisible();
    await page.getByLabel("School year name").fill("2028–2029");
    await page.getByLabel("Start date").fill("2028-06-01");
    await page.getByLabel("End date").fill("2029-05-31");
    await page.getByRole("button", { name: "Continue to Basic Education" }).click();

    await expect(page.getByRole("heading", { name: "Set up Basic Education" })).toBeVisible();
    await page.getByText("Elementary (Grades 1–6)", { exact: true }).click();
    await page.getByRole("button", { name: /Next: Set up sections/ }).click();
    await expect(page.getByLabel("Elementary (Grades 1–6) common section 1")).toHaveValue("Section A");
    await page.getByRole("button", { name: "Continue to College" }).click();

    await expect(page.getByRole("heading", { name: "Set up Higher Education" })).toBeVisible();
    await page.getByLabel("Period name").fill("First Semester");
    await page.getByLabel("Start date").last().fill("2028-06-01");
    await page.getByLabel("End date").last().fill("2028-10-31");
    await page.getByLabel("Program 1 code").fill("BSIT");
    await page.getByLabel("Program 1 name").fill("Bachelor of Science in Information Technology");
    await page.getByLabel("Program 1 section 1 name").fill("Section A");
    await page.getByRole("button", { name: "Add section to BSIT" }).click();
    await page.getByLabel("Program 1 section 2 year level").selectOption("2");
    await page.getByLabel("Program 1 section 2 name").fill("Section B");
    await page.getByRole("button", { name: "Add another program" }).click();
    await page.getByLabel("Program 2 code").fill("BSHM");
    await page.getByLabel("Program 2 name").fill("Bachelor of Science in Hospitality Management");
    await page.getByLabel("Program 2 section 1 name").fill("Section A");
    await page.getByRole("button", { name: "Continue to Review" }).click();

    await expect(page.getByRole("heading", { name: "Review and finish" })).toBeVisible();
    await expect(page.getByText("Both K–12 and College", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Finish school setup" }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test("College-only skips Basic Education and remains responsive", async ({ page, context }) => {
    const fixture = await prepareOnboardingAdmin("college");
    await addSessionCookie(context, fixture.userId);

    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin/onboarding/school-setup");
      await expect(page.getByRole("heading", { name: "Set up your school profile" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }

    await page.getByLabel("Official school name").fill(fixture.schoolName);
    await page.getByLabel("School code").fill(fixture.schoolCode);
    await page.getByText("Higher Education only", { exact: true }).click();
    await page.getByRole("button", { name: "Continue to School Year" }).click();
    await page.getByLabel("School year name").fill("2028–2029");
    await page.getByLabel("Start date").fill("2028-06-01");
    await page.getByLabel("End date").fill("2029-05-31");
    await page.getByRole("button", { name: "Continue to College" }).click();
    await expect(page.getByRole("heading", { name: "Set up Higher Education" })).toBeVisible();
    await expect(page.getByText("Basic Education").last()).toBeVisible();
    await expect(page.getByText("Not required", { exact: true }).first()).toBeVisible();
  });

  test("Basic Education uses level bulk selection, common sections, and per-grade exceptions", async ({ page, context }) => {
    test.setTimeout(90_000);
    const fixture = await prepareOnboardingAdmin("basic-ux");
    await addSessionCookie(context, fixture.userId);
    await advanceToBasicEducation(page, fixture);

    await page.getByRole("button", { name: "Select all K–12 levels" }).click();
    await expect(page.getByText("13 grade levels selected")).toBeVisible();
    await page.getByRole("button", { name: /Next: Set up sections/ }).click();
    await expect(page.getByRole("button", { name: /Choose education levels/ })).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: /Set up sections/ }).first()).toHaveAttribute("aria-expanded", "true");

    const elementarySection = page.getByLabel("Elementary (Grades 1–6) common section 1");
    await expect(elementarySection).toHaveValue("Section A");
    await elementarySection.fill("Rose");
    await page.getByRole("button", { name: "Customize individual grades" }).first().click();
    await expect(page.getByLabel("Grade 1 section 1")).toHaveValue("Rose");
    await page.getByLabel("Grade 1 section 1").fill("Rose 1");
    await expect(page.getByLabel("Grade 2 section 1")).toHaveValue("Rose");

    await page.getByRole("button", { name: /Next: Configure Senior High/ }).click();
    await expect(page.getByText("Why can Grade 11 and Grade 12 differ?")).toBeVisible();
    await page.getByText("ACADEMIC", { exact: true }).click();
    await expect(page.getByLabel("Grade 11 ACADEMIC section 1")).toHaveValue("ACADEMIC - Section A");

    const actionFooter = page.getByRole("button", { name: "Continue to Review" }).locator("..");
    await expect(actionFooter).toHaveCSS("position", "sticky");
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalOverflow(page);
    }
  });

  test("Senior-High-only setup hides standard grade rows and supports keyboard panel navigation", async ({ page, context }) => {
    const fixture = await prepareOnboardingAdmin("shs-only-ux");
    await addSessionCookie(context, fixture.userId);
    await advanceToBasicEducation(page, fixture);

    await page.getByText("Senior High School (Grades 11–12)", { exact: true }).click();
    await page.getByRole("button", { name: /Next: Set up sections/ }).click();
    await expect(page.getByText("No standard grade sections are required.")).toBeVisible();
    const seniorPanel = page.getByRole("button", { name: /Configure Senior High School/ });
    await seniorPanel.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Why can Grade 11 and Grade 12 differ?")).toBeVisible();
  });
});

async function advanceToBasicEducation(page: Page, fixture: { schoolName: string; schoolCode: string }) {
  await page.goto("/admin/onboarding/school-setup");
  await page.getByLabel("Official school name").fill(fixture.schoolName);
  await page.getByLabel("School code").fill(fixture.schoolCode);
  await page.getByText("Basic Education only", { exact: true }).click();
  await page.getByRole("button", { name: "Continue to School Year" }).click();
  await page.getByLabel("School year name").fill("2028–2029");
  await page.getByLabel("Start date").fill("2028-06-01");
  await page.getByLabel("End date").fill("2029-05-31");
  await page.getByRole("button", { name: "Continue to Basic Education" }).click();
  await expect(page.getByRole("heading", { name: "Set up Basic Education" })).toBeVisible();
}

async function prepareOnboardingAdmin(suffix: string) {
  const connection = await mysql.createConnection(databaseConfig());
  const email = `e2e-onboarding-${suffix}@xmetapay.test`;
  const schoolCode = `E2E-ONBOARD-${suffix.toUpperCase()}`;
  const schoolName = `E2E ${suffix} Guided School`;
  try {
    const [schoolRows] = await connection.execute<Array<{ id: number } & RowDataPacket>>("SELECT id FROM schools WHERE code = :schoolCode", { schoolCode });
    if (schoolRows[0]) {
      const schoolId = schoolRows[0].id;
      await connection.execute("DELETE cs FROM college_sections cs WHERE cs.school_id = :schoolId", { schoolId });
      await connection.execute("DELETE FROM academic_periods WHERE school_id = :schoolId", { schoolId });
      await connection.execute("DELETE FROM academic_programs WHERE school_id = :schoolId", { schoolId });
      await connection.execute("DELETE FROM sections WHERE school_id = :schoolId", { schoolId });
      await connection.execute("DELETE FROM senior_high_offerings WHERE school_id = :schoolId", { schoolId });
      await connection.execute("DELETE FROM grade_levels WHERE school_id = :schoolId", { schoolId });
      await connection.execute("DELETE FROM school_years WHERE school_id = :schoolId", { schoolId });
      await connection.execute("UPDATE admin_profiles SET school_id = NULL WHERE school_id = :schoolId", { schoolId });
      await connection.execute("DELETE FROM schools WHERE id = :schoolId", { schoolId });
    }
    await connection.execute(
      `INSERT INTO users (role, name, email, password_hash, status)
       VALUES ('admin', 'E2E Guided Setup Admin', :email, 'scrypt$e2e$0', 'active')
       ON DUPLICATE KEY UPDATE status = 'active', name = VALUES(name)`,
      { email },
    );
    const [userRows] = await connection.execute<Array<{ id: number } & RowDataPacket>>("SELECT id FROM users WHERE email = :email LIMIT 1", { email });
    const userId = userRows[0].id;
    await connection.execute(
      `INSERT INTO admin_profiles (user_id, school_name, staff_role, school_id)
       VALUES (:userId, :schoolName, 'school_administrator', NULL)
       ON DUPLICATE KEY UPDATE school_name = VALUES(school_name), staff_role = 'school_administrator', school_id = NULL`,
      { userId, schoolName },
    );
    return { userId, schoolName, schoolCode };
  } finally {
    await connection.end();
  }
}

async function addSessionCookie(context: BrowserContext, userId: number) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHmac("sha256", testSessionSecret()).update(token).digest("hex");
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const connection = await mysql.createConnection(databaseConfig());
  try {
    await connection.execute(
      `INSERT INTO auth_sessions (user_id, role, token_hash, expires_at)
       VALUES (:userId, 'admin', :tokenHash, FROM_UNIXTIME(:expires))`,
      { userId, tokenHash, expires },
    );
  } finally {
    await connection.end();
  }
  await context.addCookies([{ name: "xmetapay_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax", expires }]);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

function databaseConfig() {
  return { host: process.env.MYSQL_HOST ?? "127.0.0.1", port: Number(process.env.MYSQL_PORT ?? "3306"), database: process.env.MYSQL_DATABASE ?? "xmetapay_db", user: process.env.MYSQL_USER ?? "root", password: process.env.MYSQL_PASSWORD ?? "", namedPlaceholders: true };
}

function testSessionSecret() {
  if (process.env.AUTH_SESSION_SECRET) return process.env.AUTH_SESSION_SECRET;
  try {
    const line = readFileSync(".env", "utf8").split(/\r?\n/).find((entry) => entry.startsWith("AUTH_SESSION_SECRET="));
    return line?.slice("AUTH_SESSION_SECRET=".length) || "xmetapay-local-dev-session-secret";
  } catch {
    return "xmetapay-local-dev-session-secret";
  }
}
