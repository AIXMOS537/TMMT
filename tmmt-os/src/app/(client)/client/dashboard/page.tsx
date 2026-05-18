import { requirePortal } from "@/lib/auth-portals";
import { CLIENT_SECTIONS } from "@/lib/access/sections";
import { PortalSectionGrid } from "@/components/portal-section-grid";

export const dynamic = "force-dynamic";

export default async function ClientDashboardPage() {
  const access = await requirePortal("client");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Client Portal</h1>
        <p className="text-sm text-muted-foreground">
          Everything included in your package — apps, training, documents, and support.
        </p>
      </header>
      <PortalSectionGrid
        sections={CLIENT_SECTIONS}
        access={access}
        packageLabel={access.packageSlug}
      />
    </div>
  );
}
