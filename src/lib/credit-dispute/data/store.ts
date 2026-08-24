import type { CreditProfile, DisputeRoundType, NegativeItem } from "../types";
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
