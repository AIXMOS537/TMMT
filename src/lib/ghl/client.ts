/**
 * GoHighLevel API v2 — best-effort outbound helpers.
 * Requires GHL_API_KEY plus location id(s) in server env.
 *
 * - GHL_LOCATION_ID — Rentals pipeline (default for portal notify, webhooks, cases)
 * - GHL_RESTORATION_LOCATION_ID — Credit / LTO / operator journey (falls back to GHL_LOCATION_ID)
 */

import { assertOutboundAllowed } from "@/lib/outbound-gate";
import { SmsBlockedError, type SmsType } from "../../../shared/compliance-gates/sms-gate";

import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

const GHL_BASE = "https://services.leadconnectorhq.com";

export type GhlLocationKind = "rentals" | "restoration";

export function resolveGhlLocationId(kind: GhlLocationKind = "rentals"): string | null {
  if (kind === "restoration") {
    return (
      process.env.GHL_RESTORATION_LOCATION_ID?.trim() ||
      process.env.GHL_LOCATION_ID?.trim() ||
      null
    );
  }
  return process.env.GHL_LOCATION_ID?.trim() || null;
}

export function isGhlConfigured(kind: GhlLocationKind = "rentals"): boolean {
  return Boolean(process.env.GHL_API_KEY?.trim() && resolveGhlLocationId(kind));
}

/** Credit / LTO / operator outbound (Restoration sub-account when set). */
export function isGhlJourneyConfigured(): boolean {
  return isGhlConfigured("restoration");
}

function ghlHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    Version: "2021-07-28",
    "Content-Type": "application/json",
  };
}

type GhlCustomFieldInput = { key: string; field_value: string; id?: string };

async function findGhlContactInLocation(
  email: string,
  locationId: string
): Promise<string | null> {
  const params = new URLSearchParams({
    locationId,
    email: email.trim().toLowerCase(),
  });

  const res = await fetchWithTimeout(`${GHL_BASE}/contacts/search/duplicate?${params}`, {
    headers: ghlHeaders(),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const json = (await res.json()) as { contact?: { id?: string } };
  return json.contact?.id ?? null;
}

async function findGhlContactByPhoneInLocation(
  phone: string,
  locationId: string
): Promise<string | null> {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;

  const params = new URLSearchParams({
    locationId,
    phone: digits.length === 10 ? `+1${digits}` : `+${digits}`,
  });

  const res = await fetchWithTimeout(`${GHL_BASE}/contacts/search/duplicate?${params}`, {
    headers: ghlHeaders(),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const json = (await res.json()) as { contact?: { id?: string } };
  return json.contact?.id ?? null;
}

/** Resolve GHL contact id by E.164 or national phone (voice / SMS inbound). */
export async function findGhlContactByPhone(
  phone: string,
  options?: { location?: GhlLocationKind; tryFallbackLocation?: boolean }
): Promise<string | null> {
  const kind = options?.location ?? "rentals";
  if (!isGhlConfigured(kind)) return null;

  const primary = resolveGhlLocationId(kind)!;
  const hit = await findGhlContactByPhoneInLocation(phone, primary);
  if (hit) return hit;

  if (!options?.tryFallbackLocation || kind === "rentals") return null;

  const fallback = resolveGhlLocationId("rentals");
  if (!fallback || fallback === primary) return null;
  return findGhlContactByPhoneInLocation(phone, fallback);
}

export async function findGhlContactByEmail(
  email: string,
  options?: { location?: GhlLocationKind; tryFallbackLocation?: boolean }
): Promise<string | null> {
  const kind = options?.location ?? "rentals";
  if (!isGhlConfigured(kind)) return null;

  const primary = resolveGhlLocationId(kind)!;
  const hit = await findGhlContactInLocation(email, primary);
  if (hit) return hit;

  if (!options?.tryFallbackLocation || kind === "rentals") return null;

  const fallback = resolveGhlLocationId("rentals");
  if (!fallback || fallback === primary) return null;
  return findGhlContactInLocation(email, fallback);
}

/** Merge portal custom fields on a contact (by field key — create keys in GHL first). */
export async function updateContactCustomFields(
  contactId: string,
  fields: Record<string, string>,
  locationKind: GhlLocationKind = "rentals"
): Promise<void> {
  if (!isGhlConfigured(locationKind)) return;

  const customFields: GhlCustomFieldInput[] = Object.entries(fields)
    .filter(([, v]) => v.trim().length > 0)
    .map(([key, field_value]) => ({ key, field_value }));

  if (customFields.length === 0) return;

  const res = await fetchWithTimeout(`${GHL_BASE}/contacts/${contactId}`, {
    method: "PUT",
    headers: ghlHeaders(),
    body: JSON.stringify({ customFields }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GHL updateContactCustomFields failed (${res.status}): ${body}`);
  }
}

export async function addContactTag(
  contactId: string,
  tag: string,
  locationKind: GhlLocationKind = "rentals"
): Promise<void> {
  if (!isGhlConfigured(locationKind)) return;

  const res = await fetchWithTimeout(`${GHL_BASE}/contacts/${contactId}/tags`, {
    method: "POST",
    headers: ghlHeaders(),
    body: JSON.stringify({ tags: [tag] }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GHL addContactTag failed (${res.status}): ${body}`);
  }
}

type PipelineStage = { id: string; name: string };

export type GhlPipeline = { id: string; name: string; stages: PipelineStage[] };

/**
 * Every outbound call below takes an optional `locationId`.
 *
 * These three used to read `process.env.GHL_LOCATION_ID` directly, which pinned
 * all outbound traffic to a single sub-account no matter which org it was for.
 * Inbound was already multi-location aware — the contact and opportunity-stage
 * webhook handlers have always captured `location_id` — so outbound was the
 * only thing standing between us and running the agency's sub-accounts through
 * one app.
 *
 * Pass the location resolved from `resolveGhlTargetForOrg()`; omit it and the
 * env default applies, which keeps every existing caller behaving as before.
 */
function locationOr(locationId?: string, kind: GhlLocationKind = "rentals"): string | null {
  return locationId?.trim() || resolveGhlLocationId(kind);
}

/** All pipelines in a location, with their stages. The app's view of "which pipeline". */
export async function listPipelines(locationId?: string): Promise<GhlPipeline[]> {
  const loc = locationOr(locationId);
  if (!process.env.GHL_API_KEY?.trim() || !loc) return [];

  const res = await fetchWithTimeout(
    `${GHL_BASE}/opportunities/pipelines?locationId=${encodeURIComponent(loc)}`,
    { headers: ghlHeaders(), cache: "no-store" }
  );
  if (!res.ok) return [];

  const json = (await res.json()) as { pipelines?: GhlPipeline[] };
  return json.pipelines ?? [];
}

/** Resolve GHL pipeline stage id by human-readable stage name. */
export async function findPipelineStageId(
  pipelineId: string,
  stageName: string,
  locationId?: string
): Promise<string | null> {
  const loc = locationOr(locationId);
  if (!process.env.GHL_API_KEY?.trim() || !loc) return null;

  const res = await fetchWithTimeout(
    `${GHL_BASE}/opportunities/pipelines/${pipelineId}/stages?locationId=${encodeURIComponent(loc)}`,
    { headers: ghlHeaders(), cache: "no-store" }
  );

  if (!res.ok) return null;

  const json = (await res.json()) as { stages?: PipelineStage[] };
  const norm = stageName.trim().toLowerCase();
  const hit = (json.stages ?? []).find((s) => s.name.trim().toLowerCase() === norm);
  return hit?.id ?? null;
}

/** Move opportunity to a pipeline stage (by stage id or resolved stage name). */
export async function updateOpportunityStage(args: {
  opportunityId: string;
  pipelineId: string;
  stageId?: string;
  stageName?: string;
  locationId?: string;
}): Promise<void> {
  const loc = locationOr(args.locationId);
  if (!process.env.GHL_API_KEY?.trim() || !loc) return;

  let stageId = args.stageId;
  if (!stageId && args.stageName) {
    stageId = (await findPipelineStageId(args.pipelineId, args.stageName, loc)) ?? undefined;
  }
  if (!stageId) {
    throw new Error(
      `GHL stage not found for pipeline ${args.pipelineId}: ${args.stageName ?? "(no name)"}`
    );
  }

  const res = await fetchWithTimeout(`${GHL_BASE}/opportunities/${args.opportunityId}`, {
    method: "PUT",
    headers: ghlHeaders(),
    body: JSON.stringify({
      pipelineId: args.pipelineId,
      pipelineStageId: stageId,
      locationId: loc,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GHL updateOpportunityStage failed (${res.status}): ${body}`);
  }
}

export type GhlMessageType = "SMS" | "Email";

/**
 * Send SMS or email through GHL Conversations (routes via your LC phone / mail — e.g. OpenPhone for SMS).
 *
 * This is a customer-facing send, so it goes through the outbound gate
 * (src/lib/outbound-gate: A2P compliance + do-not-contact + per-lead opt-out)
 * before anything leaves. For SMS the destination phone is REQUIRED — GHL only
 * needs the contact id, but the compliance checks key on the number, and a send
 * that cannot be checked is not made. Email skips the phone-based checks.
 * A refused send throws SmsBlockedError; callers must not swallow it silently.
 */
export async function sendConversationMessage(
  args: {
    contactId: string;
    message: string;
    subject?: string;
    html?: string;
    locationId?: string;
    /** Org whose lead record holds the opt-out flag (SMS). */
    organizationId?: string;
    /** A2P vertical for the compliance gate, e.g. "rentals" | "credit_repair" | "funding". */
    vertical?: string;
    /** Carrier class. Defaults to transactional. Marketing requires ownerApproved. */
    smsType?: SmsType;
    ownerApproved?: boolean;
  } & ({ type: "SMS"; phone: string } | { type: "Email"; phone?: string })
): Promise<void> {
  if (args.type === "SMS") {
    if (!args.phone?.trim()) {
      throw new SmsBlockedError("sendConversationMessage: phone is required for SMS so the outbound gate can run");
    }
    const gate = await assertOutboundAllowed({
      phone: args.phone,
      organizationId: args.organizationId,
      vertical: args.vertical ?? "",
      type: args.smsType ?? "transactional",
      ownerApproved: args.ownerApproved,
    });
    if (!gate.allowed) throw new SmsBlockedError(gate.reason);
  }

  const loc = locationOr(args.locationId);
  if (!process.env.GHL_API_KEY?.trim() || !loc) return;

  const body: Record<string, unknown> = {
    type: args.type,
    contactId: args.contactId,
    message: args.message,
    locationId: loc,
  };

  if (args.type === "Email") {
    body.subject = args.subject ?? "Update from TMMT";
    if (process.env.GHL_EMAIL_FROM?.trim()) {
      body.emailFrom = process.env.GHL_EMAIL_FROM.trim();
    }
    if (args.html) body.html = args.html;
  }

  const providerId = process.env.GHL_CONVERSATION_PROVIDER_ID?.trim();
  if (providerId && args.type === "SMS") {
    body.conversationProviderId = providerId;
  }

  const res = await fetchWithTimeout(`${GHL_BASE}/conversations/messages`, {
    method: "POST",
    headers: ghlHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL sendConversationMessage failed (${res.status}): ${text}`);
  }
}
