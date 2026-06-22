# Moe Legacy — Agency-SaaS Vertical & 1:1 Portal · Design Spec

**Owner:** X (PROJECT X HAILMARY) · **Date:** 2026-06-21 · **Status:** spec for owner review — NOT built, NOT applied to prod
**Partner:** Moe Legacy (Muhammad Umar) — credit guidance + business funding, going SaaS-agency
**Posture:** fenced, contract-gated, least-privilege. *Clear path for the owner, fenced for everyone else.*

---

## 0. Plain-English goal

Stand up **Moe Legacy as the second vertical** (TMMT Rentals is #1) on the *same* spine we
already run — its own brand, its own login portal, its own operators/affiliates/students — so
Umar can run ads, onboard people on a **Learn → Earn → Churn** path, and grow toward owning his
own agency, **without ever receiving Taha's source, keys, admin, or other tenants' data.**

This is **vertical #2 of a planned 30–50.** Whatever we design here is the **template** every
future vertical reuses. Near-term target: **~10 operators / locations live ASAP.**

> Why this is the protective move: Taha is the systems engineer (SE) on a contract Moe Legacy
> secured. The system must serve that contract like "the best employee Moe ever had" **while the
> IP, the keys, the kill-switch, and the data isolation stay 100% Taha's.** Trust is being
> rebuilt after being burned — so the architecture, not a promise, enforces the boundary.

---

## 1. Trust & IP firewall (non-negotiable — this is the whole point)

| Boundary | Rule |
|---|---|
| **Source code** | Never ships to Umar's device or repo. He gets a **hosted app + browser access only** (thin client). |
| **Secrets / keys** | Zero secrets on any operator/partner device (Operator Portable Kit model). Service-role key lives only on Taha's machines. |
| **Admin** | Umar is `tenant_admin` of **his org only** — never staff, never `is_staff()`. He cannot see TMMT, cannot see other verticals, cannot see other operators outside his org. |
| **Data** | Per-org RLS isolation: every row Moe Legacy touches is scoped to their `org_id`. Cross-tenant read = impossible by policy, not by convention. |
| **Kill-switch** | Owner can suspend Moe Legacy's license/tokens instantly (existing license + `dark` machinery). Reversible, owner-sealed. |
| **Legal gate** | **No IP/app access ships until the B2B agreement (TMMT … LLC → Moe Legacy) is signed** — with the IP-ownership + non-compete carve-out + commission clauses. Drafted in a prior session; **must be signed first.** |
| **Compliance gate** | Credit side is **"credit guidance," never "repair"**; no guaranteed outcomes; CROA/FTC language enforced. See `docs/sops/CREDIT-GUIDANCE-SOP.md`. |

**Everything Umar gets is leased, fenced, and revocable — never owned, never local, never source.**

---

## 2. What already exists (reuse — do NOT rebuild)

Grounded in the current repo:

- **Per-tenant orgs** — `public.organizations` (`name`, `partner_app_slug`, `agent_name`,
  `agent_persona_overlay`, `stripe_connect_account_id`, `twilio_inbound_number`,
  `llm_daily_cap_usd`). Resolver: `src/lib/agent/tenant.ts` (`resolveOrgBySlug`, `…ById`).
- **Org roles + RLS helpers** — `public.org_roles` (`tenant_admin|dispatcher|responder|viewer`),
  `is_org_member()`, `is_org_dispatcher()`, `is_staff()`, `acting_org_id()`
  (`20260530120000_rescue_dispatch_core.sql`, `20260618210000_operator_writes_org_default.sql`).
- **Operator economics** — `operator_profiles` + `provision_operator` RPC (revenue split),
  one-shot `provision-operator.command` (auth user + role + temp password + lead routing).
- **The genie meter (token ledger)** — `tmmt_token_balances` / `tmmt_token_events`, per-org,
  idempotent grant on `member-97`, atomic spend (`src/lib/token-ledger.ts`,
  `20260619010000_tmmt_token_ledger.sql`). Caps engine cost per paying seat.
- **Three-app ecosystem** — `tmmt-ops`, `tmmt-command-center`, `aixmos-landing`
  (`docs/THREE-APP-ECOSYSTEM.md`). Brand routing via `partner_app_slug`.
- **Operator Portable Kit** — thin client, zero secrets on device, `scripts/deploy operator`
  (`docs/superpowers/specs/2026-05-26-operator-portable-kit-design.md`).
- **Pricing** — `docs/OFFER-STACK.md` (BUILD one-time ladder + RUN monthly: seat $97/mo, etc.).

**So "Moe Legacy's 1:1 app" is a configuration + 3 builds, not a new product.**

---

## 3. The three pieces that make Moe Legacy "their own"

### Piece A — Brand + tenant config (their app, their face)
- A Moe Legacy `organizations` row: brand name, `partner_app_slug` (e.g. `moe-legacy`),
  agent persona overlay (credit-guidance voice, CROA-clean), own GHL sub-account, own Stripe
  Connect account, own Twilio number, own `llm_daily_cap_usd`.
- Portal renders Moe Legacy branding (logo/colors/agent name) off the org row — the app is
  *visually and functionally 1:1* with Taha's, scoped to their data.

### Piece B — Logins / portal access (the gateway)
- **Umar = `tenant_admin`** of the Moe Legacy org (his command seat).
- **His operators / affiliates / students = scoped roles** under that org (`dispatcher`/
  `responder`/`viewer`, or a new credit-funding role set).
- Login via the existing auth + middleware gate; provisioning via the existing one-shot,
  generalized from "Isaac/operator" to "any vertical, any role."

### Piece C — Per-operator subaccount isolation (**the one real build item**)
- The `organization_id` RLS layer so **two operators on the same spine never see each other's
  customers/data**, and Moe Legacy never sees TMMT (and vice-versa).
- ⚠️ **GATED:** the watchtower rule says *do not run the `organization_id` RLS migration until
  its phase, with an approved plan.* This spec **is** that plan's design input; the migration
  ships behind owner review + staging, default-deny, idempotent, reversible.

---

## 4. Learn → Earn → Churn (the operator pathway — "system that works smart for them")

Moe Legacy onboards operators/affiliates/students who progress to **their own agency**:

1. **Learn** — student seat ($97/mo): training, scripts, CROA-clean intake, mentorship content;
   metered by the token ledger (caps cost, proves engagement).
2. **Earn** — certified operator: own subaccount, commissioned closes, revenue split via
   `operator_profiles` (`revenue_share_pct`), routed leads.
3. **Churn / graduate** — top operators graduate to **their own vertical/agency** (a new org on
   the same spine) — the same template, recursively. *Not limiting them — giving them a runway.*

Each stage is a **role + token tier + revenue split**, all already modeled. The pathway is
config + the isolation layer, not new infrastructure.

---

## 5. Umar's command-center node (the Surface Pro 4 — "best-ever employee")

- **Carry M5 (Umar's):** thin-client operator seat — browser + Tailscale + bookmarks, **zero
  secrets, fenced** (Operator Portable Kit). Onboard via `scripts/deploy operator`.
- **Surface Pro 4 (the command center):** an always-on display + a **fenced agent** that serves
  Moe Legacy as a full-time employee for the secured contract — drafts, triages, follows up,
  reports — **but reads/writes only Moe Legacy's org data, holds no owner keys, and obeys the
  owner kill-switch.** It is Umar's "best employee," not a copy of HAILMARY.
- **Staged on payment, up to $50K, one step at a time** (see plan). The **TMMT Traptop stays in
  Taha's possession**; the Surface is provisioned only as milestones clear.

---

## 6. Edges handled first (non-negotiable)
- **Default-deny isolation** — unknown org / unscoped row → no access (fails closed).
- **No cross-tenant leak** — RLS proven with a test that asserts Moe Legacy ≠ TMMT visibility.
- **Revocable** — license/token suspend + device de-provision kill access instantly.
- **Idempotent provisioning** — re-running any onboard step is safe.
- **Compliance** — credit-guidance language gate; payments to the *business* account, never
  personal Zelle/CashApp; audit trail on every grant/spend.
- **Contract-before-IP** — the app does not ship until the signed agreement exists.

## 7. v0 scope cuts (honest — deferred, not hidden)
- Start with **Umar (`tenant_admin`) + 1–2 operator seats**, not all 10 at once.
- Reuse TMMT's UI 1:1 (brand-swapped); no bespoke credit-funding screens in v0 beyond the
  CROA-clean intake that already exists.
- Surface Pro agent = read/triage/draft + notify in v0; no autonomous external sends.
- One vertical template; the "30–50 verticals" generalization is proven by Moe Legacy, then documented.

## 8. Ship discipline
Build + test behind the existing gate → **owner reviews** → **owner ships via `scripts/ship`**
(Owner Seal). Agents never deploy. The `organization_id` RLS migration is applied to prod only
on the owner's explicit go, in its phase. Every partner-facing step waits on the **signed
contract**.

---

_Companions: `docs/superpowers/plans/2026-06-21-moe-legacy-agency-saas.md` (rollout),
`docs/HOMELAND-HQ-AND-OPERATOR-SEATS.md`, `docs/THREE-APP-ECOSYSTEM.md`, `docs/OFFER-STACK.md`,
`docs/sops/CREDIT-GUIDANCE-SOP.md`,
`docs/superpowers/specs/2026-05-26-operator-portable-kit-design.md`._
