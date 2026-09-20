/**
 * Client engagement tracker (G4) — the data layer behind /pocket/build.
 *
 * The security rule for this whole module, in one line:
 *   **every read here takes an RLS-respecting client, never a service-role one.**
 *
 * That is not a style preference. `createServiceRoleClient()` bypasses row level
 * security completely, so a tracker built on it would happily hand org A's build
 * to org B while every policy in the staged migration sat there looking correct.
 * The migration is only half the guarantee; this file is the other half.
 * `engagement-rls.test.ts` asserts both halves, and fails if either is removed.
 *
 * Schema: supabase/migrations/_staged/20260911220000_client_engagement_tracker_STAGED.sql
 * (STAGED — not applied. Until it is, these reads return null/[] against a live
 * DB, which the page renders as the honest empty state rather than as an error.)
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ENGAGEMENT_PHASES,
  engagementPhaseRank,
  type EngagementPhase,
} from "@/lib/workflow/statuses";

export type ChangeRequest = {
  id: string;
  body: string;
  author_kind: "client" | "operator";
  created_at: string;
};

export type Engagement = {
  id: string;
  organization_id: string;
  phase: EngagementPhase;
  intake_summary: Record<string, unknown>;
  whats_live: string[];
  intake_at: string | null;
  agreement_at: string | null;
  build_at: string | null;
  live_at: string | null;
};

/** One step as the tracker renders it. */
export type PhaseStep = {
  phase: EngagementPhase;
  /** Reached at, or null when this step hasn't happened yet. */
  at: string | null;
  state: "done" | "current" | "upcoming";
};

const PHASE_TIMESTAMP: Record<EngagementPhase, keyof Engagement> = {
  intake: "intake_at",
  agreement: "agreement_at",
  build: "build_at",
  live: "live_at",
};

/**
 * Build the four-step timeline.
 *
 * A step is `done` only when it is BEHIND the current phase — the current phase
 * itself is `current`, never `done`, even though it has a timestamp. Showing the
 * live step as finished while the build is still running is the exact kind of
 * green-over-a-dead-step that makes a client stop trusting the page.
 */
export function phaseSteps(e: Engagement): PhaseStep[] {
  const currentRank = engagementPhaseRank(e.phase);
  return ENGAGEMENT_PHASES.map((phase) => {
    const rank = engagementPhaseRank(phase);
    const at = (e[PHASE_TIMESTAMP[phase]] as string | null) ?? null;
    return {
      phase,
      at,
      state: rank < currentRank ? "done" : rank === currentRank ? "current" : "upcoming",
    };
  });
}

/**
 * The org's engagement, or null.
 *
 * `db` MUST be an RLS-respecting client. We do not filter by organization_id
 * here — deliberately. The policy does it. If the filter lived in this query
 * instead, removing the policy would leave the app looking correct while the
 * database had become wide open, and the RLS test could never catch it.
 */
export async function getEngagement(db: SupabaseClient): Promise<Engagement | null> {
  const { data, error } = await db
    .from("client_engagements")
    .select(
      "id, organization_id, phase, intake_summary, whats_live, intake_at, agreement_at, build_at, live_at",
    )
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as Engagement;
}

/** The change-request thread, oldest first. RLS scopes it to the caller's org. */
export async function getChangeRequests(
  db: SupabaseClient,
  engagementId: string,
): Promise<ChangeRequest[]> {
  const { data, error } = await db
    .from("engagement_change_requests")
    .select("id, body, author_kind, created_at")
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as ChangeRequest[];
}

/**
 * Post a change request as the signed-in client.
 *
 * `organization_id` is intentionally absent: the BEFORE INSERT trigger fills it
 * from the parent engagement, so a caller cannot aim a row at someone else's
 * thread by supplying their own org id. `author_kind` is pinned to 'client'
 * because the INSERT policy rejects anything else from `authenticated`.
 */
export async function postChangeRequest(
  db: SupabaseClient,
  engagementId: string,
  authorId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "empty" };

  const { error } = await db.from("engagement_change_requests").insert({
    engagement_id: engagementId,
    author_id: authorId,
    author_kind: "client",
    body: trimmed,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
