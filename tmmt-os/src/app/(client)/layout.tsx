import { PortalShell } from "@/components/portal-shell";
import { requirePortal } from "@/lib/auth-portals";
import { buildClientNavLinks } from "@/lib/access/client-nav";
import { getOrganizationVertical, getOrganizationPartnerAppSlug } from "@/lib/verticals/resolve";
import { resolveBranding } from "@/lib/verticals/branding";

export default async function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const access = await requirePortal("client");
  const vertical = await getOrganizationVertical();
  const partnerSlug = await getOrganizationPartnerAppSlug();
  const brand = resolveBranding(vertical, partnerSlug);

  return (
    <PortalShell
      brand={brand.clientBrand}
      currentPortal="client"
      portals={access.portals}
      links={buildClientNavLinks(access)}
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
