import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { flattenGhlDispatchPayload } from "./ghl-payload";
import { defaultPartnerAppsForWorkType } from "./protocols";
import type { JobInboxItem, PartnerAppEndpoint } from "./types";
import type { WorkType } from "@/lib/routing/types";

type EnvWebhook = { url: string; secret?: string; work_types?: string[]; case_types?: string[] };

function loadEnvWebhooks(): Record<string, EnvWebhook> {
  try {
    const raw = process.env.PARTNER_APP_WEBHOOKS_JSON;
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, EnvWebhook>;
  } catch {
    return {};
  }
}

export async function listPartnerEndpoints(
  supabase?: SupabaseClient
): Promise<PartnerAppEndpoint[]> {
  const db = supabase ?? createSupabaseServiceClient();
  const { data } = await db
    .from("partner_app_endpoints")
    .select("id, partner_app_slug, webhook_url, webhook_secret, work_types, case_types, active")
    .eq("active", true);

  const fromDb = (data ?? []) as PartnerAppEndpoint[];
  const envMap = loadEnvWebhooks();
  const seen = new Set(fromDb.map((e) => e.partner_app_slug));

  for (const [slug, cfg] of Object.entries(envMap)) {
    if (seen.has(slug) || !cfg.url) continue;
    fromDb.push({
      id: `env:${slug}`,
      partner_app_slug: slug,
      webhook_url: cfg.url,
      webhook_secret: cfg.secret ?? null,
      work_types: cfg.work_types ?? [],
      case_types: cfg.case_types ?? [],
      active: true,
    });
  }

  return fromDb;
}

function endpointMatches(
  endpoint: PartnerAppEndpoint,
  workType: WorkType,
  caseType: string,
  targetSlugs?: string[]
): boolean {
  if (targetSlugs?.length && !targetSlugs.includes(endpoint.partner_app_slug)) {
    return false;
  }
  if (endpoint.work_types.length && !endpoint.work_types.includes(workType)) {
    return false;
  }
  if (endpoint.case_types.length && !endpoint.case_types.includes(caseType)) {
    return false;
  }
  return true;
}

export async function deliverJobToPartnerApps(args: {
  caseId: string;
  refCode: string;
  vendorJobId?: string;
  workType: WorkType;
  caseType: string;
  subject: string;
  payload: Record<string, unknown>;
  targetPartnerApps?: string[];
}): Promise<
  Array<{ partner_app_slug: string; status: string; delivery_id: string; error?: string }>
> {
  const supabase = createSupabaseServiceClient();
  const endpoints = await listPartnerEndpoints(supabase);
  const targetSlugs =
    args.targetPartnerApps?.length
      ? args.targetPartnerApps
      : defaultPartnerAppsForWorkType(args.workType);

  const matching = endpoints.filter((e) =>
    endpointMatches(e, args.workType, args.caseType, targetSlugs)
  );

  const results: Array<{
    partner_app_slug: string;
    status: string;
    delivery_id: string;
    error?: string;
  }> = [];

  const envelope = flattenGhlDispatchPayload({
    caseId: args.caseId,
    refCode: args.refCode,
    vendorJobId: args.vendorJobId,
    workType: args.workType,
    caseType: args.caseType,
    subject: args.subject,
    payload: args.payload,
  });

  for (const endpoint of matching) {
    const { data: delivery, error: insertErr } = await supabase
      .from("job_dispatch_deliveries")
      .insert({
        case_id: args.caseId,
        vendor_job_id: args.vendorJobId ?? null,
        partner_app_slug: endpoint.partner_app_slug,
        endpoint_id: endpoint.id.startsWith("env:") ? null : endpoint.id,
        status: "pending",
        payload: envelope,
      })
      .select("id")
      .single();

    if (insertErr || !delivery) {
      results.push({
        partner_app_slug: endpoint.partner_app_slug,
        status: "failed",
        delivery_id: "",
        error: insertErr?.message ?? "delivery insert failed",
      });
      continue;
    }

    let status: "delivered" | "failed" = "delivered";
    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let errorMsg: string | undefined;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-TMMT-Event": "tmmt.job.dispatched",
      };
      if (endpoint.webhook_secret) {
        headers["X-TMMT-Secret"] = endpoint.webhook_secret;
      }

      const res = await fetch(endpoint.webhook_url, {
        method: "POST",
        headers,
        body: JSON.stringify(envelope),
        signal: AbortSignal.timeout(15_000),
      });
      responseStatus = res.status;
      responseBody = (await res.text()).slice(0, 2000);
      if (!res.ok) {
        status = "failed";
        errorMsg = `HTTP ${res.status}`;
      }
    } catch (e) {
      status = "failed";
      errorMsg = e instanceof Error ? e.message : "webhook failed";
    }

    await supabase
      .from("job_dispatch_deliveries")
      .update({
        status,
        response_status: responseStatus,
        response_body: responseBody,
        delivered_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);

    results.push({
      partner_app_slug: endpoint.partner_app_slug,
      status,
      delivery_id: delivery.id,
      error: errorMsg,
    });
  }

  return results;
}

export async function fetchPartnerInbox(
  partnerAppSlug: string,
  limit = 50
): Promise<JobInboxItem[]> {
  const supabase = createSupabaseServiceClient();
  const { data: deliveries } = await supabase
    .from("job_dispatch_deliveries")
    .select(
      "id, case_id, vendor_job_id, status, payload, created_at, cases(ref_code, subject, work_type, case_type, status)"
    )
    .eq("partner_app_slug", partnerAppSlug)
    .in("status", ["delivered", "pending"])
    .order("created_at", { ascending: false })
    .limit(limit);

  return (deliveries ?? []).map((d) => {
    const c = d.cases as {
      ref_code?: string;
      subject?: string;
      work_type?: string;
      case_type?: string;
      status?: string;
    } | null;
    const payload = (d.payload as Record<string, unknown>) ?? {};
    return {
      delivery_id: d.id,
      case_id: d.case_id,
      ref_code: c?.ref_code ?? (payload.ref_code as string) ?? "",
      vendor_job_id: d.vendor_job_id,
      work_type: c?.work_type ?? (payload.work_type as string) ?? null,
      case_type: c?.case_type ?? (payload.case_type as string) ?? null,
      subject: c?.subject ?? (payload.subject as string) ?? "",
      status: d.status,
      payload,
      created_at: d.created_at,
    };
  });
}

export async function acknowledgeDelivery(
  deliveryId: string,
  partnerAppSlug: string
): Promise<boolean> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("job_dispatch_deliveries")
    .update({
      status: "acknowledged",
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", deliveryId)
    .eq("partner_app_slug", partnerAppSlug);

  return !error;
}

export function verifyPartnerInboxAuth(req: Request, partnerAppSlug: string): boolean {
  const envMap = loadEnvWebhooks();
  const secret =
    envMap[partnerAppSlug]?.secret ??
    process.env[`PARTNER_APP_SECRET_${partnerAppSlug.toUpperCase()}`]?.trim() ??
    process.env.JOB_INBOX_SECRET?.trim();

  if (!secret) return false;

  const headerSecret = req.headers.get("x-tmmt-secret") ?? req.headers.get("authorization");
  if (headerSecret?.startsWith("Bearer ")) {
    return headerSecret.slice(7).trim() === secret;
  }
  return headerSecret === secret;
}
