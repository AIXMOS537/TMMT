import type { CreditProfile, DisputeRoundType, NegativeItem } from "../types";
import type { ItemAssessment } from "../policy/dispute-policy";
import type { DisputeLetterBatch } from "../engine/protocol";

export type ReportSource = "disputefox" | "myfreescorenow" | "smartcredit";

export interface StoredDisputeRound {
  id: string;
  negativeItemId: string;
  roundNumber: number;
  roundType: DisputeRoundType;
  bureau: string;
  status: string;
  letterSubject: string;
  letterBody: string;
  furnisherName: string;
  createdAt: string;
}

export interface StoredClient {
  profile: CreditProfile;
  source: ReportSource;
  negativeItems: NegativeItem[];
  disputeRounds: StoredDisputeRound[];
  importedAt: string;
  externalId?: string;
  /**
   * The accuracy call a human made on each item, keyed by negative-item id.
   *
   * Separate from the item itself because it is a JUDGEMENT about the item, made
   * by a named person at a point in time — not a property of the tradeline. It is
   * also the thing the policy gate requires before any letter exists, so it needs
   * to survive a page reload.
   */
  assessments?: Record<string, ItemAssessment>;
}

const STORAGE_KEY = "aix-dispute-clients";

export function getClients(): StoredClient[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveClients(clients: StoredClient[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
}

export function getClientById(id: string): StoredClient | undefined {
  return getClients().find((c) => c.profile.id === id);
}

export function upsertClient(client: StoredClient): void {
  const clients = getClients();
  const idx = clients.findIndex((c) => c.profile.id === client.profile.id);
  if (idx >= 0) {
    clients[idx] = client;
  } else {
    clients.push(client);
  }
  saveClients(clients);
}

export function addDisputeRounds(
  profileId: string,
  batches: DisputeLetterBatch[]
): StoredClient | undefined {
  const client = getClientById(profileId);
  if (!client) return undefined;

  const newRounds: StoredDisputeRound[] = batches.map((b, i) => ({
    id: `round-${Date.now()}-${i}`,
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

  client.disputeRounds = [...client.disputeRounds, ...newRounds];
  upsertClient(client);
  return client;
}

export function generateId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}


/**
 * Record the accuracy call on one item.
 *
 * Stamps who and when, because "who decided this was inaccurate, and on what day"
 * is the first question anyone reviewing a dispute will ask.
 */
export function setItemAssessment(
  profileId: string,
  negativeItemId: string,
  assessment: Omit<ItemAssessment, "assessedAt">,
  assessedBy?: string
): void {
  const clients = getClients();
  const client = clients.find((c) => c.profile.id === profileId);
  if (!client) return;

  const existing = client.assessments?.[negativeItemId];
  client.assessments = {
    ...(client.assessments ?? {}),
    [negativeItemId]: {
      ...assessment,
      // Rounds already sent are tracked by the dispute history, not re-entered.
      roundsSent: existing?.roundsSent ?? assessment.roundsSent ?? [],
      assessedBy: assessedBy ?? existing?.assessedBy,
      assessedAt: new Date().toISOString(),
    },
  };
  saveClients(clients);
}

/** The recorded assessments for a client, or an empty map. */
export function getAssessments(profileId: string): Record<string, ItemAssessment> {
  return getClientById(profileId)?.assessments ?? {};
}

/**
 * Rounds already sent for each item, derived from stored dispute history.
 *
 * Read from the history rather than tracked separately, so the two can never
 * disagree about what has actually gone out.
 */
export function roundsSentByItem(profileId: string): Record<string, DisputeRoundType[]> {
  const client = getClientById(profileId);
  if (!client) return {};
  const out: Record<string, DisputeRoundType[]> = {};
  for (const r of client.disputeRounds) {
    (out[r.negativeItemId] ??= []).push(r.roundType);
  }
  return out;
}
