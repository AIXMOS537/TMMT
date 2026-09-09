import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  BG_CHECK_DECISIONS,
  BG_DECISION,
  isBgCheckDecision,
  isBgCheckPending,
} from "./bg-check-decisions";

describe("BG_CHECK_DECISIONS", () => {
  it("is the five live eligibility_status values, spelled exactly as the DB holds them", () => {
    // The bg_check_decide RPC and the S3-03 CHECK constraint accept these and
    // only these. "out of radius" is lower-case in production rows; do not
    // "fix" it here without migrating the data and the RPC together.
    expect([...BG_CHECK_DECISIONS]).toEqual([
      "Eligible",
      "Not Eligible",
      "Need Manager's Review",
      "out of radius",
      "Not found",
    ]);
  });

  it("BG_DECISION names every decision once and nothing else", () => {
    expect([...Object.values(BG_DECISION)].sort()).toEqual([...BG_CHECK_DECISIONS].sort());
  });

  it("isBgCheckDecision accepts the vocabulary and rejects everything else", () => {
    for (const d of BG_CHECK_DECISIONS) expect(isBgCheckDecision(d)).toBe(true);
    expect(isBgCheckDecision("Approved")).toBe(false);
    expect(isBgCheckDecision("eligible")).toBe(false); // case matters on the wire
    expect(isBgCheckDecision(null)).toBe(false);
    expect(isBgCheckDecision(undefined)).toBe(false);
    expect(isBgCheckDecision(3)).toBe(false);
  });

  it("isBgCheckPending is NULL-or-escalated, and nothing else", () => {
    expect(isBgCheckPending(null)).toBe(true);
    expect(isBgCheckPending(undefined)).toBe(true);
    expect(isBgCheckPending("")).toBe(true);
    expect(isBgCheckPending(BG_DECISION.needsReview)).toBe(true);
    expect(isBgCheckPending(BG_DECISION.eligible)).toBe(false);
    expect(isBgCheckPending(BG_DECISION.notEligible)).toBe(false);
    expect(isBgCheckPending(BG_DECISION.outOfRadius)).toBe(false);
    expect(isBgCheckPending(BG_DECISION.notFound)).toBe(false);
  });
});

/**
 * ENFORCEMENT: the eligibility vocabulary is spelled out in one file.
 *
 * Before F-16 there were three hand-typed copies — the admin page's
 * <select> options, the staff queue's decision buttons, and a
 * "Need Manager's Review" comparison in the dashboard stats — next to the
 * canonical list in queries.ts. A typo or a renamed status in any one of them
 * would have silently disagreed with the others and with the DB's CHECK
 * constraint. This walks src/, shared/ and packages/ and fails if any
 * non-test source file other than the canonical module quotes the two
 * distinctive values as a string literal. Call sites import BG_CHECK_DECISIONS
 * or BG_DECISION instead.
 *
 * Only the two unmistakable strings are policed: "Not found" and "Eligible"
 * are ordinary English that legitimately appears elsewhere, and "out of
 * radius" is deliberately substring-matched (lower-cased) in aixmos-prequal.ts
 * so that human-typed variants still route.
 */

const ROOT = process.cwd();

/** Trees to police. */
const SCAN_DIRS = ["src", "shared", "packages"];

/** Directory names never descended into. */
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", "out", "coverage"]);

/**
 * Files allowed to spell the values out. Keep this list short and say why.
 * Paths are repo-relative with forward slashes.
 */
const ALLOWLIST = new Set<string>([
  // The canonical module: the tuple and the BG_DECISION handles both live here.
  "src/lib/bg-check-decisions.ts",
]);

/**
 * Test files are exempt as a rule rather than one by one: queries.test.ts
 * asserts the exact wire string sent to bg_check_decide (a test that imported
 * the constant would only prove the constant equals itself), and
 * aixmos-prequal.test.ts feeds the router raw human-typed variants including
 * the curly apostrophe on purpose.
 */
const isTestFile = (rel: string) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(rel);

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

/** The two distinctive values, quoted with any string delimiter. */
const LITERAL = /["'`]Need Manager['’]s Review["'`]|["'`]Not Eligible["'`]/;

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

describe("eligibility vocabulary has one source (F-16)", () => {
  const files = sourceFiles();

  it("no source file outside the canonical module quotes the decision strings", () => {
    const copies: string[] = [];
    for (const rel of files) {
      if (ALLOWLIST.has(rel) || isTestFile(rel)) continue;
      const line = firstHit(rel);
      if (line !== null) copies.push(`${rel}:${line}`);
    }
    expect(
      copies.sort(),
      "hard-coded eligibility_status copy — import BG_CHECK_DECISIONS / BG_DECISION from @/lib/bg-check-decisions",
    ).toEqual([]);
  });

  it("would catch the canonical module if it were not allowlisted", () => {
    // Guards the scanner itself: if the walker or the regex silently stopped
    // matching, the test above would pass by finding nothing. The canonical
    // file must be found, and must trip the pattern.
    expect(files).toContain("src/lib/bg-check-decisions.ts");
    expect(firstHit("src/lib/bg-check-decisions.ts")).not.toBeNull();
    expect(files.length).toBeGreaterThan(200);
  });

  it("the allowlist only names files that exist", () => {
    for (const rel of ALLOWLIST) expect(existsSync(join(ROOT, rel)), rel).toBe(true);
  });
});
