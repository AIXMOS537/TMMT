/**
 * Which command-hub links an account may see.
 *
 * Three independent gates, all pure so they can be unit-tested and shared by
 * the hub page (server) and the nav (client, via allowed hrefs):
 *
 *  1. tier        — role tier from Supabase auth (owner/staff/executive/…)
 *  2. package     — what the client bought: org license modules + package
 *                   entitlements. Missing data means "unrestricted", never
 *                   "hide everything", so a bad read can't blank the hub.
 *  3. integration — third-party connections that are actually configured.
 */
import type { AccessTier } from "@/lib/auth-roles";
import {
  commandHubSections,
  type CommandHubLink,
  type IntegrationId,
  type OrgModule,
} from "@/lib/command-hub-nav";

export const COMMAND_HUB_HREF = "/command";

/** Tiers that see a link with no explicit `tiers` requirement. */
export const DEFAULT_LINK_TIERS: AccessTier[] = ["owner", "staff"];

export type CommandHubViewer = {
  tier: AccessTier;
  isOwner: boolean;
  /** `organization_licenses.license_tier` — "full_os" unlocks every module. */
  licenseTier: string | null;
  /** Purchased modules. `null` = no license row on file → unrestricted. */
  modules: readonly string[] | null;
  /** Package + granted entitlement slugs. `null` = no package → unrestricted. */
  entitlements: readonly string[] | null;
  integrations: Record<IntegrationId, boolean>;
};

export const UNRESTRICTED_VIEWER: CommandHubViewer = {
  tier: "owner",
  isOwner: true,
  licenseTier: null,
  modules: null,
  entitlements: null,
  integrations: { clickup: true, ghl: true },
};

export function hasOrgModule(viewer: CommandHubViewer, module: OrgModule): boolean {
  if (viewer.isOwner) return true;
  if (viewer.modules === null) return true;
  if (viewer.licenseTier === "full_os") return true;
  return viewer.modules.includes(module);
}

export function hasEntitlement(viewer: CommandHubViewer, slug: string): boolean {
  if (viewer.isOwner) return true;
  if (viewer.entitlements === null) return true;
  return viewer.entitlements.includes(slug);
}

export function canSeeCommandHubLink(link: CommandHubLink, viewer: CommandHubViewer): boolean {
  const req = link.requires;
  const tiers = req?.tiers ?? DEFAULT_LINK_TIERS;
  if (!tiers.includes(viewer.tier)) return false;

  // A connection nobody wired up is a dead link — hidden even from the owner.
  if (req?.integration && !viewer.integrations[req.integration]) return false;

  if (req?.module && !hasOrgModule(viewer, req.module)) return false;
  if (req?.entitlement && !hasEntitlement(viewer, req.entitlement)) return false;
  return true;
}

/** Sections with out-of-package links removed; empty sections are dropped. */
export function visibleCommandHubSections(viewer: CommandHubViewer) {
  return commandHubSections
    .map((section) => ({
      ...section,
      links: section.links.filter((link) => canSeeCommandHubLink(link, viewer)),
    }))
    .filter((section) => section.links.length > 0);
}

/** Links this account cannot see — shown as an upgrade hint on the hub page. */
export function hiddenCommandHubCount(viewer: CommandHubViewer): number {
  return commandHubSections
    .flatMap((s) => s.links)
    .filter((link) => !canSeeCommandHubLink(link, viewer)).length;
}

/**
 * Serializable allow-list for the client nav. The nav keeps its own copy of the
 * config (icons are components and can't cross the server/client boundary), so
 * it only needs the hrefs it is allowed to render.
 */
export function allowedCommandHubHrefs(viewer: CommandHubViewer): string[] {
  const hrefs = visibleCommandHubSections(viewer).flatMap((s) => s.links.map((l) => l.href));
  const canSeeHub = DEFAULT_LINK_TIERS.includes(viewer.tier);
  return canSeeHub ? [COMMAND_HUB_HREF, ...hrefs] : hrefs;
}
