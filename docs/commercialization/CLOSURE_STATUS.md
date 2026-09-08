# CLOSURE STATUS

**What is finished, what is waiting on you, and what is deliberately not being done.**

Pass date: 2026-09-08 · Verified against `origin/master` = `5d5d8d2e`

> **This document is NOT commercial authority.** It records verified technical and
> process state. Commercial authority still does not exist — see
> `OWNER_DECISIONS.md` → THE AUTHORITY RULE.

---

## VERIFIED STATE

| Fact | Value |
|---|---|
| `origin/master` | `5d5d8d2e` |
| Working tree | clean (one untracked file of unknown authorship, left alone) |
| Worktrees | `C:/dev/TMMT-LIVE` (this), `C:/dev/TMMT-docs-wt` (`docs/owner-model`), `C:/dev/TMMT-s3-wt` (`feat/bg-check-decide-7arg`) |
| Open PRs | **#191** `feat/bg-check-decide-7arg` — OPEN, MERGEABLE, `pii-scan` SUCCESS |
| **Production deployment (Vercel)** | **`f152f3c5`** — `dpl_CbGuH9H2axgkmpDNAfpnW5ho4a5X`, state READY, target production, rollback candidate |
| Production branch | `master` |
| Commercialization docs | 8 on master (this makes 9) |
| Decisions recorded | 20 · 44 `PENDING` values in the sync plan |
| `COMMERCIAL_AUTHORITY.md` | **absent — correct** |

⚠️ **Every production-target deployment after `f152f3c5` is CANCELED** — including
`6a2b5aff`, `49d67b42`, `94d78863`, `97a78d69`, `1c25f1cd`, `5d5d8d2e`. Those are
all documentation commits, so nothing functional is missing from production, but
**master is ahead of what is actually deployed.** Do not infer deployment from a
git merge.

---

## CLOSED BEFORE THIS PASS — do not reopen

| Item | Evidence |
|---|---|
| Migration reconciliation | PR **#190** merged as `4854833d` — ancestor of master, confirmed |
| Tenant regression | PR **#188** merged as `f152f3c5` — ancestor of master, confirmed; also the live production deployment |
| Broad commercial inventory | `COMMERCIAL_MASTER.md` |
| Revenue census | 31 payments / $9,510.57 / max $577 / Oct 2025–Mar 2026 / none since — re-verified |
| Security-claim correction | `CLAIMS_AUDIT.md` |
| Pricing contradiction discovery | `PRICE_RECONCILIATION.md` — 16 conflicts, 7 meanings of $50,000, 5 rev-share schemes |
| CUBE route correction | Authorized via timing-safe token or session; **not** an unauthenticated RLS bypass |

---

## FINISHED THIS PASS

Most of the remaining engineering was **already done by sibling sessions**. The
correct action was to verify and not duplicate it.

| Item | Outcome |
|---|---|
| **§6 `bg_check_decide` 7-arg adoption** | **DONE by sibling** — PR #191, commit `0338cc48`. Verified: all 7 named args, dedupe key `bgcheck:<id>:<decision>:<yyyymmddhhmm>` UTC, returns the RPC jsonb incl. `decision_event_id`. **Not duplicated.** |
| **§7 S3-06 staff decision screen** | **DONE by sibling** — PR #191, commit `e34158f4`. Queue → decide → trail via `v_decision_trail` in the review modal. Reason picker deliberately not built (nothing to show until S3-05 is seeded). **Not duplicated.** |
| **§8 S3-05 final verification** | **Complete — and the ask is smaller than recorded.** See below. |
| **§20 Vercel** | **Resolved first-hand** via the authorized Vercel API (`list_deployments` on `prj_Cw4lJPww…`), not inferred from git. Production = `f152f3c5`, `dpl_CbGuH9H2axgkmpDNAfpnW5ho4a5X`, READY, `isRollbackCandidate: true`. |
| **§21 stale org label** | `preview/rename-moe-legacy-to-aixmos-credit` is **NOT merged** (11 behind / 15 ahead). Recorded; no action taken. |
| **§22 `dist/` mechanics** | **Determined.** See below. |
| **§9/§12/§13 Customer #2** | `CUSTOMER_2_READINESS.md` exists untracked, **authorship unknown** (the PR #191 session confirms it is not theirs). Its two P0 claims **verified by me against the live DB**: P0-1 confirmed, P0-2 mis-stated. See below. |
| **§24 this document** | Written. |

### §8 — S3-05 is a smaller ask than previously recorded

`public.reason_codes` **exists** (migration `20260907035109_s3_03_decision_contract.sql`)
and is **empty — 0 rows**. But `public.reason_categories` **already has 8 seeded
rows**, each with `recoverable` and `customer_msg` already decided:

| Category | Recoverable | Customer-visible |
|---|---|---|
| `DOCUMENT_ADMIN` — document / administrative deficiency | yes | yes |
| `MANUAL_REVIEW` — requires a human decision | yes | yes |
| `CREDIT_FINANCIAL` — credit / financial remediation | yes | yes |
| `TEMPORARY_PROGRAM` — program prerequisite not yet met | yes | yes |
| `RISK_POLICY` — declined under business policy | no | yes |
| `DNC_DNR` — do-not-contact / do-not-rent | no | no |
| `FRAUD_SECURITY` — confirmed misrepresentation | no | no |
| `OTHER` — owner-approved, fits nothing above | yes | no |

**So you are not inventing a taxonomy — you are filling 8 named buckets.** For
each code the schema wants: `code`, `category`, `label`, `description`,
`remediable_by`, `default_requal_days`, `policy_ref`. `decision_events` is also
empty (0 rows), so nothing depends on a code yet.

**`S3-05 = OWNER DECISION.` Search closed. No codes invented.**

### §22 — `dist/` mechanics determined (this does not decide D-6)

| Question | Answer |
|---|---|
| What creates it? | **Nothing.** No `dist` target in `package.json`; no generator anywhere. |
| Does regeneration work? | **No — it cannot be regenerated.** |
| Do source inputs exist? | No. `operator-runtime.tar.gz` has no source. |
| Is the ignore behavior wrong? | **Yes.** Tracked 2026-06-18/21, gitignored 2026-06-22 by an unrelated hygiene commit. Git never retroactively untracks, so `.gitignore:111` is inert. |
| Is it deployment-critical? | **Yes — three consumers.** `FLEET-UP.sh:110-113` copies it and **`exit 1`s if missing**; `scripts/booyah.sh:22` chmods `dist/*.command`; `scripts/ceo.sh:71` references `dist/onboard.command` and `dist/SEND-TO-JUSTIN.md`. |

**Evidence supports "keep tracked."** Not untracked — D-6 is yours.

---

## OWNER DECISIONS — 10 open

Full evidence in `OWNER_DECISIONS.md`; one-page form in `OWNER_ACTION_SHEET.md`.
**Default if you do not answer: NO CHANGE / HOLD.**

| # | Decision | Default if unanswered |
|---|---|---|
| **D-1** | Which price list is authoritative? | HOLD — three ladders stay live |
| **D-2** | Operator seat $97 or $297? | HOLD — **both stay publicly visible** |
| **D-3** | Khan Strategies referral rate | HOLD — 876 leads stay unworked |
| **D-4** | Rev-share / royalty / affiliate | HOLD — **no contract is signable** |
| **D-5** | Which GHL products to create | HOLD — checkout stays unverified |
| **D-6** | `dist/` disposition | HOLD — stays tracked (evidence supports this) |
| **D-7** | Founder / fenced-party terms | HOLD |
| **D-8** | Agent production authority | **OWNER GATE STAYS** |
| **D-9** | S3-05 reason codes | HOLD — `Not Eligible` accepts free text, `rule_version = pre-taxonomy` |
| **D-20** | Vehicle structure | **HOLD — no quote may name a vehicle** |

---

## CUSTOMER #2 — **BLOCKED, but by less than first recorded**

> **Attribution correction.** An earlier version of this document credited
> `CUSTOMER_2_READINESS.md` to the PR #191 session. **That was wrong** — they
> confirm they neither wrote nor read it. The file is **untracked and of unknown
> authorship**. Its claims are therefore unattributed, so I verified the two P0
> items myself against the live database rather than repeat them.

### P0-1 — **CONFIRMED** (verified first-hand, 2026-09-08)

`customer_payments` and `background_checks` both **carry an `org_id` column**, but
their only policy for `authenticated` is:

```
customer_payments_admin_only   ALL   authenticated   is_platform_admin()
background_checks_admin_only   ALL   authenticated   is_platform_admin()
```

`is_platform_admin()` is `profiles.role = 'admin'` with **no org scoping at all**.
So a Customer #2 tenant user cannot read their own payments or background checks —
the `org_id` column exists and no policy uses it. **Real blocker.**

### P0-2 — **MIS-STATED. The org-scoped role path already exists.**

The claim was "no role grants own-org access without cross-tenant reach." That is
not what the database shows:

| Primitive | Org-scoped? | Policies using it |
|---|---|---|
| `is_org_member(p_org_id)` — checks `org_roles`, or `profiles.organization_id` | **Yes** | **126** |
| `is_staff()` — role/portal_role only | No — global | 185 |
| `is_platform_admin()` — `role = 'admin'` | No — global | 34 |

**The org-scoped pattern is the dominant one**, with `org_roles (org_id, user_id,
role)` as its grant table. The real hazard is narrower and sharper than "no role
exists":

> **`profiles.role = 'admin'` is read as *platform admin* by `is_platform_admin()`
> and simultaneously as *org membership* by `is_org_member()`.** Granting a
> Customer #2 administrator that way would make them a platform admin across all
> nine organizations.

**Safe onboarding rule, derived from the evidence:** grant Customer #2 users
through **`org_roles`**, never by setting `profiles.role = 'admin'`.

### What this changes

Customer #2 is still **BLOCKED**, but on **one small, well-defined migration**
(move two tables from the `is_platform_admin()` pattern onto the existing
`is_org_member(org_id)` pattern that 126 other policies already use) **plus a
documented onboarding rule** — not on absent architecture.

**That migration is not written and not applied.** It is a production change and
therefore owner-gated.

P1 items from the unattributed document (hardcoded customer-facing branding; first
real exercise of scoped access) are **unverified by me** and should be treated as
leads, not findings.

**Manual fulfilment is not the blocker and should not be treated as one.**

---

## SELF-SERVE SaaS — **DEFERRED** (deliberately)

Separate from managed readiness. Evidence: `signup_invites` = 0 rows ever;
`profile_entitlement_grants` = 0; no provisioning worker (the GHL purchase webhook
maps a tag to a SKU and returns a **string**); entitlements unwired — the word
appears nowhere in `src/`.

Deferred until managed-customer evidence exists: automated signup · automated
entitlement grants · provisioning worker · self-service billing · generalized
subscription engine.

**Do not build the vending machine before validating demand.**

---

## PRODUCTION ACTIONS PREPARED BUT NOT EXECUTED

| Action | Status |
|---|---|
| Merge PR #191 | Prepared by sibling, MERGEABLE, checks green. **Not merged by me.** |
| Seed `public.reason_codes` | Blocked on D-9. Schema and 8 categories documented above. |
| Add `billing_interval` / `pricing_model` to `packages` | Drafted, **not applied** (D-11). |
| Create GHL products + set `NEXT_PUBLIC_` checkout vars | Owner-only (D-5). |
| Amend `CONTROL-PLANE-OPERATING-SCRIPT.md` §3 | Wording drafted, **not applied** (D-8). |
| Fix the runbook's 8 missing `NEXT_PUBLIC_` prefixes | Blocked on D-5 scope. |

**No production write, no migration, no deploy, no price change, no contract edit,
no GHL product, no lead contacted, no SMS sent occurred in this pass.**

---

## TECHNICAL DEBT THAT DOES NOT BLOCK REVENUE

Recorded so future passes stop reopening it.

- **2 Dependabot alerts, both MEDIUM**, transitive, not reachable from a request path.
- **`GO.command:74-75`** reports green on file existence (D-14).
- **`.gitignore:111`** inert bare `dist/` (D-6).
- **Dead rev-share code** — `client-journey/types.ts:36-41`, zero importers (D-4).
- **`preview/rename-moe-legacy-to-aixmos-credit`** unmerged, 15 ahead.
- **Branch `main`** is divergent (537 behind / 105 ahead) and carries a real,
  unmerged SMS-inbound security fix (`8dfb6b7c`: replay rejection + opt-out).
  **It adds no DNC check** — so D-15's DNC gap is unchanged.
- **`TMMT-Autopilot-Pulse` disabled**; `AIXMOS Flashdrive Backup` failing (D-16).

---

## GENUINE BLOCKERS THAT ARE NOT OWNER DECISIONS

1. **Customer #2 P0-1 and P0-2** — tenant-scoped read paths and a safe own-org role.
2. **DNC is enforced nowhere** — `do_not_contact_numbers` has zero references in
   `src`. Blocks any outbound campaign, not the first managed sale.

---

## SINGLE NEXT ACTION

**Answer D-1 in `OWNER_ACTION_SHEET.md` — which price list is authoritative.**

Six of the other nine unlock behind it, and it is the one decision that cannot be
derived from any evidence in this repository.
