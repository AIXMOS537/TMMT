import "server-only";

import { createServiceRoleClient } from "@/lib/supabase-service";
import { logMemoryEvent } from "@/lib/memory";
import { notifyTelegram } from "@/lib/notify";

/**
 * Work Routing — Phase 3d: evaluate / plan / assign across the FULL pool.
 *
 * `routeWork(caseId)` ranks every candidate (employee | agent | vendor | unit)
 * for a case via the deterministic `rank_work_candidates` SQL function, assigns
 * the best one atomically via `assign_work`, and records the decision in the
 * brain. Vertical-agnostic: new business lines just add candidates/verticals —
 * no code change.
 *
 * Deterministic ranking is the fail-open baseline. An agent (CAPTAIN) can later
 * re-order candidates before assignment without changing this signature.
 */

export interface RankedCandidate {
  candidate_id: string;
  candidate_kind: string;
  display_name: string;
  score: number;
  cap_overlap: number;
  vertical_match: boolean;
  current_load: number;
}

export interface RouteWorkResult {
  ok: boolean;
  assigned: boolean;
  caseId: string;
  candidateId?: string;
  candidateKind?: string;
  displayName?: string;
  score?: number;
  reason?: string;
}

export async function routeWork(
  caseId: string,
  opts?: { entityId?: string | null; orgId?: string | null }
): Promise<RouteWorkResult> {
  const supabase = createServiceRoleClient();
  try {
    const { data: ranked, error: rankErr } = await supabase.rpc(
      "rank_work_candidates",
      { p_case_id: caseId }
    );
    if (rankErr) {
      console.error("[route] rank failed:", rankErr.message);
      return { ok: false, assigned: false, caseId, reason: rankErr.message };
    }

    const candidates = (ranked as RankedCandidate[]) ?? [];
    if (candidates.length === 0) {
      // No eligible candidate — leave the case for manual triage, but record it.
      await supabase
        .from("cases")
        .update({ routing_status: "skipped" })
        .eq("id", caseId);
      await logMemoryEvent({
        action: "work_unassigned",
        source: "system",
        actorKind: "system",
        actorLabel: "work router",
        orgId: opts?.orgId ?? null,
        entityId: opts?.entityId ?? null,
        summary: `No eligible candidate for case ${caseId} — needs manual triage`,
        details: { caseId },
        dedupeKey: `route:${caseId}:none`,
      });
      return { ok: true, assigned: false, caseId, reason: "no eligible candidate" };
    }

    const top = candidates[0];
    const { error: assignErr } = await supabase.rpc("assign_work", {
      p_case_id: caseId,
      p_candidate_id: top.candidate_id,
      p_by_kind: "system",
      p_score: top.score,
      p_reasoning: { ranked: candidates.slice(0, 5) },
    });
    if (assignErr) {
      console.error("[route] assign failed:", assignErr.message);
      return { ok: false, assigned: false, caseId, reason: assignErr.message };
    }

    await logMemoryEvent({
      action: "work_assigned",
      source: "system",
      actorKind: "system",
      actorLabel: "work router",
      orgId: opts?.orgId ?? null,
      entityId: opts?.entityId ?? null,
      summary: `Assigned case ${caseId} to ${top.display_name} (${top.candidate_kind}, score ${top.score})`,
      details: {
        caseId,
        candidateId: top.candidate_id,
        candidateKind: top.candidate_kind,
        score: top.score,
        considered: candidates.length,
      },
      dedupeKey: `route:${caseId}:assigned`,
    });

    // Notify the assignee (3e) — Telegram if they're a profile-backed candidate.
    // Fail-open; never affects the assignment outcome.
    try {
      const { data: cand } = await supabase
        .from("routing_candidates")
        .select("ref_kind, ref_id")
        .eq("id", top.candidate_id)
        .maybeSingle();
      if (cand?.ref_kind === "profiles" && cand.ref_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("telegram_chat_id")
          .eq("id", cand.ref_id)
          .maybeSingle();
        await notifyTelegram(
          prof?.telegram_chat_id as string | undefined,
          `New work assigned: case ${caseId} (${top.candidate_kind}). Open the queue to accept.`
        );
      }
    } catch {
      /* notify is best-effort */
    }

    return {
      ok: true,
      assigned: true,
      caseId,
      candidateId: top.candidate_id,
      candidateKind: top.candidate_kind,
      displayName: top.display_name,
      score: top.score,
    };
  } catch (err) {
    console.error("[route] threw:", (err as Error).message);
    return { ok: false, assigned: false, caseId, reason: (err as Error).message };
  }
}
