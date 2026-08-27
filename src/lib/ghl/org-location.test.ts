import { describe, it, expect, vi, beforeEach } from "vitest";

const maybeSingle = vi.fn();
const rpc = vi.fn(() => ({ maybeSingle }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-service", () => ({
  createServiceRoleClient: () => ({ rpc }),
}));
vi.mock("./client", () => ({
  resolveGhlLocationId: (kind: string) =>
    kind === "restoration" ? "ENV_RESTORATION" : "ENV_RENTALS",
}));

const { resolveGhlTargetForOrg, ghlAuthForTarget } = await import("./org-location");

beforeEach(() => {
  vi.clearAllMocks();
  maybeSingle.mockResolvedValue({ data: null, error: null });
  process.env.GHL_API_KEY = "server-token";
});

describe("resolveGhlTargetForOrg", () => {
  it("falls back to the env location when the org has no connection", async () => {
    const t = await resolveGhlTargetForOrg("org-1");
    expect(t).toEqual({ source: "env", locationId: "ENV_RENTALS", mode: "subaccount" });
  });

  it("honours the fallback kind", async () => {
    const t = await resolveGhlTargetForOrg(null, "restoration");
    expect(t?.locationId).toBe("ENV_RESTORATION");
  });

  it("uses the org's own location once connected", async () => {
    maybeSingle.mockResolvedValue({
      data: { location_id: "LOC_KHAN", mode: "foreign_agency" },
      error: null,
    });
    const t = await resolveGhlTargetForOrg("org-khan");
    expect(t).toEqual({
      source: "org",
      orgId: "org-khan",
      locationId: "LOC_KHAN",
      mode: "foreign_agency",
    });
  });

  // Rerouting an operator's traffic into the shared default because a lookup
  // blipped would put their leads in someone else's pipeline.
  it("returns null rather than falling back when the lookup errors", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await resolveGhlTargetForOrg("org-1")).toBeNull();
  });

  it("skips the lookup entirely without an org", async () => {
    await resolveGhlTargetForOrg(null);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("ghlAuthForTarget", () => {
  it("authorizes a subaccount with the server token", () => {
    const auth = ghlAuthForTarget({ source: "env", locationId: "L", mode: "subaccount" });
    expect(auth).toEqual({ ok: true, token: "server-token", locationId: "L" });
  });

  // The worst failure mode in a reseller setup: our agency token pointed at an
  // account we do not own.
  it("REFUSES to send the server token to a foreign agency", () => {
    const auth = ghlAuthForTarget({
      source: "org",
      orgId: "o",
      locationId: "LOC_KHAN",
      mode: "foreign_agency",
    });
    expect(auth).toEqual({ ok: false, reason: "credential_pending" });
  });

  it("refuses when nothing is configured", () => {
    expect(ghlAuthForTarget(null)).toEqual({ ok: false, reason: "not_configured" });
    delete process.env.GHL_API_KEY;
    expect(
      ghlAuthForTarget({ source: "env", locationId: "L", mode: "subaccount" })
    ).toEqual({ ok: false, reason: "not_configured" });
  });
});
