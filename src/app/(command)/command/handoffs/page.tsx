import { createSSRClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { Card, StatCard, PageHeader, StatusBadge, Badge, Button } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { Handshake, ShieldCheck, ShieldAlert, Clock, CheckCircle2 } from "lucide-react";

// Cross-entity client handoffs (TMMT · AIXMOS · MOE Legacy) with consent status.
// Reads the v_federation_handoffs view; mutations go through the guarded RPCs
// (capture_handoff_consent, accept_handoff) so the consent gate can't be skipped.

export const dynamic = "force-dynamic";

type Handoff = {
  id: string;
  created_at: string;
  source_org: string;
  dest_org: string;
  source_contact_ref: string | null;
  reason: string | null;
  status: string;
  consent_ok: boolean;
  consent_channel: string | null;
  commission_cents: number | null;
  accepted_at: string | null;
};

const ENTITY: Record<string, string> = {
  tmmt: "TMMT",
  aixmos: "AIXMOS",
  moe_legacy: "MOE Legacy",
};
const entityLabel = (slug: string) => ENTITY[slug] ?? slug;

const CONSENT_CHANNELS = ["sms", "email", "call", "form", "in_person"];

// ── Server actions (guarded RPCs) ────────────────────────────────
async function logConsentAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const channel = String(formData.get("channel") || "");
  if (!id || !channel) return;
  const supabase = await createSSRClient();
  await supabase.rpc("capture_handoff_consent", {
    p_referral_id: id,
    p_consent_channel: channel,
  });
  revalidatePath("/command/handoffs");
}

async function acceptHandoffAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createSSRClient();
  // The enforce_handoff_consent() trigger blocks this if consent is missing.
  await supabase.rpc("accept_handoff", { p_referral_id: id });
  revalidatePath("/command/handoffs");
}

export default async function HandoffsPage() {
  const supabase = await createSSRClient();
  const { data, error } = await supabase
    .from("v_federation_handoffs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const handoffs = (data ?? []) as Handoff[];

  const total = handoffs.length;
  const awaitingConsent = handoffs.filter((h) => !h.consent_ok && h.status === "pending").length;
  const readyToAccept = handoffs.filter((h) => h.consent_ok && h.status === "pending").length;
  const accepted = handoffs.filter((h) => ["accepted", "completed", "paid"].includes(h.status)).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Entity handoffs"
        description="Cross-entity client referrals (TMMT · AIXMOS · MOE Legacy). Every handoff is consent-gated — a client only moves between entities after a logged yes."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open handoffs" value={total} icon={<Handshake size={18} />} />
        <StatCard label="Awaiting consent" value={awaitingConsent} icon={<ShieldAlert size={18} />} />
        <StatCard label="Ready to accept" value={readyToAccept} icon={<Clock size={18} />} />
        <StatCard label="Accepted / served" value={accepted} icon={<CheckCircle2 size={18} />} />
      </div>

      {error && (
        <Card className="p-4 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30">
          Could not load handoffs: {error.message}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-slate-300">Created</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-slate-300">Route</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-slate-300">Client</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-slate-300">Reason</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-slate-300">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-slate-300">Consent</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-slate-300">Fee</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-slate-300">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {handoffs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400 dark:text-slate-500">
                    No cross-entity handoffs yet.
                  </td>
                </tr>
              ) : (
                handoffs.map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDateTime(h.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                      {entityLabel(h.source_org)} → {entityLabel(h.dest_org)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-slate-300">
                      {h.source_contact_ref ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400 max-w-xs">
                      {h.reason
                        ? h.reason.length > 70
                          ? `${h.reason.slice(0, 70)}…`
                          : h.reason
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={h.status} />
                    </td>
                    <td className="px-4 py-3">
                      {h.consent_ok ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                          ✓ {h.consent_channel ?? "consented"}
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                          ⛔ none
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap">
                      {h.commission_cents != null ? `$${(h.commission_cents / 100).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {h.status === "pending" && !h.consent_ok && (
                        <form action={logConsentAction} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={h.id} />
                          <select
                            name="channel"
                            defaultValue="sms"
                            className="rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs px-2 py-1 text-gray-900 dark:text-slate-100"
                          >
                            {CONSENT_CHANNELS.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <Button type="submit" size="sm" variant="secondary">
                            <ShieldCheck size={14} />
                            Log consent
                          </Button>
                        </form>
                      )}
                      {h.status === "pending" && h.consent_ok && (
                        <form action={acceptHandoffAction}>
                          <input type="hidden" name="id" value={h.id} />
                          <Button type="submit" size="sm">
                            Accept handoff
                          </Button>
                        </form>
                      )}
                      {h.status !== "pending" && (
                        <span className="text-xs text-gray-400 dark:text-slate-500">
                          {h.accepted_at ? `accepted ${formatDateTime(h.accepted_at)}` : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
