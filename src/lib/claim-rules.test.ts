/**
 * The rules are now shared by two copy suites, and both of those pass by
 * asserting an EMPTY violation list — which a rule set that matches nothing at
 * all would also do. These cases prove the rules still bite, using the strings
 * that actually shipped and caused the guard to be written.
 */
import { describe, it, expect } from "vitest";
import { findClaimViolations, type Claim } from "@/lib/claim-rules";

const rulesFor = (text: string) =>
  findClaimViolations([{ where: "t", text }]).map((v) => v.rule);

describe("claim rules — catches what shipped once", () => {
  it("catches the quantified score claim that was live on intro-97", () => {
    expect(rulesFor("Average client adds 47 points in 90 days")).toContain(
      "quantified score claim"
    );
    expect(rulesFor("we raise your score 100 in a month")).toContain("quantified score claim");
  });

  it("catches unsubstantiated volume claims", () => {
    expect(rulesFor("12,000+ downloaded the playbook")).toContain(
      "unsubstantiated volume claim"
    );
    expect(rulesFor("join 5,000 drivers already earning")).toContain(
      "unsubstantiated volume claim"
    );
  });

  it("catches price anchors", () => {
    expect(rulesFor("Others charge $7K+ for this")).toContain("price anchor claim");
  });

  it("catches outcome promises but allows the negated disclosure", () => {
    expect(rulesFor("You will be approved")).toContain("outcome promise");
    expect(rulesFor("We guarantee funding")).toContain("outcome promise");
    expect(rulesFor("No score change is promised or guaranteed")).not.toContain(
      "outcome promise"
    );
  });

  it("catches credit repair offered as a service, not disclaimed", () => {
    expect(rulesFor("We do credit repair for you")).toContain(
      "offers credit repair without disclaiming"
    );
    expect(rulesFor("Education only — this is not credit repair")).not.toContain(
      "offers credit repair without disclaiming"
    );
  });

  it("passes clean copy", () => {
    const clean: Claim[] = [
      { where: "a", text: "Rent a car. Go to work." },
      { where: "b", text: "We rent cars by the week to Uber and Lyft drivers." },
      { where: "c", text: "Your driver's license and your driving record." },
    ];
    expect(findClaimViolations(clean)).toEqual([]);
  });

  it("reports every rule a single string breaks, not just the first", () => {
    const rules = rulesFor("Others charge $7K+ and we guarantee 47 points");
    expect(rules).toContain("price anchor claim");
    expect(rules).toContain("outcome promise");
    expect(rules).toContain("quantified score claim");
  });
});
