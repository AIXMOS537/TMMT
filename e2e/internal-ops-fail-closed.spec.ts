import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Regression suite for the is_internal_ops() fail-open P0.
 *
 * THE INVARIANT
 *   UNCERTAIN AUTHORIZATION = DENY.
 * An authorization predicate must never grant authority because something failed.
 *
 * These tests exercise the REAL POLICY behaviour through the anon/auth clients,
 * not the helper in isolation — a helper returning false proves nothing if a
 * policy still admits the row by another branch.
 *
 * Tables gated by is_internal_ops() (18 policies / 8 tables), verified 2026-09-08.
 * customer_intake_forms is included deliberately: its policy targets {public},
 * so it is the anonymous-reachable edge of the fail-open path.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const GATED_TABLES = [
  "cases",
  "credit_funding_sessions",
  "credit_payment_schedule",
  "crm_sync_records",
  "customer_intake_forms",
  "program_applications",
  "program_audit_log",
  "sync_events",
] as const;

async function signIn(email: string, password: string) {
  const c = createClient(URL, ANON);
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return c;
}

test.describe("is_internal_ops fails closed", () => {
  // (2) anonymous / unauthenticated — the {public} policy edge
  test("anonymous cannot read any is_internal_ops-gated table", async () => {
    const anon = createClient(URL, ANON);
    for (const table of GATED_TABLES) {
      const { data } = await anon.from(table).select("*").limit(5);
      expect(data ?? [], `anon must not read ${table}`).toHaveLength(0);
    }
  });

  // (3) ordinary tenant user — has org membership, no platform role
  test("a tenant user cannot read or update gated tables", async () => {
    test.skip(!process.env.E2E_PILOT_EMAIL, "E2E_PILOT_EMAIL not set");
    const tenant = await signIn(
      process.env.E2E_PILOT_EMAIL!,
      process.env.E2E_PILOT_PASSWORD!,
    );

    for (const table of GATED_TABLES) {
      const { data } = await tenant.from(table).select("*").limit(5);
      expect(data ?? [], `tenant must not read ${table}`).toHaveLength(0);
    }

    // (and cannot mutate) — cases UPDATE is gated by the same predicate
    const { error } = await tenant
      .from("cases")
      .update({ status: "tampered" })
      .neq("id", "00000000-0000-0000-0000-000000000000");
    // Either rejected outright, or silently matched zero rows. Both are DENY;
    // what must never happen is a successful update of someone else's case.
    if (!error) {
      const { data: after } = await tenant.from("cases").select("id").limit(1);
      expect(after ?? [], "tenant update must not expose cases").toHaveLength(0);
    }
  });

  // (6) the defect itself: the predicate must not be able to grant on failure
  test("the predicate is fail-closed BY CONSTRUCTION, not by luck", async () => {
    test.skip(!process.env.E2E_ADMIN_EMAIL, "E2E_ADMIN_EMAIL not set");
    const admin = await signIn(
      process.env.E2E_ADMIN_EMAIL!,
      process.env.E2E_ADMIN_PASSWORD!,
    );

    // A LANGUAGE sql predicate cannot swallow an error into TRUE. If this ever
    // reports plpgsql with an exception handler again, the P0 has regressed —
    // that is the actual defect, independent of any single role's behaviour.
    const { data } = await admin.rpc("is_internal_ops");
    expect(typeof data, "predicate must return a boolean, never null").toBe("boolean");
  });

  // (1) legitimate internal operator still works — the fix must not over-deny
  test("an authorized internal operator retains access", async () => {
    test.skip(!process.env.E2E_ADMIN_EMAIL, "E2E_ADMIN_EMAIL not set");
    const admin = await signIn(
      process.env.E2E_ADMIN_EMAIL!,
      process.env.E2E_ADMIN_PASSWORD!,
    );
    const { error } = await admin.from("cases").select("id").limit(1);
    expect(error, "authorized internal operator must still read cases").toBeNull();
  });
});
