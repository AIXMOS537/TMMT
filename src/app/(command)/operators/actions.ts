"use server";

import { revalidatePath } from "next/cache";
import { createSSRClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { isStaffUser } from "@/lib/auth-roles";
import { grantTokens } from "@/lib/token-ledger";

type ActionResult = { success: true } | { success: false; error: string };
type ActionResultWith<T> = ({ success: true } & T) | { success: false; error: string };

/** Owner/staff gate for every provisioning action. */
async function requireStaff() {
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user || !isStaffUser(user)) return null;
  return { user };
}

export interface OrgOption {
  id: string;
  name: string;
  org_kind: string | null;
}

/** All orgs (for the parent-agency picker). Staff only. */
export async function listOrgs(): Promise<OrgOption[]> {
  if (!(await requireStaff())) return [];
  const svc = createServiceRoleClient();
  const { data } = await svc
    .from("organizations")
    .select("id, name, org_kind")
    .order("name", { ascending: true });
  return (data ?? []) as OrgOption[];
}

export interface OperatorRow {
  id: string;
  name: string;
  parent_org_id: string | null;
  created_at: string;
  balance: number;
  unlimited: boolean;
  [key: string]: unknown;
}

/** Operator sub-accounts + their token balances. Staff only. */
export async function listOperators(): Promise<OperatorRow[]> {
  if (!(await requireStaff())) return [];
  const svc = createServiceRoleClient();
  const { data: orgs } = await svc
    .from("organizations")
    .select("id, name, parent_org_id, created_at")
    .eq("org_kind", "operator")
    .order("created_at", { ascending: false });
  if (!orgs?.length) return [];
  const ids = orgs.map((o) => o.id as string);
  const { data: bals } = await svc
    .from("tmmt_token_balances")
    .select("org_id, balance, unlimited")
    .in("org_id", ids);
  const balMap = new Map((bals ?? []).map((b) => [b.org_id as string, b]));
  return orgs.map((o) => ({
    ...o,
    balance: (balMap.get(o.id as string)?.balance as number | undefined) ?? 0,
    unlimited: (balMap.get(o.id as string)?.unlimited as boolean | undefined) ?? false,
  })) as OperatorRow[];
}

/** Create an operator sub-account under an agency, optionally funding tokens. */
export async function provisionOperatorSubAccount(input: {
  name: string;
  parentAgencyOrgId: string;
  initialTokens?: number;
}): Promise<ActionResultWith<{ orgId: string }>> {
  if (!(await requireStaff())) return { success: false, error: "Owner/staff only." };
  const name = input.name?.trim();
  if (!name) return { success: false, error: "Name is required." };
  if (!input.parentAgencyOrgId) return { success: false, error: "Pick a parent agency." };

  const svc = createServiceRoleClient();
  const { data, error } = await svc
    .from("organizations")
    .insert({
      name,
      org_type: "operator",
      org_kind: "operator",
      parent_org_id: input.parentAgencyOrgId,
    })
    .select("id")
    .single();
  if (error || !data) return { success: false, error: "Could not create sub-account." };

  const orgId = data.id as string;
  const tokens = Math.max(0, Math.floor(input.initialTokens ?? 0));
  if (tokens > 0) {
    try {
      await grantTokens(svc, {
        orgId,
        amount: tokens,
        reason: "Agency provisioning grant",
        dedupeKey: `provision:${orgId}`,
      });
    } catch {
      /* org is created; funding can be retried from the row action */
    }
  }
  revalidatePath("/operators");
  return { success: true, orgId };
}

/** Fund an operator's token balance (everyone pays — the agency funds the seat). */
export async function fundOperatorTokens(input: { orgId: string; amount: number }): Promise<ActionResult> {
  if (!(await requireStaff())) return { success: false, error: "Owner/staff only." };
  const amt = Math.floor(input.amount);
  if (!input.orgId || !amt || amt <= 0) return { success: false, error: "Enter a positive amount." };

  const svc = createServiceRoleClient();
  try {
    await grantTokens(svc, {
      orgId: input.orgId,
      amount: amt,
      reason: "Agency token funding",
      dedupeKey: `fund:${input.orgId}:${Date.now()}`,
    });
    revalidatePath("/operators");
    return { success: true };
  } catch {
    return { success: false, error: "Could not fund tokens." };
  }
}
