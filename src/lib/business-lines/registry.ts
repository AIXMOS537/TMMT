import type { RequestType } from "@/lib/workflow/statuses";

/** Canonical id on cases, CRM sync, and routing */
export type BusinessLineId =
  | "rentals"
  | "express"
  | "black"
  | "auto"
  | "detailing"
  | "moving"
  | "cleaning"
  | "wholesale-cars"
  | "luxury"
  | "restoration"
  | "management";

export type IntakeLineConfig = {
  slug: string;
  title: string;
  description: string;
  requestTypes: RequestType[];
  subjectPlaceholder: string;
  detailsPlaceholder: string;
  accent: string;
};

export type TmmtBusinessLine = {
  id: BusinessLineId;
  name: string;
  shortName: string;
  tagline?: string;
  description: string;
  role: "primary_public" | "public_intake" | "command_center_only";
  intake?: IntakeLineConfig;
};

/** Public front door — economy rental fleet */
export const PRIMARY_PUBLIC_LINE_ID: BusinessLineId = "rentals";
export const PRIMARY_PUBLIC_INTAKE_SLUG = "rentals";

/** TMMT operating lines — one command center, eleven brands (management last). */
export const TMMT_BUSINESS_LINES: TmmtBusinessLine[] = [
  {
    id: "rentals",
    name: "TMMT Rentals",
    shortName: "Rentals",
    tagline: "Economy car rentals",
    description: "Current economy fleet — Tesla & EV rentals, bookings, and renter support.",
    role: "primary_public",
    intake: {
      slug: "rentals",
      title: "TMMT Rentals",
      description: "Economy rentals — bookings, changes during your rental, maintenance.",
      requestTypes: ["rental_booking", "rental_support", "maintenance", "repair"],
      subjectPlaceholder: "e.g. Extend economy rental through Friday",
      detailsPlaceholder: "Vehicle, dates, pickup/return location, and anything urgent.",
      accent: "from-violet-500/15 via-violet-500/5 border-violet-200/70",
    },
  },
  {
    id: "express",
    name: "TMMT Express",
    shortName: "Express",
    tagline: "Mid-tier daily rentals",
    description: "Mid-tier fleet — daily and short-term rentals priced by make, model, and year.",
    role: "public_intake",
    intake: {
      slug: "express",
      title: "TMMT Express",
      description: "Daily rentals — book, change dates, or report an issue with your vehicle.",
      requestTypes: ["rental_booking", "rental_support", "maintenance", "repair"],
      subjectPlaceholder: "e.g. Daily rental — pickup tomorrow 9am",
      detailsPlaceholder: "Dates, vehicle preference, pickup location, and driver details.",
      accent: "from-sky-500/15 via-sky-500/5 border-sky-200/70",
    },
  },
  {
    id: "black",
    name: "TMMT Black",
    shortName: "Black",
    tagline: "Black car service",
    description: "Chauffeur, executive transport, and premium black-car bookings.",
    role: "public_intake",
    intake: {
      slug: "black",
      title: "TMMT Black",
      description: "Black car service — reservations, changes, and trip coordination.",
      requestTypes: ["rental_booking", "delivery", "consulting", "other"],
      subjectPlaceholder: "e.g. Airport pickup — executive sedan, 2 passengers",
      detailsPlaceholder: "Pickup time, addresses, vehicle class, and special requests.",
      accent: "from-zinc-800/20 via-zinc-500/10 border-zinc-400/50",
    },
  },
  {
    id: "auto",
    name: "TMMT Auto Services",
    shortName: "Auto",
    tagline: "Wholesale auto services",
    description: "Wholesale parts, labor, tow, inspection, and repair.",
    role: "public_intake",
    intake: {
      slug: "auto-services",
      title: "TMMT Auto Services",
      description: "Wholesale auto services — parts, labor, tow, inspection, repair.",
      requestTypes: ["detail", "tow", "inspection", "repair", "other"],
      subjectPlaceholder: "e.g. Wholesale repair — 3 units, shop drop-off",
      detailsPlaceholder: "VINs or units, parts needed, labor scope, and timing.",
      accent: "from-teal-500/15 via-teal-500/5 border-teal-200/70",
    },
  },
  {
    id: "detailing",
    name: "TMMT Auto Detailing",
    shortName: "Detailing",
    tagline: "Auto detailing",
    description: "Mobile and shop detailing for retail and fleet accounts.",
    role: "public_intake",
    intake: {
      slug: "auto-detailing",
      title: "TMMT Auto Detailing",
      description: "Detailing requests — interior/exterior, fleet batches, and scheduling.",
      requestTypes: ["detail", "other"],
      subjectPlaceholder: "e.g. Full detail — Model Y, ceramic prep",
      detailsPlaceholder: "Vehicle count, location, service level, and preferred date.",
      accent: "from-cyan-500/15 via-cyan-500/5 border-cyan-200/70",
    },
  },
  {
    id: "moving",
    name: "TMMT Home and Commercial Moving Services",
    shortName: "Moving",
    tagline: "Home & commercial moving",
    description: "Residential and commercial moves, load-out, and logistics coordination.",
    role: "public_intake",
    intake: {
      slug: "moving",
      title: "TMMT Moving",
      description: "Moving services — quote, schedule, or update a move in progress.",
      requestTypes: ["delivery", "other"],
      subjectPlaceholder: "e.g. 2-bedroom move — downtown to suburbs, Saturday",
      detailsPlaceholder: "Addresses, inventory size, stairs/elevator, and access window.",
      accent: "from-amber-500/15 via-amber-500/5 border-amber-200/70",
    },
  },
  {
    id: "cleaning",
    name: "TMMT Home and Commercial Cleaning Services",
    shortName: "Cleaning",
    tagline: "Home & commercial cleaning",
    description: "Recurring and one-time cleaning for homes and commercial spaces.",
    role: "public_intake",
    intake: {
      slug: "cleaning",
      title: "TMMT Cleaning",
      description: "Cleaning services — schedule, change service, or report an issue.",
      requestTypes: ["other"],
      subjectPlaceholder: "e.g. Weekly office clean — 4,000 sq ft",
      detailsPlaceholder: "Property type, square footage, frequency, and access instructions.",
      accent: "from-emerald-500/15 via-emerald-500/5 border-emerald-200/70",
    },
  },
  {
    id: "wholesale-cars",
    name: "TMMT Wholesale Cars",
    shortName: "Wholesale",
    tagline: "Wholesale vehicles",
    description: "Wholesale inventory, buyer inquiries, and dealer coordination.",
    role: "public_intake",
    intake: {
      slug: "wholesale-cars",
      title: "TMMT Wholesale Cars",
      description: "Wholesale car inquiries — inventory, pricing, and purchase coordination.",
      requestTypes: ["other", "repair", "rental_booking"],
      subjectPlaceholder: "e.g. Lot of 5 EVs — dealer pickup this week",
      detailsPlaceholder: "Units, VINs if known, timeline, and buyer/dealer contact.",
      accent: "from-orange-500/15 via-orange-500/5 border-orange-200/70",
    },
  },
  {
    id: "luxury",
    name: "TMMT Luxury",
    shortName: "Luxury",
    tagline: "Luxury cars & cribs",
    description: "Luxury vehicle rentals and premium property experiences.",
    role: "public_intake",
    intake: {
      slug: "luxury",
      title: "TMMT Luxury",
      description: "Luxury rentals and experiences — bookings, changes, and concierge requests.",
      requestTypes: ["rental_booking", "delivery", "consulting", "other"],
      subjectPlaceholder: "e.g. Weekend exotic rental + waterfront stay",
      detailsPlaceholder: "Dates, vehicle or property preferences, and guest count.",
      accent: "from-rose-500/15 via-rose-500/5 border-rose-200/70",
    },
  },
  {
    id: "restoration",
    name: "TMMT Restoration",
    shortName: "Restoration",
    tagline: "Credit guidance & ecosystem onboarding",
    description:
      "Restoring lives of Americans through proper credit guidance and welcoming them into the TMMT ecosystem.",
    role: "public_intake",
    intake: {
      slug: "restoration",
      title: "TMMT Restoration",
      description:
        "Credit guidance and TMMT ecosystem onboarding — start with a confidential intake.",
      requestTypes: ["consulting", "other"],
      subjectPlaceholder: "Credit review — ready to join TMMT ecosystem",
      detailsPlaceholder:
        "Your goals, current credit situation (general), and how you heard about TMMT.",
      accent: "from-green-600/15 via-green-500/5 border-green-300/70",
    },
  },
  {
    id: "management",
    name: "TMMT Management",
    shortName: "Management",
    tagline: "Command center & back office",
    description:
      "Appointments, contracts, fleet, payments, and internal ops — staff use the command center and /internal/interfaces.",
    role: "command_center_only",
  },
];

export function getBusinessLine(id: string): TmmtBusinessLine | undefined {
  return TMMT_BUSINESS_LINES.find((b) => b.id === id);
}

export function getBusinessLineByIntakeSlug(slug: string): TmmtBusinessLine | undefined {
  return TMMT_BUSINESS_LINES.find((b) => b.intake?.slug === slug);
}

export function getPrimaryPublicLine(): TmmtBusinessLine {
  return TMMT_BUSINESS_LINES.find((b) => b.id === PRIMARY_PUBLIC_LINE_ID)!;
}

export function listIntakeLines(): TmmtBusinessLine[] {
  return TMMT_BUSINESS_LINES.filter((b) => b.intake);
}

export function listCommandCenterLines(): TmmtBusinessLine[] {
  return TMMT_BUSINESS_LINES;
}

export function listPublicIntakeLines(excludePrimary = true): TmmtBusinessLine[] {
  return TMMT_BUSINESS_LINES.filter(
    (b) => b.intake && (!excludePrimary || b.id !== PRIMARY_PUBLIC_LINE_ID)
  );
}

export function businessLineLabel(id: string | null | undefined): string {
  if (!id) return "—";
  const line = getBusinessLine(id);
  return line?.shortName ?? id;
}

/** Rental-family lines for GHL / CRM defaults */
export const RENTAL_FAMILY_LINE_IDS: BusinessLineId[] = [
  "rentals",
  "express",
  "black",
  "luxury",
];

export function isRentalFamilyLine(id: string): boolean {
  return (RENTAL_FAMILY_LINE_IDS as string[]).includes(id);
}
