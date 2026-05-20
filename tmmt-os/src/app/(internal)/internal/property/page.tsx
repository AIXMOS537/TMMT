import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getOrganizationVertical, getOrganizationPartnerAppSlug } from "@/lib/verticals/resolve";
import { resolveBranding } from "@/lib/verticals/branding";
import { listActiveMarketplaceListings } from "@/lib/marketplace/queries";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Building2, Store, Users, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PropertyVerticalDashboardPage() {
  await requireRole(["admin", "internal_team"]);
  const vertical = await getOrganizationVertical();
  if (vertical !== "property" && vertical !== "service_arbitrage") {
    redirect("/internal/dashboard");
  }

  const partnerSlug = await getOrganizationPartnerAppSlug();
  const brand = resolveBranding(vertical, partnerSlug);
  const listings = await listActiveMarketplaceListings(brand.marketplaceVerticalSlug);
  const deals = listings.filter((l) => l.listing_type === "deal").length;
  const vendors = listings.filter((l) => l.listing_type === "vendor").length;

  return (
    <div className="space-y-8">
      <div
        className={`rounded-xl border bg-gradient-to-br p-6 ${brand.accentClass ?? "from-primary/5 to-muted/30"}`}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          White-label shell
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{brand.opsBrand}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{brand.tagline}</p>
        <p className="mt-3 text-sm">
          Four modules: <strong>Dashboard</strong> · <strong>Learn</strong> ·{" "}
          <strong>Marketplace</strong> · <strong>Operate</strong> — configure GHL + listings, then
          invite your first $97/mo subscribers.
        </p>
      </div>

      <PageHeader
        title="Property command center"
        description="Wave 1 app #02 — short-term rental / Airbnb arbitrage on the TMMT base layer."
        action={
          <Link
            href="/internal/property/setup"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Setup wizard
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Marketplace deals" value={deals} icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Vendors listed" value={vendors} icon={<Store className="h-5 w-5" />} />
        <StatCard
          label="License SKU"
          value="property_arbitrage"
          hint="Provision in /admin/licenses"
          icon={<Sparkles className="h-5 w-5" />}
        />
        <StatCard
          label="Partner slug"
          value={partnerSlug ?? brand.marketplaceVerticalSlug}
          hint="organizations.partner_app_slug"
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      <section className="surface-card space-y-3 p-5">
        <h2 className="text-lg font-medium">Quick links</h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li>
            <Link href="/internal/marketplace" className="text-primary hover:underline">
              Marketplace admin →
            </Link>
            <span className="text-muted-foreground"> — deals & vendors for {brand.clientBrand}</span>
          </li>
          <li>
            <Link href="/client/marketplace" className="text-primary hover:underline">
              Client marketplace preview →
            </Link>
          </li>
          <li>
            <Link href="/team/performance" className="text-primary hover:underline">
              Marketing KPIs →
            </Link>
          </li>
          <li>
            <Link href="/internal/partner-verticals" className="text-primary hover:underline">
              Full 30-app catalog →
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
