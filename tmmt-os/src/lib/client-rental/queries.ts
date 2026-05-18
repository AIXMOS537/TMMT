import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CANONICAL_STAGE_LABEL } from "@/lib/crm-sync/labels";
import type { CanonicalRenterStage } from "@/lib/crm-sync/types";
import type { CaseStatus } from "@/lib/workflow/statuses";

export type ClientRentalHub = {
  email: string;
  pipeline: {
    canonical_stage: CanonicalRenterStage;
    ghl_stage: string | null;
    ghl_pipeline_name: string | null;
    updated_at: string | null;
  } | null;
  alerts: {
    id: string;
    alert_type: string;
    title: string;
    message: string;
    priority: string;
    due_at: string | null;
    acknowledged_at: string | null;
    canonical_stage: string | null;
  }[];
  tickets: {
    open: number;
    total: number;
    recent: { id: string; ref_code: string; subject: string; status: CaseStatus; request_type: string }[];
  };
  maintenance: { open: number };
  ledger: {
    pendingDepositCents: number;
    pendingRefundCents: number;
    deductionCents: number;
    entries: {
      id: string;
      entry_type: string;
      status: string;
      title: string;
      description: string | null;
      amount_cents: number;
      due_at: string | null;
    }[];
  };
};

const OPEN_CASE = new Set([
  "intake_submitted",
  "initial_contact_needed",
  "initial_contact_complete",
  "internal_review",
  "task_assignment",
  "vendor_needed",
  "vendor_assigned",
  "vendor_in_progress",
  "vendor_completed",
  "internal_quality_check",
  "customer_follow_up",
  "awaiting_approval",
  "blocked",
]);

export async function getClientRentalHub(email: string): Promise<ClientRentalHub> {
  const supabase = createSupabaseServerClient();
  const normalized = email.trim();

  const [
    { data: pipeline },
    { data: alerts },
    { data: cases },
    { data: ledger },
  ] = await Promise.all([
    supabase.from("client_renter_status").select("*").maybeSingle(),
    supabase
      .from("client_alerts")
      .select("id, alert_type, title, message, priority, due_at, acknowledged_at, canonical_stage")
      .is("acknowledged_at", null)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(12),
    supabase
      .from("cases")
      .select("id, ref_code, subject, status, request_type, created_at")
      .ilike("customer_email", normalized)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("rental_ledger")
      .select("id, entry_type, status, title, description, amount_cents, due_at")
      .eq("visible_to_client", true)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const allCases = cases ?? [];
  const openCases = allCases.filter((c) => OPEN_CASE.has(c.status));
  const maintenanceOpen = openCases.filter((c) => c.request_type === "maintenance").length;

  const entries = ledger ?? [];
  let pendingDepositCents = 0;
  let pendingRefundCents = 0;
  let deductionCents = 0;

  for (const e of entries) {
    if (e.status !== "pending" && e.status !== "processing") continue;
    if (e.entry_type === "deposit") pendingDepositCents += e.amount_cents;
    if (e.entry_type === "deposit_return" || e.entry_type === "refund") pendingRefundCents += e.amount_cents;
    if (e.entry_type === "deduction" || e.entry_type === "expense") deductionCents += e.amount_cents;
  }

  const pipe = pipeline
    ? {
        canonical_stage: pipeline.canonical_stage as CanonicalRenterStage,
        ghl_stage: pipeline.ghl_stage,
        ghl_pipeline_name: pipeline.ghl_pipeline_name,
        updated_at: pipeline.updated_at,
      }
    : null;

  return {
    email: normalized,
    pipeline: pipe,
    alerts: alerts ?? [],
    tickets: {
      open: openCases.length,
      total: allCases.length,
      recent: openCases.slice(0, 5).map((c) => ({
        id: c.id,
        ref_code: c.ref_code,
        subject: c.subject,
        status: c.status as CaseStatus,
        request_type: c.request_type,
      })),
    },
    maintenance: { open: maintenanceOpen },
    ledger: {
      pendingDepositCents,
      pendingRefundCents,
      deductionCents,
      entries: entries.map((e) => ({
        id: e.id,
        entry_type: e.entry_type,
        status: e.status,
        title: e.title,
        description: e.description,
        amount_cents: e.amount_cents,
        due_at: e.due_at,
      })),
    },
  };
}

export function pipelineStageLabel(stage: CanonicalRenterStage | null | undefined) {
  if (!stage) return "Not linked yet";
  return CANONICAL_STAGE_LABEL[stage] ?? stage;
}
