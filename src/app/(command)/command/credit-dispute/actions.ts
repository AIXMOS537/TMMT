"use server";

import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import { isOwnerUser } from "@/lib/auth-roles";
import type { StoredClient, StoredDisputeRound } from "@/lib/credit-dispute/data/store";
import type { DisputeLetterBatch } from "@/lib/credit-dispute/engine/protocol";
import type { ItemAssessment } from "@/lib/credit-dispute/policy/dispute-policy";

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
 */

export type DisputeResult<T> = { ok: true; data: T } | { ok: false; error: string };

type Row = {
  id: string;
  payload: StoredClient;
};

async function requireOwner() {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isOwnerUser(user)) return null;
  return supabase;
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

  const { data, error } = await supabase
    .from("dispute_clients")
    .select("id, payload")
    .eq("id", id)
    .maybeSingle();

  if (error) return { ok: false, error: "Could not load that client." };
  return { ok: true, data: data ? (data as Row).payload : null };
}

export async function upsertDisputeClient(
  client: StoredClient
): Promise<DisputeResult<StoredClient>> {
  const supabase = await requireOwner();
  if (!supabase) return { ok: false, error: "Not authorized." };

  if (!client?.profile?.id) return { ok: false, error: "Client is missing an id." };

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

export async function addDisputeRoundsForClient(
  profileId: string,
  batches: DisputeLetterBatch[]
): Promise<DisputeResult<StoredClient | null>> {
  const existing = await getDisputeClient(profileId);
  if (!existing.ok) return existing;
  if (!existing.data) return { ok: false, error: "Client not found." };

  const stamp = Date.now();
  const newRounds: StoredDisputeRound[] = batches.map((b, i) => ({
    id: `round-${stamp}-${i}`,
    negativeItemId: b.negativeItemId,
    roundNumber: b.roundNumber,
    roundType: b.roundType,
    bureau: b.bureau,
    status: b.status,
    letterSubject: b.letter.subject,
    letterBody: b.letter.body,
    furnisherName: b.furnisherName,
    createdAt: new Date().toISOString(),
  }));

  const updated: StoredClient = {
    ...existing.data,
    disputeRounds: [...existing.data.disputeRounds, ...newRounds],
  };

  const saved = await upsertDisputeClient(updated);
  if (!saved.ok) return saved;
  return { ok: true, data: updated };
}

/**
 * Record the accuracy call on one negative item.
 *
 * The accuracy gate refuses to write a letter for an item nobody has assessed,
 * so this is the write that unlocks one. It lived in the browser store, keyed
 * off the same localStorage record that held the client's date of birth,
 * social-security last four and home address; the assessment rides inside that
 * record, so storing it there meant storing all of it there. It goes through
 * the request-scoped owner-checked client now, like everything else on this
 * desk.
 *
 * `roundsSent` is deliberately not settable here. It is derived from the stored
 * dispute history, so the two can never disagree about what has actually gone
 * out, and an existing value is carried forward rather than re-entered.
 */
export async function recordItemAssessment(
  profileId: string,
  negativeItemId: string,
  assessment: Omit<ItemAssessment, "assessedAt" | "roundsSent" | "assessedBy">
): Promise<DisputeResult<StoredClient | null>> {
  const supabase = await requireOwner();
  if (!supabase) return { ok: false, error: "Not authorized." };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const existing = await getDisputeClient(profileId);
  if (!existing.ok) return existing;
  if (!existing.data) return { ok: false, error: "Client not found." };

  const prior = existing.data.assessments?.[negativeItemId];
  const updated: StoredClient = {
    ...existing.data,
    assessments: {
      ...(existing.data.assessments ?? {}),
      [negativeItemId]: {
        ...assessment,
        roundsSent: prior?.roundsSent ?? [],
        // Who decided this, and on what day, is the first question anyone
        // reviewing a dispute asks.
        assessedBy: user?.email ?? prior?.assessedBy,
        assessedAt: new Date().toISOString(),
      },
    },
  };

  const saved = await upsertDisputeClient(updated);
  if (!saved.ok) return saved;
  return { ok: true, data: updated };
}

/**
 * One-time rescue for whatever is still sitting in a browser.
 *
 * Switching the desk to the database would otherwise strand every client that
 * was imported before today, because that data exists only in the localStorage
 * of the machine that imported it — there is no server copy to migrate from.
 * The page reads the old key and hands it here. Existing ids are skipped rather
 * than overwritten, so running it twice is safe and a re-import cannot clobber
 * work done since.
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
    fresh.map((c) => ({
      id: c.profile.id,
      client_name: c.profile.fullName ?? null,
      email: c.profile.email ?? null,
      source: c.source,
      external_id: c.externalId ?? null,
      payload: c,
      imported_at: c.importedAt ?? new Date().toISOString(),
    }))
  );

  if (error) {
    console.error("[dispute_clients import]", error.message);
    return { ok: false, error: "Could not import those clients." };
  }
  return { ok: true, data: { imported: fresh.length, skipped: valid.length - fresh.length } };
}
