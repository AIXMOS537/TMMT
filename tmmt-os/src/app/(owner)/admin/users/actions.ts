"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireEntitlement } from "@/lib/auth-portals";
import {
  ADMIN_SCOPES,
  PORTAL_ROLES,
  TEAM_DEPARTMENTS,
  PACKAGE_SLUGS,
  type PortalRole,
} from "@/lib/access/types";
import { legacyRoleForPortalRole } from "@/lib/access/legacy-role-sync";

export async function updateUserAccess(formData: FormData) {
  await requireEntitlement("admin_users", "/admin/dashboard");

  const profileId = String(formData.get("profile_id") ?? "");
  const portalRole = String(formData.get("portal_role") ?? "");
  const legacyRole = String(formData.get("legacy_role") ?? "");
  const packageSlug = String(formData.get("package_slug") ?? "");
  const teamDepartment = String(formData.get("team_department") ?? "");
  const adminScope = String(formData.get("admin_scope") ?? "");
  const organizationId = String(formData.get("organization_id") ?? "");

  if (!profileId) throw new Error("Missing profile");

  const supabase = createSupabaseServerClient();

  let packageId: string | null = null;
  if (packageSlug && PACKAGE_SLUGS.includes(packageSlug as (typeof PACKAGE_SLUGS)[number])) {
    const { data: pkg } = await supabase
      .from("packages")
      .select("id")
      .eq("slug", packageSlug)
      .maybeSingle();
    packageId = pkg?.id ?? null;
  }

  const payload: Record<string, unknown> = {
    organization_id: organizationId || null,
    package_id: packageSlug === "" ? null : packageId,
    team_department:
      teamDepartment && TEAM_DEPARTMENTS.includes(teamDepartment as (typeof TEAM_DEPARTMENTS)[number])
        ? teamDepartment
        : null,
    admin_scope:
      adminScope && ADMIN_SCOPES.includes(adminScope as (typeof ADMIN_SCOPES)[number])
        ? adminScope
        : null,
  };

  const syncLegacyFromPortal = formData.get("sync_legacy_from_portal") === "on";

  if (PORTAL_ROLES.includes(portalRole as (typeof PORTAL_ROLES)[number])) {
    payload.portal_role = portalRole;
    if (syncLegacyFromPortal) {
      payload.role = legacyRoleForPortalRole(portalRole as PortalRole);
    }
  }
  if (legacyRole && !syncLegacyFromPortal) {
    payload.role = legacyRole;
  }

  const { error } = await supabase.from("profiles").update(payload).eq("id", profileId);

  if (error) throw new Error(error.message);

  await supabase.from("activity_logs").insert({
    entity: "profile",
    entity_id: profileId,
    action: "admin_updated_access",
    data: {
      portal_role: portalRole,
      package_slug: packageSlug || null,
      organization_id: organizationId || null,
    },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/dashboard");
}
