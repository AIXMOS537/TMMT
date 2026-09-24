/**
 * Credit correspondence recipients (C3-011 / C3-012) — pure, versioned, reviewable.
 *
 * Before C3 the bureau and CFPB addresses were hard-coded inside the templates, and
 * furnisher/collector letters printed "[ADDRESS — LOOKUP REQUIRED]". An address is a
 * fact the letter states; it needs a source and a person's verification like any
 * other fact.
 *
 * Rules:
 *   - A recipient has an identity (type + key), a postal address, a SOURCE, a
 *     VERIFICATION status, and a version with an effective window.
 *   - Versions are appended, never edited. A new address = a new version.
 *   - Only a `verified` version, effective at the time of use, can address a letter.
 *     Nothing is verified automatically — not seeded values from old code, not
 *     addresses found in a report, and never a model-suggested address.
 *   - Which recipient a round goes to is decided per round type and item, and is
 *     stored on the round (recipient id + version) so a reviewer can see it.
 *   - No fuzzy matching: a furnisher is found only by its exact normalised key.
 */

import type { CreditBureau, DisputeRoundType, NegativeItem } from "../types";

export type RecipientType = "CRA" | "FURNISHER" | "COLLECTOR" | "OTHER_APPROVED";

export type RecipientSource =
  | "owner_entered" // an owner typed it from a document they hold
  | "public_record" // e.g. the bureau's published dispute address, checked by a person
  | "imported_report" // printed on the customer's credit report
  | "legacy_code_seed" // copied from pre-C3 hard-coded constants
  | "model_suggested"; // suggested by an AI assistant — never verified by that fact

export interface PostalAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface RecipientVersion {
  /** Stable identity across versions, e.g. "CRA:experian", "FURNISHER:example-bank". */
  recipientId: string;
  version: number;
  type: RecipientType;
  name: string;
  address: PostalAddress;
  source: RecipientSource;
  verification: {
    status: "unverified" | "verified" | "rejected";
    by?: string;
    at?: string;
    /** How it was checked, e.g. "bureau website dispute page, 2026-09-22". */
    method?: string;
  };
  effectiveFrom: string;
  effectiveTo?: string;
  createdBy: string;
  createdAt: string;
}

export type Registry = ReadonlyArray<RecipientVersion>;

export function normaliseKey(name: string): string {
  return name.trim().toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function recipientIdFor(type: RecipientType, key: string): string {
  return `${type}:${normaliseKey(key)}`;
}

/** Which recipient a round of this type goes to, for this item. Deliberately explicit. */
export function recipientTargetFor(roundType: DisputeRoundType, item: Pick<NegativeItem, "bureau" | "furnisherName">): { type: RecipientType; recipientId: string } {
  switch (roundType) {
    case "furnisher_623":
      return { type: "FURNISHER", recipientId: recipientIdFor("FURNISHER", item.furnisherName) };
    case "fdcpa_validation":
      return { type: "COLLECTOR", recipientId: recipientIdFor("COLLECTOR", item.furnisherName) };
    case "cfpb_escalation":
      return { type: "OTHER_APPROVED", recipientId: recipientIdFor("OTHER_APPROVED", "cfpb") };
    default:
      return { type: "CRA", recipientId: recipientIdFor("CRA", item.bureau as CreditBureau) };
  }
}

function effectiveAt(v: RecipientVersion, at: string): boolean {
  return v.effectiveFrom <= at && (!v.effectiveTo || at < v.effectiveTo);
}

export type Resolution =
  | { ok: true; recipient: RecipientVersion }
  | { ok: false; code: "recipient_missing" | "recipient_unverified" | "recipient_rejected"; recipientId: string };

/** The latest version effective at `at`, and only if a person verified it. */
export function resolveRecipient(registry: Registry, recipientId: string, at = new Date().toISOString()): Resolution {
  const current = registry
    .filter((v) => v.recipientId === recipientId && effectiveAt(v, at))
    .sort((a, b) => b.version - a.version)[0];
  if (!current) return { ok: false, code: "recipient_missing", recipientId };
  if (current.verification.status === "rejected") return { ok: false, code: "recipient_rejected", recipientId };
  if (current.verification.status !== "verified") return { ok: false, code: "recipient_unverified", recipientId };
  return { ok: true, recipient: current };
}

export function validateAddress(a: PostalAddress): string | null {
  if (!a || typeof a !== "object") return "An address is required.";
  if (!a.line1?.trim() || !a.city?.trim()) return "Street and city are required.";
  if (!/^[A-Z]{2}$/.test(a.state ?? "")) return "Use a two-letter state code.";
  if (!/^\d{5}(-\d{4})?$/.test(a.zip ?? "")) return "Use a 5-digit ZIP (or ZIP+4).";
  if (/LOOKUP REQUIRED|\[|\]/i.test(`${a.line1} ${a.line2 ?? ""} ${a.city}`)) return "That is a placeholder, not an address.";
  return null;
}

/** Append a new version. Earlier versions are closed (effectiveTo), never edited or removed. */
export function addRecipientVersion(
  registry: Registry,
  input: { type: RecipientType; key: string; name: string; address: PostalAddress; source: RecipientSource; effectiveFrom?: string },
  actor: string,
  now = new Date().toISOString()
): RecipientVersion[] {
  const address = { ...input.address, state: String(input.address?.state ?? "").trim().toUpperCase() };
  const err = validateAddress(address);
  if (err) throw new Error(err);
  if (!input.name?.trim()) throw new Error("A recipient needs a name.");
  const recipientId = recipientIdFor(input.type, input.key);
  const prior = registry.filter((v) => v.recipientId === recipientId);
  const version = prior.reduce((m, v) => Math.max(m, v.version), 0) + 1;
  const effectiveFrom = input.effectiveFrom ?? now;
  const closed = registry.map((v) => (v.recipientId === recipientId && !v.effectiveTo ? { ...v, effectiveTo: effectiveFrom } : v));
  return [
    ...closed,
    {
      recipientId,
      version,
      type: input.type,
      name: input.name.trim(),
      address,
      source: input.source,
      verification: { status: "unverified" },
      effectiveFrom,
      createdBy: actor,
      createdAt: now,
    },
  ];
}

/** A person verifies (or rejects) one specific version. The method is required. */
export function verifyRecipientVersion(
  registry: Registry,
  recipientId: string,
  version: number,
  decision: "verified" | "rejected",
  method: string,
  actor: string,
  now = new Date().toISOString()
): RecipientVersion[] {
  if (!method?.trim() || method.trim().length < 5) throw new Error("Say how the address was checked.");
  // Same rule as the staged credit_recipients_guard trigger: agents, AIXMOS and system actors never verify.
  if (!actor?.trim() || /^(ai|agent|aixmos|system)[:_-]/i.test(actor)) throw new Error("Only a person can verify a recipient address.");
  let found = false;
  const next = registry.map((v) => {
    if (v.recipientId !== recipientId || v.version !== version) return v;
    found = true;
    return { ...v, verification: { status: decision, by: actor, at: now, method: method.trim().slice(0, 200) } };
  });
  if (!found) throw new Error("That recipient version does not exist.");
  return next;
}

/**
 * The pre-C3 hard-coded addresses, as UNVERIFIED seed versions. Kept so nothing is
 * lost; an owner must check each against the bureau's own published dispute address
 * before it can be used.
 */
export function legacySeedRegistry(now = "2026-09-22T00:00:00.000Z"): RecipientVersion[] {
  const seed = (key: string, type: RecipientType, name: string, address: PostalAddress): RecipientVersion => ({
    recipientId: recipientIdFor(type, key),
    version: 1,
    type,
    name,
    address,
    source: "legacy_code_seed",
    verification: { status: "unverified" },
    effectiveFrom: now,
    createdBy: "system:c3-seed",
    createdAt: now,
  });
  return [
    seed("experian", "CRA", "Experian", { line1: "P.O. Box 4500", city: "Allen", state: "TX", zip: "75013" }),
    seed("equifax", "CRA", "Equifax Information Services LLC", { line1: "P.O. Box 740256", city: "Atlanta", state: "GA", zip: "30374" }),
    seed("transunion", "CRA", "TransUnion LLC", { line1: "P.O. Box 2000", city: "Chester", state: "PA", zip: "19016" }),
    seed("cfpb", "OTHER_APPROVED", "Consumer Financial Protection Bureau", { line1: "1700 G Street NW", city: "Washington", state: "DC", zip: "20552" }),
  ];
}
