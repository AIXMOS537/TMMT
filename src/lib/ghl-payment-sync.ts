import type { SupabaseClient } from "@supabase/supabase-js";

const REVENUE_TAGS: Record<string, { amount: number; label: string; method: string; product_code: string }> = {
  "member-97": { amount: 97, label: "AIXMOS Membership ($97/mo)", method: "Stripe", product_code: "97_rental_enrollment" },
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
};

type GhlPaymentPayload = {
  email: string;
  event: string;
  tags: string[];
  amount?: number;
  payment_method?: string;
  product?: string;
  contact_id?: string;
};

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
  return { recorded: true, id: data.id as string };
}
