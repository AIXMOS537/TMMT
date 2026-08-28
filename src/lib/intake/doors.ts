/**
 * All In One Management Solutions — door catalog.
 *
 * Every public intake surface resolves to one door. The door decides:
 * tenant, GHL location, tags, pipeline, and whether credit/funding is
 * legal-gated (L1–L10). Money tags (`member-97`, `credit-guidance-active`)
 * are NEVER applied here — those fire only from paid GHL webhooks.
 */

export type DoorFamily =
  | "rentals"
  | "engine"
  | "academy"
  | "operator"
  | "dealer"
  | "sovereign"
  | "credit"
  | "vertical"
  | "ops";

export type DoorTenant = "aixmos" | "tmmt_property" | "moe_legacy";

export type DoorLocation = "rentals" | "restoration";

export type LegalGate = "none" | "l1-l10";

export type ResolvedDoor = {
  id: string;
  family: DoorFamily;
  tenant: DoorTenant;
  location: DoorLocation;
  tags: string[];
  pipelineName: string | null;
  stageName: string | null;
  legalGate: LegalGate;
};

export type DoorResolveInput = {
  formSlug?: string | null;
  sku?: string | null;
  orgSlug?: string | null;
  businessLine?: string | null;
};

export const MASTER_PIPELINE = "TMMT → AIXMOS";
export const DEALER_PIPELINE = "Applicants – Dealership";

const PAID_ONLY_TAGS = new Set([
  "member-97",
  "credit-guidance-active",
  "funding-prep",
  "kit-ordered-ops-kit",
  "kit-ordered-dealer-bundle",
]);

function locationForFamily(family: DoorFamily): DoorLocation {
  switch (family) {
    case "rentals":
    case "vertical":
    case "ops":
      return "rentals";
    case "engine":
    case "academy":
    case "operator":
    case "dealer":
    case "sovereign":
    case "credit":
      return "restoration";
    default: {
      const _exhaustive: never = family;
      return _exhaustive;
    }
  }
}

function door(
  id: string,
  family: DoorFamily,
  tenant: DoorTenant,
  tags: string[],
  pipelineName: string | null,
  stageName: string | null,
  legalGate: LegalGate = "none"
): ResolvedDoor {
  for (const tag of tags) {
    if (PAID_ONLY_TAGS.has(tag)) {
      throw new Error(`Door ${id} must not apply paid-only tag ${tag}`);
    }
  }
  return {
    id,
    family,
    tenant,
    location: locationForFamily(family),
    tags,
    pipelineName,
    stageName,
    legalGate,
  };
}

const FORM_DOORS: Record<string, ResolvedDoor> = {
  apply: door("apply", "engine", "aixmos", ["aixmos-intake", "lead-magnet"], MASTER_PIPELINE, "TMMT Lead"),
  "academy-join": door(
    "academy-join",
    "academy",
    "aixmos",
    ["academy-apply"],
    MASTER_PIPELINE,
    "Membership Offered"
  ),
  "operator-apply": door(
    "operator-apply",
    "operator",
    "aixmos",
    ["operator:candidate"],
    MASTER_PIPELINE,
    "Membership Offered"
  ),
  sovereign: door(
    "sovereign",
    "sovereign",
    "aixmos",
    ["sovereign-inquiry"],
    MASTER_PIPELINE,
    "TMMT Lead"
  ),
  "dealer-apply": door(
    "dealer-apply",
    "dealer",
    "aixmos",
    ["dealer-prospect"],
    DEALER_PIPELINE,
    "New Lead"
  ),
  "lead-intake": door(
    "lead-intake",
    "rentals",
    "tmmt_property",
    ["tmmt-customer"],
    MASTER_PIPELINE,
    "TMMT Lead"
  ),
  "customer-intake": door(
    "customer-intake",
    "rentals",
    "tmmt_property",
    ["tmmt-customer"],
    MASTER_PIPELINE,
    "TMMT Lead"
  ),
  "credit-funding-intake": door(
    "credit-funding-intake",
    "credit",
    "moe_legacy",
    ["credit-inquiry"],
    null,
    null,
    "l1-l10"
  ),
  appointment: door("appointment", "ops", "tmmt_property", ["tmmt-appointment"], MASTER_PIPELINE, "TMMT Lead"),
  waitlist: door("waitlist", "ops", "tmmt_property", ["tmmt-waitlist"], MASTER_PIPELINE, "TMMT Lead"),
  ticket: door("ticket", "ops", "tmmt_property", ["tmmt-ticket"], null, null),
};

const SKU_DOORS: Record<string, ResolvedDoor> = {
  "lead-magnet": FORM_DOORS.apply,
  "intro-97": FORM_DOORS["academy-join"],
  "operator-seat": FORM_DOORS["operator-apply"],
  flagship: FORM_DOORS.sovereign,
  "rental-in-a-box": FORM_DOORS["lead-intake"],
  training: door("training", "engine", "aixmos", ["training-inquiry"], MASTER_PIPELINE, "TMMT Lead"),
};

function normalizeOrg(slug?: string | null): DoorTenant | null {
  const s = (slug ?? "").trim().toLowerCase();
  if (s === "moe_legacy" || s === "moe-legacy" || s === "aixmos-credit") return "moe_legacy";
  if (s === "tmmt_property" || s === "tmmt" || s === "tmmtrentals") return "tmmt_property";
  if (s === "aixmos" || s === "aixmos537") return "aixmos";
  return null;
}

/**
 * Resolve any intake surface (form slug, landing SKU, org, business line)
 * to one door. Credit/Moe Legacy always legal-gates — contact tag only,
 * no paid pipeline, no guidance tags.
 */
export function resolveDoor(input: DoorResolveInput): ResolvedDoor {
  const org = normalizeOrg(input.orgSlug);

  if (org === "moe_legacy") {
    return FORM_DOORS["credit-funding-intake"];
  }

  const slug = (input.formSlug ?? "").trim().toLowerCase();
  if (slug && FORM_DOORS[slug]) return FORM_DOORS[slug];

  const sku = (input.sku ?? "").trim().toLowerCase();
  if (sku && SKU_DOORS[sku]) return SKU_DOORS[sku];

  const line = (input.businessLine ?? "").trim().toLowerCase();
  if (line) {
    return door(
      `vertical:${line}`,
      "vertical",
      "tmmt_property",
      ["tmmt-customer", `line-${line}`],
      MASTER_PIPELINE,
      "TMMT Lead"
    );
  }

  if (org === "aixmos") return FORM_DOORS.apply;
  return FORM_DOORS["lead-intake"];
}

export function isPaidOnlyTag(tag: string): boolean {
  return PAID_ONLY_TAGS.has(tag);
}
