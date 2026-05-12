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
    await expect(page.getByRole("heading", { name: /Thank You/i })).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe("Auth", () => {
  test("unauthenticated user is redirected to login", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 15000 });
    await expect(page.locator("form")).toBeVisible();
  });

  test("unauthenticated user cannot open partner portal", async ({ page }) => {
    await page.goto("/partner");
    await page.waitForURL("**/login");
    await expect(page.locator('input[name="email"]')).toBeVisible();
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
