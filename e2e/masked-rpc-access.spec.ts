import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * The OTHER half of Customer #2 access — and the half that actually works.
 *
 * `customer2-tenant-isolation.spec.ts` reads the two sensitive tables DIRECTLY and, exactly
 * as its docstring predicts, a scoped org member reads zero rows from `customer_payments`
 * and `background_checks`. That is not a bug to fix by widening the RLS policy: the
 * admin-only lock is deliberate hardening from 20260828000000, and reversing it would
 * expose raw licences, paystubs and insurance payloads to every member of every org.
 *
 * The chosen architecture is a masked, org-scoped, SECURITY DEFINER RPC. So the product
 * requirement — "a customer org member can see their own payments and screening" — must be
 * asserted against THAT path, which is what this file does. Both files are needed:
 *   - the isolation spec proves the raw tables stay shut
 *   - this spec proves the intended door opens, and only onto the caller's own org
 *
 * Requires 20260916230000_client_and_org_scoped_sensitive_access.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function signIn(email: string, password: string) {
  const c = createClient(URL, ANON);
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return c;
}

test.describe("masked org-scoped access", () => {
  test.skip(
    !process.env.E2E_TMMT_EMAIL || !process.env.E2E_PILOT_EMAIL,
    "E2E_*_EMAIL not set — needs two NON-ADMIN scoped users",
  );

  test("neither user is privileged, or this file proves nothing", async () => {
    for (const [email, password] of [
      [process.env.E2E_TMMT_EMAIL!, process.env.E2E_TMMT_PASSWORD!],
      [process.env.E2E_PILOT_EMAIL!, process.env.E2E_PILOT_PASSWORD!],
    ]) {
      const c = await signIn(email, password);
      const { data: isAdmin } = await c.rpc("is_platform_admin");
      const { data: isStaff } = await c.rpc("is_staff");
      expect(isAdmin, `${email} must not be a platform admin`).toBe(false);
      expect(isStaff, `${email} must not be staff`).toBe(false);
    }
  });

  for (const rpc of ["bg_check_queue", "customer_payments_queue"] as const) {
    test(`${rpc}: a scoped member reads their own org, and only their own`, async () => {
      const a = await signIn(process.env.E2E_TMMT_EMAIL!, process.env.E2E_TMMT_PASSWORD!);
      const b = await signIn(process.env.E2E_PILOT_EMAIL!, process.env.E2E_PILOT_PASSWORD!);

      const { data: aRows, error: aErr } = await a.rpc(rpc, { p_status: null, p_limit: 500 });
      const { data: bRows, error: bErr } = await b.rpc(rpc, { p_status: null, p_limit: 500 });

      expect(aErr, `${rpc} must be callable by a scoped member`).toBeNull();
      expect(bErr, `${rpc} must be callable by a scoped member`).toBeNull();

      // The product assertion: the door actually opens.
      expect((aRows ?? []).length, `${rpc}: org A must see its own rows`).toBeGreaterThan(0);
      expect((bRows ?? []).length, `${rpc}: org B must see its own rows`).toBeGreaterThan(0);

      // The security assertion: and only onto their own org. Disjoint id sets.
      const aIds = new Set((aRows ?? []).map((r: { id: string }) => r.id));
      const bIds = new Set((bRows ?? []).map((r: { id: string }) => r.id));
      const overlap = [...aIds].filter(id => bIds.has(id));
      expect(overlap, `${rpc}: two orgs must never see the same row`).toHaveLength(0);
    });
  }

  test("client_bg_status is NOT reachable by a signed-in browser session", async () => {
    // The renter RPC is service_role only. A token is the credential, and tokens must not
    // travel in browser-issued PostgREST calls where they land in logs and Referer headers.
    const a = await signIn(process.env.E2E_TMMT_EMAIL!, process.env.E2E_TMMT_PASSWORD!);
    const { error } = await a.rpc("client_bg_status", {
      p_token: "d1111111-0000-4000-8000-000000000002",
    });
    expect(error, "client_bg_status must be denied to authenticated").not.toBeNull();
  });
});
