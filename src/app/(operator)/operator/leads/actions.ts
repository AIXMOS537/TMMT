"use server";

import { revalidatePath } from "next/cache";
import { createSSRClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { isStaffUser, isOperatorUser } from "@/lib/auth-roles";
import {
  claimLead,
  assignLead,
  crossReferLead,
  canClaimFromAgency,
  VERTICALS,
  type Vertical,
} from "@/lib/lead-pool";

type ActionResult = { success: true } | { success: false; error: string };

/** Lightweight viewer context for the client UI (drives the agency-tools gate). */
export async function viewerContext(): Promise<{ canManage: boolean }> {
  const c = await caller();
  return { canManage: !!c && isStaffUser(c.user) };
}

/** Pickers for the agency tools: operator sub-accounts (assign) + agencies (refer). Staff only. */
export async function listOrgsForAssign(): Promise<{
  operators: Array<{ id: string; name: string }>;
  agencies: Array<{ id: string; name: string }>;
}> {
  const c = await caller();
  if (!c || !isStaffUser(c.user)) return { operators: [], agencies: [] };
  const svc = createServiceRoleClient();
  const { data } = await svc.from("organizations").select("id, name, org_kind").order("name", { ascending: true });
  const rows = (data ?? []) as Array<{ id: string; name: string; org_kind: string | null }>;
  return {
    operators: rows.filter((o) => o.org_kind === "operator").map(({ id, name }) => ({ id, name })),
    agencies: rows.filter((o) => o.org_kind !== "operator").map(({ id, name }) => ({ id, name })),
  };
}

/** Resolve the signed-in user + their org (service-role writes are authorized here). */
async function caller() {
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) return null;
  const { data } = await ssr
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  return { user, orgId: (data?.organization_id as string | null) ?? null };
}

/** Read the pool row's agency + the caller's parent org, then decide eligibility. */
async function authorizeForPool(
  svc: ReturnType<typeof createServiceRoleClient>,
  poolId: number,
  callerOrgId: string | null,
  isStaff: boolean
): Promise<{ ok: boolean; agencyOrgId?: string; error?: string }> {
  const { data: pool } = await svc
    .from("lead_pool")
    .select("agency_org_id")
    .eq("id", poolId)
    .maybeSingle();
  if (!pool) return { ok: false, error: "Lead not found." };
  const agencyOrgId = pool.agency_org_id as string;

  let callerParentOrgId: string | null = null;
  if (callerOrgId) {
    const { data: org } = await svc
      .from("organizations")
      .select("parent_org_id")
      .eq("id", callerOrgId)
      .maybeSingle();
    callerParentOrgId = (org?.parent_org_id as string | null) ?? null;
  }

  const ok = canClaimFromAgency({ callerOrgId, callerParentOrgId, agencyOrgId, isStaff });
  return ok ? { ok, agencyOrgId } : { ok, error: "This lead isn't in your agency." };
}

/** Operator/staff claims an available lead — atomic, first-come. */
export async function claimLeadAction(poolId: number): Promise<ActionResult> {
  const c = await caller();
  if (!c) return { success: false, error: "Not signed in." };
  if (!c.orgId) return { success: false, error: "No organization on your profile." };
  if (!(isOperatorUser(c.user) || isStaffUser(c.user)))
    return { success: false, error: "Not allowed." };

  const svc = createServiceRoleClient();
  const auth = await authorizeForPool(svc, poolId, c.orgId, isStaffUser(c.user));
  if (!auth.ok) return { success: false, error: auth.error ?? "Not allowed." };

  try {
    const r = await claimLead(svc, { poolId, orgId: c.orgId, userId: c.user.id });
    if (!r.claimed) {
      return {
        success: false,
        error: r.reason === "unavailable" ? "Someone just claimed this lead." : "Could not claim.",
      };
    }
    revalidatePath("/operator/leads");
    return { success: true };
  } catch {
    return { success: false, error: "Could not claim — please try again." };
  }
}

/** Agency/staff assigns a lead to a specific operator sub-account. */
export async function assignLeadAction(poolId: number, targetOrgId: string): Promise<ActionResult> {
  const c = await caller();
  if (!c) return { success: false, error: "Not signed in." };
  const staff = isStaffUser(c.user);
  if (!staff && !c.orgId) return { success: false, error: "Not allowed." };

  const svc = createServiceRoleClient();
  // Only staff or the agency itself may assign (not child operators).
  const auth = await authorizeForPool(svc, poolId, c.orgId, staff);
  const isAgencyOrStaff = staff || (auth.ok && auth.agencyOrgId === c.orgId);
  if (!auth.ok || !isAgencyOrStaff)
    return { success: false, error: "Only the agency can assign this lead." };

  try {
    const r = await assignLead(svc, { poolId, orgId: targetOrgId });
    if (!r.assigned) return { success: false, error: "Could not assign this lead." };
    revalidatePath("/operator/leads");
    return { success: true };
  } catch {
    return { success: false, error: "Could not assign — please try again." };
  }
}

/** Staff/agency refers a lead to the OTHER agency (network cross-referral). */
export async function crossReferLeadAction(
  poolId: number,
  targetAgencyOrgId: string,
  targetVertical: string
): Promise<ActionResult> {
  const c = await caller();
  if (!c) return { success: false, error: "Not signed in." };
  const staff = isStaffUser(c.user);

  const svc = createServiceRoleClient();
  const auth = await authorizeForPool(svc, poolId, c.orgId, staff);
  const isAgencyOrStaff = staff || (auth.ok && auth.agencyOrgId === c.orgId);
  if (!auth.ok || !isAgencyOrStaff)
    return { success: false, error: "Only the agency can refer this lead." };

  if (!VERTICALS.includes(targetVertical as Vertical))
    return { success: false, error: "Invalid vertical." };

  try {
    const r = await crossReferLead(svc, {
      poolId,
      targetAgencyOrgId,
      targetVertical: targetVertical as Vertical,
    });
    if (!r.referred)
      return {
        success: false,
        error: r.reason === "duplicate" ? "That agency already has this lead." : "Could not refer.",
      };
    revalidatePath("/operator/leads");
    return { success: true };
  } catch {
    return { success: false, error: "Could not refer — please try again." };
  }
}
