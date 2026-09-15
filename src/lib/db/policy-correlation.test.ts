import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A row-level policy whose subquery never mentions the row is not a scoping
 * rule. It is USING (true) wearing a costume.
 *
 * The live example, found 2026-09-15 on operator_training_progress:
 *
 *   USING ( profile_id = auth.uid()
 *           OR EXISTS (SELECT 1 FROM org_roles r WHERE r.user_id = auth.uid()) )
 *
 * The EXISTS asks "does the caller hold any org role anywhere". It does not
 * ask anything about the row being read. For anyone holding a role — which is
 * every operator and every staff member — the whole expression collapses to
 * true, so one client's operator could read, update and delete every other
 * client's training records. It had been that way since the table was created.
 *
 * It reviews well. It has a subquery, it names org_roles, it mentions
 * auth.uid(). Everything about it looks like tenant scoping except the part
 * that would do the scoping.
 *
 * This test reads the migration SQL rather than the database, so it runs
 * offline in CI and fails on the way in — before a policy like that is ever
 * applied. Comments are stripped first, deliberately: the fix migration quotes
 * the broken policy in its explanation and in its rollback block, and a
 * scanner that matched comment text would flag the very file that fixes it.
 */

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

function sqlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sqlFiles(p));
    else if (name.endsWith(".sql")) out.push(p);
  }
  return out;
}

/** Drop `--` line comments and /* *\/ block comments before matching. */
function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((line) => {
      const i = line.indexOf("--");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
}

/**
 * An EXISTS over org_roles / profiles / org members whose body only ever
 * constrains the CALLER (user_id = auth.uid(), id = auth.uid()) and never
 * references anything outside the subquery.
 */
const UNCORRELATED_EXISTS =
  /exists\s*\(\s*select\s+1\s+from\s+(?:public\.)?(org_roles|profiles|organization_members)\s+(?:as\s+)?(\w+)?\s*where\s*\(?\s*\2?\.?(user_id|id)\s*=\s*auth\.uid\(\)\s*\)?\s*\)/gi;

describe("every policy subquery must mention the row it is guarding", () => {
  const files = sqlFiles(MIGRATIONS);

  it("finds migration files to scan at all", () => {
    // Without this, a wrong path would make the scan vacuously pass forever.
    expect(files.length, "no .sql files found — the scanner is looking in the wrong place").toBeGreaterThan(10);
  });

  it("has no uncorrelated org-membership EXISTS in any policy", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const sql = stripComments(readFileSync(f, "utf8"));
      for (const m of sql.matchAll(UNCORRELATED_EXISTS)) {
        offenders.push(`${f.replace(process.cwd() + "/", "")}: ${m[0].replace(/\s+/g, " ").slice(0, 120)}`);
      }
    }
    expect(
      offenders,
      `these subqueries constrain the caller but never the row, so they grant everything to anyone holding a role:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("the scanner actually recognises the shape it is looking for", () => {
    // Positive control. If the regex silently stopped matching, the test above
    // would pass forever while the hole walked straight back in.
    const known = `
      create policy x on public.t for all to authenticated
      using (profile_id = auth.uid() or exists (select 1 from org_roles r where r.user_id = auth.uid()));
    `;
    expect([...stripComments(known).matchAll(UNCORRELATED_EXISTS)].length).toBe(1);
  });

  it("does not flag a subquery that IS correlated to the row", () => {
    // Negative control on the matcher itself: the correct version must pass,
    // or the rule is unusable and someone will delete it.
    const correct = `
      using (exists (select 1 from public.operator_profiles op
                     where op.profile_id = public.operator_training_progress.profile_id
                       and public.is_org_member(op.org_id)));
    `;
    expect([...stripComments(correct).matchAll(UNCORRELATED_EXISTS)].length).toBe(0);
  });

  it("does not flag the fix migration, whose comments quote the broken policy", () => {
    const fix = sqlFiles(MIGRATIONS).find((f) => f.includes("operator_progress_tenant_scope"));
    expect(fix, "the staged fix is missing").toBeDefined();
    const stripped = stripComments(readFileSync(fix!, "utf8"));
    expect([...stripped.matchAll(UNCORRELATED_EXISTS)].length).toBe(0);
  });
});
