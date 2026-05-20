import { hasEntitlement } from "./resolve";
import { CLIENT_SECTIONS } from "./sections";
import type { ResolvedAccess } from "./types";

export function buildClientNavLinks(access: ResolvedAccess) {
  const links: { href: string; label: string }[] = [
    { href: "/client/dashboard", label: "Home" },
  ];

  const seen = new Set<string>();
  for (const section of CLIENT_SECTIONS) {
    if (!hasEntitlement(access, section.entitlement)) continue;
    if (seen.has(section.href)) continue;
    seen.add(section.href);
    links.push({ href: section.href, label: section.title });
  }

  return links;
}
