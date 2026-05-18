import { PortalShell } from "@/components/portal-shell";
import { requirePortal } from "@/lib/auth-portals";

export default async function TeamPortalLayout({ children }: { children: React.ReactNode }) {
  const access = await requirePortal("team");
  return (
    <PortalShell
      brand="TMMT · Team Portal"
      currentPortal="team"
      portals={access.portals}
      links={[
        { href: "/team/dashboard", label: "Home" },
        ...(access.portals.includes("ops")
          ? [{ href: "/internal/dashboard", label: "TMMT Ops" }]
          : []),
      ]}
      user={{
        full_name: access.profile.full_name,
        email: access.profile.email,
        role: access.profile.team_department ?? access.profile.portal_role,
      }}
    >
      {children}
    </PortalShell>
  );
}
