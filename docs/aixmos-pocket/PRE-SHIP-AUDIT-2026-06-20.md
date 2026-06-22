# AIXMOS Pocket + Lead Pool — Pre-Ship Safety Audit & Smoke Test

**Date:** 2026-06-20 · **Scope:** everything built this session (AIXMOS Pocket, the
TMMT-token metering integration, referrals, and the lead-pool/sub-account Phase 1).
**Posture:** protect X (PROJECT X HAILMARY), the owners, and the family/friends in the
network — financially, legally, and in their data. Nothing ships to prod here; this is
the inspection before the owner ships.

## Verdict

✅ **Safe to ship on the owner's go.** Build green, **160/160 unit tests pass**, lint
clean on all touched files, secret scan clean, no client bundle can reach a secret, and
every harm-vector found below was fixed and (where logic) covered by a test.

## Harm-vectors found & fixed (this audit)

| # | Risk (who it hurts) | Fix | Proof |
|---|---|---|---|
| 1 | **Lead-pool RLS leak** — a child operator could read **sibling operators' claimed leads** (one operator's book exposed to another). Hurts the operators/family. | RLS rewritten: a child sees only `available` agency leads + its **own** claims; the agency main account sees its whole pool; staff bypass. | `lead_pool_read` policy in `supabase/migrations/20260619030000_lead_pool_subaccounts.sql` |
| 2 | **Operators locked out of their own Pocket** — middleware restricts `operator` tier to `/operator*`, so `/api/pocket/chat` would 302 instead of answering. Hurts operators. | `/api/pocket/` allowed for every signed-in tier (the API does its own auth + metering). | `middleware.ts` `pathAllowedForTier` |
| 3 | **Referral self-dealing** — a buyer could put their own code on their own purchase and pay themselves. Hurts X's margin. | A code can never earn on its **own owner's** purchase (`self_referral`). | `recordCollectedReferral` + tests in `referrals.test.ts` |
| 4 | **Referral double-pay** (from prior pass) — null `payment_ref` let webhook retries pay twice. Hurts X's margin. | Synthesized stable dedupe key; never NULL. | `referralDedupeKey` + tests |
| 5 | **Token spend+refund churn** when the brain is unconfigured — spurious ledger events. Audit-trail hygiene. | Fail with 503 **before** spending if `POCKET_BRAIN_URL` unset. | `/api/pocket/chat` pre-check |

## What was verified safe (checklist)

**Secrets & client/server boundary**
- ✅ No `"use client"` component imports `supabase-service`, `pocket-brain`,
  `createServiceRoleClient`, `SERVICE_ROLE`, `token-ledger`, or `lead-pool`.
- ✅ `server-only` guard on `supabase-service.ts` and `pocket-brain.ts`.
- ✅ `scripts/secret-scan.sh` → current tree clean.
- ✅ **Zero Anthropic at runtime** — only comments stating "NOT Anthropic." The product
  runs on the owner's self-hosted brain; members pay in **TMMT tokens**.

**Money safety (protect X's margin)**
- ✅ Token spend is **atomic** (`tmmt_token_spend`, conditional UPDATE) — no oversend, no
  negative balance, no race.
- ✅ Token grant is **idempotent** (dedupe on payment ref) — no double top-up on retries.
- ✅ Brain failure **refunds** the token (unless unlimited).
- ✅ Referrals: single-tier, **collected-sales-only**, no guaranteed income, idempotent,
  self-dealing blocked, clawback on refund, summary **net of clawbacks**.
- ✅ "Everyone pays": a sub-account is its own org with its own balance; only the owner
  carries `unlimited`.

**Legal / compliance (protect the LLC + the people)**
- ✅ Compliance guard on **every** AI reply: "credit guidance" never "repair"; strips
  "guarantee"/"100%"/"erase negative items"; blocks to a safe fallback; logs violations.
- ✅ Charter boundary held: public surfaces only ever show **AIXMOS** + the agencies;
  **HAILMARY and the owner's AIXMOS network are never exposed or sold.**
- ✅ The Compass (protect-first, companion-not-clinician) is present in Pocket.

**Data isolation (protect everyone's data)**
- ✅ Lead-pool RLS fences operators to available + own (fix #1).
- ✅ Referral RLS: a member reads only their own code + earnings; writes service-role only.
- ✅ Lead-pool/route functions are SECURITY DEFINER, **service-role only**; server
  actions authorize the user before calling.
- ✅ Org read extended to self/parent/children only — **siblings are not exposed.**

**Abuse / input**
- ✅ `/api/pocket/chat`: zod-validated input, auth required, per-member rate limit
  (20/min), token-metered. No SSRF (brain URL is owner env, not user input).
- ✅ GHL webhook is secret-gated (`x-ghl-webhook-secret`), fail-closed.
- ✅ All DB writes parameterized via RPC / Supabase client — no SQL injection.

## Smoke test results

| Gate | Result |
|---|---|
| `npm run build` | ✅ Compiled successfully |
| `npx vitest run` (full) | ✅ **160 passed / 160** |
| ESLint (touched files) | ✅ 0 errors |
| `scripts/secret-scan.sh` | ✅ clean |
| Migration `$fn$` balance | ✅ 5 functions, 10 delimiters |

## Owner-side items before/at ship (only you can)

1. **Apply migrations on your go** (additive, safe): `20260619020000_pocket_referrals`,
   `20260619030000_lead_pool_subaccounts`. (Token ledger `20260619010000` too if not yet.)
2. **Set `POCKET_BRAIN_URL`/`_MODEL`** to a reachable self-hosted endpoint.
3. **Seed `lead_routes`** with the real MOE LEGACY / TMMT RENTALS org IDs.
4. Confirm `profiles.organization_id` stays **owner/service-role-controlled** (the
   lead-pool RLS trusts it as the operator's identity — members must not be able to
   self-edit their org). Verify the existing profiles write policy before enabling
   operator sub-accounts in prod.

## Residual notes (not blocking, tracked)

- Lead-pool **claim/assign UI** and **capture→pool wiring** are Phase 2–3 (not built yet);
  the schema + lib + atomic claim are in and tested.
- A live end-to-end smoke (real Supabase + real brain) can only run with prod env on the
  owner's machine; the build + unit gauntlet is the pre-ship gate here.
