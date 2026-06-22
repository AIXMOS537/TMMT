import { describe, it, expect } from "vitest";
import {
  MOE_LEGACY,
  TMMT_RENTALS,
  VERTICALS,
  getVerticalByOrgName,
  getVerticalBySlug,
  seatPlanForStage,
} from "./registry";

describe("vertical registry", () => {
  it("registers TMMT Rentals and Moe Legacy with unique slugs", () => {
    const slugs = VERTICALS.map((v) => v.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(getVerticalBySlug("moe-legacy")).toBe(MOE_LEGACY);
    expect(getVerticalBySlug("tmmt-rentals")).toBe(TMMT_RENTALS);
  });

  it("resolves by org name case-insensitively", () => {
    expect(getVerticalByOrgName("MOE LEGACY")).toBe(MOE_LEGACY);
    expect(getVerticalByOrgName("Moe Legacy")).toBe(MOE_LEGACY);
    expect(getVerticalByOrgName("TMMT Rentals")).toBe(TMMT_RENTALS);
  });

  it("Moe Legacy uses credit-guidance compliance vocabulary", () => {
    expect(MOE_LEGACY.complianceLabel.toLowerCase()).toContain("guidance");
    expect(MOE_LEGACY.complianceLabel.toLowerCase()).toContain("not credit repair");
    expect(MOE_LEGACY.agentPersonaOverlay.forbidden_phrases).toContain("credit repair");
  });

  it("Moe Legacy and TMMT Rentals do not share the same org name", () => {
    expect(MOE_LEGACY.orgName).not.toBe(TMMT_RENTALS.orgName);
  });
});

describe("seatPlanForStage", () => {
  it("learn stage is fenced viewer with no revenue share", () => {
    const plan = seatPlanForStage("learn");
    expect(plan.orgRole).toBe("viewer");
    expect(plan.revenueSharePct).toBe(0);
    expect(plan.certified).toBe(false);
  });

  it("earn stage is certified operator with 70% split", () => {
    const plan = seatPlanForStage("earn");
    expect(plan.orgRole).toBe("dispatcher");
    expect(plan.revenueSharePct).toBe(70);
    expect(plan.certified).toBe(true);
  });

  it("graduate stage maps to tenant_admin for agency owners", () => {
    const plan = seatPlanForStage("graduate");
    expect(plan.orgRole).toBe("tenant_admin");
    expect(plan.appRole).toBe("partner");
  });
});
