# FIRST BOUNDED ENGINEERING TASK — re-evaluated after the drift lanes (lane R3, 2026-09-22 UTC)

**Question:** the checkpoint (§11) recommended **TMMT-SEC-002** (GHL tags/events never create "Paid" payments) as the first collision-free task, scoped to `ghl-payment-sync.ts` + the two downstream calls in the webhook route. Does that still hold against current master `7ded46d4`, the C3/C4 branches, GHL M7 at `f17e8f69`, the rental branch, and the PM-00 owner cards?

**Answer:** **Yes for the library half, no for the route half.** Recommend **TMMT-SEC-002-LIB** (a lib-only slice of TMMT-SEC-002). Nothing is executed by this recommendation.

## 1. What changed since the checkpoint's recommendation (verified by read-only git in `C:\dev\TMMT-LIVE`, 2026-09-22)

| Fact | Evidence |
|---|---|
| `src/lib/ghl-payment-sync.ts` on `origin/master` last changed **2026-08-22** (`8e4a5d7f`); **no branch since 2026-09-15 touches it** (`git log --all --since=2026-09-15 -- src/lib/ghl-payment-sync.ts` → empty); diff vs master is **empty** on `feat/ghl-router-m7`, `origin/feat/credit-c3-security-foundation`, `origin/sec/c3-auth-orgroles`, `feat/c4-provisioning-preview`, `origin/claude/airtable-exit-fleet-os-kywbbl`, `origin/feat/inspection-walkaround`, `origin/feat/ghl-quiet-integration-detector` | this lane |
| `src/app/api/webhooks/ghl/route.ts` is **rewritten by M7** (`git diff --stat origin/master...feat/ghl-router-m7` → `270 ++-----…`, the route is now 26 lines delegating to `handleGlobalGhlWebhook`); the payment/token/referral logic moved to **`src/lib/ghl-webhooks/app-processors.ts:26-28` (imports) and `:126-160`** and still calls `recordGhlPayment`, `grantMonthlyTokensForPayment`, `recordCollectedReferral` with the **same guards** as master (`route.ts:136-137,146,173`) | this lane |
| M7 also rewrites `src/lib/ghl/handlers/form.ts` (+20) and `src/lib/agent/voice/ghl-voice-handler.ts` (+184/−?) — the files SEC-007 and SEC-003 would touch | this lane; R1 DELTA 5 |
| M7 does **not** touch `src/lib/ghl/client.ts`, `token-ledger.ts`, `referrals.ts`, `overdue/route.ts`, `stage-rules.ts`, `sync-outbound.ts`, `sync-contact-portal-fields.ts`, `aixmos-prequal-act.ts` | this lane |
| On master, the referral commission is guarded by `paymentResult.collected` (`route.ts:173`); on M7 identically (`app-processors.ts:147`). The token grant fires on the **tag alone** (`route.ts:146`; `app-processors.ts:135`) | this lane |
| Existing tests: `src/lib/ghl-payment-sync.test.ts` (pure helpers only; `isCollectedPayment`, `shouldRecordPayment`, refs), `src/app/api/webhooks/ghl/route.test.ts` (mocks `recordGhlPayment`), `token-ledger.test.ts`, `referrals.test.ts` | this lane |
| `webhooks/ghl/route.ts` is **GHL-owned** (M6 "every GHL webhook route goes through the inbox"; M7 integration branch) — per INDEX §3 the GHL owner reviews any change; editing it now guarantees a conflict at the M7 landing | INDEX §3; R1 |

## 2. Alternatives considered (and why not first)

| Candidate | Verdict | Why |
|---|---|---|
| **TMMT-SEC-002 as written** (lib + route) | **NO** | the route half collides with M7's rewrite; the route file is GHL-owned; the same logic now lives in `app-processors.ts` on the M7 branch, so a master-only edit would be undone or conflict at landing |
| **TMMT-SEC-001** (open redirect) | **NO** | fully implemented on PR #261 (`safe-redirect.ts` / `safeRelativePath`, 49 tests, CI green) — assigning it duplicates work; use its acceptance list as the #261 review checklist |
| **"GHL outbound kill switch" contract task** (one choke point in `client.ts`, default OFF; R2 §17.4 option 1) | **NOT FIRST** | the right *second* item, but it is a **contract** (prompt §44) whose default semantics and env name are the owner's decision (card D §2) and whose surface (`client.ts`) is GHL-adjacent → GHL owner co-signs; Vercel env presence UNKNOWN. Write the contract after card D, then implement |
| **Land `620e100e`** (TMMT-SEC-008) | **PARALLEL, not "the" task** | owned by the partner-acq session (its completion record names `claude:101528f1-…`, i.e. the orchestration session); needs the owner's rename-vs-VERSION_MAP choice (53 vs 54), a push (no remote ref exists), a PR, and a landing order against 58/59 (GHL) and #251 — a coordination/landing item under owner gate, not a bounded engineering task; it touches the guaranteed-conflict constant |
| **TMMT-SEC-003 lib-only** (`outbound-write-guard.ts` + test, no call-site wiring) | **NOT FIRST** | needs the `ghl_contacts` phone column confirmed from the prod catalog (owner read) before it can resolve a phone; two of six call sites (voice) are rewritten by M7; M8 will absorb the gateway. A guard with no callers changes no behaviour — low value until wiring is safe |
| **TMMT-SEC-007 one-line precedence fix** | **NO (as a separate PR)** | `handlers/form.ts` is edited by M7 (+20); the GHL owner should apply the precedence fix on the M7 branch. The `ghl-auto-ops.test.ts` regression half can ride along with any PM-00 PR |
| **TMMT-SEC-004 / SEC-005** | **NO (yet)** | owner decisions first (cards B, C) |
| **TMMT-BUILD-004** | **NO** | already on five PRs |
| **TMMT-AI-002** | **NO** | stale — the folders were deleted by #259 |
| **Anything on the rental branch** | **NO** | UNIQUE AND RELEVANT — MANUAL REVIEW; owner/authorization UNKNOWN; do not build on it |

## 3. RECOMMENDED: TMMT-SEC-002-LIB — "GHL-sourced payment rows are never `Paid` and never `collected`" (library slice of TMMT-SEC-002)

**PM milestone:** PM-00 Security containment, item 00-f · **Defects:** SEC-05, KD-05, SPEC §21.2 V2 (fully) and V2b-commission (fully); V2b-token **explicitly not** contained here (see §3.7) · **Spec refs:** SPEC §11.2, §21.2, §20.3 SEC-05, §28 KD-05; SoR §5.2 "GHL never sets business state".

### 3.1 Scope (what changes)
In `src/lib/ghl-payment-sync.ts` only:
- `recordGhlPayment` writes `payment_status: "Pending"` **unconditionally** (today `:261` = `amount > 0 && collected ? "Paid" : "Pending"`).
- `recordGhlPayment` returns `collected: false` **unconditionally** and adds `verified: false` to its result (today `:290` returns the computed `collected`). Because master `route.ts:173` and M7 `app-processors.ts:147` both guard `recordCollectedReferral` on `paymentResult.collected`, this alone stops the referral commission on **both** the current route and the M7 processor without touching either file.
- `isCollectedPayment` stays exported and unchanged (its tests pin it; it may still describe "money-sounding" events), but its result no longer decides the status. Add a doc comment: "GHL is not a payment processor; verification of collection is PM-06's job (processor proof), never a GHL claim."
- The balance row (`:275-288`, already `Pending`) is untouched, including the `amount_past_due` insert (KD-17 → PM-02; do not revive or fix here).
- Dedupe (`notes ILIKE '%[ref:…]%'`) untouched; **notes text unchanged** in this PR (a wording change risks the dedupe substring; SEC-002's "mark as unverified" goes into the returned `verified:false`, not the notes).

### 3.2 Owned files
- `src/lib/ghl-payment-sync.ts`
- `src/lib/ghl-payment-sync.test.ts` (extend)

### 3.3 Prohibited files (STOP if the smallest correct change needs any of these)
`src/app/api/webhooks/ghl/**` (GHL-owned; M7 rewrite) · `src/lib/ghl-webhooks/**` (M7) · `src/lib/token-ledger.ts` · `src/lib/referrals.ts` · `src/lib/ghl/**` (`client.ts`, handlers) · `src/middleware.ts` · anything under `supabase/` · `src/lib/db/migration-drift.test.ts` · any credit, 2A, C3/C4, rental-branch or GHL M-track file · `.github/workflows/**`.

### 3.4 Dependencies
- **None technical.** No schema change, no env, no prod read needed (the `customer_payments` insert shape is unchanged except the status literal).
- **Coordination:** send the GHL owner the §3.7 integration note before the PR opens (they own the token-grant call site on M7). Not a blocker to opening the PR.
- **Owner:** authorization to start this one task (prompt §39/§60); merge = deploy → owner + prod baton. **Does not wait on cards A–E.**

### 3.5 Collision analysis (verified)
- File untouched on every active branch and PR (§1). The M7 branch imports the function unchanged → the fix **survives the M7 landing** and applies to the inbox path automatically.
- No open PR (#232, #243, #251, #256–#261) touches the file. The rental branch, `wt-c4`, quiet-detector: no.
- `KNOWN_UNAPPLIED` untouched (no migration).
- Production behaviour change at deploy: only **future** GHL-sourced payment rows (0 exist today: `notes ILIKE '[GHL]%'` = 0) become `Pending`; no data migration; no GHL call.

### 3.6 Acceptance criteria (testable)
1. Fixture `member-97` tag + `amount: 97` → exactly one `customer_payments` insert with `payment_status = 'Pending'`; result `collected:false`, `verified:false` (**fails pre-fix**: `Paid`, `collected:true`).
2. Fixture `event: "order.completed"` + amount → `Pending`, `collected:false` (**fails pre-fix**).
3. Tag-only fixture (no amount) → `Pending`, `collected:false` (unchanged status; `collected` now false — regression + one changed assertion).
4. High-ticket tag (`balance > 0`) → deposit row `Pending` **and** balance row `Pending`, `amount_past_due: 0` untouched (regression).
5. Non-revenue event → `shouldRecordPayment` false → **no insert** (regression, negative).
6. Insert error → `recorded:false`, reason surfaced, no second insert (regression, negative).
7. Duplicate `[ref:…]` already present → `recorded:false, reason:"duplicate"` path unchanged (regression, negative).
8. `isCollectedPayment` tests unchanged and green.
9. Full gate (`npm run verify` equivalent: vitest + lint + tsc + build) passes; no other file changes.

### 3.7 Tests
- `src/lib/ghl-payment-sync.test.ts` — new `describe("recordGhlPayment never records Paid from a GHL claim")` using a minimal fake Supabase client (capture `.from("customer_payments").insert(payload)`; existing fake-supabase pattern in the repo may be reused if it is not the credit one): `payment event with amount records Pending` (red pre-fix), `revenue tag with amount records Pending` (red pre-fix), `result.collected is always false` (red pre-fix), `tag-only stays Pending`, `balance row stays Pending`, `non-revenue event inserts nothing` (negative), `insert error surfaces and does not retry` (negative), `duplicate ref is not re-inserted` (negative).
- **Integration note for the GHL owner (not in this PR):** on M7 `app-processors.ts:135`, `grantMonthlyTokensForPayment(svc, { email, tags, paymentRef })` still fires on a grant tag regardless of collection; SEC-002's expected behaviour ("never called from the GHL webhook path") should be applied there (or gated on a processor-verified payment in PM-06). A red test for it belongs beside `app-processors.ts` on the M7 branch. Until then V2b-token stays **OPEN (latent)** and is recorded as such in the delta.

### 3.8 STOP boundary
One PR, one file + its test. Stop and report if: the change needs an edit outside §3.2; a caller relies on `collected:true` for anything other than the referral guard (grep showed none on master or M7; re-verify at start); the fake client needs the credit track's fixtures; or the full gate fails for a reason outside these two files. No middleware, no webhook route, no M7 file, no migration, no prod write, no GHL call, no env change.

### 3.9 What it waits on
- **Owner authorization** of this one bounded task (the checkpoint STOP, prompt §60).
- **Owner + baton** for the merge (merge = deploy).
- **Not** on cards A–E; **not** on M7, C3/C4, the rental branch, or the partner-acq landing.

### 3.10 Suggested parallel items (not engineering tasks; owner-gated)
- The orchestration/partner-acq session pushes `sec/partner-acquisition-rls` and opens a PR after the owner picks **rename (53)** vs **VERSION_MAP (54)** (TMMT-SEC-008 corrected).
- The GHL owner reviews #261's Part 1 against SEC-001's acceptance list, and applies SEC-007's precedence fix on the M7 branch.
- After card D: write the **GHL outbound kill-switch contract** (one flag, default OFF, inside `client.ts`; adversarial test = 0 fetches to `services.leadconnectorhq.com` across all 7 paths) as the second bounded task.

**STOP.** Recommendation only. Nothing was implemented.
