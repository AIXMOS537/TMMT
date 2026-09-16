import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

/**
 * T-01 (docs/REMEDIATION_PLAN.md): the edge middleware is the first and only
 * gate every request passes before a page or route handler runs. These tests
 * pin down the four properties that matter:
 *
 *   1. PUBLIC PATHS  — the allowlist in `isPublicPath` / `isFunnelPublicPath`
 *      renders signed-out, and the pitch/webhook subset never touches Supabase.
 *   2. TIER MAP      — JWT `app_metadata.role` (the only role source the app
 *      reads, see src/lib/auth-roles.ts) decides which route group a signed-in
 *      user may reach, and which they may NOT.
 *   3. FAIL-CLOSED   — a Supabase outage, a missing env var, or an auth error
 *      is treated as signed-out: protected routes redirect, never 500, never
 *      grant.
 *   4. ORG HEADER    — `x-aixmos-org` (src/lib/platform/tenant-org.ts) is what
 *      RLS scopes data by. It must come from the host, never from the client.
 *
 * The middleware's path lists are module-private, so the public-path cases
 * below are a representative row per branch of `isPublicPath` and
 * `isFunnelPublicPath` in src/middleware.ts. Add a row there, add a row here.
 *
 * The Supabase double lives in vi.hoisted() because vi.mock factories are
 * hoisted above every other statement in the file.
 */

const h = vi.hoisted(() => {
  const getUser = vi.fn();
  const createMiddlewareClient = vi.fn(() => ({ auth: { getUser } }));
  const isRateLimited = vi.fn(() => false);
  return { getUser, createMiddlewareClient, isRateLimited };
});

vi.mock("@/lib/supabase-server", () => ({
  createMiddlewareClient: h.createMiddlewareClient,
}));

vi.mock("@/lib/rate-limit", () => ({
  isRateLimited: h.isRateLimited,
}));

import { middleware, config } from "./middleware";
import { ORG_HEADER, HOST_HEADER, HOUSE_ORG_IDS } from "@/lib/platform/tenant-org";
import { TENANT_HEADER } from "@/lib/platform/tenant-resolve";
import { OWNER_HUB_HOST, AIXMOS_PUBLIC_ORIGIN } from "@/lib/site-domains";

// A host that is neither a TMMT public host (no /credit bounce), nor the owner
// hub, nor a house brand (no static org). The plain case.
const NEUTRAL_HOST = "localhost:3000";
// A house host: resolves to the tmmt_property brand and the TMMT org uuid.
const TMMT_HOST = "tmmt-ops.vercel.app";

type ReqOpts = {
  host?: string;
  method?: string;
  headers?: Record<string, string>;
};

function req(path: string, opts: ReqOpts = {}) {
  const host = opts.host ?? NEUTRAL_HOST;
  return new NextRequest(`http://${host}${path}`, {
    method: opts.method ?? "GET",
    headers: { host, ...(opts.headers ?? {}) },
  });
}

function signedOut() {
  h.getUser.mockResolvedValue({ data: { user: null }, error: null });
}

function signedIn(role: string | undefined) {
  const user = {
    id: "user-1",
    app_metadata: role === undefined ? {} : { role },
  } as unknown as User;
  h.getUser.mockResolvedValue({ data: { user }, error: null });
}

/** Where the response sends the browser, as a path+query relative to the request. */
function redirectTarget(res: NextResponse): string | null {
  const loc = res.headers.get("location");
  if (!loc) return null;
  const u = new URL(loc);
  return `${u.pathname}${u.search}`;
}

function isPassThrough(res: NextResponse) {
  return res.status === 200 && res.headers.get("x-middleware-next") === "1";
}

/**
 * `NextResponse.next({ request: { headers } })` exposes the headers it will
 * forward to the route as `x-middleware-request-<name>`, and lists the full
 * forwarded set in `x-middleware-override-headers`. A header absent from that
 * list is NOT forwarded, whatever the client sent.
 */
function forwarded(res: NextResponse, name: string): string | null {
  return res.headers.get(`x-middleware-request-${name.toLowerCase()}`);
}
function forwardedNames(res: NextResponse): string[] {
  return (res.headers.get("x-middleware-override-headers") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  h.isRateLimited.mockReturnValue(false);
  h.createMiddlewareClient.mockImplementation(() => ({ auth: { getUser: h.getUser } }));
  signedOut();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

// ---------------------------------------------------------------------------
// 1. Public paths
// ---------------------------------------------------------------------------

describe("public paths render signed-out", () => {
  // One row per branch of isPublicPath / isFunnelPublicPath (src/middleware.ts).
  const PUBLIC_PATHS = [
    // isPublicPath
    "/login",
    "/login/reset",
    "/no-access", // the `none` landing; public so a stale session can never loop
    "/robots.txt",
    "/offline",
    "/manifest.webmanifest",
    "/kits",
    "/build",
    "/build/anything",
    "/explainer",
    "/forms",
    "/forms/intake",
    "/legal",
    "/legal/privacy",
    // A renter holding a staff-minted link has no account. If this ever stops
    // being public, every real visitor to their own status page is bounced to a
    // login they can never pass.
    "/status/d1111111-0000-4000-8000-000000000002",
    "/api/auth/callback",
    "/api/webhooks/ghl",
    "/api/forms/submit",
    "/api/agent/voice/ghl",
    // isFunnelPublicPath
    "/join",
    "/try",
    "/upgrade",
    "/dealers",
    "/credit",
    "/funding",
    "/lp/aixmos/intro-97",
    "/api/leads/webhook",
    "/api/health",
    "/api/agent/health",
    "/api/agent/_health",
    "/api/agent/sms/inbound",
    "/api/agent/stripe/webhook/slug",
    "/api/agent/cal/webhook/slug",
  ];

  it.each(PUBLIC_PATHS)("%s passes through with no session", async (path) => {
    const res = await middleware(req(path));
    expect(isPassThrough(res)).toBe(true);
    expect(res.headers.get("location")).toBeNull();
  });

  // The pitch/webhook subset must never run Supabase auth at all — a demo or a
  // Twilio/Stripe callback must not be able to 307 to /login on a Supabase
  // hiccup. See isPitchPublicPath.
  const PITCH_PATHS = [
    "/robots.txt",
    "/kits",
    "/build",
    "/build/x",
    "/dealers",
    "/explainer",
    "/forms/intake",
    "/legal/terms",
    "/api/webhooks/ghl",
    "/api/forms/submit",
    "/api/agent/sms/inbound",
    "/api/agent/stripe/webhook/slug",
    "/join",
    "/api/leads/webhook",
    "/api/health",
  ];

  it.each(PITCH_PATHS)("%s never constructs a Supabase client", async (path) => {
    h.createMiddlewareClient.mockImplementation(() => {
      throw new Error("must not be called for pitch/webhook paths");
    });
    const res = await middleware(req(path));
    expect(h.createMiddlewareClient).not.toHaveBeenCalled();
    expect(isPassThrough(res)).toBe(true);
  });

  it("/login is public but still runs the session check (so a signed-in user is sent home)", async () => {
    signedOut();
    const res = await middleware(req("/login"));
    expect(h.createMiddlewareClient).toHaveBeenCalledTimes(1);
    expect(isPassThrough(res)).toBe(true);
  });

  it("a public path is a prefix match, not a substring match", async () => {
    // "/legalese" would be caught by startsWith("/legal") — that IS the current
    // rule, so pin the narrower cases that must stay protected.
    for (const path of ["/loginx", "/kitsy", "/buildings", "/joined", "/api/healthz"]) {
      const res = await middleware(req(path));
      expect(redirectTarget(res), path).toBe("/login");
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Unauthenticated access to protected routes
// ---------------------------------------------------------------------------

describe("unauthenticated requests to protected routes", () => {
  it.each([
    "/customers",
    "/command",
    "/executive",
    "/operator",
    "/vendor",
    "/investor",
    "/partner",
    "/money",
    "/clock",
    "/pocket",
    "/api/pocket/chat",
    "/api/offline/merge",
    "/api/cron/anything",
    "/api/ops/command",
  ])("%s redirects to /login", async (path) => {
    const res = await middleware(req(path));
    expect(res.status).toBe(307);
    expect(redirectTarget(res)).toBe("/login");
  });

  it("the login redirect does not carry the original path or query", async () => {
    const res = await middleware(req("/customers/123?token=abc&secret=1"));
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/login");
    expect(loc.search).toBe("");
  });

  it("the front door (/) renders for anonymous visitors - no redirect at all", async () => {
    // History, in two steps. "/" used to redirect to the GHL marketing site,
    // which left the app with no reachable front door: the owner typed the
    // app's address and got marketing. That was changed to redirect to /login
    // instead, which was correct only because there was no front door to show.
    // There is one now (src/app/page.tsx), so "/" renders it.
    const res = await middleware(req("/"));
    expect(res.headers.get("location")).toBe(null);
    expect(res.status).toBe(200);
  });

  it("a signed-in visitor on / is sent to their own home, not the front door", async () => {
    // "/" used to BE the operator/staff home - the (admin) group's root page.
    // Now it is the public front door, so signed-in users are routed onward.
    // Two page.tsx resolving to "/" is also what Vercel refused to deploy.
    for (const [role, home] of [
      ["internal_team", "/desk"],
      ["admin", "/command"],
      ["vendor", "/vendor"],
    ] as const) {
      signedIn(role);
      const res = await middleware(req("/"));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname).toBe(home);
    }
    signedOut();
  });

  it("the intake forms are public - anonymous visitors are not sent to /login", async () => {
    for (const path of ["/intake", "/intake/rentals", "/intake/thanks"]) {
      const res = await middleware(req(path));
      expect(res.headers.get("location")).toBe(null);
      expect(res.status).toBe(200);
    }
  });

  it("the public front door does not leak the rest of the app", async () => {
    // "/" is public, "/customers" is not - isSignedOutFrontDoor matches the
    // root exactly, so nothing under it inherits the exemption.
    for (const path of ["/customers", "/command", "/money"]) {
      const res = await middleware(req(path));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    }
  });

  it("the public funnel paths still bounce to the GHL site", async () => {
    for (const path of ["/credit", "/funding"]) {
      // The bounce is host-gated (shouldBounceTmmtCreditToAixmos), so it only
      // fires on a real TMMT public host, not the neutral test host.
      const res = await middleware(req(path, { host: "tmmt-ops.vercel.app" }));
      expect(res.status).toBe(301);
      expect(res.headers.get("location")!.startsWith(AIXMOS_PUBLIC_ORIGIN)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Tier map — JWT app_metadata.role -> route groups
// ---------------------------------------------------------------------------

/**
 * Column = JWT role token (src/lib/auth-roles.ts AppRoleToken, plus the two
 * "unrecognised" cases that must fall to the `none` tier). Row = a route group.
 * `true` means the middleware lets the request through; `false` means it
 * redirects the user to their tier's home page.
 */
const ROLES = {
  admin: "owner",
  executive: "executive",
  executive_va: "executive",
  operator: "operator",
  vendor: "vendor",
  investor: "investor",
  partner: "investor",
  internal_team: "staff",
  va: "staff",
  customer: "none",
  garbage_role: "none",
  "(no role)": "none", // app_metadata.role absent altogether
} as const;

type RoleToken = keyof typeof ROLES;
const ROLE_TOKENS = Object.keys(ROLES) as RoleToken[];
const roleArg = (r: RoleToken) => (r === "(no role)" ? undefined : r);

const HOME: Record<(typeof ROLES)[RoleToken], string> = {
  owner: "/command",
  executive: "/executive",
  operator: "/desk",
  staff: "/desk",
  investor: "/investor",
  vendor: "/vendor",
  none: "/no-access",
};

/** Which TIERS may reach each route group. Everyone not listed is bounced home. */
const ROUTE_GROUPS: Array<{ path: string; allowed: Array<(typeof ROLES)[RoleToken]> }> = [
  { path: "/command", allowed: ["owner"] },
  { path: "/command/agents", allowed: ["owner"] },
  { path: "/operators", allowed: ["owner"] }, // owner's provisioning console, NOT the operator tier
  { path: "/money", allowed: ["owner"] },
  { path: "/money/ledger", allowed: ["owner"] },
  { path: "/executive", allowed: ["owner", "executive"] },
  { path: "/executive/reports", allowed: ["owner", "executive"] },
  { path: "/operator", allowed: ["owner", "operator"] },
  { path: "/operator/desk", allowed: ["owner", "operator"] },
  { path: "/vendor", allowed: ["owner", "vendor"] },
  { path: "/vendor/jobs", allowed: ["owner", "vendor"] },
  { path: "/investor", allowed: ["owner", "investor"] },
  { path: "/partner", allowed: ["owner", "investor"] },
  { path: "/partner/fleet", allowed: ["owner", "investor"] },
  // Rentals desk: everything not claimed by a portal prefix above. The `none`
  // tier is NOT on this list — see "the none tier lands on /no-access" below.
  { path: "/customers", allowed: ["owner", "executive", "operator", "staff"] },
  { path: "/fleet/units", allowed: ["owner", "executive", "operator", "staff"] },
  { path: "/api/cron/nightly", allowed: ["owner", "executive", "operator", "staff"] },
  // Everyone-surfaces: every signed-in tier, whatever the role.
  { path: "/clock", allowed: ["owner", "executive", "operator", "staff", "investor", "vendor", "none"] },
  { path: "/clock/punch", allowed: ["owner", "executive", "operator", "staff", "investor", "vendor", "none"] },
  { path: "/pocket", allowed: ["owner", "executive", "operator", "staff", "investor", "vendor", "none"] },
  { path: "/pocket/chat", allowed: ["owner", "executive", "operator", "staff", "investor", "vendor", "none"] },
  { path: "/api/pocket/chat", allowed: ["owner", "executive", "operator", "staff", "investor", "vendor", "none"] },
  { path: "/api/offline/merge", allowed: ["owner", "executive", "operator", "staff", "investor", "vendor", "none"] },
  // The refusal landing is public, so every tier passes (it renders "no
  // access" for `none`, and a way home for anyone who typed the URL).
  { path: "/no-access", allowed: ["owner", "executive", "operator", "staff", "investor", "vendor", "none"] },
];

describe("tier map: JWT app_metadata.role -> route group", () => {
  const cases = ROUTE_GROUPS.flatMap(({ path, allowed }) =>
    ROLE_TOKENS.map((role) => ({
      path,
      role,
      tier: ROLES[role],
      allowed: allowed.includes(ROLES[role]),
    })),
  );

  it.each(cases)(
    "role=$role (tier $tier) -> $path: allowed=$allowed",
    async ({ path, role, tier, allowed }) => {
      signedIn(roleArg(role));
      const res = await middleware(req(path));
      if (allowed) {
        expect(isPassThrough(res)).toBe(true);
        expect(res.headers.get("location")).toBeNull();
      } else {
        expect(res.status).toBe(307);
        expect(redirectTarget(res)).toBe(HOME[tier]);
      }
    },
  );

  it("a signed-in user hitting /login is sent to their tier's home", async () => {
    for (const role of ROLE_TOKENS) {
      signedIn(roleArg(role));
      const res = await middleware(req("/login"));
      expect(redirectTarget(res), role).toBe(HOME[ROLES[role]]);
    }
  });

  it("the role is read from app_metadata, never from user_metadata (client-writable)", async () => {
    // user_metadata is settable by the user through supabase.auth.updateUser();
    // a role planted there must not elevate.
    const user = {
      id: "user-1",
      app_metadata: {},
      user_metadata: { role: "admin" },
    } as unknown as User;
    h.getUser.mockResolvedValue({ data: { user }, error: null });
    const res = await middleware(req("/command"));
    expect(res.status).toBe(307);
    expect(redirectTarget(res)).toBe("/no-access");
  });

  it("a non-string app_metadata.role does not elevate", async () => {
    const user = {
      id: "user-1",
      app_metadata: { role: ["admin"] },
    } as unknown as User;
    h.getUser.mockResolvedValue({ data: { user }, error: null });
    const res = await middleware(req("/command"));
    expect(redirectTarget(res)).toBe("/no-access");
  });
});

/**
 * The `none` tier — signed in, no recognised role — is "entitled to nothing
 * beyond the public pages and the everyone-surfaces (/clock, /pocket)"
 * (src/lib/auth-roles.ts). The T-01 PR found the edge admitting it to the
 * rentals desk exactly like `staff`, with only the (admin) layout holding it
 * back, and pinned that with `it.fails` because a one-line deny was unsafe:
 * the tier's home was "/", itself a desk path, so the deny would have looped.
 *
 * Closed by giving the tier a real landing, /no-access, which the middleware
 * treats as public. These cases are the contract for that landing.
 */
describe("the none tier lands on /no-access", () => {
  const NONE_ROLES = ["customer", "garbage_role", undefined] as const;

  const DESK_PATHS = [
    "/",
    "/customers",
    "/customers/123",
    "/fleet/units",
    "/payments",
    "/background-checks",
    "/insurance",
    "/interfaces/vehicles",
    "/tickets",
    "/api/cron/nightly",
    "/api/ops/command",
  ];

  it.each(DESK_PATHS)("role-less user on %s -> 307 /no-access", async (path) => {
    for (const role of NONE_ROLES) {
      signedIn(role);
      const res = await middleware(req(path));
      expect(res.status, `role=${role}`).toBe(307);
      expect(redirectTarget(res), `role=${role}`).toBe("/no-access");
    }
  });

  it.each(["/command", "/executive", "/operator", "/vendor", "/investor", "/partner", "/money"])(
    "role-less user on the portal path %s -> 307 /no-access",
    async (path) => {
      signedIn("customer");
      const res = await middleware(req(path));
      expect(res.status).toBe(307);
      expect(redirectTarget(res)).toBe("/no-access");
    },
  );

  it.each(["/clock", "/clock/punch", "/pocket", "/pocket/chat", "/api/pocket/chat", "/api/offline/merge"])(
    "role-less user keeps the everyone-surface %s",
    async (path) => {
      for (const role of NONE_ROLES) {
        signedIn(role);
        const res = await middleware(req(path));
        expect(isPassThrough(res), `role=${role}`).toBe(true);
      }
    },
  );

  it("the redirect target itself passes through for the same user (no loop)", async () => {
    for (const role of NONE_ROLES) {
      signedIn(role);
      const first = await middleware(req("/"));
      expect(first.status, `role=${role}`).toBe(307);
      const second = await middleware(req(redirectTarget(first)!));
      expect(isPassThrough(second), `role=${role}`).toBe(true);
      expect(second.headers.get("location"), `role=${role}`).toBeNull();
    }
  });

  it("the redirect drops the original path and query", async () => {
    signedIn("customer");
    const res = await middleware(req("/customers/123?token=abc"));
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/no-access");
    expect(loc.search).toBe("");
  });

  it("/login sends a role-less user to /no-access, not to the desk", async () => {
    signedIn("customer");
    const res = await middleware(req("/login"));
    expect(redirectTarget(res)).toBe("/no-access");
  });

  it("/no-access is public: an anonymous visitor (stale session) renders it rather than looping", async () => {
    signedOut();
    const res = await middleware(req("/no-access"));
    expect(isPassThrough(res)).toBe(true);
    expect(res.headers.get("location")).toBeNull();
  });

  it("/no-access still runs the session check (the page shows who is signed in)", async () => {
    signedOut();
    await middleware(req("/no-access"));
    expect(h.createMiddlewareClient).toHaveBeenCalledTimes(1);
  });

  it("/no-access is an exact match; a sibling path is still protected", async () => {
    signedIn("customer");
    for (const path of ["/no-accessx", "/no-access/anything"]) {
      const res = await middleware(req(path));
      expect(res.status, path).toBe(307);
      expect(redirectTarget(res), path).toBe("/no-access");
    }
  });

  it("every other tier keeps the desk exactly as before", async () => {
    // Belt and braces on top of the tier map: the fix must not have widened
    // or narrowed anyone else.
    for (const role of ["internal_team", "va", "operator", "executive", "admin"]) {
      signedIn(role);
      const res = await middleware(req("/customers"));
      expect(isPassThrough(res), role).toBe(true);
    }
    for (const role of ["vendor", "investor", "partner"]) {
      signedIn(role);
      const res = await middleware(req("/customers"));
      expect(res.status, role).toBe(307);
      expect(redirectTarget(res), role).not.toBe("/no-access");
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Fail-closed when Supabase is unavailable
// ---------------------------------------------------------------------------

describe("fail-closed when Supabase errors", () => {
  const PROTECTED = ["/customers", "/command", "/clock", "/api/pocket/chat"];

  it.each(PROTECTED)("%s: client factory throws (missing env) -> redirect to /login, never 500", async (path) => {
    h.createMiddlewareClient.mockImplementation(() => {
      throw new Error("Missing required Supabase environment variables");
    });
    const res = await middleware(req(path));
    expect(res.status).toBe(307);
    expect(redirectTarget(res)).toBe("/login");
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it.each(PROTECTED)("%s: getUser rejects (network) -> redirect to /login, never 500", async (path) => {
    h.getUser.mockRejectedValue(new Error("fetch failed"));
    const res = await middleware(req(path));
    expect(res.status).toBe(307);
    expect(redirectTarget(res)).toBe("/login");
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it.each(PROTECTED)("%s: getUser returns an auth error -> treated as signed-out", async (path) => {
    h.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid JWT", status: 401 },
    });
    const res = await middleware(req(path));
    expect(res.status).toBe(307);
    expect(redirectTarget(res)).toBe("/login");
  });

  it("a Supabase failure still renders public (non-pitch) paths", async () => {
    h.getUser.mockRejectedValue(new Error("fetch failed"));
    for (const path of ["/login", "/offline", "/api/auth/callback"]) {
      const res = await middleware(req(path));
      expect(isPassThrough(res), path).toBe(true);
    }
  });

  it("the client is built from the live request and the response (so cookie refresh can be written back)", async () => {
    const request = req("/customers");
    const res = await middleware(request);
    expect(h.createMiddlewareClient).toHaveBeenCalledTimes(1);
    const [gotReq, gotRes] = h.createMiddlewareClient.mock.calls[0] as unknown as [NextRequest, NextResponse];
    expect(gotReq).toBe(request);
    expect(gotRes).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(307);
  });
});

// ---------------------------------------------------------------------------
// 5. Org / host / tenant headers cannot be spoofed by the client
// ---------------------------------------------------------------------------

describe("internal headers are set by the middleware, never trusted from the client", () => {
  const EVIL_ORG = "ffffffff-ffff-ffff-ffff-ffffffffffff";

  it(`strips an inbound ${ORG_HEADER} on a host with no static org`, async () => {
    signedIn("admin");
    const res = await middleware(req("/customers", { headers: { [ORG_HEADER]: EVIL_ORG } }));
    expect(isPassThrough(res)).toBe(true);
    expect(forwardedNames(res)).not.toContain(ORG_HEADER);
    expect(forwarded(res, ORG_HEADER)).toBeNull();
  });

  it(`overwrites an inbound ${ORG_HEADER} with the host's org on a house host`, async () => {
    signedIn("admin");
    const res = await middleware(
      req("/customers", { host: TMMT_HOST, headers: { [ORG_HEADER]: EVIL_ORG } }),
    );
    expect(isPassThrough(res)).toBe(true);
    expect(forwarded(res, ORG_HEADER)).toBe(HOUSE_ORG_IDS.tmmt);
    expect(forwarded(res, ORG_HEADER)).not.toBe(EVIL_ORG);
  });

  it(`sets ${ORG_HEADER} from the host even when the client sent none`, async () => {
    signedIn("admin");
    const res = await middleware(req("/customers", { host: TMMT_HOST }));
    expect(forwarded(res, ORG_HEADER)).toBe(HOUSE_ORG_IDS.tmmt);
  });

  it("an unknown host gets NO org header (no silent fallback to the house org)", async () => {
    signedIn("admin");
    const res = await middleware(req("/customers", { host: "tenant-xyz.example.com" }));
    expect(isPassThrough(res)).toBe(true);
    expect(forwardedNames(res)).not.toContain(ORG_HEADER);
  });

  it("the org header is stripped on public and pitch paths too", async () => {
    for (const path of ["/login", "/api/health", "/forms/intake"]) {
      const res = await middleware(req(path, { headers: { [ORG_HEADER]: EVIL_ORG } }));
      expect(forwardedNames(res), path).not.toContain(ORG_HEADER);
    }
  });

  it("a spoofed org header cannot rescue a request that fails auth", async () => {
    // Belt and braces: even if the header survived (it does not), the auth
    // decision is made on the session alone.
    const res = await middleware(
      req("/command", { host: TMMT_HOST, headers: { [ORG_HEADER]: HOUSE_ORG_IDS.aixmos } }),
    );
    expect(res.status).toBe(307);
    expect(redirectTarget(res)).toBe("/login");
  });

  it(`overwrites an inbound ${HOST_HEADER} with the normalized request host`, async () => {
    signedIn("admin");
    const res = await middleware(
      req("/customers", { host: "TMMT-OPS.vercel.app:443", headers: { [HOST_HEADER]: "evil.example" } }),
    );
    expect(forwarded(res, HOST_HEADER)).toBe("tmmt-ops.vercel.app");
  });

  it(`overwrites an inbound ${TENANT_HEADER} with the host-resolved brand`, async () => {
    signedIn("admin");
    const res = await middleware(
      req("/customers", { host: TMMT_HOST, headers: { [TENANT_HEADER]: "moe_legacy" } }),
    );
    expect(forwarded(res, TENANT_HEADER)).toBe("tmmt_property");
    expect(res.headers.get(TENANT_HEADER)).toBe("tmmt_property");
  });
});

// ---------------------------------------------------------------------------
// 6. Owner hub host
// ---------------------------------------------------------------------------

describe("owner hub host", () => {
  const hub = (path: string, headers?: Record<string, string>) =>
    req(path, { host: OWNER_HUB_HOST, headers });

  it("an owner on the hub front door goes to /command", async () => {
    signedIn("admin");
    const res = await middleware(hub("/"));
    expect(redirectTarget(res)).toBe("/command");
  });

  it("an owner on the hub /login goes to /command", async () => {
    signedIn("admin");
    const res = await middleware(hub("/login"));
    expect(redirectTarget(res)).toBe("/command");
  });

  const NON_OWNER_ROLES = ["executive", "operator", "vendor", "investor", "internal_team", "customer", undefined];

  it.each(NON_OWNER_ROLES)(
    "role=%s signed in on the hub is refused every protected path (-> /no-access?hub=owner)",
    async (role) => {
      signedIn(role);
      for (const path of ["/", "/customers", "/command", "/clock", "/pocket", "/executive", "/vendor", "/money"]) {
        const res = await middleware(hub(path));
        expect(res.status, path).toBe(307);
        expect(redirectTarget(res), path).toBe("/no-access?hub=owner");
      }
    },
  );

  /**
   * The old refusal target was /login?hub=owner. A signed-in user on /login is
   * itself the refused case, so that redirected to /login?hub=owner again —
   * ERR_TOO_MANY_REDIRECTS. Fail-closed, but as a loop rather than a message.
   */
  it.each(NON_OWNER_ROLES)(
    "role=%s signed in on the hub /login goes to /no-access?hub=owner, never back to /login",
    async (role) => {
      signedIn(role);
      const res = await middleware(hub("/login"));
      expect(res.status).toBe(307);
      expect(redirectTarget(res)).toBe("/no-access?hub=owner");
      expect(new URL(res.headers.get("location")!).pathname).not.toBe("/login");
    },
  );

  it.each(NON_OWNER_ROLES)(
    "role=%s: the refusal target renders for that same user on the hub (no loop)",
    async (role) => {
      signedIn(role);
      const first = await middleware(hub("/customers"));
      expect(first.status).toBe(307);
      const second = await middleware(hub(redirectTarget(first)!));
      expect(isPassThrough(second)).toBe(true);
      expect(second.headers.get("location")).toBeNull();
    },
  );

  it("a non-owner on the hub is refused /no-access's siblings (exact match only)", async () => {
    signedIn("executive");
    for (const path of ["/no-accessx", "/no-access/x"]) {
      const res = await middleware(hub(path));
      expect(redirectTarget(res), path).toBe("/no-access?hub=owner");
    }
  });

  it("an owner on the hub is unchanged: every path passes, /no-access included", async () => {
    signedIn("admin");
    for (const path of ["/command", "/customers", "/money", "/clock", "/no-access"]) {
      const res = await middleware(hub(path));
      expect(isPassThrough(res), path).toBe(true);
    }
  });

  it("an anonymous visitor on the hub is still sent to /login (no hub leakage)", async () => {
    const res = await middleware(hub("/command"));
    expect(redirectTarget(res)).toBe("/login");
  });

  it("the hub host is not a house brand, so it forwards no org header", async () => {
    signedIn("admin");
    const res = await middleware(hub("/command"));
    expect(isPassThrough(res)).toBe(true);
    expect(forwardedNames(res)).not.toContain(ORG_HEADER);
  });
});

// ---------------------------------------------------------------------------
// 7. Other security-relevant behaviour
// ---------------------------------------------------------------------------

describe("response hygiene", () => {
  it("every response carries a noindex X-Robots-Tag", async () => {
    signedOut();
    const anon = await middleware(req("/customers")); // redirect
    const pub = await middleware(req("/api/health")); // pitch pass-through
    const login = await middleware(req("/login")); // auth'd pass-through
    signedIn("admin");
    const ok = await middleware(req("/command")); // allowed
    signedIn("customer");
    const denied = await middleware(req("/customers")); // none -> /no-access
    const landing = await middleware(req("/no-access")); // the landing itself
    const hubRefusal = await middleware(req("/customers", { host: OWNER_HUB_HOST }));
    for (const res of [anon, pub, login, ok, denied, landing, hubRefusal]) {
      expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    }
  });

  it("the tenant header is stamped on the response and the forwarded request", async () => {
    signedIn("admin");
    const res = await middleware(req("/command", { host: TMMT_HOST }));
    expect(res.headers.get(TENANT_HEADER)).toBe("tmmt_property");
    expect(forwarded(res, TENANT_HEADER)).toBe("tmmt_property");
  });
});

describe("/forms POST rate limit", () => {
  it("rate-limits by the first x-forwarded-for hop and returns 429", async () => {
    h.isRateLimited.mockReturnValue(true);
    const res = await middleware(
      req("/forms/intake", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
      }),
    );
    expect(res.status).toBe(429);
    expect(h.isRateLimited).toHaveBeenCalledWith("203.0.113.9");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    await expect(res.json()).resolves.toEqual({
      error: "Too many submissions. Please try again later.",
    });
  });

  it("falls back to 'unknown' when no forwarded IP is present", async () => {
    h.isRateLimited.mockReturnValue(true);
    const res = await middleware(req("/forms/intake", { method: "POST" }));
    expect(res.status).toBe(429);
    expect(h.isRateLimited).toHaveBeenCalledWith("unknown");
  });

  it("does not consult the limiter for GET /forms or for POST elsewhere", async () => {
    await middleware(req("/forms/intake"));
    await middleware(req("/api/forms/submit", { method: "POST" }));
    expect(h.isRateLimited).not.toHaveBeenCalled();
  });
});

describe("marketing entry points on a TMMT public host bounce to the public site", () => {
  it.each(["/credit", "/funding", "/lp/aixmos/intro-97", "/lp/moe-legacy/lead-magnet"])(
    "%s -> 301 to the AIXMOS public site",
    async (path) => {
      const res = await middleware(req(path, { host: TMMT_HOST }));
      expect(res.status).toBe(301);
      expect(res.headers.get("location")!.startsWith(`${AIXMOS_PUBLIC_ORIGIN}/`)).toBe(true);
      expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
      expect(h.createMiddlewareClient).not.toHaveBeenCalled();
    },
  );

  it("is skipped when the public site proxied the request (x-forwarded-host)", async () => {
    const res = await middleware(
      req("/credit", { host: TMMT_HOST, headers: { "x-forwarded-host": "allinonemanagementsolutions.com" } }),
    );
    expect(isPassThrough(res)).toBe(true);
  });

  it("does not bounce on a non-TMMT host", async () => {
    const res = await middleware(req("/credit"));
    expect(isPassThrough(res)).toBe(true);
  });
});

describe("matcher config", () => {
  const patterns = config.matcher.map((m) => new RegExp(`^${m}$`));
  const matches = (path: string) => patterns.some((re) => re.test(path));

  it("runs on the front door and app routes", () => {
    for (const p of ["/", "/customers", "/api/cron/x", "/command", "/login"]) {
      expect(matches(p), p).toBe(true);
    }
  });

  it("skips Next internals and static assets", () => {
    for (const p of [
      "/_next/static/chunk.js",
      "/_next/image",
      "/favicon.ico",
      "/logo.png",
      "/styles.css",
      "/robots.txt",
    ]) {
      expect(matches(p), p).toBe(false);
    }
  });
});
