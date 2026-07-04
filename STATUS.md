# STATUS.md — year-to-date work inventory

> Catch-up deliverable · STEP 3 · 2026-06-28 · branch `claude/catchup-aixmos-tmmt-5wv942`
> Every project/workstream, its state, what remains, the single next action, a rough
> effort, and a ⏰ flag if time-sensitive. **Sorted: closest-to-done + non-gated at top;
> gated / needs-you at the bottom.** States: DONE · NEAR-DONE · IN-PROGRESS · BLOCKED · GATED.

Legend — effort: **S** ≤½ day · **M** 1–3 days · **L** 1–2 weeks · **XL** >2 weeks.

---

## A. Shipped & green (the running product)

| # | Project | State | What remains | Next action | Eff | ⏰ |
|---|---------|-------|--------------|-------------|-----|----|
| 1 | **TMMT OS rental app** (11 business lines, admin pages, public intake forms, dashboard KPIs, CSV export) | **DONE / live** | Nothing to build; maintenance only | Keep build green; monitor | — | |
| 2 | **B3 SMS sales agent** (state machine, Sonnet→Haiku router, compliance suite, personas, kill-switch) | **DONE (code)** | Not sending until Twilio 10DLC + Anthropic key + owner-approval persistence (see #12, F-block) | Leave off; owner wires Twilio/key | — | ⏰ |
| 3 | **CAPTAIN dispatch client** (unit ranking) | **DONE** | — | — | — | |
| 4 | **Mission Control daily push** (`/api/mission/generate`, `mission-daily.yml` cron) | **DONE** | Needs Telegram/token env to actually fire | Owner sets env | S | |
| 5 | **Licensing + 4-tier kill switch** (`/api/license/*`) | **DONE** | — | — | — | |
| 6 | **Token ledger / lead pool / referrals / revenue / GHL payment sync** | **DONE** (all unit-tested) | — | — | — | |
| 7 | **Shared spine — compliance gates + schemas** (`shared/`) | **DONE** | Gates correctly ship `false`; CPN block `true` | Do not touch without owner | — | |

## B. Near-done — safe/config work, non-gated (do next)

| # | Project | State | What remains | Next action | Eff | ⏰ |
|---|---------|-------|--------------|-------------|-----|----|
| 8 | **Lint baseline** | **DONE this session** | Was 1 error; now 0 (48 advisory warnings) | ✅ fixed + committed | — | |
| 9 | **AIXMOS funnel pages** (`AIXMOS/public/{index,apply,operator,thankyou}.html`) | **NEAR-DONE** | Code is fully wired; only the **real GHL checkout URLs** are missing (still `YOUR_GHL_*`). `thankyou.html` complete. | **Owner:** paste 4 GHL links into `ghl-config.js` (or set `NEXT_PUBLIC_GHL_*`). Optional UX patch staged → `catchup/staged-diffs/01-ghl-cta-fallback.patch` | S | ⏰ |
| 10 | **In-app money collection** (`/kits`, `/build`, `/lp/[org]/[sku]`, `/api/webhooks/ghl`) | **NEAR-DONE** | GHL deposit products + `NEXT_PUBLIC_GHL_CHECKOUT_*` env in Vercel; point GHL automation at webhook; $1 test | **Owner:** create GHL products + env; then $1 end-to-end test | M | ⏰ |
| 11 | **48 lint warnings** (`react-hooks/set-state-in-effect`, etc.) | IN-PROGRESS | Advisory only; don't fail CI | Optional cleanup, low priority | M | |

## C. Built-but-partial platform (WS1 — division 5)

| # | Project | State | What remains | Next action | Eff | ⏰ |
|---|---------|-------|--------------|-------------|-----|----|
| 12 | **Connectors — Stripe** | IN-PROGRESS | Webhooks exist; read-only revenue/utilization connector for dashboard not built | Spec the read path | M | |
| 13 | **Connectors — Twilio/SMS** | IN-PROGRESS | Send + inbound + compliance done; **blocked on 10DLC registration** | Owner starts 10DLC (REPORT-ONLY) | M | ⏰ |
| 14 | **Connectors — Turo import** | BLOCKED | Import method/cadence unknown (WS1 "needs human") | Owner confirms Turo export source | M | |
| 15 | **Connectors — QuickBooks** | Not started | Cost/expense read for fleet economics | Design after Turo | M | |
| 16 | **Fleet Economics dashboard** (WS1) | Not started (stub) | React dashboard reading Airtable `appcenWUju039rD7b` | Scaffold from spec | L | |
| 17 | **One-command provisioning** (WS1) | Not started (stub) | Installer for NAS+Tailscale+n8n+Supabase+Qdrant+Ollama+Redis | Scaffold installer | XL | |

## D. Operator network (WS3 — division 3)

| # | Project | State | What remains | Next action | Eff | ⏰ |
|---|---------|-------|--------------|-------------|-----|----|
| 18 | **$97/mo signup + platform-license SKU** | BLOCKED (stub; schema exists) | Stripe subscription + one-time SKU; no-advance-fee enforcement on any credit path | Owner sets final license price → then build | L | |
| 19 | **Operator portal** (referral links, training, tiers) | Not started (stub) | Tier 1/2/3 portal | Build after signup | L | |
| 20 | **Commission engine** | Not started (stub) | Pay only on real client services; **reject recruitment triggers** (schema already omits them) | Build against `Commission` type | L | |
| 21 | **Operator covenant + conduct flags** | BLOCKED | Covenant acceptance + enforcement ladder | **Owner:** covenant legal review (joint-employer/anti-discrimination) | M | |

## E. GATED — credit & funding (WS2 — division 2). Legal gates ship `false`; do not enable.

| # | Project | State | Blocking gate | Owner action | Eff |
|---|---------|-------|---------------|--------------|-----|
| 22 | **Intake (CROA contract + disclosure + 3-day cancel)** | GATED | `croa_contracts_attorney_approved` + `vdacs_registered_bonded` | VA attorney sign-off; VDACS reg + surety bond | L |
| 23 | **Dispute engine** (Ollama drafts, 30-day clock) | GATED | `croa_contracts_attorney_approved` | Same as #22; every letter → owner gate | L |
| 24 | **Funding desk** (cards/LOC/SBA/equipment launchable; MCA/RBF gated) | GATED (partial-launchable) | `sbf_broker_registered` (MCA/RBF only) | SCC broker reg only if doing MCA/RBF | L |
| 25 | **Tradeline tracker** (net-30, PAYDEX; legit AU only) | GATED | (behind intake) | After #22 | M |
| 26 | **Billing no-advance-fee proof** | GATED | `no_advance_fee_billing_enforced` | Prove + unit-test monthly-after-service | M |
| 27 | **Community capital (CDFI/SSBCI referral)** | GATED | `securities_counsel_cleared_fund` stays `false` (no pooled fund by design) | Referral-only; no fund | M |
| 28 | **Any non-VA launch** | GATED | `multistate_matrix_cleared` | Per-state legal review | XL |

## F. Needs-you / owner-only (security, ops, live surfaces)

| # | Item | State | Next action | ⏰ |
|---|------|-------|-------------|----|
| 29 | **Owner-approval persistence + PreToolUse hook** — primitive exists; Supabase table, approve/reject endpoint, and the `.claude/hooks/` hook (referenced by CLAUDE.md but **not present**) are missing | BLOCKED (needs decision) | Decide persistence + reinstall the enforcement hook | ⏰ |
| 30 | **Repo security** — branch protection on `master`, 2FA, Secret Scanning + Push Protection | Needs-you | GitHub UI (owner) | ⏰ |
| 31 | **Supabase P1** — `REVOKE EXECUTE` on ~20 anon-callable `SECURITY DEFINER` functions | Needs-you | Run before onboarding real tenants | ⏰ |
| 32 | **Broken GHL $203 dunning workflow** | Needs-you | Pause it (live surface) | ⏰ |
| 33 | **`management@tmmtrentals.net` bounce** | Needs-you | Fix or drop the address | |
| 34 | **Operation Overdrive (medical courier dispatch)** | GATED (doc-only) | Courier/dispatch licensing — leave for owner/Umar | |
| 35 | **Content compliance disclosures** — 13 missing-disclosure warnings in `content/consumer-facing/*` | REPORT-ONLY | CROA copy — owner + Umar edit | |
| 36 | **secret-scan false positive** — 1 env-reference hit (`process.env`) trips the generic regex | Low priority | Allowlist tweak (not a real leak) | |

---

## Rollup

- **Done & green:** the whole rental OS, the agent layer (B3/CAPTAIN), licensing, ledger,
  and the shared spine. This is a real, working platform.
- **Closest to money (non-gated):** #9 + #10 — paste real GHL links / create GHL products →
  first dollar. Everything technical is in place.
- **Biggest not-started, non-gated builds:** WS1 provisioning (#17) and fleet dashboard (#16),
  WS3 signup/portal/commissions (#18–20).
- **Everything credit/funding (WS2, #22–28) stays dark** behind `false` legal gates until
  attorney + registrations clear. Correct and by design — don't touch.

*Ordered next-steps and the top-3 priorities are in `PLAN.md`.*
