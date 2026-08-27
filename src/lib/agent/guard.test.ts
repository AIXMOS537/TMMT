import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The house orgs must never be gated by the licensing system. TMMT RENTALS'
 * own licence row is active:false — without the exemption, the app rejects its
 * own lead capture the day public forms go live.
 */

const single = vi.fn();
vi.mock("./supabase-server", () => ({
  createServiceSupabase: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  }),
}));

const TMMT = "8e651b25-e7c8-4356-af64-1716a82053b0";
const AIXMOS = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CUSTOMER = "370cd891-f6c0-4fcc-a36a-bc25f27ca229";

describe("guardOrganization", () => {
  beforeEach(() => {
    single.mockReset();
    delete process.env.B3_KILL_SWITCH;
  });
  afterEach(() => {
    delete process.env.B3_KILL_SWITCH;
  });

  it("lets the house orgs through even with an inactive licence", async () => {
    const { guardOrganization } = await import("./guard");
    // active:false is the real state of the TMMT RENTALS row today.
    single.mockResolvedValue({ data: { active: false, kill_command: null } });

    await expect(guardOrganization(TMMT)).resolves.toBeUndefined();
    await expect(guardOrganization(AIXMOS)).resolves.toBeUndefined();
    // Not even queried — the exemption returns before touching the database.
    expect(single).not.toHaveBeenCalled();
  });

  it("still blocks a customer org whose licence is inactive", async () => {
    const { guardOrganization, LicenseDisabledError } = await import("./guard");
    single.mockResolvedValue({ data: { active: false, kill_command: null } });

    await expect(guardOrganization(CUSTOMER)).rejects.toBeInstanceOf(LicenseDisabledError);
  });

  it("lets an active customer org through", async () => {
    const { guardOrganization } = await import("./guard");
    single.mockResolvedValue({ data: { active: true, kill_command: null } });

    await expect(guardOrganization(CUSTOMER)).resolves.toBeUndefined();
  });

  it("blocks a customer org carrying a wipe kill command", async () => {
    const { guardOrganization, LicenseDisabledError } = await import("./guard");
    single.mockResolvedValue({ data: { active: true, kill_command: "wipe" } });

    await expect(guardOrganization(CUSTOMER)).rejects.toBeInstanceOf(LicenseDisabledError);
  });

  it("blocks an org with no licence row at all", async () => {
    const { guardOrganization, LicenseDisabledError } = await import("./guard");
    single.mockResolvedValue({ data: null });

    await expect(guardOrganization(CUSTOMER)).rejects.toBeInstanceOf(LicenseDisabledError);
  });

  it("stops the house orgs too when the operational kill switch is set", async () => {
    const { guardOrganization, OperationalKillError } = await import("./guard");
    process.env.B3_KILL_SWITCH = "1";

    // The deliberate stop-everything lever has no exceptions, by design.
    await expect(guardOrganization(TMMT)).rejects.toBeInstanceOf(OperationalKillError);
    await expect(guardOrganization(CUSTOMER)).rejects.toBeInstanceOf(OperationalKillError);
  });
});
