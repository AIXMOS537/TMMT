import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A page nobody can reach is not shipped, it is only written.
 *
 * The repo already enforces the other direction — internal-links.test.ts
 * proves every link points at a route that exists. Nothing proved the
 * reverse: that a route anyone is supposed to find is linked from somewhere.
 * There is no global navigation in this app; public pages link to each other
 * by hand, so an orphan is invisible rather than broken, and invisible is the
 * harder kind to notice.
 *
 * Scoped deliberately to /configurator rather than every public route. Some
 * pages are unlisted on purpose (/build is noindex until its prices are
 * approved), and a blanket rule would either flag those wrongly or need an
 * allow-list that quietly grows until it means nothing.
 */

const APP = join(process.cwd(), "src", "app");

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

function pagesLinkingTo(path: string): string[] {
  return walk(APP)
    .filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."))
    .filter((f) => !f.includes(join("app", "configurator")))
    .filter((f) => readFileSync(f, "utf8").includes(`href="${path}"`));
}

describe("the configurator is reachable without typing the URL", () => {
  it("is linked from at least one other page", () => {
    const linkers = pagesLinkingTo("/configurator");
    expect(
      linkers.length,
      "nothing links to /configurator any more — it is live but unreachable, which is worse than absent because it reads as shipped",
    ).toBeGreaterThan(0);
  });

  it("is linked from a page a business buyer actually lands on", () => {
    const linkers = pagesLinkingTo("/configurator").map((f) => f.replace(APP, ""));
    // Not the rental front door: /welcome is for drivers renting a car, and a
    // "build your system" link there is aimed at the wrong person.
    const buyerFacing = linkers.filter((f) => f.includes("kits") || f.includes("dealers"));
    expect(
      buyerFacing.length,
      `only reachable from ${linkers.join(", ") || "nowhere"} — a buyer will not find it`,
    ).toBeGreaterThan(0);
  });

  it("is public in middleware, or the link leads to a login wall", () => {
    const mw = readFileSync(join(process.cwd(), "src", "middleware.ts"), "utf8");
    expect(mw).toContain('pathname === "/configurator"');
  });
});
