import { describe, expect, it } from "vitest";
import { isPaidOnlyTag, MASTER_PIPELINE, resolveDoor } from "./doors";

describe("resolveDoor", () => {
  it("maps rental lead intake onto the master pipeline with tmmt-customer", () => {
    const d = resolveDoor({ formSlug: "lead-intake" });
    expect(d.family).toBe("rentals");
    expect(d.tenant).toBe("tmmt_property");
    expect(d.location).toBe("rentals");
    expect(d.tags).toContain("tmmt-customer");
    expect(d.pipelineName).toBe(MASTER_PIPELINE);
    expect(d.stageName).toBe("TMMT Lead");
    expect(d.legalGate).toBe("none");
  });

  it("maps academy join without applying member-97", () => {
    const d = resolveDoor({ formSlug: "academy-join" });
    expect(d.family).toBe("academy");
    expect(d.tags).toEqual(["academy-apply"]);
    expect(d.tags.some(isPaidOnlyTag)).toBe(false);
    expect(d.stageName).toBe("Membership Offered");
  });

  it("maps operator apply to operator:candidate", () => {
    const d = resolveDoor({ formSlug: "operator-apply" });
    expect(d.tags).toContain("operator:candidate");
    expect(d.location).toBe("restoration");
  });

  it("maps dealer apply onto the dealer pipeline", () => {
    const d = resolveDoor({ formSlug: "dealer-apply" });
    expect(d.family).toBe("dealer");
    expect(d.tags).toContain("dealer-prospect");
    expect(d.pipelineName).toMatch(/dealership/i);
  });

  it("legal-gates credit intake — inquiry tag only, no pipeline", () => {
    const d = resolveDoor({ formSlug: "credit-funding-intake" });
    expect(d.family).toBe("credit");
    expect(d.tenant).toBe("moe_legacy");
    expect(d.legalGate).toBe("l1-l10");
    expect(d.pipelineName).toBeNull();
    expect(d.tags).toEqual(["credit-inquiry"]);
    expect(d.tags.some(isPaidOnlyTag)).toBe(false);
  });

  it("Moe Legacy org always legal-gates even if the SKU looks like academy", () => {
    const d = resolveDoor({ orgSlug: "moe_legacy", sku: "intro-97" });
    expect(d.legalGate).toBe("l1-l10");
    expect(d.family).toBe("credit");
  });

  it("maps landing SKUs to the same doors as forms", () => {
    expect(resolveDoor({ sku: "intro-97" }).id).toBe("academy-join");
    expect(resolveDoor({ sku: "flagship" }).id).toBe("sovereign");
    expect(resolveDoor({ sku: "rental-in-a-box" }).id).toBe("lead-intake");
  });

  it("maps business lines onto rental verticals", () => {
    const d = resolveDoor({ businessLine: "express" });
    expect(d.family).toBe("vertical");
    expect(d.tags).toEqual(["tmmt-customer", "line-express"]);
    expect(d.location).toBe("rentals");
  });

  it("defaults unknown surfaces to rental lead", () => {
    const d = resolveDoor({});
    expect(d.id).toBe("lead-intake");
  });
});
