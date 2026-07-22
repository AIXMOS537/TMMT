import { describe, expect, it } from "vitest";
import { inferLane } from "./net";
import { isInboundMessagePayload } from "@/lib/ghl/handlers/inbound-message";

describe("inferLane", () => {
  it("defaults to rental (the main line)", () => {
    expect(inferLane()).toBe("rental");
    expect(inferLane("webform", "intro-97")).toBe("rental");
    expect(inferLane(null, undefined, "facebook")).toBe("rental");
  });

  it("routes detailing signals to the detail lane", () => {
    expect(inferLane("detail-landing")).toBe("detail");
    expect(inferLane("webform", "ceramic coating special")).toBe("detail");
    expect(inferLane("Free Vehicle Health Check")).toBe("detail");
    expect(inferLane("interior deep clean")).toBe("detail");
  });

  it("is case-insensitive and ignores null/undefined signals", () => {
    expect(inferLane(undefined, "CERAMIC")).toBe("detail");
    expect(inferLane(null, "Detailing quote please")).toBe("detail");
  });
});

describe("isInboundMessagePayload", () => {
  it("accepts GHL inbound message shapes", () => {
    expect(
      isInboundMessagePayload({ type: "InboundMessage", contactId: "abc123" })
    ).toBe(true);
    expect(
      isInboundMessagePayload({ direction: "inbound", contactId: "abc123", body: "hi" })
    ).toBe(true);
  });

  it("rejects outbound, contact-less, and unrelated payloads", () => {
    expect(isInboundMessagePayload({ direction: "outbound", contactId: "abc" })).toBe(false);
    expect(isInboundMessagePayload({ type: "InboundMessage" })).toBe(false);
    expect(isInboundMessagePayload({ email: "x@y.com", tags: [] })).toBe(false);
  });
});
