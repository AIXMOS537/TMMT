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

/**
 * Each test presents a distinct client IP.
 *
 * The form rate limiter allows five POSTs per IP per hour and the server keeps
 * that map in memory across runs, so a suite that submits several forms exhausts
 * its own budget and the last test fails on a 429 that has nothing to do with the
 * code under test. Separating the IPs measures the app instead of the bucket —
 * and the limiter itself is covered deliberately, below.
 */
let ipCounter = 0;
test.beforeEach(async ({ context }) => {
  // No effect against a real deployment — Vercel overwrites this header. Kept for
  // local runs, where it is what stops the suite exhausting its own budget.
  ipCounter += 1;
  await context.setExtraHTTPHeaders({ "X-Forwarded-For": `198.51.100.${ipCounter}` });
});

test.describe("renter journey", () => {
  test("the front door at / is a rental page, not a staff sign-in", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);

    // The URL must stay on the brand's own address — this is a rewrite, so a
    // redirect to /login or /welcome would both be failures here.
    expect(new URL(page.url()).pathname).toBe("/");

    await expect(
      page.getByRole("heading", { name: /weekly car rental for rideshare/i }),
    ).toBeVisible();
    // The sign-in door still exists, but as staff furniture, not the main event.
    await expect(page.getByRole("link", { name: /staff sign in/i })).toBeVisible();
  });

  test("the front door offers both ways in, and both work", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /^rent a car$/i }).first().click();
    await expect(page).toHaveURL(/\/forms\/lead-intake/);

    await page.goto("/");
    await page.getByRole("link", { name: /^join the waitlist$/i }).first().click();
    await expect(page).toHaveURL(/\/forms\/waitlist/);
  });

  test("the front door shows the real fleet, and never a fabricated price", async ({ page }) => {
    await page.goto("/");
    const body = (await page.textContent("body")) ?? "";
    // Whatever it says about money must not be a zero standing in for "unknown".
    expect(body).not.toMatch(/\$0\s*\/\s*week/);
    // It must be honest that this is not a live availability board.
    expect(body).toMatch(/not a live availability board|Nothing is on the lot|can't load the fleet/i);
  });

  test("the front door never leaks vehicle identity documents", async ({ page }) => {
    await page.goto("/");
    const body = (await page.textContent("body")) ?? "";
    // VIN is 17 chars; plates were readable until the column grants landed.
    expect(body).not.toMatch(/[A-HJ-NPR-Z0-9]{17}/);
    expect(body).not.toContain("6GJ4314");
    expect(body).not.toContain("SXM3874");
  });

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

  test("the form rate limiter fires, and only after a real burst", async ({ request }) => {
    // Local only. Vercel replaces x-forwarded-for with the true client IP — which
    // is correct, and is exactly why the header cannot be spoofed to get a clean
    // bucket against production. Run there, every request in the suite shares the
    // runner's real address and the limiter trips on a burst it did not cause.
    test.skip(
      !!process.env.AUDIT_BASE_URL && !process.env.AUDIT_BASE_URL.includes("localhost"),
      "rate-limit test needs a spoofable client IP; run it against localhost",
    );

    // A limiter nobody has watched refuse is not a control. Five go through from
    // one address, the sixth does not.
    // A fresh address per run: the limiter's map lives in the server process and
    // survives between runs, so a fixed IP would arrive already spent and the
    // test would "pass" on a 429 it did not cause.
    const ip = `203.0.113.${(Date.now() % 200) + 20}`;
    const codes: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const res = await request.post("/forms/waitlist", {
        headers: { "X-Forwarded-For": ip, "Content-Type": "application/json" },
        data: {},
      });
      codes.push(res.status());
    }
    expect(codes.slice(0, 5).every((c) => c !== 429), `first five: ${codes}`).toBe(true);
    expect(codes[5], `sixth should be refused: ${codes}`).toBe(429);
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
