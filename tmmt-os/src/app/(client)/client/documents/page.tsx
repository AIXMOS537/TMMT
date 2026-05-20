import Link from "next/link";
import { requireEntitlement } from "@/lib/auth-portals";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getJourneyHub } from "@/lib/client-journey/queries";
import { PageHeader } from "@/components/page-header";
import { formatDate } from "@/lib/utils";
import { fetchCommandCenterBridgeByEmail } from "@/lib/command-center-bridge/queries";

export const dynamic = "force-dynamic";

const CONTRACT_LABEL: Record<string, string> = {
  rental_agreement: "Rental agreement",
  lto_purchase_agreement: "Lease-to-own agreement",
  vehicle_turnover: "Vehicle turnover",
  vehicle_exchange: "Vehicle exchange",
  operator_license: "Operator license",
};

export default async function ClientDocumentsPage() {
  await requireEntitlement("docs_library", "/client/dashboard");
  const me = await getCurrentUser();
  if (!me?.email) {
    return <p className="text-sm text-muted-foreground">Profile email required.</p>;
  }

  const hub = await getJourneyHub(me.email, me.id);
  const commandCenter = await fetchCommandCenterBridgeByEmail(me.email);
  const supabase = createSupabaseServerClient();

  let contracts: { id: string; title: string; contract_type: string; status: string; signed_at: string | null }[] =
    [];

  if (hub.journey?.id) {
    const { data } = await supabase
      .from("contract_instances")
      .select("id, title, contract_type, status, signed_at")
      .eq("journey_id", hub.journey.id)
      .order("created_at", { ascending: false });
    contracts = data ?? [];
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Documents"
        description="Rental, lease-to-own, turnover, and exchange paperwork for your journey."
        action={
          <Link href="/client/path" className="text-sm font-medium text-primary hover:underline">
            ← My path
          </Link>
        }
      />

      {!hub.lto.eligible && (
        <p className="surface-card p-4 text-sm text-muted-foreground">
          Complete credit path, education, training, and 90-day good standing to unlock LTO documents.
          <Link href="/client/path" className="ml-1 text-primary hover:underline">
            View gates
          </Link>
        </p>
      )}

      {hub.lto.agreements.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Lease-to-own</h2>
          <ul className="space-y-2">
            {hub.lto.agreements.map((a) => (
              <li key={a.id} className="surface-card flex justify-between p-4 text-sm">
                <span>{a.vin ? `VIN ${a.vin}` : "LTO agreement"}</span>
                <span className="capitalize text-muted-foreground">{a.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {commandCenter.configured && commandCenter.backgroundChecks.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Background check</h2>
          <ul className="space-y-2 text-sm">
            {commandCenter.backgroundChecks.map((b) => (
              <li key={b.id} className="surface-card p-4">
                Status: {b.background_check_status ?? "Pending"}
                {b.created_at ? ` · ${formatDate(b.created_at)}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Contracts</h2>
        {contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No documents yet. TMMT will add turnover, exchange, or LTO agreements when you are ready.
          </p>
        ) : (
          <ul className="space-y-2">
            {contracts.map((c) => (
              <li key={c.id} className="surface-card p-4 text-sm">
                <p className="font-medium">{c.title}</p>
                <p className="text-muted-foreground">
                  {CONTRACT_LABEL[c.contract_type] ?? c.contract_type} · {c.status}
                  {c.signed_at ? ` · Signed ${formatDate(c.signed_at)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
