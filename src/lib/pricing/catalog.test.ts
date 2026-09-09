import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  MEMBER_97_CENTS,
  LEAD_WEBHOOK_SKU_PRICE_CENTS,
  PROGRAM_FORM_SKUS,
  AGENT_HUMAN_HANDOFF_THRESHOLD_CENTS,
  CREDIT_PATH_A_MONTHLY_MAX_CENTS,
} from "./catalog";

/**
 * These values are PINNED, not designed. The authoritative price list is an
 * open owner decision (OWNER_DECISIONS.md D-1, D-2). A failing assertion here
 * means someone changed a price in code; that must come with the decision
 * that authorised it, recorded in the commit.
 */
describe("pricing catalog pins today's numbers", () => {
  it("membership is $97", () => {
    expect(MEMBER_97_CENTS).toBe(9700);
  });

  it("lead webhook sku prices are unchanged from the inline table they replaced", () => {
    expect(LEAD_WEBHOOK_SKU_PRICE_CENTS).toEqual({
      "lead-magnet": 0,
      "intro-97": 9700,
      training: 700000,
      "rental-in-a-box": 1500000,
      flagship: 5000000,
    });
  });

  it("program form skus are unchanged from the inline table they replaced", () => {
    expect(PROGRAM_FORM_SKUS).toEqual({
      apply: { sku: "lead-magnet", priceCents: 0, title: "AIXMOS CHUMMO intake" },
      "academy-join": { sku: "intro-97", priceCents: 9700, title: "Academy $97" },
      "operator-apply": { sku: "operator-seat", priceCents: 29700, title: "Operator seat $297" },
      sovereign: { sku: "flagship", priceCents: 5000000, title: "Sovereign $50K" },
    });
  });

  it("the agent handoff threshold and the credit Path A cap are the membership price", () => {
    expect(AGENT_HUMAN_HANDOFF_THRESHOLD_CENTS).toBe(9700);
    expect(CREDIT_PATH_A_MONTHLY_MAX_CENTS).toBe(9700);
  });

  it("records the D-2 contradiction instead of hiding it: operator seat is $297 here", () => {
    // When D-2 is answered this assertion is updated together with the decision.
    expect(PROGRAM_FORM_SKUS["operator-apply"].priceCents).toBe(29700);
  });
});

/**
 * ENFORCEMENT: the four inline tables this module replaced must not come back.
 * A `SKU_PRICE_CENTS` / `PROGRAM_SKUS` literal or a bare 9700 / 29700 in
 * non-test app code outside this module is a price defined somewhere the
 * owner decisions do not see.
 */
describe("no price constants outside src/lib/pricing", () => {
  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".next") continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) out.push(...walk(p));
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
    }
    return out;
  }
  const SRC = join(process.cwd(), "src");
  const ALLOWED = new Set(["src/lib/pricing/catalog.ts"]);
  // 9700 / 29700 as a number literal (not part of a longer number or an id).
  const priceLiteral = /(^|[^\d_])(9700|29700)(?![\d_])/;
  // An inline table is a definition with a LITERAL on the right-hand side — an
  // object literal for the sku maps, a digit for the thresholds. Aliases that
  // import from the catalog (`const SKU_PRICE_CENTS = LEAD_WEBHOOK_SKU_PRICE_CENTS`)
  // are the intended pattern and must pass.
  const inlineTable =
    /const (SKU_PRICE_CENTS|PROGRAM_SKUS)\b[^=\n]*=\s*\{|const (HUMAN_PRICE_THRESHOLD_CENTS|PATH_A_MONTHLY_MAX_CENTS)\s*=\s*\d/;

  it("no inline price tables or bare $97/$297 literals outside the catalog", () => {
    const offenders = walk(SRC)
      .map((f) => ({ rel: f.slice(process.cwd().length + 1).replace(/\\/g, "/"), src: readFileSync(f, "utf8") }))
      .filter(({ rel }) => !ALLOWED.has(rel))
      .filter(({ src }) => {
        const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
        return inlineTable.test(code) || priceLiteral.test(code);
      })
      .map(({ rel }) => rel);
    expect(offenders, `price defined outside src/lib/pricing: ${offenders.join(", ")}`).toEqual([]);
  });
});
