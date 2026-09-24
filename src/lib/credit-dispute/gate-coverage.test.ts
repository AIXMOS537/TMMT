import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { CreditProfile, NegativeItem } from "./types";
import { ComplianceGateError, isGateOpen } from "../../../shared/compliance-gates/gate";
import { generateCeaseAndDesist, generateIntentToLitigate, generateMetro2Dispute } from "./letters/advanced";
import { generateLetter } from "./letters/generator";
import { generatePendingLetters, LegacyProtocolDisabledError, runDisputeProtocol } from "./engine/protocol";

/**
 * C1-002 — ONE enforceable boundary.
 *
 * 1. With the REAL gate config (closed), every letter entry point refuses —
 *    including the advanced.ts exports that used to have no gate at all.
 * 2. The legacy ungated protocol refuses regardless of the gate.
 * 3. No browser-side file can reach the letter engine: only the desk's server
 *    actions import it. A future button, API route or AIXMOS action has to go
 *    through generateDisputeRound(), which applies the policy.
 */

const profile: CreditProfile = {
  id: "p1",
  fullName: "Test",
  currentAddress: { street: "1 St", city: "C", state: "VA", zip: "22150" },
};
const item: NegativeItem = { id: "i1", bureau: "experian", itemType: "collection", furnisherName: "X", currentRound: 0, status: "draft", inaccuracyDetails: "x" };

describe("with the real (closed) CROA gate", () => {
  it("the gate is closed in this build", () => {
    expect(isGateOpen("croa_contracts_attorney_approved")).toBe(false);
  });

  it.each([
    ["generateLetter", () => generateLetter("initial_611", profile, item, 1)],
    ["generateIntentToLitigate", () => generateIntentToLitigate(profile, item, 1, ["Round 1"])],
    ["generateMetro2Dispute", () => generateMetro2Dispute(profile, item, 1, ["x"])],
    ["generateCeaseAndDesist", () => generateCeaseAndDesist(profile, item, 1)],
  ])("%s refuses", (_l, run) => {
    expect(run).toThrow(ComplianceGateError);
  });
});

describe("the legacy ungated protocol is disabled", () => {
  it("runDisputeProtocol refuses", () => {
    expect(() => runDisputeProtocol(profile, [item])).toThrow(LegacyProtocolDisabledError);
  });
  it("generatePendingLetters refuses", () => {
    expect(() => generatePendingLetters(profile, [item])).toThrow(LegacyProtocolDisabledError);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

describe("only the server actions reach the letter engine", () => {
  const root = process.cwd();
  const ENGINE = /from\s+["'][^"']*credit-dispute\/(letters\/(generator|advanced|render-from-decision)|engine\/(gated-protocol|case-state))["']/;
  const LEGACY = /\b(runDisputeProtocol|generatePendingLetters)\b/;
  const ALLOWED = new Set(["src/app/(command)/command/credit-dispute/actions.ts"]);

  const appFiles = walk(join(root, "src", "app")).map((f) => relative(root, f).replace(/\\/g, "/"));

  it("no app file other than actions.ts imports the letter engine at runtime", () => {
    const offenders = appFiles.filter((f) => {
      if (ALLOWED.has(f)) return false;
      const src = readFileSync(join(root, f), "utf8");
      // Type-only imports are erased at build time and carry no code.
      const runtime = src.split("\n").filter((l) => ENGINE.test(l) && !/^\s*import\s+type\b/.test(l));
      return runtime.length > 0;
    });
    expect(offenders).toEqual([]);
  });

  it("nothing in src/app calls the legacy protocol", () => {
    expect(appFiles.filter((f) => LEGACY.test(readFileSync(join(root, f), "utf8")))).toEqual([]);
  });

  it("the actions module is a server module", () => {
    const src = readFileSync(join(root, "src/app/(command)/command/credit-dispute/actions.ts"), "utf8");
    expect(src.trimStart().startsWith('"use server"')).toBe(true);
  });
});
