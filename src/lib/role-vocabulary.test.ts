import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { User } from "@supabase/supabase-js";
import {
  ACCESS_TIERS,
  APP_ROLE_TOKENS,
  getTierForUser,
  isAppRoleToken,
  type AccessTier,
} from "./auth-roles";
import {
  DB_PORTAL_ROLES,
  DB_USER_ROLES,
  ORG_ROLE,
  ORG_ROLES,
  isDbUserRole,
  isOrgRole,
} from "./db-vocab";
import { USER_ROLES } from "./workflow/statuses";
import { seatPlanForStage, type VerticalSeatStage } from "./verticals/registry";

const ROOT = process.cwd();

/**
 * Live database facts, read from PRODUCTION on 2026-09-08 21:40 (read-only
 * query, remediation F-15). Tests cannot reach the DB, so these pin app-vs-DB
 * parity offline. When the schema changes, re-run the queries below, update
 * this constant AND the constants in src/lib/db-vocab.ts, and bump the date.
 *
 *   select enum_range(null::public.user_role);
 *   select enum_range(null::public.portal_role);
 *   select enum_range(null::public.license_tier);
 *   select conrelid::regclass, pg_get_constraintdef(oid)
 *     from pg_constraint where contype = 'c'
 *      and conrelid in ('public.org_roles'::regclass,
 *                       'public.hailmary_licenses'::regclass,
 *                       'public.tmmt_token_ledger'::regclass,
 *                       'public.credit_funding_sessions'::regclass);
 *   select distinct role from public.profiles;
 *
 * The user_role enum has no migration file in the repo (195 applied migrations
 * have none — supabase/schema/README.md), so this constant is its only pin.
 * The org_roles CHECK does have one, and is parsed out of it below.
 */
const DB_FACTS_2026_09_08 = {
  /** enum public.user_role — column profiles.role */
  user_role: ["admin", "internal_team", "investor", "vendor", "customer"],
  /** distinct profiles.role values actually present in rows that day */
  profiles_role_in_use: ["admin", "customer"],
  /** enum public.portal_role */
  portal_role: ["client", "team_member", "manager", "admin", "super_admin"],
  /** org_roles.role is text with this CHECK */
  org_roles_check: ["tenant_admin", "dispatcher", "responder", "viewer"],
  // The following are recorded for completeness; they are tier vocabularies
  // that are NOT roles and are not modelled in db-vocab.ts (see its header).
  /** enum public.license_tier */
  license_tier: ["rentals_app", "full_os", "custom"],
  hailmary_licenses_tier_check: ["taste", "starter", "operator", "flagship"],
  tmmt_token_ledger_tier_check: ["FREE", "OPERATOR", "FOUNDER"],
  credit_funding_sessions_routing_tier_check: ["education", "guidance", "pre_referral", "introduction"],
} as const;

const ORG_ROLES_MIGRATION = "supabase/migrations/20260530120000_rescue_dispatch_core.sql";

function userWithRole(role?: string): User {
  return { app_metadata: role ? { role } : {} } as unknown as User;
}

// ---------------------------------------------------------------------------
// App role tokens (JWT app_metadata.role) — src/lib/auth-roles.ts is the source
// ---------------------------------------------------------------------------

describe("APP_ROLE_TOKENS", () => {
  it("is the ten JWT role tokens, spelled exactly as app_metadata.role carries them", () => {
    // These are live JWT values and DB rows. Changing one is a data migration,
    // not a refactor. Order matches the source so a diff reads naturally.
    expect([...APP_ROLE_TOKENS]).toEqual([
      "admin",
      "internal_team",
      "va",
      "executive_va",
      "executive",
      "operator",
      "investor",
      "partner",
      "vendor",
      "customer",
    ]);
    expect(new Set(APP_ROLE_TOKENS).size).toBe(APP_ROLE_TOKENS.length);
  });

  it("isAppRoleToken accepts the vocabulary and rejects everything else", () => {
    for (const t of APP_ROLE_TOKENS) expect(isAppRoleToken(t)).toBe(true);
    expect(isAppRoleToken("Admin")).toBe(false); // case matters on the wire
    expect(isAppRoleToken("staff")).toBe(false); // a tier, not a token
    expect(isAppRoleToken("owner")).toBe(false); // a tier, not a token
    expect(isAppRoleToken("")).toBe(false);
    expect(isAppRoleToken(null)).toBe(false);
    expect(isAppRoleToken(undefined)).toBe(false);
    expect(isAppRoleToken(1)).toBe(false);
  });
});

describe("ACCESS_TIERS", () => {
  it("lists the seven tiers, with none last as the fallback", () => {
    expect([...ACCESS_TIERS]).toEqual([
      "owner",
      "executive",
      "operator",
      "staff",
      "investor",
      "vendor",
      "none",
    ]);
  });

  it("every app role token maps to a listed tier", () => {
    // The mapping is read from getTierForUser, not re-declared here: this only
    // asserts the function never returns something outside ACCESS_TIERS.
    for (const t of APP_ROLE_TOKENS) {
      expect(ACCESS_TIERS, `token ${t}`).toContain(getTierForUser(userWithRole(t)));
    }
  });

  it("every granting tier is reached by an explicit token, and only customer falls to none", () => {
    const reached = new Map<AccessTier, string[]>();
    for (const t of APP_ROLE_TOKENS) {
      const tier = getTierForUser(userWithRole(t));
      reached.set(tier, [...(reached.get(tier) ?? []), t]);
    }
    for (const tier of ACCESS_TIERS) {
      if (tier === "none") continue;
      expect(reached.get(tier)?.length ?? 0, `tier ${tier} has no granting token`).toBeGreaterThan(0);
    }
    // "customer" is a real token (it is a DB enum value and a JWT value) that
    // deliberately grants nothing. If a second token ever lands here, or this
    // one stops, that is an access change — say so in the PR.
    expect(reached.get("none")).toEqual(["customer"]);
    // And anything outside the vocabulary also falls to none.
    expect(getTierForUser(userWithRole("garbage"))).toBe("none");
    expect(getTierForUser(userWithRole())).toBe("none");
    expect(getTierForUser(null)).toBe("none");
  });
});

// ---------------------------------------------------------------------------
// DB-side vocabularies — src/lib/db-vocab.ts vs the live schema
// ---------------------------------------------------------------------------

describe("DB_USER_ROLES (enum public.user_role)", () => {
  it("matches the enum read from prod on 2026-09-08", () => {
    expect([...DB_USER_ROLES]).toEqual([...DB_FACTS_2026_09_08.user_role]);
  });

  it("is a strict subset of the app role tokens", () => {
    // db-vocab.ts pins this at compile time with `satisfies`; this is the
    // runtime restatement so a test log shows it too.
    for (const r of DB_USER_ROLES) expect(isAppRoleToken(r), r).toBe(true);
    const appOnly = APP_ROLE_TOKENS.filter((t) => !isDbUserRole(t));
    // The five app-only tokens live in the JWT alone; profiles.role cannot
    // hold them. Read from the two lists, not invented here.
    expect(appOnly).toEqual(["va", "executive_va", "executive", "operator", "partner"]);
  });

  it("every profiles.role value in use on prod is in the enum", () => {
    for (const r of DB_FACTS_2026_09_08.profiles_role_in_use) expect(isDbUserRole(r), r).toBe(true);
  });

  it("USER_ROLES in workflow/statuses.ts is the same list, not a copy", () => {
    expect(USER_ROLES).toBe(DB_USER_ROLES);
  });
});

describe("ORG_ROLES (org_roles.role CHECK)", () => {
  it("matches the CHECK read from prod on 2026-09-08", () => {
    expect([...ORG_ROLES]).toEqual([...DB_FACTS_2026_09_08.org_roles_check]);
  });

  it("matches the CHECK in the repo migration that created org_roles", () => {
    const sql = readFileSync(join(ROOT, ORG_ROLES_MIGRATION), "utf8");
    const m = sql.match(/role\s+text\s+NOT NULL\s+CHECK\s*\(\s*role\s+IN\s*\(([^)]*)\)\s*\)/i);
    expect(m, `org_roles CHECK not found in ${ORG_ROLES_MIGRATION}`).not.toBeNull();
    const inSql = m![1].split(",").map((s) => s.trim().replace(/^'|'$/g, ""));
    expect(inSql).toEqual([...ORG_ROLES]);
  });

  it("ORG_ROLE names every org role once and nothing else", () => {
    expect([...Object.values(ORG_ROLE)].sort()).toEqual([...ORG_ROLES].sort());
  });

  it("isOrgRole accepts the vocabulary and rejects app tokens and tiers", () => {
    for (const r of ORG_ROLES) expect(isOrgRole(r)).toBe(true);
    for (const t of APP_ROLE_TOKENS) expect(isOrgRole(t), t).toBe(false);
    expect(isOrgRole("owner")).toBe(false);
    expect(isOrgRole(null)).toBe(false);
  });
});

describe("DB_PORTAL_ROLES (enum public.portal_role)", () => {
  it("matches the enum read from prod on 2026-09-08", () => {
    expect([...DB_PORTAL_ROLES]).toEqual([...DB_FACTS_2026_09_08.portal_role]);
  });
});

// ---------------------------------------------------------------------------
// Vertical seat stages — a projection of both vocabularies
// ---------------------------------------------------------------------------

type StageJson = { appRole: string; orgRole: string; revenueSharePct: number; level: string; certified: boolean };

describe("vertical seat stages map onto the role vocabularies", () => {
  const json = JSON.parse(readFileSync(join(ROOT, "config/verticals.json"), "utf8")) as {
    stages: Record<string, StageJson>;
  };
  const registryStages: VerticalSeatStage[] = ["learn", "earn", "graduate"];

  it("config/verticals.json (what provision-tenant-seat.mjs writes) uses only real tokens", () => {
    // The script writes stage.appRole to app_metadata.role and stage.orgRole
    // to org_roles.role — so a typo here would provision a seat the app
    // routes to `none` or the DB CHECK rejects.
    expect(Object.keys(json.stages).length).toBeGreaterThan(0);
    for (const [stage, s] of Object.entries(json.stages)) {
      expect(isAppRoleToken(s.appRole), `${stage}.appRole=${s.appRole}`).toBe(true);
      expect(isOrgRole(s.orgRole), `${stage}.orgRole=${s.orgRole}`).toBe(true);
    }
  });

  it("seatPlanForStage in verticals/registry.ts uses only real tokens", () => {
    for (const stage of registryStages) {
      const plan = seatPlanForStage(stage);
      expect(isAppRoleToken(plan.appRole), `${stage}.appRole`).toBe(true);
      expect(isOrgRole(plan.orgRole), `${stage}.orgRole`).toBe(true);
    }
  });

  it("the registry and the JSON agree on appRole/orgRole for every stage they share", () => {
    // Only the role columns are compared: `level` and the extra "admin" stage
    // differ between the two files today and are outside this test's remit.
    for (const stage of registryStages) {
      const plan = seatPlanForStage(stage);
      const s = json.stages[stage];
      expect(s, `stage ${stage} missing from config/verticals.json`).toBeDefined();
      expect({ appRole: plan.appRole, orgRole: plan.orgRole }, stage).toEqual({
        appRole: s.appRole,
        orgRole: s.orgRole,
      });
    }
  });

  it("no stage provisions a seat the app would route to none", () => {
    for (const [stage, s] of Object.entries(json.stages)) {
      expect(getTierForUser(userWithRole(s.appRole)), stage).not.toBe("none");
    }
  });
});

// ---------------------------------------------------------------------------
// ENFORCEMENT: the role token vocabulary is spelled out in one file.
// ---------------------------------------------------------------------------

/**
 * Before F-15, `USER_ROLES` in workflow/statuses.ts re-typed five of the
 * tokens next to the `AppRoleToken` union in auth-roles.ts, with nothing
 * tying the two together. This walks src/, shared/ and packages/ and fails if
 * any non-test source file outside the canonical modules quotes one of the
 * unmistakable tokens as a string literal. Call sites import
 * APP_ROLE_TOKENS / isAppRoleToken (or ORG_ROLES / ORG_ROLE) instead.
 *
 * Only unmistakable tokens are policed. "admin", "operator", "vendor",
 * "customer", "viewer" are ordinary words that legitimately appear as other
 * enums (dispatch link kinds, UI labels) and as single-token comparisons.
 * `internal_team` and `executive_va` are only ever JWT role tokens;
 * `responder` is only ever an org_roles value.
 */

/** Trees to police. */
const SCAN_DIRS = ["src", "shared", "packages"];

/** Directory names never descended into. */
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", "out", "coverage"]);

/**
 * Files allowed to spell the values out. Keep this list short and say why.
 * Paths are repo-relative with forward slashes.
 */
const ALLOWLIST = new Set<string>([
  // The canonical app-side module: APP_ROLE_TOKENS and getTierForUser's switch.
  "src/lib/auth-roles.ts",
  // The canonical DB-side module: DB_USER_ROLES, ORG_ROLES, ORG_ROLE.
  "src/lib/db-vocab.ts",
]);

/**
 * Test files are exempt as a rule: middleware.test.ts carries its own
 * role-to-tier matrix on purpose (a test that imported the mapping would only
 * prove it equals itself), and several suites sign in as "internal_team".
 */
const isTestFile = (rel: string) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(rel);

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

/** The unmistakable tokens, quoted with any string delimiter. */
const LITERAL = /["'`](internal_team|executive_va|responder)["'`]/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/** Block comments and full-line `//` comments are not code. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

function sourceFiles(): string[] {
  return SCAN_DIRS.filter((d) => existsSync(join(ROOT, d)))
    .flatMap((d) => walk(join(ROOT, d)))
    .filter((f) => SOURCE_EXT.test(f))
    .map((f) => relative(ROOT, f).split(sep).join("/"));
}

/** First offending line in the file, or null. Comments are ignored. */
function firstHit(rel: string): number | null {
  const lines = stripComments(readFileSync(join(ROOT, rel), "utf8")).split("\n");
  const i = lines.findIndex((l) => LITERAL.test(l));
  return i === -1 ? null : i + 1;
}

describe("role vocabulary has one source (F-15)", () => {
  const files = sourceFiles();

  it("no source file outside the canonical modules quotes a role token", () => {
    const copies: string[] = [];
    for (const rel of files) {
      if (ALLOWLIST.has(rel) || isTestFile(rel)) continue;
      const line = firstHit(rel);
      if (line !== null) copies.push(`${rel}:${line}`);
    }
    expect(
      copies.sort(),
      "hard-coded role token copy — import APP_ROLE_TOKENS / isAppRoleToken from @/lib/auth-roles, or ORG_ROLES / ORG_ROLE from @/lib/db-vocab",
    ).toEqual([]);
  });

  it("would catch the canonical modules if they were not allowlisted", () => {
    // Guards the scanner itself: if the walker or the regex silently stopped
    // matching, the test above would pass by finding nothing.
    expect(files).toContain("src/lib/auth-roles.ts");
    expect(files).toContain("src/lib/db-vocab.ts");
    expect(firstHit("src/lib/auth-roles.ts")).not.toBeNull();
    expect(firstHit("src/lib/db-vocab.ts")).not.toBeNull();
    expect(files.length).toBeGreaterThan(200);
  });

  it("the allowlist only names files that exist", () => {
    for (const rel of ALLOWLIST) expect(existsSync(join(ROOT, rel)), rel).toBe(true);
  });
});
