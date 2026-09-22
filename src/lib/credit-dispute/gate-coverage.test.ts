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
  // Anything that can render correspondence.
  const LETTER_ENGINE = /from\s+["'][^"']*credit-dispute\/(letters\/(generator|advanced|render-from-decision)|engine\/gated-protocol)["']/;
  // Case state (writes rounds/assertions/evidence) — server actions only.
  const CASE_ENGINE = /from\s+["'][^"']*credit-dispute\/(engine\/case-state|evidence\/store\.server)["']/;
  const LEGACY = /\b(runDisputeProtocol|generatePendingLetters)\b/;
  const DESK_ACTIONS = "src/app/(command)/command/credit-dispute/actions.ts";
  // C2: the customer actions may use case state, but can NEVER render a letter.
  const CUSTOMER_ACTIONS = "src/app/my-credit/actions.ts";

  const appFiles = walk(join(root, "src", "app")).map((f) => relative(root, f).replace(/\\/g, "/"));
  const runtimeImports = (f: string, re: RegExp) =>
    readFileSync(join(root, f), "utf8")
      .split("\n")
      // Type-only imports are erased at build time and carry no code.
      .filter((l) => re.test(l) && !/^\s*import\s+type\b/.test(l));

  it("no app file other than the desk's actions.ts imports the letter engine at runtime", () => {
    expect(appFiles.filter((f) => f !== DESK_ACTIONS && runtimeImports(f, LETTER_ENGINE).length > 0)).toEqual([]);
  });

  it("the customer actions cannot reach the letter engine at all", () => {
    expect(runtimeImports(CUSTOMER_ACTIONS, LETTER_ENGINE)).toEqual([]);
    expect(readFileSync(join(root, CUSTOMER_ACTIONS), "utf8")).not.toMatch(/generateDisputeRound|reviewDisputeRound|recordRoundSent|recordDisputeResponse|authorizeFollowUp/);
  });

  it("only the two server-action modules touch case state at runtime", () => {
    expect(
      appFiles.filter((f) => f !== DESK_ACTIONS && f !== CUSTOMER_ACTIONS && runtimeImports(f, CASE_ENGINE).length > 0)
    ).toEqual([]);
  });

  it("nothing in src/app calls the legacy protocol", () => {
    expect(appFiles.filter((f) => LEGACY.test(readFileSync(join(root, f), "utf8")))).toEqual([]);
  });

  // C2-21: AIXMOS (or any agent/tool code) may read the counts-only queue later, but
  // may not approve, mark sent, record responses, authorize follow-ups or invent
  // assertions. The only callers of those engine functions are the owner-checked
  // desk actions (approve/sent/response) and, for a customer's OWN draft/confirm,
  // the customer actions.
  it("no agent / AIXMOS / tool code imports the credit engine or its actions", () => {
    const libFiles = walk(join(root, "src", "lib"))
      .concat(walk(join(root, "src", "app", "api")))
      .map((f) => relative(root, f).replace(/\\/g, "/"))
      .filter((f) => !f.startsWith("src/lib/credit-dispute/"));
    const CREDIT = /from\s+["'][^"']*(credit-dispute\/(engine|letters|policy|evidence)|command\/credit-dispute\/actions|my-credit\/actions)["']/;
    expect(libFiles.filter((f) => runtimeImports(f, CREDIT).length > 0)).toEqual([]);
  });

  it("approval / sent / response / follow-up are only reachable through the owner-checked desk actions", () => {
    const LIFECYCLE = /\b(reviewRound|markSent|recordResponse|authorizeFollowUp|classifyAssertion|reviewEvidence|linkCustomer|closeCase)\s*\(/;
    const callers = appFiles.filter((f) => LIFECYCLE.test(readFileSync(join(root, f), "utf8")));
    expect(callers).toEqual([DESK_ACTIONS]);
  });

  it("both action modules are server modules", () => {
    for (const f of [DESK_ACTIONS, CUSTOMER_ACTIONS]) {
      expect(readFileSync(join(root, f), "utf8").trimStart().startsWith('"use server"'), f).toBe(true);
    }
  });

  // Caught by the C2 production build, not by tests: a "use server" module may export
  // only async functions (types are erased). A const export breaks the build.
  it("the server-action modules export only async functions (and types)", () => {
    for (const f of [DESK_ACTIONS, CUSTOMER_ACTIONS]) {
      const bad = readFileSync(join(root, f), "utf8")
        .split("\n")
        .filter((l) => /^export\s+(const|let|var|class|function|default)\b/.test(l));
      expect(bad, f).toEqual([]);
    }
  });
});
