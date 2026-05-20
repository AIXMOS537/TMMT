import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { BridgeNotice } from "@/components/dealer/bridge-notice";
import { Button } from "@/components/ui/button";
import { fetchDealerFleet, fetchDealerLeads, isDealerDataBridgeReady } from "@/lib/dealer/command-center";
import { fetchOwnerDashboardMetrics } from "@/lib/dealer/analytics";
import { fetchDealsForOrg } from "@/lib/dealer/queries";
import { moneyUSD } from "@/lib/utils";
import { Car, Handshake, UserPlus, DollarSign } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DealerDashboardPage() {
  const bridgeReady = isDealerDataBridgeReady();
  const [fleet, leads, deals, owner] = await Promise.all([
    bridgeReady ? fetchDealerFleet() : Promise.resolve([]),
    bridgeReady ? fetchDealerLeads() : Promise.resolve([]),
    fetchDealsForOrg(),
    fetchOwnerDashboardMetrics(),
  ]);

  const available = fleet.filter((f) => (f.retail_status ?? "available") === "available").length;
  const workingDeals = deals.filter((d) => d.status === "working" || d.status === "pending").length;
  const newLeads = leads.filter((l) => l.status === "New Lead").length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="LotOS"
        description="Dealer command center — inventory → lead → deal → payment in one flow."
        action={
          <Link href="/internal/dealer/deals/new">
            <Button>New deal</Button>
          </Link>
        }
      />

      {!bridgeReady && <BridgeNotice />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Units on lot"
          value={available}
          icon={<Car className="h-5 w-5" />}
          hint={`${fleet.length} total in inventory`}
        />
        <StatCard
          label="New leads"
          value={newLeads}
          icon={<UserPlus className="h-5 w-5" />}
          hint={`${leads.length} in pipeline`}
        />
        <StatCard
          label="Open deals"
          value={workingDeals}
          icon={<Handshake className="h-5 w-5" />}
          hint={`${deals.length} deals total`}
        />
        <StatCard
          label="Sold / funded"
          value={deals.filter((d) => d.status === "sold" || d.status === "funded").length}
          icon={<DollarSign className="h-5 w-5" />}
          hint="MTD desk"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Gross potential (lot)"
          value={moneyUSD(owner.grossPotential)}
          icon={<DollarSign className="h-5 w-5" />}
          hint="List minus cost on inventoried units"
        />
        <StatCard
          label="Receivables"
          value={moneyUSD(owner.outstandingReceivables)}
          icon={<DollarSign className="h-5 w-5" />}
          hint={`${owner.overdueCount} overdue`}
        />
        <Link href="/internal/dealer/collections" className="surface-card flex flex-col justify-center p-4 hover:shadow-lift">
          <p className="font-medium">Collections</p>
          <p className="text-sm text-muted-foreground">Open balances & overdue</p>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/internal/dealer/inventory" className="surface-card p-4 hover:shadow-lift">
          <p className="font-medium">Inventory</p>
          <p className="text-sm text-muted-foreground">Cost, list price, retail status</p>
        </Link>
        <Link href="/internal/dealer/leads" className="surface-card p-4 hover:shadow-lift">
          <p className="font-medium">Leads</p>
          <p className="text-sm text-muted-foreground">Incoming buyer pipeline</p>
        </Link>
        <Link href="/internal/dealer/deals" className="surface-card p-4 hover:shadow-lift">
          <p className="font-medium">Deal desk</p>
          <p className="text-sm text-muted-foreground">Working deals and buyers</p>
        </Link>
        <Link href="/internal/dealer/payments" className="surface-card p-4 hover:shadow-lift">
          <p className="font-medium">Payments</p>
          <p className="text-sm text-muted-foreground">Cash-in log per deal</p>
        </Link>
        <Link href="/internal/dealer/service" className="surface-card p-4 hover:shadow-lift">
          <p className="font-medium">Service</p>
          <p className="text-sm text-muted-foreground">Maintenance & ROs</p>
        </Link>
      </div>
    </div>
  );
}
