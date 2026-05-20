import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MarketplaceListing } from "./types";

export async function listActiveMarketplaceListings(
  verticalSlug = "tmmt_rentals"
): Promise<MarketplaceListing[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("marketplace_listings")
    .select(
      "id, vertical_slug, listing_type, title, description, financial_summary, external_url, featured, active, created_at"
    )
    .eq("active", true)
    .eq("vertical_slug", verticalSlug)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error?.message.includes("does not exist")) return [];
  if (error) throw error;
  return (data ?? []) as MarketplaceListing[];
}

export async function listAllMarketplaceListings(): Promise<MarketplaceListing[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("marketplace_listings")
    .select(
      "id, vertical_slug, listing_type, title, description, financial_summary, external_url, featured, active, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error?.message.includes("does not exist")) return [];
  if (error) throw error;
  return (data ?? []) as MarketplaceListing[];
}
