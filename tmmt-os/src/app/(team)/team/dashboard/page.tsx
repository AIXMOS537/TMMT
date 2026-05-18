import { requirePortal } from "@/lib/auth-portals";
import { TEAM_SECTIONS } from "@/lib/access/sections";
import { PortalSectionGrid } from "@/components/portal-section-grid";

export const dynamic = "force-dynamic";

export default async function TeamDashboardPage() {
  const access = await requirePortal("team");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Team Portal</h1>
        <p className="text-sm text-muted-foreground">
          Mission, training, SOPs, and workflows — scoped to your department.
        </p>
      </header>
      <PortalSectionGrid sections={TEAM_SECTIONS} access={access} />
    </div>
  );
}
