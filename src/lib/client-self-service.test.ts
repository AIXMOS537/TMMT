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
vi.mock("@/lib/supabase-service", () => ({
  createServiceRoleClient: () => ({ rpc }),
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
