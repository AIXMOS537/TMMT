import { createHash, randomBytes } from "node:crypto";

/**
 * Invite codes for self-serve sign-up.
 *
 * Public sign-up is open on tmmt-ops. These helpers are the gate: no valid,
 * unused, unexpired code means no account. Everything here is pure so the rules
 * are testable without a database — the DB work lives in the sign-up action.
 */

/** Crockford-ish base32: no I, L, O, U — nothing a human can mis-copy. */
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ0123456789";

/** Shortest thing we will even send to the database. Blocks "" and typos. */
export const MIN_CODE_LENGTH = 12;

/** Codes are quoted with dashes but compared without them — and case-blind. */
export function normalizeInviteCode(raw: string | null | undefined): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** What we store and compare. The raw code never touches the database. */
export function hashInviteCode(raw: string | null | undefined): string {
  return createHash("sha256").update(normalizeInviteCode(raw)).digest("hex");
}

/**
 * Mint a code: 16 characters of a 32-symbol alphabet = 80 bits of randomness,
 * grouped for reading aloud over the phone. Returns the display form; hash it
 * with hashInviteCode before storing.
 *
 * One byte per character. 256 is an exact multiple of the 32-symbol alphabet,
 * so `% ALPHABET.length` stays uniform — no modulo bias shrinking the keyspace.
 */
export function generateInviteCode(): string {
  const bytes = randomBytes(16);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out.replace(/(.{4})(?=.)/g, "$1-");
}

export type InviteRow = {
  id: string;
  email: string | null;
  expires_at: string;
  used_at: string | null;
  /** C3 (staged signup_invites v2): absent on today's table, where it reads as pending. */
  status?: InviteStatus | null;
  revoked_at?: string | null;
};

export type InviteRejection = "malformed" | "unknown" | "used" | "expired" | "wrong-email" | "revoked";

/**
 * C3-001/002 — the invitation lifecycle.
 *
 *   PENDING ──claim──▶ ACCEPTED        (once; single-use)
 *   PENDING ──time───▶ EXPIRED         (computed from expires_at, never stored early)
 *   PENDING ──owner──▶ REVOKED         (kept as a record; revoking ≠ deleting)
 *   ACCEPTED / EXPIRED / REVOKED are terminal.
 *
 * An invite may carry ONE bound relationship (e.g. a credit case); it grants
 * nothing by itself — the server makes the link after the account exists, from the
 * invite row, never from anything the browser sent.
 */
export type InviteStatus = "pending" | "accepted" | "expired" | "revoked";

export function inviteState(invite: InviteRow, now: Date = new Date()): InviteStatus {
  if (invite.status === "revoked" || invite.revoked_at) return "revoked";
  if (invite.status === "accepted" || invite.used_at) return "accepted";
  if (new Date(invite.expires_at).getTime() <= now.getTime()) return "expired";
  return "pending";
}

/**
 * Every reason a code is refused. Returns null when the code may be claimed.
 *
 * The caller must NOT show these to the user — one generic message for all of
 * them, so a stranger probing the form learns nothing about which codes exist.
 * They are for the server log.
 */
export function inviteRejection(
  invite: InviteRow | null | undefined,
  email: string,
  now: Date = new Date()
): InviteRejection | null {
  if (!invite) return "unknown";
  const state = inviteState(invite, now);
  if (state === "revoked") return "revoked";
  if (state === "accepted") return "used";
  if (state === "expired") return "expired";
  if (invite.email && invite.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return "wrong-email";
  }
  return null;
}

/** True when the submitted string is too short/empty to be worth a DB lookup. */
export function isMalformedInviteCode(raw: string | null | undefined): boolean {
  return normalizeInviteCode(raw).length < MIN_CODE_LENGTH;
}
