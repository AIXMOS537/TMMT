import { getRentalsDb, isRentalsDbConfigured } from "./db";

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

export async function getActiveVentures(): Promise<Venture[]> {
  if (!isRentalsDbConfigured()) return [TMMT_RENTALS_FALLBACK];
  const supabase = getRentalsDb();
  const { data, error } = await supabase
    .from("ventures")
    .select("*")
    .eq("status", "active")
    .order("name");
  if (error) return [TMMT_RENTALS_FALLBACK];
  return (data?.length ? data : [TMMT_RENTALS_FALLBACK]) as Venture[];
}

export async function getVentureBySlug(slug: string): Promise<Venture | null> {
  if (!isRentalsDbConfigured()) {
    return slug === "tmmt-rentals" ? TMMT_RENTALS_FALLBACK : null;
  }
  const supabase = getRentalsDb();
  const { data, error } = await supabase.from("ventures").select("*").eq("slug", slug).maybeSingle();
  if (error || !data) {
    return slug === "tmmt-rentals" ? TMMT_RENTALS_FALLBACK : null;
  }
  return data as Venture;
}
