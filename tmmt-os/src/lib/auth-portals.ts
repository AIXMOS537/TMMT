import { redirect } from "next/navigation";
import { getUserAccess, hasEntitlement } from "@/lib/access/resolve";
import { canAccessPortal } from "@/lib/access/portals";
import type { PortalId } from "@/lib/access/types";

export async function requirePortal(portal: PortalId) {
  const access = await getUserAccess();
  if (!access) redirect("/login");
  if (!canAccessPortal(access.profile, portal)) {
    redirect("/portals?error=forbidden");
  }
  return access;
}

export async function requireEntitlement(entitlement: string, fallback = "/portals") {
  const access = await getUserAccess();
  if (!access) redirect("/login");
  if (!hasEntitlement(access, entitlement)) {
    redirect(`${fallback}?error=entitlement`);
  }
  return access;
}
