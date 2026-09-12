/**
 * Tenant isolation for the client build tracker.
 *
 * WHAT THIS TEST IS, HONESTLY: the migration is STAGED, not applied, so there is
 * no live table to query and this is NOT a round-trip test against Postgres. It
 * proves the two things that can be proven without a database, and it is written
 * so that removing either one turns it red:
 *
 *   1. the POLICY half — the staged migration really does enable RLS, really does
 *      scope both tables to the caller's own org, and really does deny anon;
 *   2. the APP half — the tracker reads through the RLS-respecting client and
 *      never through service-role, and the query does not carry its own org
 *      filter that would mask a missing policy.
 *
 * Both halves are load-bearing. A perfect policy is worthless if the page calls
 * `createServiceRoleClient()`, because service-role bypasses RLS entirely — that
 * is the exact failure this file exists to catch, and the reason the app half is
 * tested at all.
 *
 * WHAT IS STILL OWED once the migration is applied: a real two-user test that
 * signs in as org B and asserts zero rows from org A. That needs the owner-gated
 * apply. Until then this file is the guard, and it is deliberately blunt about
 * being a structural one.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/_staged/20260911220000_client_engagement_tracker_STAGED.sql",
);
const ENGAGEMENT_LIB = join(process.cwd(), "src/lib/engagement.ts");
const TRACKER_PAGE = join(process.cwd(), "src/app/(pocket)/pocket/build/page.tsx");

const sql = existsSync(MIGRATION) ? readFileSync(MIGRATION, "utf8") : "";
const norm = sql.replace(/\s+/g, " ").toLowerCase();

/** The predicate that ties a row to the caller's own org. */
const OWN_ORG =
  "organization_id = (select p.organization_id from public.profiles p where p.id = auth.uid())";

const CLIENT_TABLES = ["client_engagements", "engagement_change_requests"] as const;

describe("staged migration exists at all", () => {
  it("is on disk — if this fails, nothing below means anything", () => {
    expect(existsSync(MIGRATION)).toBe(true);
    expect(sql.length).toBeGreaterThan(500);
  });
});

describe("org A cannot read org B — the policy half", () => {
  it.each(CLIENT_TABLES)("enables row level security on %s", (table) => {
    expect(norm).toContain(`alter table public.${table} enable row level security`);
  });

  // THE test. Delete either SELECT policy from the migration and this goes red.
  it.each(CLIENT_TABLES)("scopes %s SELECT to the caller's own organization", (table) => {
    const policy = `create policy ${table}_own_org_select on public.${table} for select to authenticated using ( ${OWN_ORG} )`;
    expect(norm).toContain(policy.replace(/\s+/g, " ").toLowerCase());
  });

  it.each(CLIENT_TABLES)("revokes anon on %s so a logged-out reader gets nothing", (table) => {
    expect(norm).toContain(`revoke all on public.${table} from anon`);
  });

  it("never grants a blanket USING (true) to authenticated", () => {
    expect(norm).not.toContain("using ( true )");
    expect(norm).not.toContain("using (true)");
  });

  it("scopes every policy to `authenticated`, never to `public`", () => {
    const policyLines = norm.match(/create policy [^;]+;/g) ?? [];
    expect(policyLines.length).toBeGreaterThan(0);
    for (const p of policyLines) {
      expect(p).toContain("to authenticated");
    }
  });
});

describe("a client cannot post into another org's thread — the insert half", () => {
  it("pins the INSERT to the caller's own org", () => {
    expect(norm).toContain(
      `create policy engagement_change_requests_own_org_insert on public.engagement_change_requests for insert to authenticated with check ( ${OWN_ORG}`
        .replace(/\s+/g, " ")
        .toLowerCase(),
    );
  });

  it("forces author_kind to 'client' so nobody posts as the team", () => {
    expect(norm).toContain("and author_kind = 'client'");
  });

  it("forces author_id to the caller so nobody posts as another client", () => {
    expect(norm).toContain("and author_id = auth.uid()");
  });

  // Without this trigger, a caller could name their OWN org (passing WITH CHECK)
  // while aiming engagement_id at a stranger's engagement.
  it("derives organization_id from the parent engagement via a trigger", () => {
    expect(norm).toContain("create trigger engagement_change_request_org_trg");
    expect(norm).toContain("before insert on public.engagement_change_requests");
    expect(norm).toContain("select e.organization_id into new.organization_id");
  });

  it("gives `authenticated` no UPDATE or DELETE policy — the thread is append-only", () => {
    expect(norm).not.toContain("for update to authenticated");
    expect(norm).not.toContain("for delete to authenticated");
  });
});

describe("the app half — RLS is not bypassed in code", () => {
  const lib = readFileSync(ENGAGEMENT_LIB, "utf8");
  const page = readFileSync(TRACKER_PAGE, "utf8");
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("the data layer never imports the service-role client", () => {
    expect(code(lib)).not.toContain("createServiceRoleClient");
    expect(code(lib)).not.toContain("supabase-service");
  });

  it("the tracker page never imports the service-role client", () => {
    expect(code(page)).not.toContain("createServiceRoleClient");
    expect(code(page)).not.toContain("supabase-service");
  });

  it("the tracker page reads through the RLS-respecting SSR client", () => {
    expect(page).toContain("createSSRClient");
  });

  // If the query filtered by org itself, deleting the policy would leave the app
  // looking correct while the database was wide open — and the policy tests above
  // would be the only thing standing, with nothing to catch a runtime regression.
  it("the engagement query leans on the policy, not a hand-written org filter", () => {
    const fn = lib.slice(lib.indexOf("export async function getEngagement"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    expect(body).not.toContain('.eq("organization_id"');
    expect(body).not.toContain(".eq('organization_id'");
  });
});
