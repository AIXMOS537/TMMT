"use server";

/**
 * Onboard a paying operator: one org, one domain, one licence, one admin.
 *
 * Deliberately a NEW surface rather than an extension of operators/actions.ts,
 * which is being repaired on another branch against the live schema. Keeping
 * this separate means both land without fighting over the same file.
 *
 * The order below is the order things can fail in, and each step is undone if a
 * later one fails. Postgres has no cross-statement transaction through PostgREST,
 * so this compensates by hand — a half-created operator is worse than none,
 * because the unique index on hostname then blocks the retry.
 */

import { revalidatePath } from "next/cache";
import { createSSRClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { isStaffUser } from "@/lib/auth-roles";
import { checkHostname, dnsInstruction, answerPointsAtVercel, type DnsAnswer } from "@/lib/platform/hostname";

export type Result<T = undefined> =
  | ({ success: true } & (T extends undefined ? object : { data: T }))
  | { success: false; error: string };

async function requireStaff(): Promise<boolean> {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  return Boolean(user && isStaffUser(user));
}

export interface OnboardInput {
  name: string;
  hostname: string;
  licenseTier: string;
  modules: string[];
  adminEmail?: string;
}

export interface OnboardResult {
  orgId: string;
  hostname: string;
  dns: { type: "A" | "CNAME"; name: string; value: string };
  adminInvited: boolean;
}

export async function onboardOperator(input: OnboardInput): Promise<Result<OnboardResult>> {
  if (!(await requireStaff())) return { success: false, error: "Owner or staff only." };

  const name = input.name?.trim();
  if (!name) return { success: false, error: "Enter the operator's business name." };

  const host = checkHostname(input.hostname);
  if (!host.ok) return { success: false, error: host.reason };

  const svc = createServiceRoleClient();

  // Check the hostname first. It is the one field with a unique index, so
  // finding the clash now avoids creating an org we then have to delete.
  const { data: taken } = await svc
    .from("organization_domains")
    .select("org_id, organizations(name)")
    .eq("hostname", host.hostname)
    .maybeSingle();
  if (taken) {
    const owner = (taken as { organizations?: { name?: string } }).organizations?.name;
    return {
      success: false,
      error: `${host.hostname} is already registered${owner ? ` to ${owner}` : ""}.`,
    };
  }

  // 1. the org
  const { data: org, error: orgErr } = await svc
    .from("organizations")
    .insert({ name })
    .select("id")
    .single();
  if (orgErr || !org) {
    return { success: false, error: `Could not create the organization: ${orgErr?.message ?? "unknown error"}` };
  }
  const orgId = org.id as string;

  // From here on, failures roll back what came before.
  const undo = async () => {
    await svc.from("organization_domains").delete().eq("org_id", orgId);
    await svc.from("organization_licenses").delete().eq("organization_id", orgId);
    await svc.from("organizations").delete().eq("id", orgId);
  };

  // 2. the domain — unverified. It is a claim until DNS proves it, and
  // org_id_for_host() ignores unverified rows, so nothing routes there yet.
  const { error: domErr } = await svc.from("organization_domains").insert({
    org_id: orgId,
    hostname: host.hostname,
    is_primary: true,
    verified_at: null,
  });
  if (domErr) {
    await undo();
    return { success: false, error: `Could not register the domain: ${domErr.message}` };
  }

  // 3. the licence — inactive until they have paid and the domain resolves.
  // guardOrganization() refuses an inactive licence, so this is the switch that
  // turns the operator on, and it should not flip before both are true.
  const { error: licErr } = await svc.from("organization_licenses").insert({
    organization_id: orgId,
    license_tier: input.licenseTier || "custom",
    modules: input.modules?.length ? input.modules : ["rentals_app"],
    active: false,
    max_ventures: 1,
  });
  if (licErr) {
    await undo();
    return { success: false, error: `Could not create the licence: ${licErr.message}` };
  }

  // 4. the admin, if given. Their failure does not undo the operator - the org
  // is usable and a person can be added afterwards, whereas throwing away a
  // correctly created org over a typo'd email would be worse.
  let adminInvited = false;
  const email = input.adminEmail?.trim().toLowerCase();
  if (email) {
    const { error: memberErr } = await svc.rpc("onboard_org_member", {
      email,
      org: orgId,
      role: "tenant_admin",
    });
    adminInvited = !memberErr;
  }

  revalidatePath("/operators");
  return {
    success: true,
    data: { orgId, hostname: host.hostname, dns: dnsInstruction(host.hostname), adminInvited },
  };
}

/**
 * Check DNS and, if it points at us, mark the domain verified.
 *
 * Verification is a real lookup rather than a button that trusts the operator:
 * flipping verified_at is what makes org_id_for_host() start routing traffic to
 * this tenant, so it must reflect the world, not an intention.
 */
export async function verifyOperatorDomain(hostname: string): Promise<Result<{ verified: boolean; detail: string }>> {
  if (!(await requireStaff())) return { success: false, error: "Owner or staff only." };

  const host = checkHostname(hostname);
  if (!host.ok) return { success: false, error: host.reason };

  let answer: DnsAnswer | null = null;
  try {
    const type = host.isApex ? "A" : "CNAME";
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(host.hostname)}&type=${type}`,
      { headers: { accept: "application/dns-json" }, cache: "no-store" },
    );
    answer = (await res.json()) as DnsAnswer;
    // A subdomain may be a CNAME OR a direct A record; check both before failing.
    if (!answerPointsAtVercel(answer) && !host.isApex) {
      const res2 = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(host.hostname)}&type=A`,
        { headers: { accept: "application/dns-json" }, cache: "no-store" },
      );
      answer = (await res2.json()) as DnsAnswer;
    }
  } catch {
    return { success: false, error: "Could not reach DNS to check. Try again in a moment." };
  }

  if (!answerPointsAtVercel(answer)) {
    const want = dnsInstruction(host.hostname);
    return {
      success: true,
      data: {
        verified: false,
        detail: `${host.hostname} does not point here yet. Add a ${want.type} record "${want.name}" → ${want.value}, then check again.`,
      },
    };
  }

  const svc = createServiceRoleClient();
  const { error } = await svc
    .from("organization_domains")
    .update({ verified_at: new Date().toISOString() })
    .eq("hostname", host.hostname);
  if (error) return { success: false, error: `DNS is correct but the record could not be saved: ${error.message}` };

  revalidatePath("/operators");
  return { success: true, data: { verified: true, detail: `${host.hostname} is verified and now routes to this operator.` } };
}
