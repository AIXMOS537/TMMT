#!/usr/bin/env node
/**
 * probe-prod — the honest production gate.
 *
 * Replaces the old scripts/smoke-prod.sh, which accepted 307/308 as "OK". That
 * leniency is why a lead webhook that redirected to /login sat undetected: a
 * 307 on POST /api/leads/webhook means GoHighLevel's payload is thrown away and
 * the lead is lost silently. Here every route declares the status it must
 * return, and a redirect to /login on a public funnel route is a hard failure.
 *
 *   node scripts/probe-prod.mjs
 *   PROBE_BASE_URL=https://preview.example node scripts/probe-prod.mjs
 *   node scripts/probe-prod.mjs --json
 */

const BASE = (process.env.PROBE_BASE_URL || "https://tmmt-ops.vercel.app").replace(/\/$/, "");
const JSON_OUT = process.argv.includes("--json");
const TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS || 20000);

/**
 * Every check is explicit. `expect` lists acceptable statuses; `redirectTo`
 * pins where a legitimate redirect is allowed to land. Anything landing on
 * /login that is not supposed to is a revenue-losing regression.
 */
const CHECKS = [
  // --- Revenue funnel: must be publicly reachable, never auth-walled. ---
  { name: "kits (dealer demo)", path: "/kits", expect: [200] },
  { name: "build page", path: "/build", expect: [200] },
  { name: "join (operator funnel)", path: "/join", expect: [200] },
  { name: "dealers (dealer funnel)", path: "/dealers", expect: [200] },
  { name: "aixmos lead magnet", path: "/lp/aixmos/lead-magnet", expect: [200] },
  { name: "credit intake form", path: "/forms/credit-funding-intake", expect: [200] },

  // Shortlink aliases legitimately redirect, but only to the intake form.
  { name: "credit shortlink", path: "/credit", expect: [307, 308], redirectTo: "/forms/credit-funding-intake" },
  { name: "funding shortlink", path: "/funding", expect: [307, 308], redirectTo: "/forms/credit-funding-intake" },

  // --- Machine surfaces: a redirect here is data loss, not a nuisance. ---
  { name: "agent health", path: "/api/agent/_health", expect: [200] },
  { name: "app health", path: "/api/health", expect: [200] },
  {
    // Routing check. No ?org= slug, so the handler must reject with 400 before
    // touching the database. A 3xx here means GHL's payload evaporates.
    name: "LEAD WEBHOOK routing",
    path: "/api/leads/webhook",
    method: "POST",
    body: { probe: true, source: "probe-prod" },
    expect: [400],
    critical: true,
  },
  {
    // Dependency check. A slug that cannot exist forces the handler through
    // resolveOrgBySlugPublic(), which uses the service-role Supabase client.
    // 404 proves the DB was actually queried and answered. 500 means
    // SUPABASE_SERVICE_ROLE_KEY is missing or wrong — leads would be lost even
    // though routing looks fine. No row is ever written, so prod stays clean.
    name: "LEAD WEBHOOK → Supabase",
    path: "/api/leads/webhook?org=__probe_nonexistent__",
    method: "POST",
    body: { phone: "5555550100", source: "probe-prod" },
    expect: [404],
    critical: true,
  },

  // --- Auth boundary: these SHOULD bounce to /login. Verifies the gate works. ---
  { name: "command (owner only)", path: "/command", expect: [307, 308], redirectTo: "/login" },
];

async function probe(check) {
  const url = `${BASE}${check.path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: check.method || "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: check.body ? { "content-type": "application/json" } : undefined,
      body: check.body ? JSON.stringify(check.body) : undefined,
    });
    const location = res.headers.get("location");
    return { status: res.status, location };
  } catch (err) {
    return { status: 0, error: err.name === "AbortError" ? `timeout after ${TIMEOUT_MS}ms` : err.message };
  } finally {
    clearTimeout(timer);
  }
}

function evaluate(check, result) {
  if (result.status === 0) return { ok: false, why: result.error || "request failed" };

  if (!check.expect.includes(result.status)) {
    const landed = result.location ? ` → ${result.location}` : "";
    // Name the specific failure mode so the log is self-explanatory at 2am.
    if ([301, 302, 307, 308].includes(result.status) && /\/login/.test(result.location || "")) {
      return { ok: false, why: `AUTH-WALLED: expected ${check.expect.join("/")}, got ${result.status}${landed}` };
    }
    return { ok: false, why: `expected ${check.expect.join("/")}, got ${result.status}${landed}` };
  }

  if (check.redirectTo) {
    const loc = result.location || "";
    if (!loc.startsWith(check.redirectTo)) {
      return { ok: false, why: `redirect should land on ${check.redirectTo}, landed on ${loc || "(no location)"}` };
    }
  }
  return { ok: true };
}

const RED = "\x1b[31m", GREEN = "\x1b[32m", BOLD = "\x1b[1m", DIM = "\x1b[2m", OFF = "\x1b[0m";

async function main() {
  const results = [];
  // Sequential on purpose: parallel bursts can trip the edge rate limiter and
  // produce false failures, which would make this gate untrustworthy.
  for (const check of CHECKS) {
    const raw = await probe(check);
    const verdict = evaluate(check, raw);
    results.push({ ...check, ...raw, ...verdict });
  }

  const failures = results.filter((r) => !r.ok);
  const criticalFailures = failures.filter((r) => r.critical);

  if (JSON_OUT) {
    console.log(JSON.stringify({ base: BASE, at: new Date().toISOString(), results, failed: failures.length }, null, 2));
  } else {
    console.log(`${BOLD}Probing ${BASE}${OFF}\n`);
    for (const r of results) {
      const mark = r.ok ? `${GREEN}PASS${OFF}` : `${RED}FAIL${OFF}`;
      const method = (r.method || "GET").padEnd(4);
      console.log(`${mark}  ${method} ${r.path.padEnd(34)} ${r.ok ? `${DIM}${r.status}${OFF}` : `${RED}${r.why}${OFF}`}`);
    }
    console.log("");
    if (failures.length === 0) {
      console.log(`${GREEN}${BOLD}✓ ALL ${results.length} CHECKS PASSED — production is serving correctly.${OFF}`);
    } else {
      console.log(`${RED}${BOLD}✗ ${failures.length}/${results.length} CHECKS FAILED${OFF}`);
      if (criticalFailures.length) {
        console.log(`${RED}${BOLD}  ⚠ ${criticalFailures.length} CRITICAL — leads are being dropped right now.${OFF}`);
      }
    }
  }

  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`${RED}probe crashed:${OFF}`, err);
  process.exit(2);
});
