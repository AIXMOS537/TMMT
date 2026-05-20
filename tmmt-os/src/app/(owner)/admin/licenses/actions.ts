"use server";

import { revalidatePath } from "next/cache";
import { requireEntitlement } from "@/lib/auth-portals";
import { ORG_MODULES, type OrgModule } from "@/lib/access/org-license";
import { manifestForSku, PROVISION_SKUS } from "@/lib/access/provision";
import { LICENSE_TIERS, type LicenseTier } from "@/lib/access/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function createOrganization(formData: FormData) {
  await requireEntitlement("admin_licenses", "/admin/dashboard");

  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "tmmt").trim() || "tmmt";
  if (!name) throw new Error("Organization name is required");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .insert({ name, kind })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("activity_logs").insert({
    entity: "organization",
    entity_id: data.id,
    action: "admin_created_organization",
    data: { name, kind },
  });

  revalidatePath("/admin/licenses");
}

export async function provisionOrgFromSku(formData: FormData) {
  await requireEntitlement("admin_licenses", "/admin/dashboard");

  const organizationId = String(formData.get("organization_id") ?? "");
  const sku = String(formData.get("sku") ?? "");
  if (!organizationId) throw new Error("Missing organization");
  const manifest = manifestForSku(sku);

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("organization_licenses").upsert(
    {
      organization_id: organizationId,
      license_tier: manifest.license_tier,
      modules: manifest.modules,
      max_ventures: manifest.max_ventures,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" }
  );

  if (error) throw new Error(error.message);

  await supabase.from("activity_logs").insert({
    entity: "organization_license",
    entity_id: organizationId,
    action: "admin_provisioned_sku",
    data: { sku, ...manifest },
  });

  revalidatePath("/admin/licenses");
  revalidatePath("/admin/users");
}

export async function updateOrgLicense(formData: FormData) {
  await requireEntitlement("admin_licenses", "/admin/dashboard");

  const organizationId = String(formData.get("organization_id") ?? "");
  const licenseTier = String(formData.get("license_tier") ?? "");
  const maxVentures = Number(formData.get("max_ventures") ?? 1);

  if (!organizationId) throw new Error("Missing organization");
  if (!LICENSE_TIERS.includes(licenseTier as LicenseTier)) {
    throw new Error("Invalid license tier");
  }

  const modules = ORG_MODULES.filter((m) => formData.get(`module_${m}`) === "on") as OrgModule[];

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("organization_licenses").upsert(
    {
      organization_id: organizationId,
      license_tier: licenseTier,
      modules: licenseTier === "full_os" ? [...ORG_MODULES] : modules,
      max_ventures: Number.isFinite(maxVentures) ? Math.max(1, maxVentures) : 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" }
  );

  if (error) throw new Error(error.message);

  await supabase.from("activity_logs").insert({
    entity: "organization_license",
    entity_id: organizationId,
    action: "admin_updated_license",
    data: { license_tier: licenseTier, modules, max_ventures: maxVentures },
  });

  revalidatePath("/admin/licenses");
}

export async function assignProfileOrganization(formData: FormData) {
  await requireEntitlement("admin_licenses", "/admin/dashboard");

  const profileId = String(formData.get("profile_id") ?? "");
  const organizationId = String(formData.get("organization_id") ?? "");

  if (!profileId) throw new Error("Missing profile");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ organization_id: organizationId || null })
    .eq("id", profileId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/licenses");
  revalidatePath("/admin/users");
}
