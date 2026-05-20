import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid_signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orgId = session.metadata?.organization_id;
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    if (orgId && subId) {
      await supabase
        .from("organizations")
        .update({
          stripe_subscription_id: subId,
          billing_status: "active",
          plan_tier: session.metadata?.plan_tier ?? "starter",
        })
        .eq("id", orgId);
    }
  }

  if (event.type === "account.updated") {
    const account = event.data.object;
    const orgId = account.metadata?.organization_id;
    if (orgId) {
      const chargesEnabled = Boolean(account.charges_enabled);
      await supabase
        .from("organizations")
        .update({
          connect_charges_enabled: chargesEnabled,
          stripe_connect_account_id: account.id,
        })
        .eq("id", orgId);
    }
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object;
    const orgId = sub.metadata?.organization_id;
    if (orgId) {
      await supabase
        .from("organizations")
        .update({
          billing_status:
            sub.status === "active" || sub.status === "trialing"
              ? sub.status
              : sub.status === "canceled"
                ? "canceled"
                : "past_due",
          stripe_subscription_id: sub.id,
        })
        .eq("id", orgId);
    }
  }

  return NextResponse.json({ received: true });
}
