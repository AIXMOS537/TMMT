import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import * as appUtils from "@/lib/utils";
import * as core from "@aixmos/core";

/**
 * Remediation F-17: one implementation of each formatter, four names that say
 * what they print. Both import paths must hand back the same functions.
 */
describe("formatters — one implementation, two import paths", () => {
  it("src/lib/utils re-exports the package's functions, not copies", () => {
    expect(appUtils.formatCurrency).toBe(core.formatCurrency);
    expect(appUtils.formatCurrencyWhole).toBe(core.formatCurrencyWhole);
    expect(appUtils.formatDate).toBe(core.formatDate);
    expect(appUtils.formatDateTime).toBe(core.formatDateTime);
    expect(appUtils.cn).toBe(core.cn);
  });

  it("formatCurrency shows cents; formatCurrencyWhole does not", () => {
    expect(core.formatCurrency(1234.5)).toBe("$1,234.50");
    expect(core.formatCurrency(0)).toBe("$0.00");
    expect(core.formatCurrencyWhole(1234.5)).toBe("$1,235");
    expect(core.formatCurrencyWhole(97)).toBe("$97");
  });

  it("both currency formatters are null-safe and reject non-finite input", () => {
    for (const fn of [core.formatCurrency, core.formatCurrencyWhole]) {
      expect(fn(null)).toBe("—");
      expect(fn(undefined)).toBe("—");
      expect(fn(Number.NaN)).toBe("—");
    }
  });

  it("formatDate is date-only; formatDateTime carries the time", () => {
    const iso = "2026-06-15T14:30:00";
    const d = core.formatDate(iso);
    const dt = core.formatDateTime(iso);
    expect(d).toMatch(/^Jun 15, 2026$/);
    expect(dt).toMatch(/^Jun 15, 2026, 2:30 PM$/);
  });

  it("both date formatters are null-safe and reject unparseable input", () => {
    for (const fn of [core.formatDate, core.formatDateTime]) {
      expect(fn(null)).toBe("—");
      expect(fn("")).toBe("—");
      expect(fn("not a date")).toBe("—");
    }
  });
});

/**
 * ENFORCEMENT: no second definition of these names anywhere under src/,
 * shared/ or packages/. Re-exports are fine; a `function formatCurrency(` or
 * `const formatDate =` outside the package's utils.ts is the duplication this
 * fix removed.
 */
describe("no duplicate formatter definitions", () => {
  const ROOT = process.cwd();
  const ALLOWED = "packages/aixmos-core/src/utils.ts";
  const definition = /\b(?:function|const|let)\s+(formatCurrency|formatCurrencyWhole|formatDate|formatDateTime)\b/;
  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".next" || name === "dist") continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) out.push(...walk(p));
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
    }
    return out;
  }
  it("the four names are defined once, in the package", () => {
    const offenders = ["src", "shared", "packages"]
      .flatMap((d) => walk(join(ROOT, d)))
      .map((f) => ({ rel: f.slice(ROOT.length + 1).replace(/\\/g, "/"), src: readFileSync(f, "utf8") }))
      .filter(({ rel, src }) => rel !== ALLOWED && definition.test(src))
      .map(({ rel }) => rel);
    expect(offenders, `duplicate formatter definition in: ${offenders.join(", ")}`).toEqual([]);
  });
});
