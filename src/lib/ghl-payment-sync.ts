import type { SupabaseClient } from "@supabase/supabase-js";

type RevenueTagMeta = {
  amount: number;
  label: string;
  method: string;
  product_code: string;
  /** Remaining contract balance invoiced at kickoff (recorded as a Pending row). */
  balance?: number;
};

const REVENUE_TAGS: Record<string, RevenueTagMeta> = {
  "member-97": { amount: 97, label: "TMMT Academy ($97/mo)", method: "Stripe", product_code: "97_rental_enrollment" },
  "credit-guidance-active": {
    amount: 750,
    label: "Credit guidance program",
    method: "Stripe",
    product_code: "credit_guidance",
  },
  "credit-consult-booked": {
    amount: 0,
    label: "Credit consult booked",
    method: "GHL",
    product_code: "credit_consult",
  },
  // High-ticket build deposits (see src/lib/high-ticket.ts + /build). The
  // webhook's explicit amount wins; these are the fallback deposit figures.
  // Base is a scope-based down payment — balance is unknown, so no Pending row.
  "build-base-deposit": {
    amount: 3750,
    label: "Base Infrastructure — deposit",
    method: "Stripe",
    product_code: "build_base",
  },
  "build-enterprise-deposit": {
    amount: 3750,
    label: "Enterprise Systems — deposit",
    method: "Stripe",
    product_code: "build_enterprise",
    balance: 3750,
  },
  "build-carbox-deposit": {
    amount: 7500,
    label: "Car Rental in a Box — deposit",
    method: "Stripe",
    product_code: "build_carbox",
    balance: 7500,
  },
  "build-ecom-deposit": {
    amount: 12500,
    label: "E-Commerce Ecosystem — deposit",
    method: "Stripe",
    product_code: "build_ecommerce",
    balance: 12500,
  },
  "build-ecosystem-consult": {
    amount: 0,
    label: "Full Ecosystem — consult booked",
    method: "GHL",
    product_code: "build_ecosystem",
  },
};

// Stable transaction-level id for idempotency. Deliberately excludes generic
// `id`/`contact_id` (same across a contact's repeat payments, e.g. monthly $97)
// so legit recurring charges are never skipped — only true duplicates are.
export function extractPaymentRef(body: Record<string, unknown>): string | null {
  for (const k of ["transaction_id", "order_id", "payment_id", "charge_id", "invoice_id"]) {
    const v = body[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

// Affiliate/referral code from an explicit field or a `aff-`/`ref-`/`via-` tag.
// Does NOT match `affiliate-applied`/`affiliate-approved` (program lifecycle tags).
export function extractAffiliateRef(
  body: Record<string, unknown>,
  tags: string[]
): string | null {
  for (const k of ["affiliate", "affiliate_id", "affiliate_ref", "referral", "rewardful_referral"]) {
    const v = body[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const tag = tags.find((t) => /^(aff|ref|via)[-:]/i.test(t));
  if (tag) {
    const code = tag.replace(/^(aff|ref|via)[-:]/i, "").trim();
    return code || null;
  }
  return null;
}

function parseAmount(body: Record<string, unknown>): number | undefined {
  if (typeof body.amount === "number" && Number.isFinite(body.amount)) return body.amount;
  if (typeof body.amount === "string" && body.amount.trim()) {
    const n = Number(body.amount.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function isPaymentEvent(event: string): boolean {
  const e = event.toLowerCase();
  return (
    e.includes("payment") ||
    e.includes("invoice") ||
    e.includes("subscription") ||
    e.includes("order") ||
    e === "checkout.completed"
  );
}

/** Remaining contract balance for a revenue tag (0 if none/unknown). */
export function depositBalanceForTag(tag: string): number {
  return REVENUE_TAGS[tag]?.balance ?? 0;
}

export function shouldRecordPayment(body: Record<string, unknown>, tags: string[]): boolean {
  const event = typeof body.event === "string" ? body.event : "";
  if (isPaymentEvent(event)) return true;
  return tags.some((t) => t in REVENUE_TAGS);
}

export async function recordGhlPayment(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  tags: string[]
): Promise<{ recorded: boolean; id?: string; reason?: string }> {
  const email =
    (typeof body.email === "string" && body.email) ||
    (typeof body.contact_email === "string" && body.contact_email) ||
    "";
  if (!email) return { recorded: false, reason: "no email" };

  const event = typeof body.event === "string" ? body.event : "ghl_webhook";
  const explicitAmount = parseAmount(body);
  const paymentMethod =
    (typeof body.payment_method === "string" && body.payment_method) ||
    (typeof body.paymentMethod === "string" && body.paymentMethod) ||
    "Stripe";

  const revenueTag = tags.find((t) => t in REVENUE_TAGS);
  const tagMeta = revenueTag ? REVENUE_TAGS[revenueTag] : undefined;
  const amount = explicitAmount ?? tagMeta?.amount ?? 0;

  if (!isPaymentEvent(event) && !revenueTag && amount <= 0) {
    return { recorded: false, reason: "not a payment event" };
  }

  const product =
    (typeof body.product === "string" && body.product) ||
    (typeof body.product_name === "string" && body.product_name) ||
    tagMeta?.label ||
    event;

  const today = new Date().toISOString().slice(0, 10);
  const ghlId =
    (typeof body.contact_id === "string" && body.contact_id) ||
    (typeof body.id === "string" && body.id) ||
    "";

  const productCode = tagMeta?.product_code ?? null;

  // Idempotency: if this exact transaction was already recorded (webhook retry,
  // duplicate delivery), don't insert a second row.
  const paymentRef = extractPaymentRef(body);
  if (paymentRef) {
    const { data: existing } = await supabase
      .from("customer_payments")
      .select("id")
      .ilike("notes", `%[ref:${paymentRef}]%`)
      .limit(1);
    if (existing?.[0]?.id) {
      return { recorded: false, reason: "duplicate", id: existing[0].id as string };
    }
  }

  const affiliateRef = extractAffiliateRef(body, tags);

  const phoneRaw =
    (typeof body.phone === "string" && body.phone) ||
    (typeof body.contact_phone === "string" && body.contact_phone) ||
    "";
  const phoneDigits = phoneRaw.replace(/\D/g, "");

  let incomingLeadId: string | null = null;
  {
    const { data: leadByEmail } = await supabase
      .from("incoming_leads")
      .select("id")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1);
    if (leadByEmail?.[0]?.id) {
      incomingLeadId = leadByEmail[0].id as string;
    } else if (phoneDigits.length >= 7) {
      const { data: leadByPhone } = await supabase
        .from("incoming_leads")
        .select("id")
        .ilike("phone_text", `%${phoneDigits}%`)
        .order("created_at", { ascending: false })
        .limit(1);
      if (leadByPhone?.[0]?.id) incomingLeadId = leadByPhone[0].id as string;
    }
  }

  const notes = [
    `[GHL] ${event}`,
    product,
    tags.length ? `tags: ${tags.join(", ")}` : "",
    ghlId ? `ghl_contact: ${ghlId}` : "",
    incomingLeadId ? `lead: ${incomingLeadId}` : "",
    affiliateRef ? `aff: ${affiliateRef}` : "",
    paymentRef ? `[ref:${paymentRef}]` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const { data, error } = await supabase
    .from("customer_payments")
    .insert({
      customer: email,
      payment_method: tagMeta?.method ?? paymentMethod,
      last_payment_date: today,
      amount,
      payment_status: amount > 0 ? "Paid" : "Pending",
      notes,
      payment_plan: revenueTag === "member-97" ? "Monthly $97" : product,
      product_code: productCode,
      incoming_lead_id: incomingLeadId,
    })
    .select("id")
    .single();

  if (error) return { recorded: false, reason: error.message };
  const paymentId = data.id as string;

  // For high-ticket deposits, also log the remaining balance as a Pending row so
  // the ledger shows full contract value, not just the deposit collected.
  const balance = tagMeta?.balance ?? 0;
  if (balance > 0) {
    await supabase.from("customer_payments").insert({
      customer: email,
      payment_method: tagMeta?.method ?? paymentMethod,
      amount: balance,
      payment_status: "Pending",
      amount_past_due: 0,
      notes: `[GHL] balance due — ${product} | deposit_payment: ${paymentId}${paymentRef ? ` | [ref:${paymentRef}-balance]` : ""}`,
      payment_plan: "Balance invoiced at kickoff",
      product_code: productCode,
      incoming_lead_id: incomingLeadId,
    });
  }

  return { recorded: true, id: paymentId };
}
