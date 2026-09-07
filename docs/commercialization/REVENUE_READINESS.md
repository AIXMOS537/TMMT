# REVENUE READINESS BOARD

**What can actually be sold and fulfilled, and what stands in the way.**

Audit date: 2026-09-07 · Companion to `COMMERCIAL_MASTER.md`,
`PRICE_RECONCILIATION.md`, `OWNER_DECISIONS.md`

---

## 0. THE CONSTRAINT THAT APPLIES TO EVERY ROW

Before any individual offering: **fulfilment is manual end-to-end and has never
been run once.**

| Step | State | Evidence |
|---|---|---|
| 1. Visitor reaches `/kits` | ✅ public | `middleware.ts:40` |
| 2. Clicks Buy → GHL checkout | ⚠️ `UNVERIFIED PRODUCTION CONFIGURATION` | env values not inspectable |
| 3. Pays in GHL | ⚠️ unverified — GHL products live outside this repo | — |
| 4. Webhook maps purchase tag → SKU | ⚠️ **returns a string. No queue, no worker.** | `src/lib/ghl/dealer-provision-queue.ts` |
| 5. Login invite issued | ❌ **manual only** (`scripts/invite.mjs` is the sole creator) | `signup_invites` = **0 rows, ever** |
| 6. Customer redeems invite → account | ✅ works | `(auth)/login/actions.ts:42-134` |
| 7. Instance provisioned | ❌ **manual 11-step runbook** | `provision-dealer-instance.mjs`; `handoffs/` never created |
| 8. Package / entitlements granted | ❌ **unwired** — 0 profiles carry `package_id`; "entitlement" appears nowhere in `src/` | DB + grep |

**Consequence for the ratings below.** Nothing is GREEN in the sense of
"self-serve, hands-off". A row is GREEN when it can be **sold and delivered this
week with the manual effort a services business normally expends**. For anything
priced as self-serve software, manual fulfilment is itself the blocker.

**And the commercial ground truth:** the only real revenue ever recorded in this
system is **31 payments totalling $9,510.57 between October 2025 and March 2026**,
all small rental payments. **Largest single payment ever: $577.** Nothing since
March. Zero software/SaaS revenue, ever. There is no demand evidence at any price
point above $577 — which does not mean the higher prices are wrong, but it does
mean they are untested.

---

## 1. THE BOARD

### 🟢 GREEN — sellable and fulfillable now

| Offering | Price | Blocker | Owner decision? | Code? | Config? | Legal? | Effort | Dependencies |
|---|---|---|---|---|---|---|---|---|
| **Implementation / consulting on the encoded SOPs** | quote | none — this is services | no | no | no | standard MSA | — | The 11-step runbook and deal-kit already encode the method |
| **Rentals back-office as a done-for-you build** | $15,000 (Ladder C, 50% deposit) | none technical | D-9 (positioning) | no | no | engagement letter | days | Most operationally proven asset; deposits already encoded in `high-ticket.ts:88-95` |
| **876 leads → Khan Strategies referral** | TBD | **the rate** | 🔴 **D-3** | no | no | referral agreement | hours once D-3 lands | `partner_referrals` built with consent capture + lifecycle; `commission_cents` null |

> Three rows. All three are **services or a one-off build** — the modes where
> manual fulfilment is expected and priced in.

---

### 🟡 YELLOW — sellable after specific non-code business/config work

| Offering | Price | Blocker | Owner decision? | Code? | Config? | Legal? | Effort | Dependencies |
|---|---|---|---|---|---|---|---|---|
| **Ops Kit** | $997 + $297/mo | GHL product + checkout URL; **the `NEXT_PUBLIC_` prefix defect**; monthly var undocumented | 🔴 **D-6** | no | **yes** | no | ~half a day | D-1, D-6 |
| **Command Kit** | $2,997 + $497/mo | same | 🔴 D-6 | no | yes | no | same | D-1, D-6 |
| **Dealer Bundle** | $3,497 + $697/mo | same | 🔴 D-6 | no | yes | no | same | D-1, D-6 |
| **`/build` rungs** ($3,750 / $7,500 / $15,000 / $25,000) | as listed | checkout URLs; **`$15K` and `$25K` mean two different things** across ladders | 🔴 D-1, D-6 | no | yes | no | ~half a day | D-1 |
| **Full Ecosystem $50,000** | $50,000 | consult-only by design — no checkout needed | D-1 | no | no | contract | — | **D-5** (contract values), D-4 |
| **Vertical builds via Ladder C** | $7,500–$25,000 | which ladder governs | 🔴 D-1 | no | yes | engagement letter | days | D-1, D-5 |

> The common blocker is **not code**. It is D-1 (which price list) and D-6 (create
> the GHL products, with the prefix fixed).

---

### 🟠 ORANGE — requires limited implementation

| Offering | Price | Blocker | Owner decision? | Code? | Config? | Legal? | Effort | Dependencies |
|---|---|---|---|---|---|---|---|---|
| **Operator seat $97/mo** | $97/mo | **two prices live publicly**; manual invite issuance; no automatic entitlement grant | 🔴 **D-2** | **yes** (small: 2 strings + invite-on-purchase) | yes | no | 1–3 days | D-2, D-6, §0 step 5 |
| **Entitlement enforcement** | enabler | 53 entitlements + 94 mappings modelled; **"entitlement" appears nowhere in `src/`** | D-11 | **yes** | no | no | 1–2 weeks | D-1, D-11 |
| **`packages` billing interval** | enabler | migration drafted, deliberately **not applied** | D-11 | yes (migration) | no | no | hours | D-1 |
| **`/try` funnel** | $97 | **quotes a subscription, lands on a one-time purchase** | D-12 | yes (1 link) | no | no | minutes | D-12 |
| **Sovereign install** | $50,000 + $97/agent/mo | partner-deploy **dormant since June, never run end to end**; claims exceed implementation (see RED note) | 🟠 **D-10** | yes | yes | contract | 1–2 weeks + a dry run | D-5, D-10 |
| **Dispatch** | unpriced | **zero operational history** — `incidents` = 0 rows ever; ~1,482 lines total | 🟡 **D-8** | some | no | no | 1–2 weeks to productize | D-8 |
| **GHL Voice AI ("Bella")** | unpriced | 401 lines handler + 327 lines tests + idempotent provisioner; **no SKU** | D-1 | no | yes (per GHL location) | A2P | days | **Best attach to the Kit SKUs**, not standalone |
| **Commission / revenue-split engine** | enabler | schema complete (`revenue_splits`: gross/platform/operator/partner/agency + pct/tier/segment), **0 rows, no logic** | 🔴 **D-4** | **yes** | no | contract | 2–3 weeks | **D-4 blocks this entirely** |
| **44 designed Airtable automations** | billable delivery | specified in the Agent Spine audit, never deployed | no | yes | yes | no | ~1 day each | Completes the Airtable exit |

---

### 🔴 RED — material functionality, security or compliance gap

| Offering | Blocker | Owner decision? | Code? | Config? | Legal? | Effort | Dependencies |
|---|---|---|---|---|---|---|---|
| **Credit vertical as a done-for-you service** | **All seven legal gates CLOSED** except the permanent CPN prohibition. No attorney-approved CROA suite, no VDACS registration, no surety bond. | no — **external** | no | no | **🔴 yes** | months | VA attorney → VDACS → bond. `workstream-2/TASKS.md` lists the gate-flip checklist |
| **Any outbound SMS campaign** | **DNC checked nowhere in code**, despite `do_not_contact_numbers` existing in production. A2P/CROA vertical gate is orphaned. | 🔴 **D-15** | **yes** | no | statutory exposure | days | **Do not run outbound until DNC is wired** |
| **"Every payout is owner-approved"** as a stated control | Gate is a stub with **zero importers**; its enforcement test **passes vacuously**; `requireGate()` also has zero callers; `GO.command:74-75` reports green on **file existence** | 🔴 **D-14** | yes | no | claim exposure | 1–2 weeks | ⭐ **Mitigator: no code in the repo moves money** — unenforced *and* unexercised |
| **`PUT /api/cube/application`** | Service-role, **RLS-bypassing** write to a credit/funding application (DOB, income, `client_consent_given`), reachable by any holder of a mailed deep-link token, **no approval check, no CROA gate** | — | **yes** | no | **PII + CROA** | days | Worst currently-reachable path found in this audit |
| **Enterprise security claims for sovereign licensing** | "HMAC" is **plain unsalted SHA-256**; "Secure Enclave attestation" **stores a key it never verifies**; "license JWT" is an **opaque digest** (code's own comment: *"full Ed25519 signing happens once vault is wired"*); heartbeat authenticates on two non-secret client-supplied values; **kill switch is advisory** | 🟠 D-10 | yes | no | claim exposure | 2–4 weeks | Sell the real capability; do not claim attestation |
| **$297 operator seat as advertised** | `token-ledger.ts:30-45` can grant **only 500 tokens**, and only on tag `member-97`. **Nothing can deliver the advertised 2,000.** | 🔴 **D-2** | yes | no | offer you cannot honour | days | D-2 |
| **`AIXMOS/public/operator.html`** | Advertises **50/50 partnership / 10% referral** with a **live application form**, corroborated by no agreement and referenced by no code. **Deployment status undeterminable from the repo.** | 🔴 D-4, D-12 | — | **verify in Vercel** | contract exposure | minutes to check | If deployed, you are publishing terms nothing backs |

---

## 2. REVENUE BLOCKED BY DECISIONS, NOT SOFTWARE

The prior audit claimed six of the top ten actions need no engineering. **Verified —
it is seven of seventeen decisions**, and they gate more revenue than the code does.

| # | Blocker | Decision | Engineering required? | Unblocks |
|---|---|---|---|---|
| 1 | **No authoritative price book** | D-1 | **None** | Every quote, every contract, D-6, D-11 |
| 2 | **No referral rate** | D-3 | **None** | 876 leads — the only immediately monetizable asset |
| 3 | **No rev-share / royalty rate** | D-4 | **None** | **Every signable instrument.** `{{REV_SHARE_PCT}}` = `[TBD]`; `{{ROYALTY}}` never filled |
| 4 | **Contract policy values unset** | D-5 | **None** (some need counsel) | Papering any deal |
| 5 | **GHL products not created** | D-6 | **None** — config only | First dollar through checkout |
| 6 | **`dist/` disposition** | D-7 | **None** | Hygiene; risk already reduced |
| 7 | **Founding-operator terms name a fenced party** | D-13 | **None** | Fence compliance |

**Two caveats on "no engineering":**

- **D-6 is config, but it has a code-adjacent trap.** The runbook tells you to set
  eight checkout variables **without the `NEXT_PUBLIC_` prefix the code requires**.
  Follow it literally and every kit checkout silently falls back to the generic
  campaign site — with no error anywhere. Fix the runbook first.
- **D-2 is a decision but needs two string changes** to stop the contradiction being
  publicly visible.

**Engineering should not be used to avoid these.** Building more product while
D-1 and D-4 are open produces more things you cannot quote or paper.

---

## 3. WHAT IS ACTUALLY ENFORCED (so nothing is over-claimed)

| Control | Status | Evidence |
|---|---|---|
| RLS on every table | ✅ **165/165 enabled, zero exceptions**, 344 policies | live DB |
| Tenant scoping | ✅ 96 of 165 tables carry `org_id` | live DB |
| SMS opt-out | ✅ enforced | `compliance/opt-out.ts` → `process-inbound.ts:47` |
| SMS quiet hours | ✅ enforced (`:195` nulls the body) | code |
| Twilio signature verification | ✅ fail-closed | code |
| CFPB disclaimers | ✅ enforced in the agent | `src/lib/agent` |
| Banned-phrase regeneration | ✅ enforced in the agent | `src/lib/agent` |
| Per-org LLM daily spend cap | ✅ enforced from the audit log | `src/lib/agent` |
| Legal gates (CROA/VDACS/bond) | ⚠️ **config correct, `requireGate()` has zero callers** | `shared/compliance-gates/gate.ts:40` |
| A2P / CROA SMS vertical gate | ❌ **orphaned — unreachable in production** | `twilio-send.ts` has one importer: its own test |
| DNC | ❌ **checked nowhere** | zero code references |
| Owner-approval gate | ❌ **stub, zero importers, test passes vacuously** | `shared/owner-approval-gate/approval.ts` |
| Automated snapshots (Pulse) | ⚠️ **Disabled**, ~24h stale | scheduled task state |
| Backups | ❌ **`AIXMOS Flashdrive Backup` result 1, no next run** | scheduled task state |
| Dependabot | ⚠️ 2 open, **both MEDIUM**, zero high/critical | authenticated `gh` |

---

## 4. THE SEQUENCE THAT MOVES THE FIRST DOLLAR

Ordered by dependency, not by size.

1. **D-1** — name the authoritative price list. *(decision, minutes)*
2. **D-3** — agree the Khan Strategies rate. *(call)* → **start working the 876
   leads the same day.** This is the only revenue that needs no checkout at all.
3. **D-6** — create the GHL products for the winning ladder, **with the
   `NEXT_PUBLIC_` prefix**, and confirm the three monthly vars. *(config, half a day)*
4. **D-2** — fix the two strings so one seat price is public. *(minutes)*
5. **Verify** in the Vercel dashboard which checkout vars are actually set, and
   whether `AIXMOS/public` is deployed. *(minutes — resolves two `UNVERIFIED` rows)*
6. **D-4 + D-5** — set rev-share and the contract policy values. *(decision + counsel)*
7. **D-15** — wire the DNC check before any outbound. *(days)*
8. Then, and only then, engineering: entitlements, billing interval, commission
   engine.

**Steps 1–5 contain no engineering and gate more revenue than steps 7–8.**
