import { test, expect } from "@playwright/test";

test.describe("Venture routes (unauthenticated)", () => {
  test("portfolio requires login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 15000 });
  });

  test("venture dashboard requires login", async ({ page }) => {
    await page.goto("/v/tmmt-rentals");
    await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 15000 });
  });

  test("legacy /fleet redirects to login then preserves next path", async ({ page }) => {
    await page.goto("/fleet");
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });
});
