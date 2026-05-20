"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe } from "./client";

function appOrigin(): string {
  const explicit =
    process.env.NEXT_PUBLIC_APP_HOST?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    const host = explicit.replace(/\/$/, "");
    return host.startsWith("http") ? host : `https://${host}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Start or resume Stripe Connect onboarding for the agency root org. */
export async function startAgencyConnectOnboarding(agencyOrgId: string) {
  await requireRole(["admin"]);

  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured.");

  const supabase = createSupabaseServerClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, stripe_connect_account_id, connect_charges_enabled")
    .eq("id", agencyOrgId)
    .maybeSingle();

  if (!org) throw new Error("Agency organization not found.");

  let accountId = org.stripe_connect_account_id as string | null;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "company",
      metadata: { organization_id: org.id, role: "agency" },
    });
    accountId = account.id;
    await supabase
      .from("organizations")
      .update({ stripe_connect_account_id: accountId })
      .eq("id", org.id);
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appOrigin()}/internal/agency?connect=refresh`,
    return_url: `${appOrigin()}/internal/agency?connect=return`,
    type: "account_onboarding",
  });

  if (!link.url) throw new Error("Could not create Connect onboarding link.");
  redirect(link.url);
}
