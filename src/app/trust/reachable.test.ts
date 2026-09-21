import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The trust page only does its job if the people who need it can find it.
 *
 * It was built and linked from nowhere. There is no global navigation in this
 * app, so an orphan page is not broken — it is invisible, and invisible reads
 * as shipped. A promise nobody can read is not a promise.
 *
 * The audience that matters most is not the buyer. It is the person who just
 * got a text and wants to know who we are and how to make it stop, which is
 * why /legal/sms is asserted separately below: that is where they land.
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
    .filter((f) => !f.includes(join("app", "trust")))
    .filter((f) => readFileSync(f, "utf8").includes(`href="${path}"`))
    .map((f) => f.replace(APP, ""));
}

describe("the trust page is reachable", () => {
  it("is linked from somewhere", () => {
    expect(
      pagesLinkingTo("/trust").length,
      "nothing links to /trust — the promises are live and unreadable",
    ).toBeGreaterThan(0);
  });

  it("is linked from the SMS disclosure, where a texted person actually lands", () => {
    const linkers = pagesLinkingTo("/trust");
    expect(
      linkers.some((f) => f.includes(join("legal", "sms"))),
      `reachable from ${linkers.join(", ") || "nowhere"}, but not from /legal/sms — the page says "stop means stop" and the person who replied STOP cannot find it`,
    ).toBe(true);
  });

  it("stays public in middleware, or the link leads to a login wall", () => {
    const mw = readFileSync(join(process.cwd(), "src", "middleware.ts"), "utf8");
    expect(mw).toContain('pathname === "/trust"');
  });
});
