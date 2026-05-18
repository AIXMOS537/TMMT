import { PortalShell } from "@/components/portal-shell";
import { requirePortal } from "@/lib/auth-portals";

export default async function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  const access = await requirePortal("admin");
  return (
    <PortalShell
      brand="TMMT OS"
      currentPortal="admin"
      portals={access.portals}
      links={[{ href: "/admin/dashboard", label: "Home" }]}
      user={{
        full_name: access.profile.full_name,
        email: access.profile.email,
        role: access.profile.admin_scope ?? access.profile.portal_role,
      }}
    >
      {children}
    </PortalShell>
  );
}
