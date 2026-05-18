import { notFound, redirect } from "next/navigation";
import { requirePortal } from "@/lib/auth-portals";
import { CLIENT_SECTIONS } from "@/lib/access/sections";
import { hasEntitlement } from "@/lib/access/resolve";
import { PortalSectionPage } from "@/components/portal-section-page";

export const dynamic = "force-dynamic";

export default async function ClientSectionPage({
  params,
}: {
  params: { section: string };
}) {
  const access = await requirePortal("client");
  const section = CLIENT_SECTIONS.find((s) => s.slug === params.section);
  if (!section) notFound();
  if (!hasEntitlement(access, section.entitlement)) {
    redirect("/portals?error=entitlement");
  }

  return (
    <PortalSectionPage
      title={section.title}
      description={section.description}
      portalHome="/client/dashboard"
    />
  );
}
