import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the ACT half of the prequal lane. The decision half is covered in
 * aixmos-prequal.test.ts; what matters here is the order of side effects and,
 * above all, that nobody is handed to another company without consent.
 */

const addContactTag = vi.fn<(id: string, tag: string, kind?: string) => Promise<void>>();
const resolveGhlContactId = vi.fn<() => Promise<string | null>>();
const isGhlConfigured = vi.fn<() => boolean>();
const rpc = vi.fn();
const maybeSingle = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("@/lib/ghl/client", () => ({
  addContactTag: (...a: [string, string, string?]) => addContactTag(...a),
  isGhlConfigured: () => isGhlConfigured(),
}));

vi.mock("@/lib/ghl/resolve-contact", () => ({
  resolveGhlContactId: () => resolveGhlContactId(),
}));

vi.mock("@/lib/supabase-server", () => ({
  createSSRClient: async () => ({
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({ limit: () => ({ maybeSingle: () => maybeSingle() }) }),
          }),
        }),
      }),
    }),
  }),
}));

const { routeDeclinedApplicant } = await import("./aixmos-prequal-act");

beforeEach(() => {
  vi.clearAllMocks();
  isGhlConfigured.mockReturnValue(true);
  resolveGhlContactId.mockResolvedValue("ghl_contact_1");
  addContactTag.mockResolvedValue(undefined);
  maybeSingle.mockResolvedValue({ data: null, error: null });
  rpc.mockResolvedValue({ data: {}, error: null });
});

const declined = {
  eligibilityStatus: "Not Eligible",
  contactRef: "someone@example.com",
  email: "someone@example.com",
};

describe("routeDeclinedApplicant", () => {
  it("does nothing at all for an eligible applicant", async () => {
    const out = await routeDeclinedApplicant({
      eligibilityStatus: "Eligible",
      contactRef: "someone@example.com",
    });
    expect(out.action).toBe("none");
    expect(out.tagApplied).toBeNull();
    expect(out.handoff).toBe("not_applicable");
    expect(addContactTag).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("waits for the manager rather than pre-empting the decision", async () => {
    const out = await routeDeclinedApplicant({
      eligibilityStatus: "Need Manager's Review",
      contactRef: "someone@example.com",
    });
    expect(out.action).toBe("await_review");
    expect(addContactTag).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("tags an out-of-radius applicant and never hands them over", async () => {
    const out = await routeDeclinedApplicant({
      eligibilityStatus: "out of radius",
      contactRef: "far@example.com",
      email: "far@example.com",
      // Even WITH consent on file, geography is not a credit lead.
      consentCapturedVia: "sms",
    });
    expect(out.tagApplied).toBe("market-waitlist");
    expect(out.handoff).toBe("not_applicable");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("tags a profile decline but holds the handoff until consent exists", async () => {
    const out = await routeDeclinedApplicant(declined);
    expect(out.tagApplied).toBe("aixmos-prequal");
    expect(out.handoff).toBe("awaiting_consent");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("creates the handoff once consent is on record", async () => {
    const out = await routeDeclinedApplicant({ ...declined, consentCapturedVia: "sms" });
    expect(out.handoff).toBe("created");
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(fn).toBe("request_handoff");
    // The slugs partner_referrals CHECKs against — organizations.name is rejected.
    expect(args.p_source_org).toBe("tmmt");
    expect(args.p_dest_org).toBe("aixmos");
    expect(args.p_consent_channel).toBe("sms");
  });

  it("does not stack a second referral while one is still pending", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "existing" }, error: null });
    const out = await routeDeclinedApplicant({ ...declined, consentCapturedVia: "sms" });
    expect(out.handoff).toBe("already_open");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("still tags when GHL has no matching contact, and says so", async () => {
    resolveGhlContactId.mockResolvedValue(null);
    const out = await routeDeclinedApplicant(declined);
    expect(out.tagApplied).toBeNull();
    expect(out.errors.join(" ")).toContain("No GHL contact matched");
  });

  it("reports a rejected RPC instead of throwing", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "violates check constraint" } });
    const out = await routeDeclinedApplicant({ ...declined, consentCapturedVia: "sms" });
    expect(out.handoff).toBe("failed");
    expect(out.errors.join(" ")).toContain("violates check constraint");
  });

  it("still attempts the handoff when GHL is switched off entirely", async () => {
    isGhlConfigured.mockReturnValue(false);
    const out = await routeDeclinedApplicant({ ...declined, consentCapturedVia: "sms" });
    expect(out.tagApplied).toBeNull();
    expect(out.handoff).toBe("created");
  });
});
