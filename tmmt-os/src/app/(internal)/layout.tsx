import { PortalShell } from "@/components/portal-shell";
import { requireRole } from "@/lib/auth";
import { getUserAccess } from "@/lib/access/resolve";

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole(["admin", "internal_team"]);
  const access = await getUserAccess();
  return (
    <PortalShell
      brand="TMMT OS"
      sidebar
      portals={access?.portals}
      currentPortal="ops"
      links={[
        { href: "/internal/dashboard", label: "Dashboard" },
        { href: "/internal/assistant", label: "Command" },
        { href: "/internal/cases", label: "Cases" },
        { href: "/internal/sync", label: "CRM sync" },
        { href: "/internal/ledger", label: "Finance" },
        { href: "/internal/vendors", label: "Vendors" },
        ...(me.role === "admin" ? [{ href: "/internal/admin", label: "Admin" }] : []),
      ]}
      user={me}
    >
      {children}
    </PortalShell>
  );
}
