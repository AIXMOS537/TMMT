import "server-only";

import type { User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { getTierForUser } from "@/lib/auth-roles";

/**
 * Memory Fabric — Phase 1 capture helper.
 *
 * Writes append-only rows into public.memory_events (see migration
 * 20260616000000_memory_fabric.sql). Uses the service-role client so capture
 * works in ANY context — authenticated admin actions, anonymous public-form
 * submissions, AI agents, ingestors, and external parties — bypassing RLS.
 *
 * Capture must NEVER break the primary operation: every write is wrapped and
 * failures are logged, not thrown.
 */

export type MemoryActorKind =
  | "ai_agent"
  | "operator"
  | "team"
  | "owner"
  | "external"
  | "system";

export type MemorySource =
  | "app"
  | "slack"
  | "clickup"
  | "gmail"
  | "quo"
  | "calendar"
  | "airtable"
  | "agent"
  | "system";

export interface MemoryEventInput {
  /** Verb describing what happened, e.g. "upsert:fleet", "sent_sms", "approved". */
  action: string;
  source?: MemorySource;
  actorKind?: MemoryActorKind;
  /** auth.users id when known; null for agents/external/system. */
  actorId?: string | null;
  /** Human label, e.g. "CAPTAIN agent", "John Lopez (lawyer)". */
  actorLabel?: string | null;
  orgId?: string | null;
  entityId?: string | null;
  summary?: string | null;
  details?: Record<string, unknown>;
  /** Idempotency key for re-ingestion, e.g. "quo:msg:<id>". */
  dedupeKey?: string | null;
  occurredAt?: string | Date;
}

/** Map an authenticated Supabase user to a memory actor_kind. */
export function actorKindFromUser(user: User | null): MemoryActorKind {
  const tier = getTierForUser(user);
  if (tier === "owner") return "owner";
  if (tier === "operator") return "operator";
  if (tier === "executive" || tier === "staff") return "team";
  return "team";
}

/**
 * Record a single memory event. Fire-and-forget semantics: resolves to true on
 * success, false on failure, and never throws.
 */
export async function logMemoryEvent(input: MemoryEventInput): Promise<boolean> {
  try {
    const supabase = createServiceRoleClient();
    const occurred =
      input.occurredAt instanceof Date
        ? input.occurredAt.toISOString()
        : input.occurredAt ?? new Date().toISOString();

    const row = {
      action: input.action,
      source: input.source ?? "app",
      actor_kind: input.actorKind ?? "system",
      actor_id: input.actorId ?? null,
      actor_label: input.actorLabel ?? null,
      org_id: input.orgId ?? null,
      entity_id: input.entityId ?? null,
      summary: input.summary ?? input.action,
      details: input.details ?? {},
      dedupe_key: input.dedupeKey ?? null,
      occurred_at: occurred,
    };

    // ignoreDuplicates keeps re-ingestion idempotent when a dedupe_key is set.
    const { error } = await supabase
      .from("memory_events")
      .upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true });

    if (error) {
      console.error("[memory] event write failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[memory] event write threw:", (err as Error).message);
    return false;
  }
}

// ─── Recall (Phase 2) ────────────────────────────────────────────────────

export interface RecallInput {
  /** Free-text query. Phase 2 uses keyword match; pgvector semantic recall is Phase 4. */
  query?: string;
  entityId?: string;
  orgId?: string;
  actorKind?: MemoryActorKind;
  source?: MemorySource;
  /** Max events to return (default 20, capped at 100). */
  limit?: number;
}

export interface RecalledFact {
  fact: string;
  confidence: number;
  entity_id: string | null;
  valid_from: string;
}

export interface RecalledEvent {
  action: string;
  source: string;
  actor_kind: string;
  actor_label: string | null;
  summary: string | null;
  occurred_at: string;
  details: Record<string, unknown>;
}

export interface RecallResult {
  facts: RecalledFact[];
  events: RecalledEvent[];
}

/**
 * Recall the relevant slice of memory: active distilled facts first, then the
 * supporting recent event timeline. Role/scope filtering is enforced by the
 * caller (the HTTP route) and by RLS for authenticated reads; this library
 * function uses the service-role client and applies the requested filters.
 *
 * Phase 2 ranks by recency + keyword match. Phase 4 swaps in pgvector semantic
 * ranking behind this same signature — callers do not change.
 */
export async function recallMemory(input: RecallInput): Promise<RecallResult> {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const empty: RecallResult = { facts: [], events: [] };
  try {
    const supabase = createServiceRoleClient();

    let factsQ = supabase
      .from("memory_facts")
      .select("fact, confidence, entity_id, valid_from")
      .is("valid_to", null)
      .order("confidence", { ascending: false })
      .limit(limit);
    if (input.entityId) factsQ = factsQ.eq("entity_id", input.entityId);
    if (input.orgId) factsQ = factsQ.eq("org_id", input.orgId);
    if (input.query) factsQ = factsQ.ilike("fact", `%${input.query}%`);

    let eventsQ = supabase
      .from("memory_events")
      .select("action, source, actor_kind, actor_label, summary, occurred_at, details")
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (input.entityId) eventsQ = eventsQ.eq("entity_id", input.entityId);
    if (input.orgId) eventsQ = eventsQ.eq("org_id", input.orgId);
    if (input.actorKind) eventsQ = eventsQ.eq("actor_kind", input.actorKind);
    if (input.source) eventsQ = eventsQ.eq("source", input.source);
    if (input.query) {
      // match the query against either the one-line summary or the action verb
      eventsQ = eventsQ.or(`summary.ilike.%${input.query}%,action.ilike.%${input.query}%`);
    }

    const [factsRes, eventsRes] = await Promise.all([factsQ, eventsQ]);
    if (factsRes.error) console.error("[memory] recall facts failed:", factsRes.error.message);
    if (eventsRes.error) console.error("[memory] recall events failed:", eventsRes.error.message);

    return {
      facts: (factsRes.data as RecalledFact[]) ?? [],
      events: (eventsRes.data as RecalledEvent[]) ?? [],
    };
  } catch (err) {
    console.error("[memory] recall threw:", (err as Error).message);
    return empty;
  }
}

export interface RecalledEntity {
  id: string;
  display_name: string;
  kind: string;
}

/**
 * Richer recall: base keyword/recency recall PLUS, when the query matches a
 * memory_entity (by name or primary phone), that entity's events and facts are
 * folded in. Makes ask/recon answers deeper — without any external API calls
 * (everything comes from the brain). Sources already in the brain (app, quo,
 * clickup, slack, gmail, …) all surface here.
 */
export async function recallRich(
  query: string,
  opts?: { limit?: number }
): Promise<RecallResult & { entities: RecalledEntity[] }> {
  const base = await recallMemory({ query, limit: opts?.limit ?? 15 });
  try {
    const supabase = createServiceRoleClient();
    const q = query.replace(/[%,()]/g, " ").trim();
    const { data: ents } = await supabase
      .from("memory_entities")
      .select("id, display_name, kind")
      .or(`display_name.ilike.%${q}%,external_refs->>primary_phone.eq.${query}`)
      .limit(3);
    const entities = (ents as RecalledEntity[]) ?? [];
    if (entities.length) {
      const ids = entities.map((e) => e.id);
      const [{ data: ev }, { data: fc }] = await Promise.all([
        supabase
          .from("memory_events")
          .select("action, source, actor_kind, actor_label, summary, occurred_at, details")
          .in("entity_id", ids)
          .order("occurred_at", { ascending: false })
          .limit(15),
        supabase
          .from("memory_facts")
          .select("fact, confidence, entity_id, valid_from")
          .is("valid_to", null)
          .in("entity_id", ids)
          .limit(15),
      ]);
      const seenE = new Set(base.events.map((e) => e.summary));
      for (const e of (ev as RecalledEvent[]) ?? [])
        if (!seenE.has(e.summary)) {
          base.events.push(e);
          seenE.add(e.summary);
        }
      const seenF = new Set(base.facts.map((f) => f.fact));
      for (const f of (fc as RecalledFact[]) ?? [])
        if (!seenF.has(f.fact)) {
          base.facts.push(f);
          seenF.add(f.fact);
        }
    }
    return { ...base, entities };
  } catch (err) {
    console.error("[memory] recallRich threw:", (err as Error).message);
    return { ...base, entities: [] };
  }
}

/** Convenience: log an event attributed to an authenticated user. */
export async function logMemoryEventForUser(
  user: User | null,
  input: Omit<MemoryEventInput, "actorKind" | "actorId" | "actorLabel"> &
    Partial<Pick<MemoryEventInput, "actorLabel">>
): Promise<boolean> {
  return logMemoryEvent({
    ...input,
    actorKind: actorKindFromUser(user),
    actorId: user?.id ?? null,
    actorLabel:
      input.actorLabel ??
      (typeof user?.email === "string" ? user.email : null),
  });
}
