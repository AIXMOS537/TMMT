import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The repo and the database disagree, and the disagreement is dangerous in one
 * specific direction.
 *
 * Read from the live ledger on 2026-09-15:
 *   250 migrations applied in production
 *    59 migration files in this repo
 *   235 applied with no file here at all
 *    38 files here whose version was never applied
 *
 * The 235 are annoying — the schema's history mostly is not in version control,
 * and any static analysis of migration SQL is blind to it. That is why the live
 * cross-tenant policy on operator_training_progress could not have been caught
 * by reading this repo: no file here ever mentioned it.
 *
 * The 38 are the landmine. `supabase db push` applies every file whose version
 * is not in the ledger, and several of those 38 are the SAME migration under an
 * earlier timestamp as something already live — tmmt_token_ledger, money_meter,
 * signup_invites, advisor_hardening_policies, tenant_scope_rls_policies. They
 * would not no-op. They would drop and recreate policies, replacing the current
 * ones with older definitions. A push would be a silent security rollback.
 *
 * This test does not fix the drift. It pins it, so the number cannot grow
 * quietly: add a migration file without reconciling it and the count moves and
 * this fails, with the filename.
 */

const MIG = join(process.cwd(), "supabase", "migrations");
const SNAPSHOT = join(MIG, "LEDGER-SNAPSHOT.txt");

function appliedVersions(): Set<string> {
  return new Set(
    readFileSync(SNAPSHOT, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#")),
  );
}

function repoVersions(): { version: string; file: string }[] {
  return readdirSync(MIG)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => ({ version: f.split("_")[0].replace(".sql", ""), file: f }))
    .sort((a, b) => a.version.localeCompare(b.version));
}

/**
 * Files present here but never applied. Pinned deliberately: this list must
 * shrink as they are reconciled, and must never grow without someone saying so.
 */
const KNOWN_UNAPPLIED = 50;

/*
 * 49 -> 50 on 2026-09-17: `20260917120000_training_progress_by_journey.sql`.
 * Written and rehearsed on the throwaway (three constraints watched refusing: progress
 * belonging to nobody, a 250% percentage, and a duplicate row). NOT applied to production —
 * it is queued behind the same owner approval as the rest, so it is counted here rather
 * than hidden. Until it lands, gates 30 and 40 of the Drive-to-Own ladder stay
 * unevidencable in production for every renter, exactly as gate 10 was before
 * 20260917010000.
 *
 * 38 -> 49 on 2026-09-17, deliberately, in two parts:
 *
 * +6  Six files WERE applied to production today under the runbook, each
 *     verified by postcondition. They still count as drift because
 *     `apply_migration` assigns its own version string, so the ledger records
 *     20260917195950..20260917200633 while the repo files are named
 *     20260916230000..20260917040500. The SQL is live; the version numbers do
 *     not match. LEDGER-SNAPSHOT.txt carries the full mapping. Re-running them
 *     would be harmless (IF NOT EXISTS / CREATE OR REPLACE / not-exists guards)
 *     but it would still be a re-run, so they are counted rather than hidden.
 *
 * +5  Carried in by the ten branches merged into master today. They were
 *     already drift on their own branches; landing those branches moved the
 *     drift here rather than creating it.
 *
 * The direction of travel is still down. This number must shrink as files are
 * reconciled, and must never move up again without a note like this one.
 */

describe("migration drift stays pinned", () => {
  it("can read both sides, or it is measuring nothing", () => {
    expect(appliedVersions().size, "ledger snapshot is empty or missing").toBeGreaterThan(200);
    expect(repoVersions().length, "no migration files found").toBeGreaterThan(20);
  });

  it("has no MORE unapplied files than the drift we already know about", () => {
    const applied = appliedVersions();
    const unapplied = repoVersions().filter((m) => !applied.has(m.version));
    expect(
      unapplied.length,
      `unapplied migration files changed. If you added one, reconcile it or raise KNOWN_UNAPPLIED on purpose.\n  ${unapplied
        .map((m) => m.file)
        .join("\n  ")}`,
    ).toBeLessThanOrEqual(KNOWN_UNAPPLIED);
  });

  it("still flags the duplicates that make a push a security rollback", () => {
    const applied = appliedVersions();
    const unapplied = repoVersions().filter((m) => !applied.has(m.version)).map((m) => m.file);
    // These are the ones whose names match something already live under a
    // different timestamp. If a push ever ran, these are what it would undo.
    for (const dupe of [
      "tmmt_token_ledger",
      "money_meter",
      "signup_invites",
      "advisor_hardening_policies",
    ]) {
      expect(
        unapplied.some((f) => f.includes(dupe)),
        `"${dupe}" is no longer in the unapplied set — if it was reconciled, good, drop it from this list and lower KNOWN_UNAPPLIED`,
      ).toBe(true);
    }
  });

  it("the snapshot is a record, not a wish — it holds the operator policy migration", () => {
    // 20260609190421 operator_training_progress_and_certification is where the
    // uncorrelated policy came from. It is in the ledger and in no file here.
    const applied = appliedVersions();
    expect(applied.has("20260609190421")).toBe(true);
    const files = readdirSync(MIG).filter((f) => f.startsWith("20260609190421"));
    expect(
      files,
      "if this migration now has a file, the 235-with-no-file gap is being closed — update the counts in this file",
    ).toEqual([]);
  });
});
