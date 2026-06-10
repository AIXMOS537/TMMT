import { createCommandCenterClient, isCommandCenterBridgeConfigured } from "@/lib/command-center-bridge/client";

const DEALER_PIPELINE_NAMES = [
  "applicants – dealership",
  "applicants - dealership",
  "dealer sales",
  "dealership",
];

const STAGE_TO_LEAD_STATUS: Record<string, string> = {
  "new lead": "New Lead",
  contacted: "New Lead",
  qualified: "Qualified",
  "appointment set": "Qualified",
  showed: "Contracting",
  "application in": "Contracting",
  "approved / conditional": "Contracting",
  "sold / placed": "Closed",
  lost: "Closed",
};

export function isDealerSalesPipeline(pipelineName?: string, businessLine?: string): boolean {
  const p = (pipelineName ?? "").trim().toLowerCase();
  const b = (businessLine ?? "").trim().toLowerCase();
  if (b === "dealer" || b === "wholesale-cars" || b.includes("dealer")) return true;
  return DEALER_PIPELINE_NAMES.some((name) => p.includes(name));
}

function mapStageToLeadStatus(stage: string): string {
  const norm = stage.trim().toLowerCase();
  return STAGE_TO_LEAD_STATUS[norm] ?? "New Lead";
}

/** Mirror GHL dealer pipeline stages into Command Center incoming_leads (LotOS). */
export async function syncDealerLeadFromGhl(args: {
  ghlContactId: string;
  ghlOpportunityId?: string | null;
  pipelineName?: string | null;
  stage: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  businessLine?: string | null;
}): Promise<{ ok: boolean; leadId?: string; error?: string }> {
  if (!isCommandCenterBridgeConfigured()) {
    return { ok: false, error: "command_center_not_configured" };
  }
  if (!isDealerSalesPipeline(args.pipelineName ?? undefined, args.businessLine ?? undefined)) {
    return { ok: true };
  }

  const db = createCommandCenterClient();
  if (!db) return { ok: false, error: "command_center_client_failed" };

  const status = mapStageToLeadStatus(args.stage);
  const contact_name = args.customerName?.trim() || "Unknown";
  const email = args.customerEmail?.trim() || null;
  const phone = args.customerPhone?.replace(/\D/g, "") || null;

  const { data: existing } = await db
    .from("incoming_leads")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  const row: Record<string, unknown> = {
    contact_name,
    email,
    phone,
    status,
    opportunity_name: args.pipelineName
      ? `${args.pipelineName} · ${args.stage}`
      : args.stage,
    priority_level: status === "New Lead" ? "Requires Follow Up" : "Moderate",
    notes: [
      `ghl_contact_id=${args.ghlContactId}`,
      args.ghlOpportunityId ? `ghl_opportunity_id=${args.ghlOpportunityId}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };

  if (existing?.id) {
    const { error } = await db.from("incoming_leads").update(row).eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, leadId: existing.id };
  }

  const { data, error } = await db.from("incoming_leads").insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, leadId: data.id };
}
