import { PortalShell } from "@/components/portal-shell";
import { requireRole } from "@/lib/auth";
import { getUserAccess } from "@/lib/access/resolve";

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole(["admin", "internal_team"]);
  const access = await getUserAccess();
  return (
    <PortalShell
      brand="TMMT OS · Internal"
      sidebar
      portals={access?.portals}
      currentPortal="ops"
      links={[
        { href: "/internal/dashboard", label: "Dashboard" },
        { href: "/internal/cases", label: "Cases" },
        { href: "/internal/sync", label: "CRM sync" },
        { href: "/internal/interfaces", label: "Interfaces" },
        { href: "/internal/vendors", label: "Vendors" },
        ...(me.role === "admin" ? [{ href: "/internal/admin", label: "Admin" }] : []),
      ]}
      user={me}
    >
      {children}
    </PortalShell>
  );
}
