import { test, expect } from "@playwright/test";

test("unauthenticated visitor is kept off the task list", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("My Tasks")).toHaveCount(0);
});

test("sign-in page renders Clerk's form", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.locator("input[name='identifier'], input[type='email']").first()).toBeVisible({
    timeout: 10_000,
  });
});

test("sign-up page renders Clerk's form", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(page.getByRole("heading")).toBeVisible({ timeout: 10_000 });
});
