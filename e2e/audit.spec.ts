import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ALL_ROUTES, PUBLIC_ROUTES } from "./audit/routes";
import { recordRoute, isNoise, type Finding, type RouteResult } from "./audit/record";

/**
 * Full-app route crawl.
 *
 * Visits every route the app actually ships, watches the page the way a person
 * would — did it render, did anything throw, did the data arrive — and writes
 * one machine-readable record per route for `npm run audit:report`.
 *
 * Runs twice over the same route list: once signed out (proving the auth gate
 * holds) and once signed in when credentials are available (proving the admin
 * pages actually work). The signed-in pass is skipped, not failed, when no
 * storage state exists, so the harness is useful before auth is wired up.
 */

const AUTH_STATE = path.join(process.cwd(), "audit", ".auth", "admin.json");
const SCREENS = path.join(process.cwd(), "audit", "screens");
const authed = fs.existsSync(AUTH_STATE);

// Deliberately NOT serial mode: a serial group stops at the first failure, and
// a survey that quits on route 1 is useless. `workers: 1` in the config already
// guarantees the single-writer ordering the NDJSON log needs.
//
// The results log is cleared by the `audit:crawl` npm script, NOT here.
// Playwright restarts its worker after a test times out, and that re-runs
// beforeAll — clearing the log here silently truncated it mid-run and threw
// away every route recorded before the first timeout.
test.beforeAll(() => {
  fs.mkdirSync(SCREENS, { recursive: true });
});

// Routes that reached the end of their test body and wrote their own record.
const recorded = new Set<string>();

// A timed-out test is killed mid-body, so it never reaches recordRoute() and
// would vanish from the report entirely — the most broken routes silently
// missing from the findings. Record them here instead: a page that cannot
// finish loading inside the timeout is a blocker, not an absence.
test.afterEach(({}, testInfo) => {
  const route = testInfo.title.replace(/^audit /, "");
  if (recorded.has(route)) return;
  recordRoute({
    route,
    authed,
    status: null,
    finalUrl: route,
    title: null,
    h1: null,
    loadMs: testInfo.duration,
    findings: [
      {
        route,
        authed,
        severity: "blocker",
        kind: testInfo.status === "timedOut" ? "load-timeout" : "crawl-aborted",
        detail:
          testInfo.status === "timedOut"
            ? `Page never finished loading within ${testInfo.timeout}ms.`
            : `Crawl aborted: ${testInfo.status}. ${testInfo.error?.message?.slice(0, 200) ?? ""}`,
      },
    ],
  });
});

if (authed) test.use({ storageState: AUTH_STATE });

for (const route of ALL_ROUTES) {
  test(`audit ${route}`, async ({ page }) => {
    const findings: Finding[] = [];
    const add = (severity: Finding["severity"], kind: string, detail: string) =>
      findings.push({ route, authed, severity, kind, detail });

    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const text = m.text();
      if (isNoise(text)) return;
      add("broken", "console-error", text.slice(0, 400));
    });

    // An uncaught exception means the React tree threw — the user sees a blank
    // page or an error boundary, so this outranks everything else on the page.
    page.on("pageerror", (e) => add("blocker", "uncaught-exception", e.message.slice(0, 400)));

    page.on("response", (r) => {
      if (r.status() < 400) return;
      if (isNoise(r.url())) return;
      // A Supabase REST failure is the difference between "page rendered" and
      // "page rendered empty" — call it out separately from any other 4xx.
      const kind = r.url().includes("/rest/v1/") ? "supabase-request-failed" : "http-error";
      add(r.status() >= 500 ? "blocker" : "broken", kind, `${r.status()} ${r.url().slice(0, 300)}`);
    });

    const started = Date.now();
    const response = await page.goto(route, { waitUntil: "domcontentloaded" }).catch(() => null);

    // Client pages fetch on mount; give the network a beat to settle before
    // judging whether the data arrived. networkidle can hang on dev-mode HMR
    // sockets, so this is a bounded wait rather than a hard expectation.
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    const loadMs = Date.now() - started;

    const finalUrl = new URL(page.url()).pathname;
    const isPublic = PUBLIC_ROUTES.has(route);
    const redirectedToLogin = finalUrl.startsWith("/login") && route !== "/login";

    if (redirectedToLogin) {
      if (authed) {
        add("blocker", "session-lost", "Signed-in crawl was bounced to /login — session did not hold.");
      } else if (isPublic) {
        add("blocker", "public-route-gated", "Public route redirected to /login — form is unreachable by customers.");
      }
      // Signed-out + admin route = the auth gate doing its job. Not a finding.
    }

    if (!redirectedToLogin) {
      if (response && response.status() >= 400) {
        add("blocker", "bad-status", `Route returned HTTP ${response.status()}`);
      }

      // The explicit timeout is load-bearing. textContent() auto-waits for the
      // element to exist, so on a page with no <h1> it blocks until the whole
      // test times out — the check meant to REPORT a missing h1 was instead
      // hanging on it, and the route vanished from the report.
      const h1 = await page
        .locator("h1")
        .first()
        .textContent({ timeout: 2000 })
        .catch(() => null);
      if (!h1?.trim()) add("warning", "no-h1", "Page has no <h1> — breaks screen-reader and SEO structure.");

      // The app's own failure surface (ErrorBanner in src/components/ui.tsx).
      // If this is visible the page loaded but the data behind it did not.
      // Matching on the red background alone caught red-tinted StatCards too,
      // so require the banner's text colour as well — that pair is unique to it.
      const banner = page.locator("div.bg-red-50.text-red-700, div.text-red-700.bg-red-50").first();
      if (await banner.isVisible().catch(() => false)) {
        const text = (await banner.textContent().catch(() => "")) ?? "";
        add("broken", "error-banner", `Visible error banner: ${text.trim().slice(0, 200)}`);
      }

      // A spinner still on screen after the network settled means the fetch
      // never resolved and never rejected — the page is stuck, not slow.
      const spinner = page.locator(".animate-spin").first();
      if (await spinner.isVisible().catch(() => false)) {
        add("broken", "stuck-loading", "Loading spinner still visible after network idle — fetch never settled.");
      }

      if (await page.locator("text=No records found").first().isVisible().catch(() => false)) {
        add("info", "empty-table", "Table rendered with no rows.");
      }

      const slug = route === "/" ? "root" : route.replace(/\//g, "_").replace(/^_/, "");
      await page
        .screenshot({ path: path.join(SCREENS, `${authed ? "authed" : "anon"}-${slug}.png`), fullPage: true })
        .catch(() => {});
    }

    const result: RouteResult = {
      route,
      authed,
      status: response?.status() ?? null,
      finalUrl,
      title: await page.title().catch(() => null),
      h1: null,
      loadMs,
      findings,
    };
    recordRoute(result);
    recorded.add(route);

    // The crawl is a survey, not a gate: a broken page is data to report, not a
    // reason to abort the remaining routes. Only blockers fail the run so CI
    // still goes red on something genuinely unshippable.
    const blockers = findings.filter((f) => f.severity === "blocker");
    expect(blockers, blockers.map((b) => `${b.kind}: ${b.detail}`).join("\n")).toEqual([]);
  });
}
