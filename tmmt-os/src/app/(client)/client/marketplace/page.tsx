import Link from "next/link";
import { requireEntitlement } from "@/lib/auth-portals";
import { PageHeader } from "@/components/page-header";
import { listActiveMarketplaceListings } from "@/lib/marketplace/queries";
import { getOrganizationVertical, getOrganizationPartnerAppSlug } from "@/lib/verticals/resolve";
import { resolveBranding } from "@/lib/verticals/branding";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  deal: "Deal",
  vendor: "Vendor",
  opportunity: "Opportunity",
};

export default async function ClientMarketplacePage() {
  await requireEntitlement("marketplace_hub", "/client/dashboard");
  const vertical = await getOrganizationVertical();
  const partnerSlug = await getOrganizationPartnerAppSlug();
  const brand = resolveBranding(vertical, partnerSlug);
  const listings = await listActiveMarketplaceListings(brand.marketplaceVerticalSlug);

  const featured = listings.filter((l) => l.featured);
  const rest = listings.filter((l) => !l.featured);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Marketplace"
        description="Vetted deals, vendors, and opportunities for your rental income system."
        action={
          <Link
            href="/marketplace"
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            Public vehicle catalog
          </Link>
        }
      />

      {!listings.length && (
        <p className="text-sm text-muted-foreground surface-card p-5">
          Listings will appear here once your team publishes them in TMMT OS → Marketplace
          admin. If you are setting up the platform, apply migration{" "}
          <code className="text-xs">0030_ecosystem_framework_modules.sql</code>.
        </p>
      )}

      {featured.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Featured
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {featured.map((item) => (
              <ListingCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {featured.length ? "More" : "All listings"}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {rest.map((item) => (
              <ListingCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ListingCard({
  item,
}: {
  item: Awaited<ReturnType<typeof listActiveMarketplaceListings>>[number];
}) {
  return (
    <article className="surface-card flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{item.title}</h3>
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {TYPE_LABELS[item.listing_type] ?? item.listing_type}
        </span>
      </div>
      {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
      {item.financial_summary && (
        <p className="text-sm font-medium">{item.financial_summary}</p>
      )}
      {item.external_url && (
        <a
          href={item.external_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 w-fit items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-accent"
        >
          View details
        </a>
      )}
    </article>
  );
}
