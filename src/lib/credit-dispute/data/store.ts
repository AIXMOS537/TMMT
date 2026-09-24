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

/**
 * The old browser key.
 *
 * Client records used to live here and nowhere else — legal name, email, phone,
 * date of birth, social-security last four, address and tri-bureau scores, in
 * localStorage, on whatever machine imported them. They are in the database now
 * (see the server actions beside the credit-dispute pages); this constant
 * survives only so the one-time rescue can find what is still stranded in a
 * browser.
 *
 * Nothing writes to it any more. Once a machine has run the rescue and the
 * count comes back zero, the key can be cleared.
 */
export const LEGACY_STORAGE_KEY = "aix-dispute-clients";

/** Whatever this browser still holds under the old key. Read-only. */
export function readLegacyClients(): StoredClient[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredClient[]) : [];
  } catch {
    return [];
  }
}

/** Drop the old key. Only call this once the rescue has reported success. */
export function clearLegacyClients(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* a browser that refuses storage has nothing to clear */
  }
}

export function generateId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}


/*
 * setItemAssessment / getAssessments / roundsSentByItem used to live here.
 *
 * They read and wrote the whole client record in localStorage - and that
 * record carries legal name, email, phone, date of birth, social-security
 * last four, home address and tri-bureau scores. Storing an accuracy call
 * there meant storing all of it there.
 *
 * They are gone, not moved: their server replacements are
 * recordItemAssessment() in the desk's actions.ts, and the read side needs no
 * function at all because listDisputeClients() already returns `assessments`
 * and `disputeRounds` inside each StoredClient (dispute_clients.payload).
 *
 * Do not reintroduce them. The only localStorage left in this file is the
 * one-way legacy rescue above (readLegacyClients / clearLegacyClients), which
 * exists to empty the old key, never to fill it.
 */
