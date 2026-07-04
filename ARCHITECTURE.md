# ARCHITECTURE.md — the real current structure

> Catch-up deliverable · compiled 2026-06-28 · branch `claude/catchup-aixmos-tmmt-5wv942`
> Additive document — describes what is actually in the repo today, not the aspiration.
> Companion docs from this catch-up: `HEALTH.md` (baseline checks), `STATUS.md`
> (work inventory), `PLAN.md` (what to do next).
>
> Where this disagrees with older docs, this file reflects **what the code actually
> does as of this commit**. Older narrative docs (`WHAT-YOU-HAVE.md`,
> `docs/AIXMOS-SYSTEM-INDEX.md`, the `00_START_HERE/` brief) are still the best
> source for *intent* and history.

---

## 0. One-paragraph truth

There is **one running product** — a Next.js 16 + Supabase app under `src/`
that operates the live TMMT vehicle business across eleven brand lines — wrapped
in **a large body of strategy/runbook docs** and **three "workstream" folders
(WS1/WS2/WS3) that are still mostly README + TASKS stubs**. The genuinely shared,
load-bearing spine is small and lives in `shared/`: the **owner-approval gate**,
the **compliance gates**, and the **shared schemas** (which encode the money/ledger
contract). The repo *feels* like six businesses because it is being built to run
six functional divisions — but most of that is documented-and-scaffolded, with the
real implemented code concentrated in the rental OS, the B3 SMS agent, the CAPTAIN
dispatch client, and the licensing/kill-switch.

---

## 1. The six divisions (functional map)

**Note on "six":** there is no single doc in the repo that names exactly six
divisions. The canonical build structure is **3 workstreams + a `shared/` spine**
(`CLAUDE.md`), and the live app exposes **11 business lines**
(`src/lib/business-lines/registry.ts`). Below I group everything that exists into
six functional divisions, because that's the honest shape of the operation and it
maps cleanly to where the money and the code actually are. Each row says what's
**built** vs **stubbed/doc-only**.

| # | Division | What it is | Where it lives | State |
|---|----------|------------|----------------|-------|
| 1 | **Vehicle & Field Services (TMMT OS)** | The live business: 11 brand lines (rentals, express, black, auto, detailing, moving, cleaning, wholesale-cars, luxury, restoration, management), fleet, bookings, dispatch | `src/app/(admin\|command\|...)`, `src/lib/business-lines/registry.ts`, `src/lib/captain-client.ts`, `src/lib/dispatch-types.ts` | **BUILT / live** |
| 2 | **Credit & Funding (Restoration / WS2)** | CROA-gated funding ladder: intake → dispute → tradeline → funding desk. Surfaces publicly as the "Restoration" business line | `workstream-2-credit-funding/*` (stubs), `shared/compliance-gates/`, `docs/CREDIT_FUNDING_OS.md` | **GATED + STUBBED** (legal gates `false`; folders are README-only) |
| 3 | **Operator Network (WS3)** | The $97/mo product: signup/billing, operator portal, commission engine, conduct covenant | `workstream-3-operator-network/*` (stubs), `shared/schemas/types.ts` (Operator/Commission), `src/app/(operator\|learn)` | **PARTIAL** (types + some app routes; WS3 folders README-only) |
| 4 | **AIXMOS Brain & Agent Mesh** | The AI layer: B3 SMS sales agent (+ personas), CAPTAIN dispatch, mission-control push, local-first/verification-mesh model routing, tailnet device sync | `src/lib/agent/*` (~18 files), `src/lib/captain-client.ts`, `src/app/api/agent/*`, `src/app/api/mission/generate`, `docs/AIXMOS-SYSTEM-INDEX.md` | **BUILT** (B3 + CAPTAIN real; mesh/local-first largely doc + scripts) |
| 5 | **Platform & Provisioning (WS1)** | Make the stack installable: one-command provisioning, Fleet Economics dashboard, connectors (Turo/Stripe/QuickBooks/Twilio), multi-tenant licensing + 4-tier kill-switch | `workstream-1-aixmos-core/*` (stubs), `src/app/api/license/*`, `src/app/api/agent/stripe/*`, `src/lib/agent/twilio-send.ts`, `packages/aixmos-core/` | **PARTIAL** (licensing + Stripe webhooks + Twilio send real; Turo/QuickBooks/provisioning not started) |
| 6 | **Go-to-Market / Funnel & Distribution** | Turn strangers into customers/operators and **get paid**: landing pages, `/kits`, `/build`, affiliate, GHL checkout, deal-kit contracts, the Drive "Data Room" | `src/app/(lp\|kits\|build\|partner)`, `AIXMOS/public/*.html`, `docs/deal-kit/`, `docs/affiliates/`, `tools/aixmos-build-page/`, `web/build-page/` | **PARTIAL** (pages exist; several CTAs/checkout links not wired — see §5) |

The 11 brand lines in division 1 are a **registry, not eleven codebases** —
`registry.ts` defines them and the app renders intake/command surfaces from that
config. Adding a line = a config entry, not a fork. "Restoration" (line 10) is the
public face of division 2; "Management" (line 11) is command-center-only.

---

## 2. The stack (concrete)

- **App framework:** Next.js 16 (React 19) — `src/app/` route groups
  `(admin) (auth) (command) (executive) (investor) (learn) (operator) (partner)
  (pocket) (program) (vendor)`, plus `api/`, `forms/`, `kits/`, `build/`, `lp/`, `legal/`.
- **DB / system of record:** Supabase (Postgres, RLS) — `supabase/migrations/`,
  `supabase/functions/`. Airtable base `appcenWUju039rD7b` is the original/parallel
  source of truth (Fleet, Active Customers, Customer Payments, Incoming Leads).
- **Agents:** `src/lib/agent/` (B3 SMS: state-machine, llm-router Sonnet→Haiku,
  compliance/, persona/, twilio-send, guard w/ kill-switch) + `src/lib/captain-client.ts`.
- **Billing/CRM:** Stripe webhooks (`src/app/api/agent/stripe/webhook/`), GoHighLevel
  (`src/app/api/webhooks/ghl/`, `data-ghl-*` CTAs on the static HTML pages).
- **Licensing:** `organization_licenses` + 4-tier kill switch
  (`src/app/api/license/{provision,heartbeat,revoke}`).
- **Local-first AI / mesh:** docs + scripts (`scripts/mesh/`, `scripts/swarm*.sh`,
  `infra/tailscale-acl.jsonc`), Ollama on the tailnet — operational, not in-app code.
- **Shared contract:** `shared/{owner-approval-gate,compliance-gates,schemas,config}`.

---

## 3. Data flow (intake → action → ledger)

```
  Public intake                         AIXMOS brain                 Execution
  ───────────────                       ─────────────                ─────────
  Business-line forms  ┐                ┌ B3 SMS agent ┐             ┌ Twilio SMS
  /forms, /try, intake ┤                │ CAPTAIN rank │             │ Stripe charge
  AIXMOS/public/*.html ┼─► Supabase ───►┤ persona/LLM  ├─► OWNER ───►┤ dispatch unit
  GHL checkout/webhook ┤   + Airtable   │ router       │   APPROVAL  │ funding submit
  Incoming Leads       ┘  (record of    └ mission push ┘   GATE      └ dispute send
                          truth, cases,        ▲           (§4)          │
                          statuses)            │                         ▼
                                               │                   Audit events
                                   COMPLIANCE GATES (§4)           (api/audit/events)
                                   wrap credit/funding/SMS                │
                                   paths; PII stays on NAS,               ▼
                                   never in a cloud LLM context     Ledger / payments
                                                                    (Customer Payments,
                                                                     commissions, license)
```

Key invariants visible in code:
- **Nothing customer-facing or financial executes without passing the owner-approval
  gate** (`shared/owner-approval-gate/approval.ts` → `assertApproved`).
- **Credit/funding/SMS paths are wrapped by compliance gates** that physically
  block while their gate is `false`.
- **PII is meant to land on the NAS tier**, never inside a cloud LLM prompt
  (enforced operationally + by the PII guard CI, not yet by app-layer code).

---

## 4. The spine: ledger · compliance · owner-approval

This is the part that must never regress. Three interlocking layers:

### 4a. Owner-approval gate  (`shared/owner-approval-gate/approval.ts`)
- `GatedAction` with 7 action types: `customer_message`, `dispute_letter`,
  `charge_fee`, `pay_commission`, `submit_funding_app`, `move_money`,
  `production_automation_edit`.
- `assertApproved(action)` throws `ApprovalRequiredError` unless `status === "approved"`.
- `createPendingAction()` makes a PENDING action; **no auto-approve path exists**
  (and the code comment forbids adding one — "a test that bypasses approval is a wrong test").
- ⚠️ **GAP:** persistence (Supabase `gated_actions`), the owner approval queue, and
  the approve/reject endpoint are marked `TODO` — the primitive exists, the wiring
  is partial.
- ⚠️ **GAP:** `CLAUDE.md` says the *real* enforcement is a **PreToolUse hook in
  `.claude/hooks/`** that should "stay installed." **That directory does not exist**
  (only `.claude/commands/` and `.claude/launch.json` are present). The hook is
  documented but not installed in this checkout. Flagged for owner — not auto-fixing.

### 4b. Compliance gates  (`shared/compliance-gates/`)
- `gates.config.json` — 7 gates. All ship `false` **except**
  `cpn_and_rented_tradelines_blocked` which ships `true` and must stay true forever.
- `gate.ts` / `gate.py` — `requireGate()` blocks any gated action while its gate is `false`.
- `sms-gate.ts` (+ `.test.ts`) — SMS/A2P 10DLC compliance gate.
- Content/claims compliance: `scripts/compliance-check.mjs` + `config/credit-compliance.json`
  (part of `verify.checks`), scans `content/consumer-facing`.
- The seven gates and their legal basis (CROA §1679, VA Credit Services Businesses
  Act, TSR advance-fee ban, VA SCC §6.2-2228, federal fraud, Howey/'40 Act, multistate):
  see `gates.config.json` and `CLAUDE.md §3`. **Virginia-only at launch.**

### 4c. Ledger / money-of-record
- **Values layer:** `docs/FINANCIAL-PRIORITY-LEDGER.md` — the priority order
  (God → self/wellbeing → family → others) and entity-separation rule ("never mix"
  personal / family / business books). This is the *governance* ledger.
- **Schema layer:** `shared/schemas/types.ts` — `Commission`
  (triggers: `credit_repair_service`, `funding_funded`, `consulting_delivered`;
  **intentionally NO `operator_recruited` trigger** — recruitment pay = illegal
  pyramid), `FundingDeal`, `DisputeItem`, `Operator` tiers 1–3.
- **Record layer:** Supabase + Airtable Customer Payments (`tblsG1LCDNSeehiLf`),
  Stripe webhooks, GHL checkout, `organization_licenses`, and the audit stream
  (`src/app/api/audit/events`). Money flows **client ↔ creditor/funder directly** —
  the platform never takes custody of client funds.

---

## 5. Notable gaps surfaced while mapping (detail in STATUS.md)

- **WS1/WS2/WS3 folders are README/TASKS-only** — the real shipped code lives in
  `src/`. The workstream dirs are scaffolding + plans, not implementations.
- **Four static funnel pages have unwired CTAs** (the "get paid" leak):
  `AIXMOS/public/index.html` (6 GHL checkout CTAs → `href="#"` / `data-ghl-card`),
  `apply.html` and `operator.html` (forms fall back to sessionStorage demo mode),
  all depending on a **missing `AIXMOS/public/ghl-config.js`**. `thankyou.html` is
  fine. These are the Step-4 "near-done" candidates I'll stage as diffs.
- **Owner-approval persistence + the PreToolUse hook are not wired** (§4a).
- **Connectors:** Turo + QuickBooks not started; Stripe + Twilio partial.
- **Two CI workflows only:** `mission-daily.yml`, `pii-guard.yml`. The build/test
  gate runs via `verify.checks` / `npm run build` locally, not in a CI workflow.

---

## 6. How to verify any change (the gate)

`verify.checks` (fast pre-push): `types` (tsc --noEmit) · `lint` (eslint) ·
`compliance` (compliance-check.mjs) · `secrets` (secret-scan.sh). Full gate:
`npm run build` + `npm run test` (vitest). Readiness/security audit:
`scripts/doctor.sh` → `scripts/swarm-doctor.sh`. CI: PII guard (`ultimatrix.sh scan`)
on every push/PR. **HEALTH.md records the actual current results of all of these.**

---

*This is the map. Read `STATUS.md` for the per-project inventory and `PLAN.md` for
the ordered next steps. The spine in §4 is the line that must stay green.*
