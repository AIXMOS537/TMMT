/**
 * The renter self-service contract.
 *
 * These tests pin the two things that make this path safe to expose to a member
 * of the public holding a link: that a token which is not exactly right yields
 * nothing, and that a database error never degrades into a reassuring blank page.
 *
 * The reason gate itself (three categories that must never reach a renter) is
 * enforced in SQL, inside client_bg_status, and was watched refusing a DNC_DNR row
 * against a real Postgres — see evidence/client-self-service-rehearsal.md. It
 * cannot be tested here without a database, and mocking it would only test the mock.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
/** Shared stub so individual tests can swap `from` without re-mocking the module. */
const svc: { rpc: typeof rpc; from?: unknown } = { rpc };
vi.mock("@/lib/supabase-service", () => ({
  createServiceRoleClient: () => svc,
}));

import { getClientBgStatus } from "./client-self-service";

const DECIDED = {
  status: "decided",
  decided: true,
  eligibility_status: "Not Eligible",
  reason_label: "Document / administrative deficiency",
  reason_description: "Missing, invalid, or incomplete documentation.",
  recoverable: true,
  date_verified: "2026-09-16",
  has_license: true,
  has_insurance_proof: false,
  has_paystub: false,
  verification_form_submitted: true,
};

const VALID = "d1111111-0000-4000-8000-000000000002";

beforeEach(() => rpc.mockReset());

describe("getClientBgStatus — what reaches the renter", () => {
  it("returns the decided row for a well-formed token", async () => {
    rpc.mockResolvedValue({ data: [DECIDED], error: null });
    await expect(getClientBgStatus(VALID)).resolves.toEqual(DECIDED);
    expect(rpc).toHaveBeenCalledWith("client_bg_status", { p_token: VALID });
  });

  it("trims surrounding whitespace from a pasted link", async () => {
    rpc.mockResolvedValue({ data: [DECIDED], error: null });
    await getClientBgStatus(`  ${VALID}\n`);
    expect(rpc).toHaveBeenCalledWith("client_bg_status", { p_token: VALID });
  });

  it("an unknown or expired token is an empty result, not an error", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(getClientBgStatus(VALID)).resolves.toBeNull();
  });
});

describe("getClientBgStatus — probing is refused before it reaches the database", () => {
  for (const [label, bad] of [
    ["empty string", ""],
    ["not a uuid", "not-a-token"],
    ["sql fragment", "' or 1=1 --"],
    ["truncated uuid", "d1111111-0000-4000-8000"],
    ["uuid with trailing junk", `${VALID}x`],
  ] as const) {
    it(`${label} returns null and never calls the database`, async () => {
      await expect(getClientBgStatus(bad)).resolves.toBeNull();
      expect(rpc).not.toHaveBeenCalled();
    });
  }
});

describe("getClientBgStatus — an error is not an empty result", () => {
  it("throws rather than rendering an empty status as if nothing were wrong", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    await expect(getClientBgStatus(VALID)).rejects.toThrow(
      "We could not load your status right now.",
    );
  });

  it("does not leak the database message to the renter", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'relation "background_checks" does not exist' },
    });
    await expect(getClientBgStatus(VALID)).rejects.not.toThrow(/background_checks/);
  });
});

describe("getClientJourneyForToken — one journey, or none", () => {
  // The service-role client is mocked per-table so the two lookups can be steered.
  function mockTables(bg: unknown, journeys: unknown[] | null, errors: Record<string, string> = {}) {
    rpc.mockReset();
    const from = vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      Object.assign(chain, {
        select: self,
        eq: self,
        gt: self,
        ilike: self,
        limit: () =>
          Promise.resolve({ data: journeys, error: errors.journey ? { message: errors.journey } : null }),
        maybeSingle: () =>
          Promise.resolve({ data: bg, error: errors.bg ? { message: errors.bg } : null }),
      });
      void table;
      return chain;
    });
    return from;
  }

  it("returns the single matching journey", async () => {
    const from = mockTables({ email: "R@Example.com " }, [{ id: "j1", good_standing: true, good_standing_days: 40, lto_eligible: false, program_track: "renter" }]);
    svc.from = from;
    const { getClientJourneyForToken } = await import("./client-self-service");
    await expect(getClientJourneyForToken(VALID)).resolves.toMatchObject({ id: "j1" });
  });

  it("refuses when the email matches more than one journey", async () => {
    svc.from = mockTables({ email: "dup@example.com" }, [{ id: "a" }, { id: "b" }]);
    const { getClientJourneyForToken } = await import("./client-self-service");
    // Showing one renter another's progress is worse than showing nothing.
    await expect(getClientJourneyForToken(VALID)).resolves.toBeNull();
  });

  it("returns null when no journey exists for that renter", async () => {
    svc.from = mockTables({ email: "none@example.com" }, []);
    const { getClientJourneyForToken } = await import("./client-self-service");
    await expect(getClientJourneyForToken(VALID)).resolves.toBeNull();
  });

  it("returns null when the token resolves to no background check", async () => {
    svc.from = mockTables(null, []);
    const { getClientJourneyForToken } = await import("./client-self-service");
    await expect(getClientJourneyForToken(VALID)).resolves.toBeNull();
  });

  it("a lookup error throws instead of silently showing no progress", async () => {
    svc.from = mockTables({ email: "r@example.com" }, null, { journey: "permission denied" });
    const { getClientJourneyForToken } = await import("./client-self-service");
    await expect(getClientJourneyForToken(VALID)).rejects.toThrow(/could not load/i);
  });

  it("a malformed token never reaches the database", async () => {
    const from = mockTables(null, []);
    svc.from = from;
    const { getClientJourneyForToken } = await import("./client-self-service");
    await expect(getClientJourneyForToken("nope")).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});
