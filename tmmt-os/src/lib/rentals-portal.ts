/** TMMT Rentals admin — same-origin paths inside TMMT OS (merged from tmmt-app). */
export const RENTALS_VENTURE_SLUG = "tmmt-rentals";

export function rentalsPortalOrigin(): string {
  return "";
}

export function rentalsInterfaceHref(
  iface: "appointments" | "contracts" | "vehicles" | "payments"
) {
  return `/v/${RENTALS_VENTURE_SLUG}/interfaces/${iface}`;
}

export function rentalsVentureHref(segment: string) {
  const path = segment.startsWith("/") ? segment : `/${segment}`;
  return `/v/${RENTALS_VENTURE_SLUG}${path}`;
}

export const RENTALS_INTERFACES = [
  {
    slug: "appointments" as const,
    title: "Appointment Management",
    description: "Calendar, weekly slots, and pickup/return scheduling.",
    accent: "from-amber-500/20 to-orange-500/10 border-amber-200/80",
    icon: "calendar",
  },
  {
    slug: "contracts" as const,
    title: "Contract Management",
    description: "Draft → signed → active pipeline with Kanban.",
    accent: "from-violet-500/20 to-purple-500/10 border-violet-200/80",
    icon: "file",
  },
  {
    slug: "vehicles" as const,
    title: "Vehicles",
    description: "Fleet status, maintenance, and availability.",
    accent: "from-teal-500/20 to-emerald-500/10 border-teal-200/80",
    icon: "car",
  },
  {
    slug: "payments" as const,
    title: "Payments",
    description: "Collections, overdue, and revenue trends.",
    accent: "from-blue-500/20 to-sky-500/10 border-blue-200/80",
    icon: "dollar",
  },
];
