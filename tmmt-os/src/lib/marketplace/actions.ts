"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { MARKETPLACE_LISTING_TYPES } from "./types";

const listingSchema = z.object({
  vertical_slug: z.string().min(1).max(64),
  listing_type: z.enum(MARKETPLACE_LISTING_TYPES),
  title: z.string().min(2).max(200),
  description: z.string().max(4000).optional(),
  financial_summary: z.string().max(500).optional(),
  external_url: z.string().url().optional().or(z.literal("")),
  featured: z.coerce.boolean(),
  active: z.coerce.boolean(),
});

export async function upsertMarketplaceListingAction(
  formData: FormData,
  listingId?: string
) {
  await requireRole(["admin", "internal_team"]);
  const me = await getCurrentUser();
  const parsed = listingSchema.parse({
    vertical_slug: formData.get("vertical_slug"),
    listing_type: formData.get("listing_type"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    financial_summary: formData.get("financial_summary") || undefined,
    external_url: formData.get("external_url") || "",
    featured: formData.get("featured") === "on",
    active: formData.get("active") === "on",
  });

  const supabase = createSupabaseServiceClient();
  const row = {
    ...parsed,
    external_url: parsed.external_url || null,
    description: parsed.description ?? null,
    financial_summary: parsed.financial_summary ?? null,
    updated_at: new Date().toISOString(),
    ...(listingId ? {} : { created_by: me?.id ?? null }),
  };

  if (listingId) {
    const { error } = await supabase.from("marketplace_listings").update(row).eq("id", listingId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("marketplace_listings").insert(row);
    if (error) throw error;
  }

  revalidatePath("/internal/marketplace");
  revalidatePath("/client/marketplace");
  revalidatePath("/marketplace");
}

export async function deleteMarketplaceListingAction(listingId: string) {
  await requireRole(["admin", "internal_team"]);
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("marketplace_listings").delete().eq("id", listingId);
  if (error) throw error;
  revalidatePath("/internal/marketplace");
  revalidatePath("/client/marketplace");
}
