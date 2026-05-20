import { PageHeader } from "@/components/page-header";
import { DealForm } from "@/components/dealer/deal-form";
import { PartyForm } from "@/components/dealer/party-form";
import { fetchDealerFleet, isDealerDataBridgeReady } from "@/lib/dealer/command-center";
import { fetchPartiesForOrg } from "@/lib/dealer/queries";

export const dynamic = "force-dynamic";

export default async function NewDealPage() {
  const parties = await fetchPartiesForOrg();
  const fleet = isDealerDataBridgeReady() ? await fetchDealerFleet() : [];
  const vehicles = fleet.map((f) => ({
    id: f.id,
    label: f.vehicle_name ?? [f.year, f.vehicle_make, f.vehicle_model].filter(Boolean).join(" "),
    vin: f.vin_number,
  }));

  return (
    <div className="space-y-8">
      <PageHeader title="New deal" description="Attach a buyer and vehicle, then log payments." />
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Add buyer first (if needed)</h2>
        <PartyForm />
      </section>
      <DealForm parties={parties} vehicles={vehicles} />
    </div>
  );
}
