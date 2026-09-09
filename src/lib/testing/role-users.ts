import type { User } from "@supabase/supabase-js";
import {
  APP_ROLE_TOKENS,
  getTierForUser,
  isOwnerUser,
  isStaffUser,
  isVendorUser,
  type AppRoleToken,
} from "@/lib/auth-roles";

/**
 * Synthetic signed-in users for server-action authz tests (T-03), one per JWT
 * `app_metadata.role` token — generated from APP_ROLE_TOKENS rather than
 * re-typed here, so the vocabulary stays in src/lib/auth-roles.ts (F-15) and a
 * token added there gets a fixture and lands in every table below.
 *
 * The role source is the JWT claim, not `profiles.role`; server actions read
 * `isStaffUser` / `isOwnerUser` / `isVendorUser` off exactly this field, and
 * the partitions below are computed with those same predicates. That is
 * deliberate: these suites test that the ACTIONS honour the predicates, while
 * the token -> tier mapping itself is pinned by role-vocabulary.test.ts.
 */
export type RoleUser = Partial<User> & { id: string; email: string; app_metadata: { role?: string } };

const mk = (n: number, email: string, role?: string): RoleUser => ({
  id: `00000000-0000-4000-8000-0000000000${n.toString(16).padStart(2, "0")}`,
  email,
  app_metadata: role === undefined ? {} : { role },
  user_metadata: {},
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00.000Z",
});

const byToken = Object.fromEntries(
  APP_ROLE_TOKENS.map((token, i) => [token, mk(0xa1 + i, `${token.replace(/_/g, "-")}@example.com`, token)])
) as Record<AppRoleToken, RoleUser>;

export const OWNER = byToken.admin;
export const STAFF = byToken.internal_team;
export const VA = byToken.va;
export const EXECUTIVE = byToken.executive;
export const EXECUTIVE_VA = byToken.executive_va;
export const OPERATOR = byToken.operator;
export const VENDOR = byToken.vendor;
export const INVESTOR = byToken.investor;
export const PARTNER = byToken.partner;
export const CUSTOMER = byToken.customer;
/** Signed in, `app_metadata.role` absent — tier "none". */
export const NO_ROLE = mk(0xf0, "norole@example.com");
/** Signed in with a role token nothing recognises — also tier "none". */
export const UNKNOWN_ROLE = mk(0xf1, "mystery@example.com", "superuser");

const asUser = (u: RoleUser) => u as unknown as User;
const label = (u: RoleUser) => (u.app_metadata.role ? `${u.app_metadata.role} (${getTierForUser(asUser(u))})` : "no role (none)");

/** Every signed-in fixture, labelled "<token> (<tier>)" for it.each titles. */
export const ALL_SIGNED_IN: Array<[string, RoleUser]> = [
  ...APP_ROLE_TOKENS.map((t): [string, RoleUser] => [label(byToken[t]), byToken[t]]),
  [label(NO_ROLE), NO_ROLE],
  ["unknown role (none)", UNKNOWN_ROLE],
];

/** Every tier isStaffUser() accepts. */
export const STAFF_USERS = ALL_SIGNED_IN.filter(([, u]) => isStaffUser(asUser(u)));

/** Every signed-in tier isStaffUser() rejects. */
export const NON_STAFF_USERS = ALL_SIGNED_IN.filter(([, u]) => !isStaffUser(asUser(u)));

/** Every signed-in user who is not the owner (isOwnerUser() false). */
export const NON_OWNER_USERS = ALL_SIGNED_IN.filter(([, u]) => !isOwnerUser(asUser(u)));

/** Every signed-in user who is not a vendor (isVendorUser() false). */
export const NON_VENDOR_USERS = ALL_SIGNED_IN.filter(([, u]) => !isVendorUser(asUser(u)));
