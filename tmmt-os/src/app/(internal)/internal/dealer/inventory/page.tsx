import { PageHeader } from "@/components/page-header";
import { BridgeNotice } from "@/components/dealer/bridge-notice";
import { InventoryTable } from "@/components/dealer/inventory-table";
import { fetchDealerFleet, isDealerDataBridgeReady } from "@/lib/dealer/command-center";

export const dynamic = "force-dynamic";

export default async function DealerInventoryPage() {
  const ready = isDealerDataBridgeReady();
  const fleet = ready ? await fetchDealerFleet() : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Retail lot units — acquisition cost, list price, and retail status."
      />
      {!ready && <BridgeNotice />}
      <InventoryTable rows={fleet} />
    </div>
  );
}
