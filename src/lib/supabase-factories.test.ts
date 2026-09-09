import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * ENFORCEMENT (Remediation F-14): Supabase clients are built in three files
 * and nowhere else.
 *
 * Before this test the app had four service-role factories and five more
 * inline `createClient(url, serviceKey)` sites, each reading
 * SUPABASE_SERVICE_ROLE_KEY for itself with its own option set, and only one
 * of them carried `import "server-only"`. A service-role client built in a
 * route file is one careless import away from a client bundle, and a factory
 * without the marker gives the bundler nothing to refuse.
 *
 * Three rules, each with an explicit allowlist:
 *
 *   1. `createClient(` from @supabase/supabase-js — only the service-role
 *      factory, plus the anon-key realtime subscriber in the workspace package
 *      (browser code that cannot reach `@/lib`).
 *   2. `createBrowserClient(` / `createServerClient(` from @supabase/ssr — only
 *      the browser singleton and the cookie-aware SSR/middleware factory.
 *   3. The service-key env name — only the factory reads it. Everything else
 *      calls createServiceRoleClient() / tryCreateServiceRoleClient(), or
 *      buildServiceRoleClient(url, key) for a bridge to another project.
 *
 * Scripts (scripts/*.mjs) and Deno edge functions (supabase/functions) are
 * outside the app bundle and are not scanned. Tests are skipped: they mock
 * these modules by name.
 */

const ROOT = process.cwd();
const SCAN_DIRS = ["src", "shared", "packages"].map((d) => join(ROOT, d));

/** Rule 1 — @supabase/supabase-js createClient(). */
const SUPABASE_JS_ALLOWED = new Set([
  "src/lib/supabase-service.ts", // THE service-role factory (server-only)
  "packages/aixmos-core/src/store/persistence-client.ts", // anon key, "use client" realtime hook
]);

/** Rule 2 — @supabase/ssr createBrowserClient() / createServerClient(). */
const SUPABASE_SSR_ALLOWED = new Set([
  "src/lib/supabase.ts", // browser singleton (anon key, lazy proxy)
  "src/lib/supabase-server.ts", // createSSRClient + createMiddlewareClient (anon key + cookies)
]);

/** Rule 3 — who may read the service-role key. */
const SERVICE_KEY_ALLOWED = new Set(["src/lib/supabase-service.ts"]);

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "dist") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const sources = SCAN_DIRS.flatMap(walk)
  .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.(test|spec)\.(ts|tsx)$/.test(f))
  .map((f) => ({ rel: relative(ROOT, f).split(sep).join("/"), src: readFileSync(f, "utf8") }));

/** Strip line and block comments so a mention in prose does not count. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function offenders(pattern: RegExp, allowed: Set<string>): string[] {
  return sources
    .filter(({ rel, src }) => !allowed.has(rel) && pattern.test(code(src)))
    .map(({ rel }) => rel)
    .sort();
}

describe("supabase client factories (F-14)", () => {
  it("createClient() from @supabase/supabase-js only appears in the allowed factories", () => {
    expect(
      offenders(/\bcreateClient\s*\(/, SUPABASE_JS_ALLOWED),
      "build service-role clients with createServiceRoleClient() from @/lib/supabase-service",
    ).toEqual([]);
  });

  it("createBrowserClient()/createServerClient() from @supabase/ssr only appear in the two anon factories", () => {
    expect(
      offenders(/\bcreate(Browser|Server)Client\s*\(/, SUPABASE_SSR_ALLOWED),
      "use the `supabase` singleton (@/lib/supabase) or createSSRClient()/createMiddlewareClient() (@/lib/supabase-server)",
    ).toEqual([]);
  });

  it("SUPABASE_SERVICE_ROLE_KEY is read by the service-role factory and nothing else", () => {
    expect(
      offenders(/SUPABASE_SERVICE_ROLE_KEY/, SERVICE_KEY_ALLOWED),
      "only src/lib/supabase-service.ts may read the service-role key",
    ).toEqual([]);
  });

  it("the allowed factories exist, still do what the allowlist says, and are server-only where they must be", () => {
    // Guards the allowlist itself: a renamed or deleted factory must be
    // removed from the list on purpose, not silently pass by absence.
    const byRel = new Map(sources.map((s) => [s.rel, s.src]));
    for (const rel of [...SUPABASE_JS_ALLOWED, ...SUPABASE_SSR_ALLOWED, ...SERVICE_KEY_ALLOWED]) {
      expect(byRel.has(rel), `${rel} is allowlisted but does not exist`).toBe(true);
    }
    const service = byRel.get("src/lib/supabase-service.ts") ?? "";
    expect(service).toMatch(/^import "server-only";/m);
    expect(service).toMatch(/\bcreateClient\s*\(/);
    expect(service).toMatch(/persistSession:\s*false/);
    expect(byRel.get("src/lib/supabase.ts") ?? "").toMatch(/\bcreateBrowserClient\s*\(/);
    expect(byRel.get("src/lib/supabase-server.ts") ?? "").toMatch(/\bcreateServerClient\s*\(/);
    // The retired factory stays retired.
    expect(byRel.has("src/lib/agent/supabase-server.ts")).toBe(false);
    // And the walker is really looking at the app.
    expect(sources.length).toBeGreaterThan(300);
  });
});
