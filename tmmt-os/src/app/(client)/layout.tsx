import { PortalShell } from "@/components/portal-shell";
import { requirePortal } from "@/lib/auth-portals";

export default async function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const access = await requirePortal("client");
  return (
    <PortalShell
      brand="TMMT · Client Portal"
      currentPortal="client"
      portals={access.portals}
      links={[{ href: "/client/dashboard", label: "Home" }]}
      user={{
        full_name: access.profile.full_name,
        email: access.profile.email,
        role: access.profile.package_slug ?? access.profile.portal_role,
      }}
    >
      {children}
    </PortalShell>
  );
}
