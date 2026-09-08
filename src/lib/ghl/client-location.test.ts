import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Outbound GHL calls must honour a caller-supplied location, so one app can
 * drive every sub-account under the agency. These used to read
 * process.env.GHL_LOCATION_ID directly and pinned all traffic to one.
 */

// sendConversationMessage now runs the outbound gate (A2P + do-not-contact +
// opt-out) before any SMS leaves. Stand it in here so these routing tests stay
// about routing; the gate has its own suite in src/lib/outbound-gate.test.ts.
const gate = vi.hoisted(() => ({
  assertOutboundAllowed: vi.fn(async () => ({ allowed: true, reason: "ok", flags: ["gate_allow"] })),
}));
vi.mock("@/lib/outbound-gate", () => ({
  assertOutboundAllowed: gate.assertOutboundAllowed,
  orgSmsVertical: () => "",
}));

const {
  listPipelines,
  findPipelineStageId,
  updateOpportunityStage,
  sendConversationMessage,
} = await import("./client");
const { SmsBlockedError } = await import("../../../shared/compliance-gates/sms-gate");

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GHL_API_KEY = "k";
  process.env.GHL_LOCATION_ID = "ENV_LOC";
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ pipelines: [], stages: [{ id: "s1", name: "Won" }] }),
    text: async () => "",
  });
});

afterEach(() => vi.unstubAllGlobals());

/** URL of the nth fetch call. */
const url = (n = 0) => String(fetchMock.mock.calls[n][0]);
/** Parsed JSON body of the nth fetch call. */
const body = (n = 0) => JSON.parse(String(fetchMock.mock.calls[n][1].body));

describe("outbound location routing", () => {
  it("listPipelines targets the location it was given", async () => {
    await listPipelines("SUB_B");
    expect(url()).toContain("locationId=SUB_B");
  });

  it("falls back to the env location when none is passed", async () => {
    await listPipelines();
    expect(url()).toContain("locationId=ENV_LOC");
  });

  it("url-encodes the location rather than interpolating it raw", async () => {
    await findPipelineStageId("p1", "Won", "a b&c");
    expect(url()).toContain("locationId=a%20b%26c");
  });

  it("updateOpportunityStage writes the given location into the body", async () => {
    await updateOpportunityStage({
      opportunityId: "o1",
      pipelineId: "p1",
      stageId: "s1",
      locationId: "SUB_C",
    });
    expect(body().locationId).toBe("SUB_C");
  });

  // The stage lookup has to happen in the SAME location as the update, or it
  // resolves a stage id that does not exist in the target sub-account.
  it("resolves the stage name in the target location, not the default", async () => {
    await updateOpportunityStage({
      opportunityId: "o1",
      pipelineId: "p1",
      stageName: "Won",
      locationId: "SUB_C",
    });
    expect(url(0)).toContain("locationId=SUB_C");
    expect(body(1).locationId).toBe("SUB_C");
  });

  it("sendConversationMessage sends from the given location", async () => {
    await sendConversationMessage({
      contactId: "c1",
      type: "SMS",
      phone: "+15551112222",
      message: "hi",
      locationId: "SUB_D",
    });
    expect(body().locationId).toBe("SUB_D");
  });

  it("sends nothing at all when no location can be resolved", async () => {
    delete process.env.GHL_LOCATION_ID;
    await sendConversationMessage({ contactId: "c1", type: "SMS", phone: "+15551112222", message: "hi" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("sendConversationMessage — outbound gate", () => {
  it("asks the gate with the phone, org, vertical and class before an SMS", async () => {
    await sendConversationMessage({
      contactId: "c1",
      type: "SMS",
      phone: "+15551112222",
      organizationId: "org-1",
      vertical: "rentals",
      message: "hi",
    });
    expect(gate.assertOutboundAllowed).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "+15551112222", organizationId: "org-1", vertical: "rentals", type: "transactional" })
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses an SMS without a phone — an unchecked send is not made", async () => {
    await expect(
      // @ts-expect-error — the type demands a phone for SMS; this pins the runtime guard too
      sendConversationMessage({ contactId: "c1", type: "SMS", message: "hi" })
    ).rejects.toBeInstanceOf(SmsBlockedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws and does not fetch when the gate refuses", async () => {
    gate.assertOutboundAllowed.mockResolvedValueOnce({ allowed: false, reason: "dnc", flags: ["dnc"] });
    await expect(
      sendConversationMessage({ contactId: "c1", type: "SMS", phone: "+15551112222", message: "hi" })
    ).rejects.toThrow(/dnc/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("email skips the phone-based checks and sends", async () => {
    await sendConversationMessage({ contactId: "c1", type: "Email", message: "hi", subject: "s" });
    expect(gate.assertOutboundAllowed).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
