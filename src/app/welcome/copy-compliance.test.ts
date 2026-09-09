/**
 * The public front door is customer-facing copy on a rental product that also
 * touches credit and background checks, so it is held to the same claim rules
 * as the paid-ad landing pages — one shared implementation in lib/claim-rules.
 */
import { describe, it, expect } from "vitest";
import { findClaimViolations, formatClaimViolations, type Claim } from "@/lib/claim-rules";
import {
  HERO,
  SECTIONS,
  ACADEMY_CTA,
  HONEST_NOTE,
  STAFF,
  LEGAL_LINKS,
} from "./copy";

/** Every customer-visible string on the page, labelled. */
function allStrings(): Claim[] {
  const out: Claim[] = [
    { where: "HERO.eyebrow", text: HERO.eyebrow },
    { where: "HERO.headline", text: HERO.headline },
    { where: "HERO.subhead", text: HERO.subhead },
    { where: "HERO.primaryCta", text: HERO.primaryCta },
    { where: "HERO.secondaryCta", text: HERO.secondaryCta },
    { where: "ACADEMY_CTA.label", text: ACADEMY_CTA.label },
    { where: "HONEST_NOTE", text: HONEST_NOTE },
    { where: "STAFF.label", text: STAFF.label },
    { where: "STAFF.linkLabel", text: STAFF.linkLabel },
  ];
  SECTIONS.forEach((s, i) => {
    out.push({ where: `SECTIONS[${i}].heading`, text: s.heading });
    out.push({ where: `SECTIONS[${i}].body`, text: s.body });
    s.items?.forEach((item, j) =>
      out.push({ where: `SECTIONS[${i}].items[${j}]`, text: item })
    );
  });
  LEGAL_LINKS.forEach((l, i) => out.push({ where: `LEGAL_LINKS[${i}].label`, text: l.label }));
  return out;
}

describe("front-door copy compliance", () => {
  it("makes no score, volume, anchor, promise or credit-repair claim", () => {
    const violations = findClaimViolations(allStrings());
    expect(violations, `\n${formatClaimViolations(violations)}\n`).toEqual([]);
  });

  it("says plainly that this is a rental and not credit repair", () => {
    // The page tells drivers their credit score is not the gate, which is
    // exactly the moment a reader can hear "credit product". It has to say
    // what it is not, in the same breath.
    const credit = SECTIONS.find((s) => /credit score/i.test(s.heading));
    expect(credit, "the credit section is gone — the disclosure went with it").toBeDefined();
    expect(credit!.body).toMatch(/not a loan/i);
    expect(credit!.body).toMatch(/not credit repair/i);
  });

  it("does not tell every driver they will qualify", () => {
    expect(HONEST_NOTE).toMatch(/not everyone qualifies/i);
    expect(HONEST_NOTE).toMatch(/results are different/i);
  });

  it("keeps a route to the rental agreement and privacy disclosures", () => {
    const hrefs = LEGAL_LINKS.map((l) => l.href);
    expect(hrefs).toContain("/legal/rental");
    expect(hrefs).toContain("/legal/privacy");
  });

  it("points its calls to action at real public routes", () => {
    // A front door whose buttons 404 or bounce to /login is worse than no door.
    for (const href of [HERO.primaryHref, HERO.secondaryHref, ACADEMY_CTA.href]) {
      expect(href.startsWith("/forms/"), `${href} must be a public /forms route`).toBe(true);
    }
    expect(STAFF.href).toBe("/login");
  });
});
