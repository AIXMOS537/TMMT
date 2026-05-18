import { PortalShell } from "@/components/portal-shell";
import { requireRole } from "@/lib/auth";
import { getUserAccess } from "@/lib/access/resolve";

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole(["admin", "internal_team"]);
  const access = await getUserAccess();
  return (
    <PortalShell
      brand="TMMT OS · Internal"
      portals={access?.portals}
      currentPortal="ops"
      links={[
        { href: "/internal/dashboard", label: "Dashboard" },
        { href: "/internal/cases", label: "Cases" },
        { href: "/internal/sync", label: "CRM sync" },
        { href: "/internal/vendors", label: "Vendors" },
        ...(me.role === "admin" ? [{ href: "/internal/admin", label: "Admin" }] : []),
        {
          href: process.env.NEXT_PUBLIC_PORTAL_URL ?? "https://tmmt-c919-two.vercel.app",
          label: "Rentals portal ↗",
        },
      ]}
      user={me}
    >
      {children}
    </PortalShell>
  );
}
