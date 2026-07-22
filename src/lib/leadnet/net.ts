/**
 * Lead Net (docs/LEAD-NET-SPEC.md) — the intake→GHL bridge.
 *
 * Every inbound lead becomes ONE GHL contact (deduped by phone), tagged with its
 * lane (`lane:rental` / `lane:detail`) and source, with a first-touch follow-up
 * task due in 1 hour. The Supabase side (lead_followups clock + escalation sweep
 * + daily digest) is handled by DB triggers/pg_cron — this module only bridges GHL.
 *
 * Fail-open by design: lead capture must NEVER be blocked by GHL being down or
 * unconfigured. Callers fire-and-forget.
 */
import {
  createGhlContact,
  createGhlContactTask,
  findGhlContactByPhone,
  addContactTag,
  isGhlConfigured,
} from "@/lib/ghl/client";

export type LeadLane = "rental" | "detail";

const DETAIL_SIGNALS = [
  "detail", "detailing", "ceramic", "coating", "interior", "wash",
  "wax", "polish", "health check", "health-check",
];

/** Infer the business lane from free-text signals; rentals is the default lane. */
export function inferLane(...signals: Array<string | null | undefined>): LeadLane {
  const haystack = signals.filter(Boolean).join(" ").toLowerCase();
  return DETAIL_SIGNALS.some((s) => haystack.includes(s)) ? "detail" : "rental";
}

export interface NetLeadInput {
  name?: string | null;
  phone: string;
  email?: string | null;
  source?: string | null;
  lane?: LeadLane;
  /** extra free-text used only for lane inference (sku, message, campaign...) */
  signals?: Array<string | null | undefined>;
}

export interface NetLeadResult {
  ghlContactId: string | null;
  lane: LeadLane;
  created: boolean;
}

/**
 * Ensure the lead exists in GHL exactly once, tagged and clocked.
 * Never throws — returns { ghlContactId: null } when GHL is unreachable/unconfigured.
 */
export async function netLeadIntoGhl(input: NetLeadInput): Promise<NetLeadResult> {
  const lane = input.lane ?? inferLane(input.source, ...(input.signals ?? []));

  if (!isGhlConfigured()) return { ghlContactId: null, lane, created: false };

  try {
    let created = false;
    let contactId = await findGhlContactByPhone(input.phone);

    if (!contactId) {
      contactId = await createGhlContact({
        name: input.name ?? undefined,
        phone: input.phone,
        email: input.email ?? undefined,
        source: input.source ?? "lead-net",
        tags: [`lane:${lane}`, "lead-net"],
      });
      created = true;
    } else {
      // Existing contact — make sure the lane tag is present (idempotent in GHL).
      await addContactTag(contactId, `lane:${lane}`).catch(() => {});
    }

    if (contactId) {
      await createGhlContactTask({
        contactId,
        title: `First touch: ${input.name?.trim() || input.phone} (${lane})`,
        body:
          "Lead-net clock — reply within 1 hour. " +
          `Source: ${input.source ?? "unknown"}. ` +
          "If they asked about money/legal/complaints, tag the owner and stop.",
        dueAt: new Date(Date.now() + 60 * 60 * 1000),
      }).catch(() => {});
    }

    return { ghlContactId: contactId, lane, created };
  } catch {
    return { ghlContactId: null, lane, created: false };
  }
}
