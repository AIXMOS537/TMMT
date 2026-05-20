import { PortalShell } from "@/components/portal-shell";
import { requireRole } from "@/lib/auth";
import { getUserAccess } from "@/lib/access/resolve";
import { getOrganizationVertical } from "@/lib/verticals/resolve";
import { getFilteredInternalNavLinks } from "@/lib/access/internal-nav-filter";
import { getDealerBrand } from "@/lib/verticals/nav";
import { getOrganizationAccessBlock } from "@/lib/agency/access";

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole(["admin", "internal_team"]);
  const access = await getUserAccess();
  const vertical = await getOrganizationVertical();
  const links = getFilteredInternalNavLinks(vertical, me.role === "admin", access);
  const brand = getDealerBrand(vertical);
  const suspendMessage = await getOrganizationAccessBlock();

  if (suspendMessage) {
    return (
      <PortalShell
        brand={brand}
        sidebar
        portals={access?.portals}
        currentPortal="ops"
        links={[]}
        user={me}
      >
        <div className="mx-auto max-w-lg space-y-4 p-8 text-center">
          <h1 className="text-xl font-semibold">Access paused</h1>
          <p className="text-muted-foreground">{suspendMessage}</p>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell
      brand={brand}
      sidebar
      portals={access?.portals}
      currentPortal="ops"
      links={links}
      user={me}
    >
      {children}
    </PortalShell>
  );
}
