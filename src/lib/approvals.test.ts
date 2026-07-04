import { describe, it, expect } from "vitest";
import { canDecide, decisionToStatus, describeActionType } from "./approvals-core";
import type { GatedActionType } from "../../shared/owner-approval-gate/approval";

describe("canDecide", () => {
  it("allows deciding only pending actions", () => {
    expect(canDecide("pending")).toBe(true);
  });
  it("refuses to re-decide terminal actions", () => {
    expect(canDecide("approved")).toBe(false);
    expect(canDecide("rejected")).toBe(false);
  });
});

describe("decisionToStatus", () => {
  it("maps approve -> approved and reject -> rejected", () => {
    expect(decisionToStatus("approve")).toBe("approved");
    expect(decisionToStatus("reject")).toBe("rejected");
  });
});

describe("describeActionType", () => {
  const cases: [GatedActionType, string][] = [
    ["customer_message", "Customer message"],
    ["dispute_letter", "Credit-bureau dispute"],
    ["charge_fee", "Charge a fee"],
    ["pay_commission", "Pay a commission"],
    ["submit_funding_app", "Submit funding application"],
    ["move_money", "Move money"],
    ["production_automation_edit", "Edit production automation"],
  ];
  it.each(cases)("labels %s", (type, label) => {
    expect(describeActionType(type)).toBe(label);
  });

  it("covers every GatedActionType (no silent fallthrough)", () => {
    // If a new gated action type is added to the primitive, this list must grow.
    expect(cases).toHaveLength(7);
  });
});
