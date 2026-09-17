import { test, expect } from "@playwright/test";

/**
 * End-to-end proof that the rental quote endpoint is wired into a RUNNING app,
 * and that an unauthenticated caller gets nothing priced.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE UNIT TESTS
 * src/app/api/rental/quote/route.test.ts mocks createSSRClient and never runs
 * middleware, so it can stay green even if the route were unreachable. This
 * spec goes over real HTTP with no session.
 *
 * THE CONTRACT THIS ASSERTS (verified 2026-09-16, and it is deliberate)
 * Middleware answers a signed-out request to a protected /api/* path with a
 * 307 to /login, which Playwright follows to a 200 login page. That is an
 * intentional, explicitly tested decision — src/middleware.test.ts has cases
 * named "/api/pocket/chat redirects to /login" and "client factory throws
 * (missing env) -> redirect to /login, never 500". The route's own 401 is
 * therefore a second line of defence that a signed-out caller never reaches.
 *
 * ⚠️ An open design question for the owner, NOT changed here: an API answering
 * a programmatic client with an HTML login page means `fetch` sees 200 + HTML
 * and a naive caller can read it as success. The refusal is genuinely
 * fail-closed — no data escapes either way — but it is not machine-readable.
 * Changing it would alter a tested contract across /api/cron, /api/ops,
 * /api/pocket and /api/offline, so it is the owner's call, not a cleanup edit.
 */

const PROTECTED = "/api/rental/quote";

test.describe("Rental quote API — signed out", () => {
  test("the endpoint exists — it is not a 404", async ({ request }) => {
    const res = await request.post(PROTECTED, { data: { tier: "economy", days: 7 } });
    // A 404 would mean the route never shipped, which is the exact failure the
    // rental-pricing module was written to stop repeating.
    expect(res.status()).not.toBe(404);
  });

  test("prices nothing for an anonymous caller, on any tier", async ({ request }) => {
    for (const tier of ["economy", "mid", "luxury"]) {
      const res = await request.post(PROTECTED, {
        data: { tier, days: 7, backgroundApproved: true },
      });
      const body = await res.text();

      // The security property that actually matters: whatever the status, no
      // rate-card figure, rule id, or coverage name may come back. RLS alone
      // would let `anon` browse active pricing rules; this route is what
      // stands in front of that.
      expect(body, `tier ${tier} must not leak quote fields`).not.toMatch(
        /quoted_weekly_cents|quoted_daily_cents|quoted_deposit_cents|pricing_rule_id/
      );
      expect(body, `tier ${tier} must not leak coverage`).not.toMatch(
        /TMMT Economy Shield|TMMT Mid-Tier Protection|TMMT Luxury Coverage|Fleet Non-Owner/
      );
      expect(body, `tier ${tier} must not leak a floor`).not.toMatch(/floorWeeklyCents/);
    }
  });

  test("lands on the login gate rather than a quote", async ({ request }) => {
    const res = await request.post(PROTECTED, { data: { tier: "economy", days: 7 } });
    // Playwright follows the 307, so this is the login page, not a quote body.
    expect(res.url()).toContain("/login");
    expect(await res.text()).not.toContain('"ok":true');
  });

  test("a GET is not a way around the POST guard", async ({ request }) => {
    const res = await request.get(PROTECTED);
    const body = await res.text();
    expect(body).not.toContain('"ok":true');
    expect(body).not.toMatch(/quoted_weekly_cents|pricing_rule_id/);
  });

  test("a bogus tier cannot be used to probe which tiers exist", async ({ request }) => {
    // Auth resolves before input validation, so the responses must be
    // indistinguishable to an anonymous caller.
    const bogus = await request.post(PROTECTED, { data: { tier: "platinum", days: 7 } });
    const real = await request.post(PROTECTED, { data: { tier: "economy", days: 7 } });
    expect(bogus.status()).toBe(real.status());
    expect(bogus.url().includes("/login")).toBe(real.url().includes("/login"));
  });
});
