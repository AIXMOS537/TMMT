import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Customer #2 tenant-isolation invariant.
 *
 * THE INVARIANT UNDER TEST
 * A normal authenticated member of Organization B may read the Organization B
 * records the rental product requires, and must not read Organization A records
 * merely by knowing they exist.
 *
 * Neither user here may be a platform admin or staff. The whole point is to
 * prove ORDINARY scoped authorization works — granting admin to make these pass
 * would defeat the test and is exactly the shortcut this file exists to prevent.
 *
 * WHY TWO ASSERTIONS PER TABLE
 * A scoped user currently reads ZERO rows from customer_payments and
 * background_checks — but so does a user who is correctly isolated. "Sees
 * nothing" is ambiguous. So each table asserts BOTH directions:
 *   own-org rows  > 0   (the product works for them)
 *   other-org rows = 0  (they cannot reach the neighbour)
 * Only the pair distinguishes "isolated" from "broken".
 *
 * RESOLVED 2026-09-17. When this was written the two admin-only tables returned zero to a
 * scoped member and that was called the Customer #2 blocker. It was never going to be
 * fixed by widening the table policy — doing so would expose raw licences, paystubs and
 * insurance payloads to every member of every org.
 *
 * The answer shipped instead as masked, org-scoped RPCs
 * (20260916230000_client_and_org_scoped_sensitive_access.sql), and the product requirement
 * is asserted against THAT path in `masked-rpc-access.spec.ts`, which passes.
 *
 * So this file now asserts what is actually true and actually desired:
 *   vehicles / tickets          own > 0  · cross = 0
 *   customer_payments / checks  own = 0  · cross = 0   <- the raw tables stay shut
 *
 * SETUP (owner-authorised production writes; not performed by this file):
 *   two Auth users, neither admin nor internal_team, each with a single
 *   org_roles row — one in TMMT RENTALS, one in a throwaway org — and at least
 *   one row per table per org.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Defaults to the real TMMT RENTALS org so a production run is unchanged. Overridable so
// the same invariant can be proven against a throwaway pair of orgs, which is the only way
// to run this at all until two scoped users exist in production.
const TMMT_ORG = process.env.E2E_TMMT_ORG_ID ?? "8e651b25-e7c8-4356-af64-1716a82053b0";
const PILOT_ORG = process.env.E2E_PILOT_ORG_ID ?? "";

/**
 * Admin-only at the row level since 20260828000000. A scoped member reads nothing from
 * these directly, by design — their access is the masked RPC, covered in
 * `masked-rpc-access.spec.ts`. Widening these policies would expose raw licences,
 * paystubs and insurance payloads to every member of every org.
 */
const ADMIN_ONLY = new Set(["customer_payments", "background_checks"]);

const SCOPED_TABLES = [
  "vehicles",
  "tickets",
  "customer_payments",
  "background_checks",
] as const;

async function signIn(email: string, password: string) {
  const c = createClient(URL, ANON);
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return c;
}

test.describe("Customer #2 tenant isolation", () => {
  test.skip(
    !process.env.E2E_TMMT_EMAIL || !process.env.E2E_PILOT_EMAIL || !PILOT_ORG,
    "E2E_TMMT_EMAIL / E2E_PILOT_EMAIL / E2E_PILOT_ORG_ID not set — owner must " +
      "create two NON-ADMIN scoped users and a throwaway org first",
  );

  test("neither test user holds a privileged role", async () => {
    // If either user is admin or staff the rest of this file proves nothing.
    for (const [email, password] of [
      [process.env.E2E_TMMT_EMAIL!, process.env.E2E_TMMT_PASSWORD!],
      [process.env.E2E_PILOT_EMAIL!, process.env.E2E_PILOT_PASSWORD!],
    ]) {
      const c = await signIn(email, password);
      const { data } = await c.auth.getUser();
      const { data: profile } = await c
        .from("profiles")
        .select("role, portal_role")
        .eq("id", data.user!.id)
        .single();
      expect(profile?.role, `${email} must not be admin`).not.toBe("admin");
      expect(profile?.role, `${email} must not be internal_team`).not.toBe("internal_team");
    }
  });

  for (const table of SCOPED_TABLES) {
    test(`${table}: Pilot reads its own rows and none of TMMT's`, async () => {
      const pilot = await signIn(
        process.env.E2E_PILOT_EMAIL!,
        process.env.E2E_PILOT_PASSWORD!,
      );

      const own = await pilot.from(table).select("id").eq("org_id", PILOT_ORG);
      const cross = await pilot.from(table).select("id").eq("org_id", TMMT_ORG);

      // Cross-tenant is the security assertion. It must hold unconditionally.
      expect(
        cross.data ?? [],
        `${table}: Pilot must not read any other org's rows`,
      ).toHaveLength(0);

      if (ADMIN_ONLY.has(table)) {
        // These two are admin-only at the row level by deliberate hardening
        // (20260828000000). A scoped member reading ZERO from the raw table is the
        // control WORKING, not the blocker it was described as when this file was
        // written on 2026-09-08.
        //
        // The product requirement — "a customer org member can see their own payments
        // and screening" — is real and is satisfied through the masked, org-scoped
        // RPCs, which is where it is now asserted: `masked-rpc-access.spec.ts`.
        // Asserting it here as well left two tests permanently red against an
        // architecture that was never going to satisfy them, and a suite that is always
        // red is a suite people stop reading.
        expect(
          own.data ?? [],
          `${table}: the raw table must stay shut even to its own org — access is via the masked RPC`,
        ).toHaveLength(0);
      } else {
        expect(
          (own.data ?? []).length,
          `${table}: Pilot must be able to read its own rows`,
        ).toBeGreaterThan(0);
      }
    });

    test(`${table}: TMMT reads its own rows and none of Pilot's`, async () => {
      const tmmt = await signIn(
        process.env.E2E_TMMT_EMAIL!,
        process.env.E2E_TMMT_PASSWORD!,
      );

      const cross = await tmmt.from(table).select("id").eq("org_id", PILOT_ORG);
      expect(
        cross.data ?? [],
        `${table}: TMMT must not read any Pilot rows`,
      ).toHaveLength(0);
    });
  }

  test("masked background-check queue does not leak across tenants", async () => {
    // bg_check_queue() checks is_staff()/is_platform_admin() and carries NO org
    // predicate, so a scoped non-staff user should get nothing at all. If this
    // ever returns rows for a scoped user, the masked path has become a
    // cross-tenant read and must be treated as a security regression.
    const pilot = await signIn(
      process.env.E2E_PILOT_EMAIL!,
      process.env.E2E_PILOT_PASSWORD!,
    );
    const { data } = await pilot.rpc("bg_check_queue", {
      p_status: "pending",
      p_limit: 50,
    });
    expect(data ?? [], "scoped user must not reach the masked staff queue").toHaveLength(0);
  });
});
