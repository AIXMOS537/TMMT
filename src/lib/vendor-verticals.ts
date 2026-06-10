/** TMMT commission verticals assignable to workflow vendors. */
export const VENDOR_SERVICE_VERTICALS = [
  { id: "cleaning", label: "TMMT Cleaning" },
  { id: "moving", label: "TMMT Moving" },
  { id: "detailing", label: "TMMT Detailing" },
  { id: "chauffeur", label: "TMMT Chauffeur" },
  { id: "restoration", label: "TMMT Restoration" },
  { id: "mechanic", label: "Mechanic / shop" },
  { id: "tow", label: "Tow / repo" },
] as const;

export type VendorServiceVertical = (typeof VENDOR_SERVICE_VERTICALS)[number]["id"];

export function parseServiceVerticals(raw: unknown): VendorServiceVertical[] {
  if (Array.isArray(raw)) {
    return raw.filter((v): v is VendorServiceVertical =>
      VENDOR_SERVICE_VERTICALS.some((x) => x.id === v)
    );
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/[,|]/)
      .map((s) => s.trim().toLowerCase())
      .filter((v): v is VendorServiceVertical =>
        VENDOR_SERVICE_VERTICALS.some((x) => x.id === v)
      );
  }
  return [];
}

export function formatServiceVerticals(verticals: VendorServiceVertical[]): string {
  const labels = verticals
    .map((id) => VENDOR_SERVICE_VERTICALS.find((v) => v.id === id)?.label ?? id)
    .join(", ");
  return labels || "—";
}

export function serializeServiceVerticals(verticals: VendorServiceVertical[]): string {
  return verticals.join(",");
}
