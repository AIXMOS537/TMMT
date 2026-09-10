import { test, expect } from "@playwright/test";

/**
 * The journey a renter actually takes, driven through a real browser.
 *
 * This exists because every layer below it passed while the journey itself was
 * broken: the pages returned 200, the forms rendered, the probe was green, and
 * an anonymous submission was still refused by the database. Nothing short of
 * filling the form and watching for the success screen catches that, because
 * the failure surfaced to the visitor AS the success screen.
 *
 * Every submitted name is prefixed ZZ_E2E_ so a run is identifiable and
 * removable in the tables it writes to.
 */

const STAMP = process.env.E2E_STAMP ?? "local";
const testName = (what: string) => `ZZ_E2E_${what}_${STAMP}`;

test.describe("renter journey", () => {
  test("a renter can submit a rental inquiry and sees confirmation", async ({ page }) => {
    await page.goto("/forms/lead-intake");

    // The door a renter comes through keeps its rental wording.
    await expect(page.getByRole("heading", { name: /vehicle rental inquiry/i })).toBeVisible();

    await page.fill('input[name="contact_name"]', testName("RENT"));
    await page.fill('input[name="phone"]', "5715550111");
    await page.fill('input[name="opportunity_name"]', "Weekly sedan for rideshare");
    await page.click('button[type="submit"]');

    // The assertion that matters: a real confirmation, not the form still sitting
    // there and not an error banner. Before the org_id default was repaired this
    // is the step that failed while every page-level check stayed green.
    await expect(page.getByText(/thank you/i)).toBeVisible({ timeout: 15000 });
  });

  test("a money CTA lands on a form that names what was clicked", async ({ page }) => {
    await page.goto("/forms/lead-intake?offer=ecosystem");
    await expect(page.getByRole("heading", { name: /request details/i })).toBeVisible();
    await expect(page.getByText(/full done-for-you ecosystem/i)).toBeVisible();
    // Never the rental heading — that was the mismatch a $50K buyer used to see.
    await expect(page.getByRole("heading", { name: /vehicle rental inquiry/i })).toHaveCount(0);
  });

  test("an unknown or hostile offer value falls back, it does not crash", async ({ page }) => {
    // ?offer=__proto__ returned a 500 through a prototype-chain lookup.
    const res = await page.goto("/forms/lead-intake?offer=__proto__");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /vehicle rental inquiry/i })).toBeVisible();
  });

  test("a waitlisted renter can opt into other services", async ({ page }) => {
    await page.goto("/forms/waitlist");
    await expect(page.getByRole("heading", { name: /join the waitlist/i })).toBeVisible();

    await page.fill('input[name="customer_name"]', testName("WAIT"));
    await page.fill('input[name="customer_phone"]', "5715550112");

    // The cross-sell must be present and must NOT offer rentals to someone who
    // is already waiting for a rental.
    const services = page.locator('input[name="services"]');
    expect(await services.count()).toBeGreaterThan(3);
    await expect(page.locator('input[name="services"][value="rentals"]')).toHaveCount(0);

    await page.check('input[name="services"][value="moving"]');
    await page.check('input[name="services"][value="cleaning"]');
    await page.click('button[type="submit"]');

    await expect(page.getByText(/you're on the list/i)).toBeVisible({ timeout: 15000 });
  });

  test("opting into nothing is the default and stays possible", async ({ page }) => {
    // Consent is opt-in. A renter who ticks nothing must still get on the list,
    // and must not be enrolled in anything.
    await page.goto("/forms/waitlist");
    for (const box of await page.locator('input[name="services"]').all()) {
      await expect(box).not.toBeChecked();
    }
    await page.fill('input[name="customer_name"]', testName("NOOPT"));
    await page.fill('input[name="customer_phone"]', "5715550113");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/you're on the list/i)).toBeVisible({ timeout: 15000 });
  });

  test("no public page hands the visitor to the partner site", async ({ page }) => {
    for (const path of ["/forms/lead-intake", "/forms/waitlist", "/kits", "/dealers", "/try"]) {
      await page.goto(path);
      expect(page.url()).not.toContain("allinonemanagementsolutions");
      const partnerLinks = await page
        .locator('a[href*="allinonemanagementsolutions"]')
        .count();
      expect(partnerLinks, `partner link on ${path}`).toBe(0);
    }
  });
});
