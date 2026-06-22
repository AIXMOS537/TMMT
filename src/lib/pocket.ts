import type { User } from "@supabase/supabase-js";
import { getAppRole } from "@/lib/auth-roles";

// AIXMOS Pocket — the productized, cross-platform "taste" of the AIXMOS ecosystem.
// The $97/mo Credit Guidance membership unlocks the assistant + member tiles.
// See docs/superpowers/specs/2026-06-19-aixmos-pocket-taste-offer-design.md.
//
// COMPLIANCE: this is credit GUIDANCE/education, never "repair"; no guarantees.
// CHARTER: this is the public AIXMOS face — never HAILMARY, never the owner's
// AIXMOS network brain.

/**
 * Is this user an active AIXMOS Pocket member (the $97/mo Credit Guidance tier)?
 *
 * Phase 1 (shell): unlocks for the owner (preview) and for users explicitly
 * flagged `app_metadata.pocket_member === true`. It deliberately does NOT
 * unlock by default — non-members see the activate/climb screen, which is the
 * correct funnel behavior.
 *
 * Phase 3 wires this to the real source of truth: the GHL `member-97` tag synced
 * into Supabase (see /api/webhooks/ghl + the planned `pocket_members` table).
 */
export function isActivePocketMember(user: User | null): boolean {
  if (!user) return false;
  if (getAppRole(user) === "admin") return true; // owner previews the full app
  return user.app_metadata?.pocket_member === true;
}

/** Checkout link for the $97/mo membership (GHL). Falls back to the Learn face. */
export function pocketCheckoutUrl(): string {
  return process.env.NEXT_PUBLIC_GHL_CHECKOUT_97 || "/learn";
}

export interface PocketTile {
  key: string;
  title: string;
  blurb: string;
  href: string;
  /** Requires an active membership to use; locked otherwise. */
  memberOnly: boolean;
}

/** The home-screen tiles. Copy is the compliance-locked text from docs/aixmos-pocket/COPY.md. */
export const POCKET_TILES: PocketTile[] = [
  {
    key: "assistant",
    title: "Assistant",
    blurb: "Ask your guidance coach anything — build a plan, learn the next step.",
    href: "/pocket/assistant",
    memberOnly: true,
  },
  {
    key: "academy",
    title: "Academy",
    blurb: "Learn how the network earns. Short lessons, real skills.",
    href: "/pocket/academy",
    memberOnly: false,
  },
  {
    key: "earn",
    title: "Earn",
    blurb:
      "Share your link. Earn commission on every sale that's collected — real money on real sales.",
    href: "/pocket/earn",
    memberOnly: true,
  },
  {
    key: "compass",
    title: "Compass",
    blurb: "Protect your peace. One small step today.",
    href: "/pocket/compass",
    memberOnly: false,
  },
  {
    key: "climb",
    title: "Climb",
    blurb: "Ready for more? See your path from member → operator → your own business.",
    href: "/pocket/climb",
    memberOnly: false,
  },
];
