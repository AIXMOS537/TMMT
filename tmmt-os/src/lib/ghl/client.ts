/**
 * GoHighLevel API v2 — best-effort outbound helpers.
 * Requires GHL_API_KEY plus location id(s) in server env.
 *
 * - GHL_LOCATION_ID — Rentals pipeline (default for portal notify, webhooks, cases)
 * - GHL_RESTORATION_LOCATION_ID — Credit / LTO / operator journey (falls back to GHL_LOCATION_ID)
 */

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

  const res = await fetch(`${GHL_BASE}/contacts/search/duplicate?${params}`, {
    headers: ghlHeaders(),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const json = (await res.json()) as { contact?: { id?: string } };
  return json.contact?.id ?? null;
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

  const res = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
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

  const res = await fetch(`${GHL_BASE}/contacts/${contactId}/tags`, {
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

/** Resolve GHL pipeline stage id by human-readable stage name. */
export async function findPipelineStageId(
  pipelineId: string,
  stageName: string
): Promise<string | null> {
  if (!isGhlConfigured()) return null;

  const res = await fetch(
    `${GHL_BASE}/opportunities/pipelines/${pipelineId}/stages?locationId=${process.env.GHL_LOCATION_ID}`,
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
}): Promise<void> {
  if (!isGhlConfigured()) return;

  let stageId = args.stageId;
  if (!stageId && args.stageName) {
    stageId = (await findPipelineStageId(args.pipelineId, args.stageName)) ?? undefined;
  }
  if (!stageId) {
    throw new Error(
      `GHL stage not found for pipeline ${args.pipelineId}: ${args.stageName ?? "(no name)"}`
    );
  }

  const res = await fetch(`${GHL_BASE}/opportunities/${args.opportunityId}`, {
    method: "PUT",
    headers: ghlHeaders(),
    body: JSON.stringify({
      pipelineId: args.pipelineId,
      pipelineStageId: stageId,
      locationId: process.env.GHL_LOCATION_ID,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GHL updateOpportunityStage failed (${res.status}): ${body}`);
  }
}

export type GhlMessageType = "SMS" | "Email";

/** Send SMS or email through GHL Conversations (routes via your LC phone / mail — e.g. OpenPhone for SMS). */
export async function sendConversationMessage(args: {
  contactId: string;
  type: GhlMessageType;
  message: string;
  subject?: string;
  html?: string;
}): Promise<void> {
  if (!isGhlConfigured()) return;

  const body: Record<string, unknown> = {
    type: args.type,
    contactId: args.contactId,
    message: args.message,
    locationId: process.env.GHL_LOCATION_ID,
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

  const res = await fetch(`${GHL_BASE}/conversations/messages`, {
    method: "POST",
    headers: ghlHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL sendConversationMessage failed (${res.status}): ${text}`);
  }
}
