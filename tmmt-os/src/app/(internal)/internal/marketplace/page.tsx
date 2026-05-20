import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { listAllMarketplaceListings } from "@/lib/marketplace/queries";
import { MarketplaceAdminPanel } from "@/components/marketplace/marketplace-admin-panel";

export const dynamic = "force-dynamic";

export default async function InternalMarketplacePage() {
  await requireRole(["admin", "internal_team"]);
  const listings = await listAllMarketplaceListings();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Marketplace admin"
        description="Deal flow, vendors, and opportunities — Module 3 for clients at /client/marketplace."
      />
      <MarketplaceAdminPanel listings={listings} />
    </div>
  );
}
