import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * ENFORCEMENT: every internal <Link href="/..."> must point at a route that
 * exists.
 *
 * This test exists because both of the only two links in the entire (learn)
 * credit journey were broken the same way — "/questionnaire/personal" and
 * "/application/review", each missing the "/learn" prefix. A signed-in member
 * who reached the product-match screen and clicked "Start questionnaire" or
 * "Review application packet" went nowhere. Nothing caught it: a route group
 * like (learn) does not appear in the URL, so the wrong path looks right in
 * source, and until the 404 status fix these dead ends answered "200 OK".
 *
 * Route groups are stripped, dynamic segments match any single path segment,
 * and catch-alls match the rest. Paths that middleware owns rather than the
 * app router (redirects out to the AIXMOS landing, for example) are listed in
 * MIDDLEWARE_OWNED below — add to it only when src/middleware.ts really does
 * handle that path.
 */

const APP = join(process.cwd(), "src", "app");

/** Paths served by src/middleware.ts, not by a page.tsx or route.ts. */
const MIDDLEWARE_OWNED = new Set(["/credit", "/funding"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const files = walk(APP);

/** Every route the app router actually serves, with route groups stripped. */
function realRoutes(): Set<string> {
  const routes = new Set<string>();
  for (const f of files) {
    const base = f.split(sep).pop() ?? "";
    if (base !== "page.tsx" && base !== "route.ts") continue;
    let r =
      "/" + relative(APP, f).split(sep).slice(0, -1).join("/");
    r = r.replace(/\/\([^)]+\)/g, "");
    routes.add(r === "" ? "/" : r);
  }
  return routes;
}

const ROUTES = realRoutes();

function routeExists(href: string): boolean {
  if (ROUTES.has(href) || MIDDLEWARE_OWNED.has(href)) return true;
  for (const r of ROUTES) {
    if (!r.includes("[")) continue;
    const pattern = r
      .replace(/\[\.\.\.[^\]]+\]/g, "!!CATCHALL!!")
      .replace(/\[[^\]]+\]/g, "!!SEGMENT!!")
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/!!CATCHALL!!/g, ".+")
      .replace(/!!SEGMENT!!/g, "[^/]+");
    if (new RegExp(`^${pattern}$`).test(href)) return true;
  }
  return false;
}

/** Static internal hrefs only — template literals are resolved at runtime. */
function internalHrefs(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/href=\{?["'](\/[^"']*)["']/g)) {
    const href = (m[1].replace(/[?#].*$/, "").replace(/\/$/, "") || "/");
    if (href.startsWith("/api") || href.startsWith("/_next")) continue;
    if (/\.[a-z0-9]{2,5}$/i.test(href)) continue; // static asset
    out.push(href);
  }
  return out;
}

describe("internal links", () => {
  it("every static href points at a route that exists", () => {
    const dead: string[] = [];

    for (const f of files) {
      if (!/\.(ts|tsx)$/.test(f) || /\.test\.(ts|tsx)$/.test(f)) continue;
      const where = relative(APP, f).split(sep).join("/");
      for (const href of internalHrefs(readFileSync(f, "utf8"))) {
        if (!routeExists(href)) dead.push(`${href}  ←  src/app/${where}`);
      }
    }

    expect(
      [...new Set(dead)].sort(),
      "these links go nowhere — check for a missing route-group prefix",
    ).toEqual([]);
  });

  it("finds the routes it is supposed to be checking against", () => {
    // Guards the walker itself: if the glob silently stops matching, the test
    // above would pass by finding nothing rather than by everything being fine.
    expect(ROUTES.size).toBeGreaterThan(100);
    expect(ROUTES.has("/learn/questionnaire/personal")).toBe(true);
    expect(ROUTES.has("/lp/[org]/[sku]")).toBe(true);
    expect(routeExists("/lp/tmmt/lead-magnet")).toBe(true);
    expect(routeExists("/questionnaire/personal")).toBe(false);
  });
});
