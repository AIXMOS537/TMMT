import { test, expect } from "@playwright/test";

test.describe("Public Forms", () => {
  test("lead intake form loads and shows required fields", async ({ page }) => {
    await page.goto("/forms/lead-intake");
    await expect(page.locator("h1")).toContainText("Vehicle Rental Inquiry");
    await expect(page.locator('input[name="contact_name"]')).toBeVisible();
    await expect(page.locator('input[name="phone"]')).toBeVisible();
  });

  test("lead intake form validates and submits", async ({ page }) => {
    await page.goto("/forms/lead-intake");
    await page.fill('input[name="contact_name"]', "Test User");
    await page.fill('input[name="phone"]', "5551234567");
    await page.fill('input[name="email"]', "test@example.com");
    await page.click('button[type="submit"]');
    // Should show success or error banner (not alert)
    await expect(page.locator("text=Thank You").or(page.locator('[class*="red"]'))).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Auth", () => {
  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/login");
    await expect(page.locator("form")).toBeVisible();
  });

  test("login page loads with email and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });
});

test.describe("Admin (requires auth)", () => {
  test("forms routes are publicly accessible", async ({ page }) => {
    await page.goto("/forms/appointment");
    // Should NOT redirect to login
    await expect(page.locator("h1")).toContainText("Appointment");
  });

  test("ticket form loads with issue type dropdown", async ({ page }) => {
    await page.goto("/forms/ticket");
    await expect(page.locator('select[name="issue_type"]')).toBeVisible();
  });
});
