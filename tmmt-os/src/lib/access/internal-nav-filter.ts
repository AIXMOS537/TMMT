import type { InternalNavLink, OrgVertical } from "@/lib/verticals/types";
import { getInternalNavLinks } from "@/lib/verticals/nav";
import type { OrgModule } from "./org-license";
import { hasOrgModuleAccess } from "./org-license";
import type { ResolvedAccess } from "./types";

const LINK_MODULES: Partial<Record<string, OrgModule>> = {
  "/internal/journey": "credit_repair",
  "/internal/operators": "operator_program",
  "/v/tmmt-rentals": "rentals_app",
};

export function getFilteredInternalNavLinks(
  vertical: OrgVertical,
  isAdmin: boolean,
  access: ResolvedAccess | null
): InternalNavLink[] {
  const links = getInternalNavLinks(vertical, isAdmin);
  if (!access) return links;

  return links.filter((link) => {
    const module = LINK_MODULES[link.href];
    if (!module) return true;
    return hasOrgModuleAccess(access, module);
  });
}
