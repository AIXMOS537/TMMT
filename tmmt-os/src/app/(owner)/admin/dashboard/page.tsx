import { requirePortal } from "@/lib/auth-portals";
import { ADMIN_SECTIONS } from "@/lib/access/sections";
import { PortalSectionGrid } from "@/components/portal-section-grid";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const access = await requirePortal("admin");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Admin / Owner Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Control users, packages, entitlements, revenue, and manual access overrides.
        </p>
      </header>
      <PortalSectionGrid sections={ADMIN_SECTIONS} access={access} />
    </div>
  );
}
