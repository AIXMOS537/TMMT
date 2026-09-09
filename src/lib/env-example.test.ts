import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * ENFORCEMENT (remediation F-24): every environment variable the application
 * reads must be listed in .env.example. On 2026-09-08 the code read 39 names
 * the example did not mention (CRON_SECRET and GHL_LOCATION_ID among them)
 * while documenting 8 that nothing read any more. Runtime config that is not
 * written down gets discovered in production; this keeps the two in step.
 *
 * Names Vercel/Next supply themselves are exempt. Per-slug secrets are read by
 * template (`STRIPE_WEBHOOK_SECRET_${slug}`), which this regex cannot see, and
 * are documented in the routes that read them.
 */

const ROOT = process.cwd();
const PLATFORM_SUPPLIED = new Set(["NODE_ENV", "NEXT_RUNTIME", "VERCEL_URL", "VERCEL_ENV", "CI"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "dist") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|mjs)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

function namesReadByApp(): Set<string> {
  const names = new Set<string>();
  for (const dir of ["src", "shared", "packages"]) {
    for (const f of walk(join(ROOT, dir))) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) names.add(m[1]);
    }
  }
  return names;
}

function namesDocumented(): Set<string> {
  const text = readFileSync(join(ROOT, ".env.example"), "utf8");
  const names = new Set<string>();
  for (const m of text.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)) names.add(m[1]);
  return names;
}

describe(".env.example matches what the app reads", () => {
  const read = namesReadByApp();
  const documented = namesDocumented();

  it("every process.env name the app reads is documented", () => {
    const missing = [...read].filter((n) => !documented.has(n) && !PLATFORM_SUPPLIED.has(n)).sort();
    expect(missing, `add to .env.example: ${missing.join(", ")}`).toEqual([]);
  });

  it("the walker actually found the code and the file", () => {
    expect(read.size).toBeGreaterThan(80);
    expect(read.has("NEXT_PUBLIC_SUPABASE_URL")).toBe(true);
    expect(documented.has("SUPABASE_SERVICE_ROLE_KEY")).toBe(true);
  });
});
