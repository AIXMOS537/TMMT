/**
 * Resolves the current signed-in account into a {@link CommandHubViewer}:
 * role tier from Supabase auth, purchased modules from `organization_licenses`,
 * entitlements from the profile's package plus any direct grants, and which
 * third-party connections this deployment actually has.
 *
 * Every read is best-effort. If a query fails we fall back to "unrestricted"
 * for that gate rather than hiding links the account has paid for.
 */
import { cache } from "react";
import { createSSRClient } from "@/lib/supabase-server";
import { getTierForUser, isOwnerUser } from "@/lib/auth-roles";
import { clickupConfigured } from "@/lib/clickup/config";
import type { CommandHubViewer } from "@/lib/command-hub-access";
import type { IntegrationId } from "@/lib/command-hub-nav";

function configuredIntegrations(): Record<IntegrationId, boolean> {
  return {
    clickup:
      clickupConfigured() || Boolean(process.env.NEXT_PUBLIC_CLICKUP_WORKSPACE_URL?.trim()),
    ghl: Boolean(process.env.NEXT_PUBLIC_GHL_UPSELL_PIPELINE_URL?.trim()),
  };
}

/** Deduped per request — the layout and the hub page both ask for this. */
export const getCommandHubViewer = cache(async (): Promise<CommandHubViewer> => {
  const integrations = configuredIntegrations();

  let supabase;
  try {
    supabase = await createSSRClient();
  } catch {
    return { tier: "staff", isOwner: false, licenseTier: null, modules: null, entitlements: null, integrations };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tier = getTierForUser(user);
  const isOwner = isOwnerUser(user);
  const base: CommandHubViewer = {
    tier,
    isOwner,
    licenseTier: null,
    modules: null,
    entitlements: null,
    integrations,
  };
  if (!user) return base;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, package_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return base;

  const [license, entitlements] = await Promise.all([
    loadLicense(supabase, profile.organization_id),
    loadEntitlements(supabase, profile.id, profile.package_id),
  ]);

  return {
    ...base,
    licenseTier: license?.license_tier ?? null,
    modules: license?.modules ?? null,
    entitlements,
  };
});

type Supabase = Awaited<ReturnType<typeof createSSRClient>>;

async function loadLicense(supabase: Supabase, organizationId: string | null) {
  if (!organizationId) return null;
  const { data, error } = await supabase
    .from("organization_licenses")
    .select("license_tier, modules")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    license_tier: (data.license_tier as string | null) ?? null,
    modules: (data.modules as string[] | null) ?? [],
  };
}

/** `null` means "no package on file" → entitlement gates are not applied. */
async function loadEntitlements(
  supabase: Supabase,
  profileId: string,
  packageId: string | null,
): Promise<string[] | null> {
  const slugs = new Set<string>();
  let resolved = false;

  if (packageId) {
    const { data, error } = await supabase
      .from("package_entitlements")
      .select("entitlement_slug")
      .eq("package_id", packageId);
    if (!error && data) {
      resolved = true;
      for (const row of data) slugs.add(row.entitlement_slug as string);
    }
  }

  const { data: grants, error: grantError } = await supabase
    .from("profile_entitlement_grants")
    .select("entitlement_slug")
    .eq("profile_id", profileId)
    .or("expires_at.is.null,expires_at.gt.now()");
  if (!grantError && grants?.length) {
    resolved = true;
    for (const row of grants) slugs.add(row.entitlement_slug as string);
  }

  return resolved ? [...slugs] : null;
}
