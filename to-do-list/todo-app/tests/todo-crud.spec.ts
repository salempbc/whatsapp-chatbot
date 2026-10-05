import { test, expect } from "@playwright/test";

// Requires a real Clerk test user (email/password auth enabled) provided via env vars.
// Keyless dev mode doesn't persist credentials across runs, so these are skipped by default.
// Set CLERK_TEST_EMAIL and CLERK_TEST_PASSWORD to enable.
const email = process.env.CLERK_TEST_EMAIL;
const password = process.env.CLERK_TEST_PASSWORD;

test.describe("Todo CRUD", () => {
  test.skip(!email || !password, "Set CLERK_TEST_EMAIL / CLERK_TEST_PASSWORD to run authenticated tests");

  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in");
    await page.fill("input[name='identifier'], input[type='email']", email!);
    await page.click("button:has-text('Continue')");
    await page.fill("input[name='password'], input[type='password']", password!);
    await page.click("button:has-text('Continue')");
    await expect(page).toHaveURL("/", { timeout: 10_000 });
  });

  test("creates, completes, and deletes a task", async ({ page }) => {
    const title = `E2E task ${Date.now()}`;

    await page.click("#add-task-btn");
    await page.fill("input[name='title'], [placeholder*='title' i]", title);
    await page.click("button:has-text('Create')");
    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });

    const item = page.locator(`text=${title}`).locator("..").locator("..");
    await item.locator("button[role='checkbox']").last().click();
    await expect(item).toHaveClass(/opacity-70/);

    await item.getByRole("button", { name: /delete/i }).click();
    await page.getByRole("button", { name: /delete/i }).last().click();
    await expect(page.getByText(title)).toHaveCount(0, { timeout: 10_000 });
  });
});
