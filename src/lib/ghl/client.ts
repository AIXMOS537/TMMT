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

  const res = await fetch(`${GHL_BASE}/contacts/search/duplicate?${params}`, {
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

  const res = await fetch(
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

  const res = await fetch(
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

  const res = await fetch(`${GHL_BASE}/opportunities/${args.opportunityId}`, {
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

/** Send SMS or email through GHL Conversations (routes via your LC phone / mail — e.g. OpenPhone for SMS). */
export async function sendConversationMessage(args: {
  contactId: string;
  type: GhlMessageType;
  message: string;
  subject?: string;
  html?: string;
  locationId?: string;
}): Promise<void> {
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

function splitPersonName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Unknown", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function toE164(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 11) return `+${digits}`;
  return undefined;
}

/**
 * Find-or-create a GHL contact and apply tags. Never sends SMS/email.
 * Returns the contact id, or null when GHL is not configured / both identifiers missing.
 */
export async function upsertOutboundGhlContact(args: {
  name: string;
  email?: string | null;
  phone?: string | null;
  tags?: string[];
  source?: string;
  locationKind?: GhlLocationKind;
  locationId?: string;
}): Promise<string | null> {
  const kind = args.locationKind ?? "rentals";
  const loc = locationOr(args.locationId, kind);
  if (!process.env.GHL_API_KEY?.trim() || !loc) return null;

  const email = args.email?.trim().toLowerCase() || "";
  const phone = args.phone?.trim() || "";
  if (!email && !phone) return null;

  let contactId: string | null = null;
  if (email) contactId = await findGhlContactInLocation(email, loc);
  if (!contactId && phone) contactId = await findGhlContactByPhoneInLocation(phone, loc);

  const { firstName, lastName } = splitPersonName(args.name || "Unknown");
  const e164 = phone ? toE164(phone) : undefined;

  if (!contactId) {
    const body: Record<string, unknown> = {
      firstName,
      lastName,
      name: args.name.trim() || "Unknown",
      locationId: loc,
      source: args.source?.trim() || "AIXMOS door",
    };
    if (email) body.email = email;
    if (e164) body.phone = e164;
    if (args.tags?.length) body.tags = args.tags;

    const res = await fetch(`${GHL_BASE}/contacts/`, {
      method: "POST",
      headers: ghlHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GHL upsertOutboundGhlContact create failed (${res.status}): ${text}`);
    }

    const json = (await res.json()) as { contact?: { id?: string } };
    contactId = json.contact?.id ?? null;
  } else if (args.tags?.length) {
    for (const tag of args.tags) {
      await addContactTag(contactId, tag, kind);
    }
  }

  return contactId;
}

/**
 * Open an opportunity on a named pipeline/stage. Resolves pipeline by name
 * (case-insensitive includes) unless `pipelineId` is passed.
 * Returns the opportunity id, or null if the pipeline cannot be resolved.
 */
export async function createOutboundGhlOpportunity(args: {
  contactId: string;
  name: string;
  pipelineName?: string | null;
  pipelineId?: string | null;
  stageName?: string | null;
  locationKind?: GhlLocationKind;
  locationId?: string;
}): Promise<string | null> {
  const kind = args.locationKind ?? "rentals";
  const loc = locationOr(args.locationId, kind);
  if (!process.env.GHL_API_KEY?.trim() || !loc) return null;

  const pipelines = await listPipelines(loc);
  const wantId = args.pipelineId?.trim();
  const wantName = (args.pipelineName ?? "").trim().toLowerCase();
  const pipeline =
    (wantId && pipelines.find((p) => p.id === wantId)) ||
    (wantName
      ? pipelines.find((p) => p.name.trim().toLowerCase() === wantName) ||
        pipelines.find((p) => p.name.trim().toLowerCase().includes(wantName))
      : undefined);

  if (!pipeline) return null;

  const stageWant = (args.stageName ?? "").trim().toLowerCase();
  const stage =
    (stageWant && pipeline.stages.find((s) => s.name.trim().toLowerCase() === stageWant)) ||
    (stageWant && pipeline.stages.find((s) => s.name.trim().toLowerCase().includes(stageWant))) ||
    pipeline.stages[0];
  if (!stage) return null;

  const res = await fetch(`${GHL_BASE}/opportunities/`, {
    method: "POST",
    headers: ghlHeaders(),
    body: JSON.stringify({
      locationId: loc,
      contactId: args.contactId,
      pipelineId: pipeline.id,
      pipelineStageId: stage.id,
      name: args.name.trim() || "New lead",
      status: "open",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL createOutboundGhlOpportunity failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { opportunity?: { id?: string } };
  return json.opportunity?.id ?? null;
}
