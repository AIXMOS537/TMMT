"use server";

import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import { isOwnerUser } from "@/lib/auth-roles";
import type { StoredClient } from "@/lib/credit-dispute/data/store";
import { requireGate } from "../../../../../shared/compliance-gates/gate";
import type { DisputeLetterBatch } from "@/lib/credit-dispute/engine/protocol";
import type { FactualBasis, ItemAssessment } from "@/lib/credit-dispute/policy/dispute-policy";
import type { AssertionSource, EvidenceKind } from "@/lib/credit-dispute/policy/assertion";
import { planDisputeRound, runGatedDisputeProtocol, type PlanResult } from "@/lib/credit-dispute/engine/gated-protocol";
import {
  addAssertion,
  addEvidence,
  appendRounds,
  audit,
  caseQueueRow,
  creditCrmStatus,
  resolveForPlanning,
  reviewRound,
  roundsFromRun,
  type CaseQueueRow,
  type CreditCrmStatus,
  type ReviewAction,
} from "@/lib/credit-dispute/engine/case-state";
import { LetterFactsMissingError } from "@/lib/credit-dispute/letters/generator";

/**
 * The credit dispute desk, moved out of the browser.
 *
 * It used to keep every client in localStorage under "aix-dispute-clients":
 * legal name, email, phone, date of birth, social-security last four, address
 * and tri-bureau scores. One cleared cache, one new laptop, one browser reset
 * and the book was gone — and it existed on exactly one machine, backed up by
 * nothing.
 *
 * Reads and writes go through the request-scoped client, so the
 * dispute_clients_admin_only policy is what actually enforces access rather
 * than a check here that a service-role client would bypass. The owner check
 * below is defence in depth and a better error than an empty list.
 *
 * C1 — THE ONE POLICY BOUNDARY
 *
 * Every path that can produce dispute correspondence now goes through
 * generateDisputeRound() below, on the server:
 *
 *   owner check -> load the STORED record -> accuracy call + customer assertion +
 *   evidence + round history -> accuracy policy -> CROA gate -> render -> store as
 *   needs_review -> a person approves, returns or cancels.
 *
 * Nothing built in a browser is stored as a letter: addDisputeRoundsForClient()
 * refuses client-supplied letters, and upsertDisputeClient() cannot write rounds,
 * assessments, assertions, evidence or the audit log. A future AIXMOS action has to
 * call the same server action to get a letter, so it inherits every check.
 */

export type DisputeResult<T> = { ok: true; data: T } | { ok: false; error: string };

type Row = {
  id: string;
  payload: StoredClient;
};

type Supa = Awaited<ReturnType<typeof createSSRClient>>;

async function requireOwnerWithUser(): Promise<{ supabase: Supa; actor: string } | null> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isOwnerUser(user)) return null;
  return { supabase, actor: user.email ?? user.id };
}

async function requireOwner() {
  const who = await requireOwnerWithUser();
  return who?.supabase ?? null;
}

async function readClient(supabase: Supa, id: string): Promise<DisputeResult<StoredClient | null>> {
  const { data, error } = await supabase.from("dispute_clients").select("id, payload").eq("id", id).maybeSingle();
  if (error) return { ok: false, error: "Could not load that client." };
  return { ok: true, data: data ? (data as Row).payload : null };
}

async function writeClient(supabase: Supa, client: StoredClient): Promise<DisputeResult<StoredClient>> {
  // The searchable columns are a copy of what is already inside payload, so a
  // list view never has to pull every client's full record to show a name.
  const { error } = await supabase.from("dispute_clients").upsert({
    id: client.profile.id,
    client_name: client.profile.fullName ?? null,
    email: client.profile.email ?? null,
    source: client.source,
    external_id: client.externalId ?? null,
    payload: client,
    imported_at: client.importedAt ?? new Date().toISOString(),
  });
  if (error) {
    console.error("[dispute_clients upsert]", error.message);
    return { ok: false, error: "Could not save that client." };
  }
  return { ok: true, data: client };
}

/** Load, change, save — owner-checked first, so a non-owner triggers no query. */
async function mutateClient(
  profileId: string,
  change: (client: StoredClient, actor: string) => StoredClient
): Promise<DisputeResult<StoredClient | null>> {
  const who = await requireOwnerWithUser();
  if (!who) return { ok: false, error: "Not authorized." };
  const existing = await readClient(who.supabase, profileId);
  if (!existing.ok) return existing;
  if (!existing.data) return { ok: false, error: "Client not found." };
  let updated: StoredClient;
  try {
    updated = change(existing.data, who.actor);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "That change was refused." };
  }
  const saved = await writeClient(who.supabase, updated);
  if (!saved.ok) return saved;
  return { ok: true, data: updated };
}

export async function listDisputeClients(): Promise<DisputeResult<StoredClient[]>> {
  const supabase = await requireOwner();
  if (!supabase) return { ok: false, error: "Not authorized." };

  const { data, error } = await supabase
    .from("dispute_clients")
    .select("id, payload")
    .order("updated_at", { ascending: false });

  if (error) return { ok: false, error: "Could not load clients." };
  return { ok: true, data: (data ?? []).map((r) => (r as Row).payload) };
}

export async function getDisputeClient(
  id: string
): Promise<DisputeResult<StoredClient | null>> {
  const supabase = await requireOwner();
  if (!supabase) return { ok: false, error: "Not authorized." };
  return readClient(supabase, id);
}

/**
 * Save an imported report.
 *
 * C1: this writes the REPORT (profile, source, items). It never writes the case:
 * dispute rounds, accuracy calls, assertions, evidence and the audit log are
 * carried over from the stored record (or start empty for a new client), whatever
 * the caller sends. That closes the path where a browser could store letters or
 * assessments by handing a whole payload to this action.
 */
export async function upsertDisputeClient(
  client: StoredClient
): Promise<DisputeResult<StoredClient>> {
  const who = await requireOwnerWithUser();
  if (!who) return { ok: false, error: "Not authorized." };

  if (!client?.profile?.id) return { ok: false, error: "Client is missing an id." };

  const prior = await readClient(who.supabase, client.profile.id);
  if (!prior.ok) return { ok: false, error: prior.error };
  const existing = prior.data;

  let safe: StoredClient = {
    profile: client.profile,
    source: client.source,
    negativeItems: client.negativeItems ?? [],
    importedAt: client.importedAt,
    ...(client.externalId !== undefined ? { externalId: client.externalId } : {}),
    disputeRounds: existing?.disputeRounds ?? [],
    ...(existing?.assessments ? { assessments: existing.assessments } : {}),
    ...(existing?.assertions ? { assertions: existing.assertions } : {}),
    ...(existing?.evidence ? { evidence: existing.evidence } : {}),
    ...(existing?.auditLog ? { auditLog: existing.auditLog } : {}),
  };
  safe = audit(safe, { actor: who.actor, action: "client_imported", detail: `${client.source}; ${safe.negativeItems.length} items` });

  return writeClient(who.supabase, safe);
}

/**
 * Pre-C1 entry point that stored letters built in the browser.
 *
 * It now refuses every batch. Letters are rendered on the server, from the stored
 * record, by generateDisputeRound() — so a batch "built anywhere else — an import,
 * a fixture, a future caller" can never land in the client record. Kept (not
 * deleted) so an old bundle gets a clear answer instead of a 404.
 *
 * ORDER MATTERS, and it is authorize-then-gate. An anonymous caller is still
 * redirected to /login and a signed-in non-owner still gets "Not authorized." with
 * no query issued. Who you are is settled before what we may do.
 */
export async function addDisputeRoundsForClient(
  profileId: string,
  batches: DisputeLetterBatch[]
): Promise<DisputeResult<StoredClient | null>> {
  void batches;
  const existing = await getDisputeClient(profileId);
  if (!existing.ok) return existing;
  if (!existing.data) return { ok: false, error: "Client not found." };

  try {
    requireGate("croa_contracts_attorney_approved");
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Credit dispute features are gated.",
    };
  }
  return {
    ok: false,
    error: "Letters built outside the server are not accepted. Use Generate round: it applies the accuracy policy and stores drafts for review.",
  };
}

/**
 * Record the accuracy call on one negative item.
 *
 * `roundsSent` is deliberately not settable here. It is derived from the stored
 * dispute history, so the two can never disagree about what has actually gone
 * out. C1: only `accuracy`, `basis` and `basisNote` are taken from the caller;
 * anything else in the object is ignored.
 */
export async function recordItemAssessment(
  profileId: string,
  negativeItemId: string,
  assessment: Omit<ItemAssessment, "assessedAt" | "roundsSent" | "assessedBy">
): Promise<DisputeResult<StoredClient | null>> {
  const accuracy = assessment?.accuracy;
  if (accuracy !== "accurate" && accuracy !== "inaccurate" && accuracy !== "unknown") {
    const who = await requireOwnerWithUser();
    if (!who) return { ok: false, error: "Not authorized." };
    return { ok: false, error: "Unknown accuracy value." };
  }
  return mutateClient(profileId, (client, actor) => {
    if (!client.negativeItems.some((i) => i.id === negativeItemId)) throw new Error("Unknown item.");
    const prior = client.assessments?.[negativeItemId];
    const next: ItemAssessment = {
      accuracy,
      ...(accuracy === "inaccurate" && assessment.basis ? { basis: assessment.basis } : {}),
      ...(assessment.basisNote ? { basisNote: String(assessment.basisNote).slice(0, 2000) } : {}),
      roundsSent: prior?.roundsSent ?? [],
      // Who decided this, and on what day, is the first question anyone
      // reviewing a dispute asks.
      assessedBy: actor,
      assessedAt: new Date().toISOString(),
    };
    return audit(
      { ...client, assessments: { ...(client.assessments ?? {}), [negativeItemId]: next } },
      { actor, action: "assessment_recorded", negativeItemId, detail: `${accuracy}${next.basis ? `; ${next.basis}` : ""}` }
    );
  });
}

export interface AssertionInput {
  basis: FactualBasis;
  /** The customer's own words. */
  statement: string;
  source: AssertionSource;
  /** The customer confirmed this is their claim. */
  customerConfirmed: boolean;
  evidenceIds?: string[];
}

/** Record what the customer says is wrong with one item. Replaces (and keeps) any earlier one. */
export async function recordCustomerAssertion(
  profileId: string,
  negativeItemId: string,
  input: AssertionInput
): Promise<DisputeResult<StoredClient | null>> {
  return mutateClient(profileId, (client, actor) => {
    const statement = String(input?.statement ?? "").trim().slice(0, 2000);
    if (statement.length < 3) throw new Error("Record the customer's explanation in their own words.");
    if (input.source !== "customer" && input.source !== "operator") throw new Error("Say who made this statement.");
    const known = new Set((client.evidence ?? []).map((e) => e.id));
    const evidenceIds = (input.evidenceIds ?? []).filter((id) => known.has(id));
    const now = new Date().toISOString();
    return addAssertion(client, {
      id: `assert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      negativeItemId,
      basis: input.basis,
      statement,
      source: input.source,
      customerConfirmed: input.source === "customer" && input.customerConfirmed === true,
      evidenceIds,
      recordedBy: actor,
      recordedAt: now,
      status: "active",
    });
  });
}

export interface EvidenceInput {
  kind: EvidenceKind;
  description: string;
  negativeItemId?: string;
  assertionId?: string;
  source: "customer" | "operator";
}

/**
 * Record that a supporting document exists (metadata only in C1 — no file store
 * yet; see CREDIT_CASE_MODEL.md). No storage path or URL is accepted from the
 * browser.
 */
export async function recordEvidenceReference(
  profileId: string,
  input: EvidenceInput
): Promise<DisputeResult<StoredClient | null>> {
  return mutateClient(profileId, (client, actor) => {
    const description = String(input?.description ?? "").trim().slice(0, 500);
    if (description.length < 3) throw new Error("Describe the document.");
    const now = new Date().toISOString();
    return addEvidence(client, {
      id: `evid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind: input.kind,
      description,
      negativeItemId: input.negativeItemId,
      assertionId: input.assertionId,
      source: input.source === "customer" ? "customer" : "operator",
      uploadedBy: actor,
      uploadedAt: now,
    });
  });
}

/** What the policy would do right now, item by item. Never renders, never gated. */
export async function planDisputeRoundForClient(profileId: string): Promise<DisputeResult<PlanResult>> {
  const existing = await getDisputeClient(profileId);
  if (!existing.ok) return existing;
  if (!existing.data) return { ok: false, error: "Client not found." };
  const { items, assessments, contexts } = resolveForPlanning(existing.data);
  return { ok: true, data: planDisputeRound(items, assessments, contexts) };
}

export type GenerateOutcome =
  | { kind: "stored"; plan: PlanResult; roundIds: string[]; client: StoredClient }
  | { kind: "nothing_ready"; plan: PlanResult }
  | { kind: "gated"; plan: PlanResult; gate: string }
  | { kind: "facts_missing"; plan: PlanResult; detail: string };

/**
 * THE ONLY WAY A DISPUTE LETTER IS PRODUCED (C1).
 *
 * Reads the stored record — never the browser's copy — plans with the full policy,
 * and renders only the items the policy clears. Rendered letters are stored as
 * `needs_review`. They are not sent, and nothing here can send them.
 */
export async function generateDisputeRound(profileId: string): Promise<DisputeResult<GenerateOutcome>> {
  const who = await requireOwnerWithUser();
  if (!who) return { ok: false, error: "Not authorized." };
  const existing = await readClient(who.supabase, profileId);
  if (!existing.ok) return existing;
  if (!existing.data) return { ok: false, error: "Client not found." };
  const client = existing.data;

  const { items, assessments, contexts } = resolveForPlanning(client);
  const plan = planDisputeRound(items, assessments, contexts);
  if (plan.readyForLetter.length === 0) return { ok: true, data: { kind: "nothing_ready", plan } };

  try {
    requireGate("croa_contracts_attorney_approved");
  } catch (e) {
    return { ok: true, data: { kind: "gated", plan, gate: e instanceof Error ? e.message : "croa_contracts_attorney_approved" } };
  }

  let run;
  try {
    const ready = items.filter((i) => plan.readyForLetter.includes(i.id));
    run = runGatedDisputeProtocol(client.profile, ready, assessments, undefined, contexts);
  } catch (e) {
    if (e instanceof LetterFactsMissingError) {
      return { ok: true, data: { kind: "facts_missing", plan, detail: e.message } };
    }
    throw e;
  }

  let updated: StoredClient;
  try {
    const rounds = roundsFromRun(run, who.actor);
    updated = appendRounds(client, rounds);
    for (const r of rounds) {
      updated = audit(updated, { actor: who.actor, action: "round_generated", roundId: r.id, negativeItemId: r.negativeItemId, assertionId: r.assertionId, detail: `${r.roundType}; ${r.templateVersion}` });
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not store the round." };
  }
  const saved = await writeClient(who.supabase, updated);
  if (!saved.ok) return saved;
  return { ok: true, data: { kind: "stored", plan, roundIds: run.rendered.map((_, i) => updated.disputeRounds[updated.disputeRounds.length - run.rendered.length + i].id), client: updated } };
}

/** Edit, approve, return for information, or cancel one draft round. Owner only. */
export async function reviewDisputeRound(
  profileId: string,
  roundId: string,
  action: ReviewAction
): Promise<DisputeResult<StoredClient | null>> {
  const kind = action?.kind;
  if (kind !== "edit" && kind !== "approve" && kind !== "return_for_information" && kind !== "cancel") {
    const who = await requireOwnerWithUser();
    if (!who) return { ok: false, error: "Not authorized." };
    return { ok: false, error: "Unknown review action." };
  }
  return mutateClient(profileId, (client, actor) => reviewRound(client, roundId, action, actor));
}

/**
 * The operator queue, counts only (C1-012 / C1-016). This is the read boundary a
 * future AIXMOS assistant should use: it answers "which cases need evidence / are
 * waiting for review / have responses" without handing out report contents,
 * identifiers or letter text.
 */
export async function getCreditCaseQueue(): Promise<
  DisputeResult<Array<CaseQueueRow & { crmStatus: CreditCrmStatus }>>
> {
  const all = await listDisputeClients();
  if (!all.ok) return all;
  return {
    ok: true,
    data: all.data.map((c) => {
      const { items, assessments, contexts } = resolveForPlanning(c);
      const plan = planDisputeRound(items, assessments, contexts);
      const row = caseQueueRow(c, plan.counts.needs_information);
      return { ...row, crmStatus: creditCrmStatus(c, row) };
    }),
  };
}

/**
 * One-time rescue for whatever is still sitting in a browser.
 *
 * Switching the desk to the database would otherwise strand every client that
 * was imported before today, because that data exists only in the localStorage
 * of the machine that imported it — there is no server copy to migrate from.
 * The page reads the old key and hands it here. Existing ids are skipped rather
 * than overwritten, so running it twice is safe and a re-import cannot clobber
 * work done since. C1: assertions, evidence and audit entries are never taken
 * from a browser (it never held any); pre-C1 rounds come across as drafts, which
 * the review gate treats as awaiting review.
 */
export async function importClientsFromBrowser(
  clients: StoredClient[]
): Promise<DisputeResult<{ imported: number; skipped: number }>> {
  const supabase = await requireOwner();
  if (!supabase) return { ok: false, error: "Not authorized." };

  const valid = clients.filter((c) => c?.profile?.id);
  if (valid.length === 0) return { ok: true, data: { imported: 0, skipped: 0 } };

  const { data: present } = await supabase
    .from("dispute_clients")
    .select("id")
    .in("id", valid.map((c) => c.profile.id));

  const already = new Set((present ?? []).map((r) => (r as { id: string }).id));
  const fresh = valid.filter((c) => !already.has(c.profile.id));

  if (fresh.length === 0) {
    return { ok: true, data: { imported: 0, skipped: valid.length } };
  }

  const { error } = await supabase.from("dispute_clients").insert(
    fresh.map((c) => {
      // Strip anything a browser could only have forged.
      const { assertions: _a, evidence: _e, auditLog: _l, ...rest } = c;
      void _a;
      void _e;
      void _l;
      return {
        id: c.profile.id,
        client_name: c.profile.fullName ?? null,
        email: c.profile.email ?? null,
        source: c.source,
        external_id: c.externalId ?? null,
        payload: rest,
        imported_at: c.importedAt ?? new Date().toISOString(),
      };
    })
  );

  if (error) {
    console.error("[dispute_clients import]", error.message);
    return { ok: false, error: "Could not import those clients." };
  }
  return { ok: true, data: { imported: fresh.length, skipped: valid.length - fresh.length } };
}
