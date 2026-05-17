import { createSSRClient } from "@/lib/supabase-server";

export type Venture = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  logo_url: string | null;
  status: "active" | "paused" | "archived";
  pinned_widgets: unknown;
};

export async function getActiveVentures(): Promise<Venture[]> {
  const supabase = await createSSRClient();
  const { data, error } = await supabase
    .from("ventures")
    .select("*")
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Venture[];
}

const TMMT_RENTALS_FALLBACK: Venture = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "tmmt-rentals",
  name: "TMMT Rentals",
  description: "Vehicle rental operations",
  color: "#2563eb",
  logo_url: null,
  status: "active",
  pinned_widgets: [],
};

export async function getVentureBySlug(slug: string): Promise<Venture | null> {
  const supabase = await createSSRClient();
  const { data, error } = await supabase
    .from("ventures")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    if (slug === "tmmt-rentals") return TMMT_RENTALS_FALLBACK;
    throw error;
  }
  if (!data && slug === "tmmt-rentals") return TMMT_RENTALS_FALLBACK;
  return data as Venture | null;
}
