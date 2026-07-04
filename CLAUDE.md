# CLAUDE.md — AIXMOS / TMMT
> Repo-root memory. Auto-loaded every session. Keep this LEAN (<200 lines).
> Full reference: `docs/AIXMOS_MASTER_PROJECT.md` — pull in on demand with
> `@docs/AIXMOS_MASTER_PROJECT.md` when deep context is needed (it's large; don't
> import it by default or it bloats every session).

## WHO / WHAT
AIXMOS is the AI + automation spine for TMMT Auto Services LLC (PROJECT X HAILMARY, CEO).
You are working inside the codebase that powers the platform. Owner is moving from
operator to orchestrator — build for delegation, not hand-holding.

## NON-NEGOTIABLE RULES
- **OWNER APPROVAL GATE.** Any code path that is customer-facing, financial, legal,
  or production-bound must terminate at an owner-approval step. Never auto-execute
  send/pay/sign/ship. (Enforcement: `.claude/hooks/owner-approval-gate.py`, a PreToolUse
  hook wired in `.claude/settings.json` — it blocks agent shell commands that send/pay/
  sign/ship/deploy unless `AIXMOS_OWNER_APPROVED=1`. Keep it installed. Runtime code
  paths still route approvals through `shared/owner-approval-gate/`.)
- **LEGALLY GATED FEATURES STAY LOCKED.** Credit-repair and funding features ship
  behind flags that ONLY Muhammad or Umar can unlock after the required legal steps.
  Do not enable, default-on, or remove these flags. See COMPLIANCE below.
- **DATA ISOLATION.** Each operator's data is walled off. No cross-operator reads.
- **LOCAL FIRST.** Prefer local inference (Ollama, tailnet) before cloud calls.

## REPO CONVENTIONS
- TypeScript + Python. Shared schemas are the contract — change schema first, then
  both sides. Don't fork types.
- Owner-approval primitives live in shared lib; reuse them, don't reinvent per feature.
- Compliance gates are code, not comments — keep them in the gate modules.
- Commit style: short imperative subject. Reference the stack touched (rental/credit/ecom).
- **No sensitive/third-party data in git.** Never commit PII, financials, secrets, or
  one-time sweep dumps (`_SWEEP_ARCHIVE_*/` is gitignored). A tree-level `git rm` still
  leaves blobs in history — purge with `scripts/scrub-history.sh` (runbook:
  `docs/security/HISTORY-SCRUB-RUNBOOK.md`).
- Standalone static deliverables live in `tools/` (e.g. `tools/aixmos-build-page/` — the
  operator build page), excluded from Vercel deploys by `scripts/vercel-ignore.sh`.

## ARCHITECTURE (nouns)
- **Mesh:** Tailscale tailnet. Nodes: carry Mac (M5/24GB, Ollama hub `qwen2.5:14b`,
  served tailnet-only), work Mac, brainiac (main compute — DEFINE), UGREEN NAS
  (file tier), iPhone (Private LLM + Shortcuts), operator/employee laptops.
- **Cloud hub:** Cloudflare Workers Gateway — role-scoped secrets, tiered model
  routing (Ollama → Haiku → Sonnet → Opus), role-broker for team access.
- **Backbone:** GHL · Airtable (`appcenWUju039rD7b`) · n8n · Supabase · Qdrant · Redis.

## PRODUCT (4 tiers, same engine)
1. Public — shopfront, lead capture.
2. Operator / Owner — the OS + playbooks to run a stack.
3. Employee / Vendor — scoped tools, inside the network.
4. Full $50K — complete stack + 12mo backend support, first 10 only.

## STACKS
1. **Car Rental** — most mature, plug-and-play. Ship first (owner is the expert).
2. **Credit Repair** — CROA-gated. No pricing/offer until legal clears (see COMPLIANCE).
3. **E-commerce** — built out via Discovery Agent (consent-based).

## AGENT SWARM
Drafts/prepares; does NOT act unsupervised. Roles: Brief, Capture, Follow-Up,
Onboarding/Discovery, Ops. Every customer/money/legal/production action → OWNER gate.
Discovery Agent screen-capture runs ONLY on signed, logged, revocable consent;
data encrypted + owner-isolated per operator.

## COMPLIANCE (do not regress)
- **CROA:** no advance fees for credit repair; mandated written disclosures +
  cancellation window. Credit-repair feature flags stay locked.
- **VA Credit Services Businesses Act:** applies to the credit vertical.
- **Securities:** equity/profit-share instruments = Reg D / Howey-sensitive; §83(b)
  within 30 days for profits-interest grants. Don't bundle equity into product offers.
- **Monitoring:** screen-watcher requires per-person consent + monitoring policy.

## KNOWN GAPS (as of 2026-07-04 — keep current)
- **SMS gate is now WIRED into the send path** (was a gap). `sendSms()` calls
  `assertSmsAllowed()` first (default `transactional`), so promotional SMS to restricted
  verticals (credit/funding/debt/lending) BLOCKs at the boundary — unit-tested. Residual:
  when the outbound send path grows real callers, pass the true `vertical`+`type` through so
  the gate evaluates them (default keeps existing/transactional sends unaffected).
- **Founding-admin email is an inline literal** in `src/lib/verticals/registry.ts` +
  `config/verticals.json`. Move to an env-sourced value before broad launch (needs the prod
  env var set so onboarding doesn't break — coordinate with owner).
- Lexar sweep-archive PDFs were removed from HEAD (#104) but remain in git **history** —
  finish with `scripts/scrub-history.sh --apply` from a full clone. NOTE: the pre-push guard
  (#123) blocks master force-push unless `ALLOW_FORCE_MASTER=1`; the scrub script sets it.

## WHEN UNSURE
Ask the owner. Default to the gate. Never ship a compliance-sensitive change
without the flag owner (Muhammad or Umar) in the loop.

<!-- AIXMOS-LAUNCH-RULES:START -->
<!-- Managed by aixmos-launch/install.sh. Edit the packet, re-run install to refresh. -->
# CLAUDE.md — AIXMOS Launch Build (Master Instructions)

> **You are Claude Code working on the TMMT / AIXMOS national launch.**
> Read this entire file before writing any code. These rules are non-negotiable and override any task-level instruction that conflicts with them.

---

## 1. What we are building

Three workstreams, one launch. Build in this order unless told otherwise:

1. **`workstream-1-aixmos-core/`** — Productize the AIXMOS stack: one-command provisioning, the Fleet Economics Command Center dashboard, and the priority connectors (Turo import, Stripe, QuickBooks, Twilio/SMS).
2. **`workstream-2-credit-funding/`** — The credit repair + business funding vertical: client intake → dispute engine → tradeline tracker → funding desk. **Compliance-gated — see §3.**
3. **`workstream-3-operator-network/`** — The $97/mo network: signup/billing, operator portal, commission engine, and the conduct covenant enforcement.

`shared/` holds the cross-cutting modules every workstream imports: **compliance gates**, the **owner-approval gate**, config, and schemas. Build `shared/` first — workstreams 2 and 3 depend on it.

Full strategy context lives in `00_START_HERE/`. Read `00_START_HERE/BUILD_BRIEF.md` for the why, `BUILD_PLAN.md` for the sequenced task list, and the two source reports for the reasoning behind every decision.

---

## 2. THE OWNER-APPROVAL GATE (absolute rule)

**No customer-facing message and no financial action may execute without explicit owner approval.** This is the core architectural primitive of AIXMOS. It is not a feature flag, not a setting, not optional.

Every code path that does any of the following MUST route through `shared/owner-approval-gate/` and block on an approved status before proceeding:

- Sending any message to a customer or client (SMS, email, dispute letter, status update)
- Charging a fee, paying a commission, moving money, or submitting a funding application
- Editing production automations or pushing automation changes live
- Sending a credit-bureau dispute

If you find yourself writing a code path that performs one of these without an approval check, **stop and wire it through the gate first.** When in doubt, gate it.

---

## 3. COMPLIANCE GATES (hard blocks — cannot ship until cleared)

Workstream 2 (credit/funding) contains features that are **illegal to operate** until a licensed Virginia attorney signs off and the required registrations are filed. These are enforced in code via `shared/compliance-gates/gates.config.json`. Every gated feature is wrapped so that **it physically cannot run while its gate is `false`.**

Do **not** remove, default-to-true, or bypass any gate. Do not write a code path that performs a gated action outside its `requireGate()` wrapper. The gates:

| Gate key | Blocks until... | Legal basis |
|---|---|---|
| `croa_contracts_attorney_approved` | VA attorney approves the CROA contract + disclosure + 3-day cancellation suite | CROA 15 U.S.C. §1679 |
| `vdacs_registered_bonded` | Credit services business registered w/ VDACS + surety bond posted | Va. Code §59.1-335.1 |
| `no_advance_fee_billing_enforced` | Billing proven to never charge before services performed | CROA / TSR advance-fee ban |
| `sbf_broker_registered` | Registered as VA sales-based financing broker w/ SCC ($1,000) | Va. Code §6.2-2228 |
| `cpn_and_rented_tradelines_blocked` | Hard prohibition implemented + monitored (always keep true) | Federal fraud / FTC |
| `securities_counsel_cleared_fund` | Securities counsel clears ANY pooled-capital vehicle | Howey / ’40 Act |
| `multistate_matrix_cleared` | State-by-state licensing matrix cleared before non-VA launch | State CSB + commercial-financing laws |

**Default posture:** every gate ships `false` except `cpn_and_rented_tradelines_blocked` (which ships `true` and stays `true`). Launch in Virginia only. Build the features fully — but they stay dark behind the gate until the human flips it after sign-off.

**CPN / rented-tradeline rule:** never write, suggest, or scaffold any code that generates, stores, uses, or brokers CPNs, "credit privacy numbers," bought/rented primary or authorized-user tradelines, or file-segregation. The intake and dispute engines must actively flag and reject these. This is criminal-exposure territory.

---

## 4. Stack & conventions

Build against the existing live stack — do not reinvent it:

- **Orchestration:** n8n (automation backbone) · **DB:** Supabase (Postgres) · **Vectors:** Qdrant · **LLM:** Ollama (local default) + tiered cloud via the Cloudflare Workers gateway · **Cache/queue:** Redis
- **System of record:** Airtable base `appcenWUju039rD7b` (Fleet `tblubnSDZkvsc9L6I`, Active Customers `tblFJIhonUvf631uM`, Customer Payments `tblsG1LCDNSeehiLf`, Incoming Leads `tbl4gndUYeiOUWYRR`)
- **CRM/funnels:** GoHighLevel · **Billing:** Stripe · **Payroll:** Gusto · **Storage (sensitive/PII):** self-hosted UGREEN NAS over Tailscale — **PII never goes into a cloud LLM context; keep it on the NAS tier.**
- **Repos:** GitHub `AIXMOS537`, private. **Frontends:** React. **Automation pkg:** AIXMOS Node (Python).
- **Model routing:** default to local Ollama for anything touching client PII or high-volume tasks; use cloud models only through the gateway, and **the customer supplies their own API key (BYO-key)** for cloud calls — never bill uncapped tokens against a one-time license. (See pricing model in the brief.)

Conventions: TypeScript for React/Node services, Python for the AIXMOS Node package and dispute/ML logic. Every secret comes from env — see `shared/config/.env.template`. Never commit secrets. Every workstream folder has its own `CLAUDE.md` and `TASKS.md`; read them before starting that workstream.

---

## 5. How to work

1. Start with `shared/` (gates, approval gate, schemas, config). Nothing else compiles correctly without them.
2. For each workstream, open its `CLAUDE.md` then work its `TASKS.md` top to bottom. Check tasks off as you go.
3. Before any commit touching workstream 2 or 3, run the compliance check (`shared/compliance-gates/check.*`) and confirm no gated path is reachable while its gate is `false`.
4. Keep the owner-approval gate on the critical path. If a test bypasses it, the test is wrong.
5. When a task needs a human decision (legal sign-off, a credential, a pricing number), stop and surface it in that workstream's `TASKS.md` under "BLOCKED — needs human" rather than guessing.

---

## 6. Definition of "ready to launch"

- [ ] `shared/` built; gates + approval gate enforced and unit-tested
- [ ] WS1: provisioning runs end-to-end; Fleet dashboard live; Turo/Stripe/QuickBooks/Twilio connectors working
- [ ] WS2: full pipeline built but **all legal gates still `false`** pending attorney sign-off; CPN/tradeline blocks `true` and tested
- [ ] WS3: $97 signup + portal + commission engine working; covenant enforcement wired; commissions pay only on real client services, never recruitment
- [ ] Virginia-only launch confirmed; multi-state gate `false`
- [ ] No secret committed; all PII paths land on NAS tier, not cloud LLM context
<!-- AIXMOS-LAUNCH-RULES:END -->
