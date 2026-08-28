import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Outbound GHL calls must honour a caller-supplied location, so one app can
 * drive every sub-account under the agency. These used to read
 * process.env.GHL_LOCATION_ID directly and pinned all traffic to one.
 */

const {
  listPipelines,
  findPipelineStageId,
  updateOpportunityStage,
  sendConversationMessage,
} = await import("./client");

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
      message: "hi",
      locationId: "SUB_D",
    });
    expect(body().locationId).toBe("SUB_D");
  });

  it("sends nothing at all when no location can be resolved", async () => {
    delete process.env.GHL_LOCATION_ID;
    await sendConversationMessage({ contactId: "c1", type: "SMS", message: "hi" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("upsertOutboundGhlContact", () => {
  it("creates a contact in the given location when none exists", async () => {
    const { upsertOutboundGhlContact } = await import("./client");
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({}), text: async () => "" })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contact: { id: "new-1" } }),
        text: async () => "",
      });
    const id = await upsertOutboundGhlContact({
      name: "Ada Lovelace",
      email: "ada@example.com",
      tags: ["tmmt-customer"],
      locationId: "SUB_E",
    });
    expect(id).toBe("new-1");
    expect(url(1)).toContain("/contacts/");
    expect(body(1).locationId).toBe("SUB_E");
    expect(body(1).firstName).toBe("Ada");
    expect(body(1).tags).toEqual(["tmmt-customer"]);
  });

  it("returns null when email and phone are both missing", async () => {
    const { upsertOutboundGhlContact } = await import("./client");
    const id = await upsertOutboundGhlContact({ name: "Nobody" });
    expect(id).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
