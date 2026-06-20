import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lead Pool — ads -> shared pool -> agency -> operator sub-account.
 *
 * Thin typed wrappers around the SECURITY DEFINER functions in
 *   supabase/migrations/20260619030000_lead_pool_subaccounts.sql
 * (lead_route / lead_claim / lead_assign / lead_cross_refer). Those are
 * service_role-only, so WRITE calls here MUST use a service-role client; the
 * caller (server action / webhook) authorizes the user first. Reads ride RLS.
 *
 * Topology: docs/NETWORK-TOPOLOGY.md · Spec: docs/superpowers/specs/2026-06-19-...
 */

export const VERTICALS = ["rentals", "funding"] as const;
export type Vertical = (typeof VERTICALS)[number];

/**
 * Infer the vertical from a lead's signals (utm, form type, notes). One funnel
 * is one vertical; this just classifies an unlabeled lead. Returns null when
 * nothing matches (caller falls back to an explicit route / default agency).
 */
export function inferVertical(...signals: Array<string | null | undefined>): Vertical | null {
  const s = signals.filter(Boolean).join(" ").toLowerCase();
  if (/\b(fund|funding|capital|loan|credit|guidance|consult)\b/.test(s)) return "funding";
  if (/\b(rent|rental|rentals|car|vehicle|transport|chauffeur|fleet|broker)\b/.test(s)) return "rentals";
  return null;
}

export interface AgencyRoute {
  agencyOrgId: string;
  vertical: Vertical;
}

/**
 * Resolve which agency a lead routes to, most specific first:
 * utm_campaign → utm_source → vertical default. Null when no rule matches.
 */
export async function resolveAgency(
  supabase: SupabaseClient,
  args: { vertical?: Vertical | null; utmCampaign?: string | null; utmSource?: string | null }
): Promise<AgencyRoute | null> {
  const candidates: Array<{ kind: string; val: string }> = [];
  if (args.utmCampaign) candidates.push({ kind: "utm_campaign", val: args.utmCampaign });
  if (args.utmSource) candidates.push({ kind: "utm_source", val: args.utmSource });
  if (args.vertical) candidates.push({ kind: "vertical", val: args.vertical });

  for (const c of candidates) {
    const { data } = await supabase
      .from("lead_routes")
      .select("agency_org_id, vertical")
      .eq("match_kind", c.kind)
      .eq("match_value", c.val)
      .order("priority", { ascending: true })
      .limit(1);
    const row = data?.[0] as { agency_org_id: string; vertical: Vertical } | undefined;
    if (row) return { agencyOrgId: row.agency_org_id, vertical: row.vertical };
  }
  return null;
}

// ── RPC return shapes (mirror the SQL functions) ────────────────────────────
export type RouteResult = { routed: boolean; pool_id?: number; reason?: string };
export type ClaimResult = { claimed: boolean; pool_id?: number; reason?: string };
export type AssignResult = { assigned: boolean; pool_id?: number; reason?: string };
export type CrossReferResult = { referred: boolean; pool_id?: number; reason?: string };

/** Route a captured lead into the pool for an agency. Service-role only. */
export async function routeLead(
  supabase: SupabaseClient,
  args: { leadId: string; vertical: Vertical; agencyOrgId: string; expiresAt?: string | null; origin?: string }
): Promise<RouteResult> {
  const { data, error } = await supabase.rpc("lead_route", {
    p_lead: args.leadId,
    p_vertical: args.vertical,
    p_agency: args.agencyOrgId,
    p_expires: args.expiresAt ?? null,
    p_origin: args.origin ?? "route",
  });
  if (error) throw new Error(`lead_route failed: ${error.message}`);
  return data as RouteResult;
}

/** Atomic claim — only one operator can win an available lead. Service-role only. */
export async function claimLead(
  supabase: SupabaseClient,
  args: { poolId: number; orgId: string; userId: string }
): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc("lead_claim", {
    p_pool: args.poolId,
    p_org: args.orgId,
    p_user: args.userId,
  });
  if (error) throw new Error(`lead_claim failed: ${error.message}`);
  return data as ClaimResult;
}

/** Agency/owner assigns a lead to a specific operator sub-account. Service-role only. */
export async function assignLead(
  supabase: SupabaseClient,
  args: { poolId: number; orgId: string }
): Promise<AssignResult> {
  const { data, error } = await supabase.rpc("lead_assign", {
    p_pool: args.poolId,
    p_org: args.orgId,
  });
  if (error) throw new Error(`lead_assign failed: ${error.message}`);
  return data as AssignResult;
}

/** Network cross-referral — hand a lead to the OTHER agency. Service-role only. */
export async function crossReferLead(
  supabase: SupabaseClient,
  args: { poolId: number; targetAgencyOrgId: string; targetVertical: Vertical }
): Promise<CrossReferResult> {
  const { data, error } = await supabase.rpc("lead_cross_refer", {
    p_pool: args.poolId,
    p_target_agency: args.targetAgencyOrgId,
    p_target_vertical: args.targetVertical,
  });
  if (error) throw new Error(`lead_cross_refer failed: ${error.message}`);
  return data as CrossReferResult;
}
