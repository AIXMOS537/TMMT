import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Proves the anon lead-intake path survives the missing SELECT grant.
 *
 * THE BUG (found end-to-end 2026-09-16): a public visitor submits as `anon`.
 * anon has INSERT on incoming_leads and a matching anon_insert_leads policy,
 * but deliberately NO SELECT — it must never read the lead book back. The
 * `.select("id")` in insertRow adds a RETURNING clause, Postgres evaluates it
 * against the missing grant, and fails the WHOLE statement with 42501. Nothing
 * is written, and every public lead is answered "Submission failed."
 */

const calls = vi.hoisted(() => ({ log: [] as Array<{ withReturning: boolean }> }));
const behaviour = vi.hoisted(() => ({ firstError: null as { code: string; message: string } | null }));

vi.mock("@/lib/supabase-server", () => ({
  createSSRClient: async () => ({
    from: () => ({
      insert: (_record: unknown) => {
        // A bare insert is awaited directly; `.select().maybeSingle()` chains.
        const bare = {
          then: (resolve: (v: unknown) => unknown) => {
            calls.log.push({ withReturning: false });
            return Promise.resolve(resolve({ error: null }));
          },
          select: () => ({
            maybeSingle: async () => {
              calls.log.push({ withReturning: true });
              return behaviour.firstError
                ? { data: null, error: behaviour.firstError }
                : { data: { id: "lead-1" }, error: null };
            },
          }),
        };
        return bare;
      },
    }),
  }),
}));

// linkFormToPerson is intentionally NOT mocked: it is fire-and-forget and its
// failure outside a request scope is caught and logged by insertRow. Seeing
// "[people] link failed" in this test's stderr is the proof that a people-link
// failure cannot take the visitor's submission down with it.

import { submitLeadIntake } from "./actions";

beforeEach(() => {
  calls.log = [];
  behaviour.firstError = null;
});

function form(): FormData {
  const fd = new FormData();
  fd.set("contact_name", "Test Renter");
  fd.set("phone", "5715550123");
  fd.set("email", "renter@example.com");
  return fd;
}

describe("public lead intake survives the missing anon SELECT grant", () => {
  it("succeeds normally when the returning clause is allowed", async () => {
    const res = await submitLeadIntake(form());
    expect(res.success).toBe(true);
    expect(calls.log).toEqual([{ withReturning: true }]);
  });

  it("RECOVERS from 42501 by retrying without the returning clause", async () => {
    behaviour.firstError = { code: "42501", message: "permission denied for table incoming_leads" };
    const res = await submitLeadIntake(form());

    // The visitor's lead is saved, not lost.
    expect(res.success).toBe(true);
    // Exactly two attempts: the returning one that failed, then the bare one.
    expect(calls.log).toEqual([{ withReturning: true }, { withReturning: false }]);
  });

  it("does not retry on an unrelated error — it reports failure honestly", async () => {
    behaviour.firstError = { code: "23505", message: "duplicate key" };
    const res = await submitLeadIntake(form());
    expect(res.success).toBe(false);
    expect(calls.log).toEqual([{ withReturning: true }]);
  });
});
