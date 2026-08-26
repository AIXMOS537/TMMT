import fs from "node:fs";
import path from "node:path";

export type Severity = "blocker" | "broken" | "warning" | "info";

export type Finding = {
  route: string;
  authed: boolean;
  severity: Severity;
  kind: string;
  detail: string;
};

export type RouteResult = {
  route: string;
  authed: boolean;
  status: number | null;
  finalUrl: string;
  title: string | null;
  h1: string | null;
  loadMs: number;
  findings: Finding[];
};

const OUT_DIR = path.join(process.cwd(), "audit", "results");

/**
 * One NDJSON line per route.
 *
 * Playwright runs the audit single-worker (see playwright.config.ts), so
 * appends cannot interleave. NDJSON rather than one big JSON so a crashed or
 * cancelled run still leaves every route it *did* finish readable by the
 * report generator instead of a truncated, unparseable array.
 */
export function recordRoute(result: RouteResult): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, result.authed ? "authed.ndjson" : "anon.ndjson");
  fs.appendFileSync(file, JSON.stringify(result) + "\n", "utf8");
}

/** Clear previous results so a run never reports stale routes as current. */
export function resetResults(authed: boolean): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, authed ? "authed.ndjson" : "anon.ndjson");
  if (fs.existsSync(file)) fs.rmSync(file);
}

/**
 * Console noise that is never a defect: framework advertising, favicon misses,
 * and the dev-only HMR chatter. Everything else is surfaced — an unfiltered
 * hydration or fetch error is exactly what this harness exists to catch.
 */
const IGNORED_CONSOLE = [
  /Download the React DevTools/i,
  /favicon\.ico/i,
  /\[Fast Refresh\]/i,
  /React DevTools/i,
];

export function isNoise(text: string): boolean {
  return IGNORED_CONSOLE.some((re) => re.test(text));
}
