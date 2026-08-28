import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
const createOpp = vi.fn();
const addTag = vi.fn();
const configured = vi.fn();

vi.mock("@/lib/ghl/client", () => ({
  upsertOutboundGhlContact: (...args: unknown[]) => upsert(...args),
  createOutboundGhlOpportunity: (...args: unknown[]) => createOpp(...args),
  addContactTag: (...args: unknown[]) => addTag(...args),
  isGhlConfigured: (...args: unknown[]) => configured(...args),
}));

const { routeDoorToPipeline } = await import("./door-router");

beforeEach(() => {
  vi.clearAllMocks();
  configured.mockReturnValue(true);
  upsert.mockResolvedValue("contact-1");
  createOpp.mockResolvedValue("opp-1");
  addTag.mockResolvedValue(undefined);
});

describe("routeDoorToPipeline", () => {
  it("skips when GHL is not configured", async () => {
    configured.mockReturnValue(false);
    const res = await routeDoorToPipeline({
      formSlug: "lead-intake",
      name: "Ada",
      email: "ada@example.com",
    });
    expect(res.skipped).toBe("ghl_not_configured");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("skips when there is no email or phone", async () => {
    const res = await routeDoorToPipeline({ formSlug: "lead-intake", name: "Ada" });
    expect(res.skipped).toBe("no_identifier");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("pushes a rental lead onto the master pipeline", async () => {
    const res = await routeDoorToPipeline({
      formSlug: "lead-intake",
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "[phone removed]",
    });
    expect(res.ok).toBe(true);
    expect(res.contactId).toBe("contact-1");
    expect(res.opportunityId).toBe("opp-1");
    expect(upsert.mock.calls[0][0].tags).toContain("tmmt-customer");
    expect(createOpp.mock.calls[0][0].pipelineName).toBe("TMMT → AIXMOS");
    expect(createOpp.mock.calls[0][0].stageName).toBe("TMMT Lead");
  });

  it("legal-gates credit — tags contact, never opens an opportunity", async () => {
    const res = await routeDoorToPipeline({
      formSlug: "credit-funding-intake",
      name: "Moe Lead",
      email: "lead@example.com",
    });
    expect(res.ok).toBe(true);
    expect(res.skipped).toBe("legal_gate_l1_l10");
    expect(res.opportunityId).toBeNull();
    expect(createOpp).not.toHaveBeenCalled();
    expect(upsert.mock.calls[0][0].tags).toEqual(["credit-inquiry"]);
  });

  it("fail-opens on GHL errors so the form still succeeds", async () => {
    upsert.mockRejectedValue(new Error("ghl down"));
    const res = await routeDoorToPipeline({
      formSlug: "apply",
      name: "X",
      email: "x@example.com",
    });
    expect(res.ok).toBe(false);
    expect(res.skipped).toBe("ghl down");
  });
});
