"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe, PLAN_PRICES } from "./client";
import { getAgencyConnectAccountIdForClient } from "./connect-helpers";

export async function createOrgCheckoutSession(planTier: "starter" | "growth" | "pro") {
  const me = await requireRole(["admin", "internal_team"]);
  if (!me.organization_id) {
    throw new Error("Link your profile to an organization first.");
  }

  const stripe = getStripe();
  const plan = PLAN_PRICES[planTier];
  const priceId = process.env[plan.priceIdEnv]?.trim();
  if (!stripe || !priceId) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY and price IDs in env.");
  }

  const supabase = createSupabaseServerClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, stripe_customer_id")
    .eq("id", me.organization_id)
    .single();

  if (!org) throw new Error("Organization not found.");

  let customerId = org.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.name,
      email: me.email ?? undefined,
      metadata: { organization_id: org.id },
    });
    customerId = customer.id;
    await supabase
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", org.id);
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_HOST?.startsWith("http")
      ? process.env.NEXT_PUBLIC_APP_HOST.replace(/\/$/, "")
      : `https://${process.env.NEXT_PUBLIC_APP_HOST ?? "localhost:3001"}`;

  const connect = await getAgencyConnectAccountIdForClient(org.id);
  const platformFeePct = connect.accountId
    ? Math.min(100, Math.max(0, 100 - connect.sharePct))
    : undefined;

  const subscriptionData: {
    metadata: { organization_id: string; plan_tier: string };
    transfer_data?: { destination: string };
    application_fee_percent?: number;
  } = {
    metadata: { organization_id: org.id, plan_tier: planTier },
  };

  if (connect.accountId && platformFeePct !== undefined) {
    subscriptionData.transfer_data = { destination: connect.accountId };
    subscriptionData.application_fee_percent = platformFeePct;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/internal/billing?success=1`,
    cancel_url: `${origin}/internal/billing?canceled=1`,
    metadata: { organization_id: org.id, plan_tier: planTier },
    subscription_data: subscriptionData,
  });

  if (!session.url) throw new Error("Could not create checkout session.");
  redirect(session.url);
}
