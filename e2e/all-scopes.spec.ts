import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * Every scope of the app, checked from the outside.
 *
 * The renter journey has its own spec. This one covers the rest: that staff
 * surfaces are shut to the public, that machine surfaces answer, that every
 * public form renders, and — the part no page-level check catches — that the
 * database refuses an anonymous reader the things it must refuse.
 *
 * Read-only. Nothing here submits a form or writes a row; renter-journey.spec.ts
 * owns the write path and cleans up after itself.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Public forms — every one must render for a signed-out visitor. */
const PUBLIC_FORMS = [
  "apply", "academy-join", "operator-apply", "sovereign", "dealer-apply",
  "credit-funding-intake", "affiliates", "lead-intake", "appointment",
  "waitlist", "ticket", "customer-intake", "background-check",
  "express", "black", "auto-services", "auto-detailing", "moving",
  "cleaning", "wholesale-cars", "luxury", "restoration",
] as const;

/** Public marketing / funnel surfaces. */
const PUBLIC_PAGES = [
  "/", "/welcome", "/forms", "/kits", "/build", "/dealers", "/try", "/upgrade",
  "/login", "/no-access", "/partners/all-in-one", "/legal", "/legal/rental",
  "/legal/privacy", "/legal/sms", "/legal/credit", "/legal/funding",
  "/lp/tmmt_property/rental-in-a-box", "/lp/aixmos/lead-magnet",
] as const;

/**
 * Staff / owner surfaces. A signed-out visitor must be turned away from every
 * one — and turned away to a page that itself renders, never into a loop.
 */
const GATED_PAGES = [
  "/command", "/desk", "/customers", "/interfaces/vehicles", "/interfaces/contracts",
  "/interfaces/payments", "/interfaces/appointments", "/money", "/revenue",
  "/operator", "/vendor", "/investor", "/partner", "/executive", "/tasks",
  "/tickets", "/timesheets", "/va-queue", "/scorecard", "/whoami",
  "/work/admin", "/work/program", "/work/review", "/work/supervisor",
] as const;

test.describe("scope: public pages", () => {
  test("every public page renders for a signed-out visitor", async ({ page }) => {
    const broken: string[] = [];
    for (const path of PUBLIC_PAGES) {
      const res = await page.goto(path);
      const status = res?.status() ?? 0;
      if (status !== 200) broken.push(`${path} -> ${status}`);
    }
    expect(broken, `public pages not rendering: ${broken.join(", ")}`).toEqual([]);
  });

  test("no public page sends the visitor to the partner site", async ({ page }) => {
    const leaks: string[] = [];
    for (const path of PUBLIC_PAGES) {
      await page.goto(path);
      if (page.url().includes("allinonemanagementsolutions")) leaks.push(`${path} (url)`);
      const n = await page.locator('a[href*="allinonemanagementsolutions"]').count();
      if (n > 0) leaks.push(`${path} (${n} link)`);
    }
    expect(leaks, `partner leaks: ${leaks.join(", ")}`).toEqual([]);
  });
});

test.describe("scope: public forms", () => {
  test("every public form renders and carries a submit control", async ({ page }) => {
    const broken: string[] = [];
    for (const slug of PUBLIC_FORMS) {
      const res = await page.goto(`/forms/${slug}`);
      if (res?.status() !== 200) { broken.push(`${slug} -> ${res?.status()}`); continue; }
      // A form page with no way forward is a dead end dressed as a door. It may
      // submit itself, or — like /forms/affiliates, which is a pitch page — hand
      // off to another form that does. What it may not do is neither.
      const submits = await page.locator('button[type="submit"], input[type="submit"]').count();
      const handoff = await page.locator('a[href^="/forms/"]').count();
      if (submits === 0 && handoff === 0) broken.push(`${slug} (no submit and no hand-off)`);
    }
    expect(broken, `forms broken: ${broken.join(", ")}`).toEqual([]);
  });

  test("a pitch page's hand-off lands on a form that can actually submit", async ({ page }) => {
    // /forms/affiliates has no fields of its own; it sends people to /forms/apply.
    // A hand-off to a dead page would pass the check above while helping nobody.
    await page.goto("/forms/affiliates");
    const href = await page.locator('a[href^="/forms/"]').first().getAttribute("href");
    expect(href).toBeTruthy();
    const res = await page.goto(href!);
    expect(res?.status(), `hand-off target ${href}`).toBe(200);
    expect(await page.locator('button[type="submit"], input[type="submit"]').count()).toBeGreaterThan(0);
  });

  test("an unknown form slug 404s rather than rendering an empty shell", async ({ page }) => {
    const res = await page.goto("/forms/__not_a_real_form__");
    expect(res?.status()).toBe(404);
  });
});

test.describe("scope: staff surfaces are shut to the public", () => {
  test("every gated page turns a signed-out visitor away", async ({ page }) => {
    const open: string[] = [];
    for (const path of GATED_PAGES) {
      const res = await page.goto(path);
      const landed = new URL(page.url()).pathname;
      // Acceptable: bounced to /login or /no-access, or a 404. Not acceptable:
      // a 200 on the gated path itself.
      const bounced = landed === "/login" || landed === "/no-access";
      const notFound = res?.status() === 404;
      if (!bounced && !notFound) open.push(`${path} -> ${landed} (${res?.status()})`);
    }
    expect(open, `gated pages reachable signed-out: ${open.join(", ")}`).toEqual([]);
  });

  test("the sign-in page the gate points at actually renders", async ({ page }) => {
    // A gate that redirects to a broken page is a loop, not a gate.
    const res = await page.goto("/login");
    expect(res?.status()).toBe(200);
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});

test.describe("scope: machine surfaces", () => {
  test("health endpoints answer", async ({ request }) => {
    for (const p of ["/api/health", "/api/agent/health", "/api/agent/_health"]) {
      const res = await request.get(p);
      expect(res.status(), p).toBe(200);
    }
  });

  test("the lead webhook rejects a bodyless post instead of 500ing", async ({ request }) => {
    // A 3xx or 5xx here means GHL's payload evaporates.
    const res = await request.post("/api/leads/webhook", { data: {} });
    expect([400, 404, 422]).toContain(res.status());
  });

  test("an unknown org on the lead webhook 404s, it does not default", async ({ request }) => {
    const res = await request.post("/api/leads/webhook?org=__nope__", { data: { name: "x" } });
    expect(res.status()).toBe(404);
  });
});

/**
 * The database, asked directly as an anonymous visitor.
 *
 * Everything above talks to the app. These talk to Postgres the way a stranger
 * with the publishable key would — which is the only way to see what RLS and the
 * column grants actually permit.
 */
test.describe("scope: what an anonymous reader can reach", () => {
  test.skip(!SUPABASE_URL || !ANON_KEY, "supabase env not present");

  const get = (req: APIRequestContext, q: string) =>
    req.get(`${SUPABASE_URL}/rest/v1/${q}`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });

  test("customer and lead data is unreadable", async ({ request }) => {
    const readable: string[] = [];
    for (const t of [
      "incoming_leads", "waitlist", "active_customers", "customer_payments",
      "contracts", "people", "form_submissions", "customer_services",
      "background_checks", "tickets", "profiles", "cases", "documents",
    ]) {
      const res = await get(request, `${t}?select=*&limit=1`);
      const body = await res.text();
      // A 200 carrying rows means a stranger can read it.
      if (res.status() === 200 && body.trim() !== "[]") readable.push(`${t}: ${body.slice(0, 60)}`);
    }
    expect(readable, `anon can read: ${readable.join(" | ")}`).toEqual([]);
  });

  test("the fleet is browsable, but not its identity documents", async ({ request }) => {
    const ok = await get(request, "vehicles?select=label,make,model,year,weekly_rate&active=eq.true");
    expect(ok.status()).toBe(200);
    expect(JSON.parse(await ok.text()).length).toBeGreaterThan(0);

    for (const col of ["vin", "plate", "metadata", "*"]) {
      const res = await get(request, `vehicles?select=${encodeURIComponent(col)}&limit=1`);
      expect(res.status(), `anon read of vehicles.${col}`).toBe(401);
    }
  });

  test("an opt-in can be recorded, but never promoted past a request", async ({ request }) => {
    const post = (data: unknown) =>
      request.post(`${SUPABASE_URL}/rest/v1/customer_services`, {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        data,
      });

    // Each of these is an attempt to write a state the business grants.
    for (const bad of [
      { status: "active" },
      { status: "requested", tier: "vip" },
      { status: "requested", channel: "phone-call" },
      { status: "requested", org_id: "8e651b25-e7c8-4356-af64-1716a82053b0" },
    ]) {
      const res = await post([{
        customer_name: "ZZ_SCOPE_PROBE",
        service_slug: "moving",
        channel: "waitlist-form",
        opted_in_at: "2026-09-10T00:00:00Z",
        metadata: {},
        ...bad,
      }]);
      expect(res.status(), `should refuse ${JSON.stringify(bad)}`).toBe(401);
    }
  });
});
