# AIXMOS MASTER PROJECT
> Full reference doc — pull in on demand with `@docs/AIXMOS_MASTER_PROJECT.md`.
> Do NOT import by default — it is large and will bloat every session.
> Lean summary lives in `CLAUDE.md`. Operating rules live in `AIXMOS_OPERATING_LAYER.md`.
>
> Version: 1.0 — 2026-06-22 | Owner: Muhammad Taha (PROJECT X HAILMARY)

---

## 1. WHAT THIS IS

AIXMOS is the AI + automation spine for TMMT Auto Services LLC. It is not one app — it is a layered operating system that runs across devices, clouds, and partner organizations.

**The factory metaphor:** every new business vertical should go live by changing config and data, not by writing new code or doing a manual env setup. Current score: ~3/10 config-driven. Target: 10/10.

**The product ladder (4 tiers, same engine):**

| Tier | What they get | Price point |
|------|--------------|-------------|
| Public | Shopfront, lead capture, $97 AIXMOS program | $97/mo |
| Operator / Owner | AIXMOS OS + playbooks to run a stack | $15K–$100K |
| Employee / Vendor | Scoped tools inside the network | Internal |
| Full Stack | Complete platform + 12mo backend support | $50K (first 10 only) |

---

## 2. CODEBASE MAP

### This Repo — TMMT OS
`~/projects/TMMT` — Next.js 16, React 19, Supabase, Stripe, Twilio, GHL. ~97 app routes.

**Three Vercel apps from one repo:**
- `tmmt-ops` — internal ops dashboard
- `tmmt-command-center` — command center / admin
- `aixmos-landing` — public landing + $97 funnel

**Key paths:**
```
src/lib/agent/compliance/     — banned-word detection
src/lib/agent/tenant.ts       — org-scoped routing
shared/owner-approval-gate/   — the universal approval primitive
src/app/lp/[org]/[sku]/       — org-aware landing pages (aixmos, moe_legacy, tmmt_property)
scripts/partner-deploy/       — USB provisioning + kill-switch
/api/license/provision|heartbeat|revoke — license server
/learn/*  /work/program        — operator training routes
/forms/credit-funding-intake   — Phase 9 intake (credit-funding, RLS-locked)
/legal/*                       — compliance disclosure tree
```

### Supporting Repos
```
~/Projects/aixmos-gateway/    — Cloudflare Workers gateway (routing + token metering)
~/Projects/AIXMOS-AGENTS/     — agent squad (CHUMMO, MOOSE, VISION, TANK, STICKS…)
~/Projects/ai-command-center/ — command center config (assistants, runbooks, memory)
~/Projects/aixmos-gateway/    — Cloudflare Workers gateway
~/AIXMOS-COMMAND/             — operational docs, Moe Legacy kit, knowledge base
```

---

## 3. DATABASE (Supabase — prod: uapxakmlwnpfsftfeezx)

**Critical tables:**
```
organizations          — 3 seeded tenants: AIXMOS, Moe Legacy, TMMT Rentals
organization_licenses  — partner license state (active/suspended/revoked)
partner_tenants        — white-label tenant config
partner_licenses       — hardware kill-switch state
partner_referrals      — cross-entity referral ledger (idempotency key per row)
incoming_leads         — org-scoped leads (organization_id FK)
credit_funding_sessions — Phase 9 credit intake (RLS-locked, never public)
token_ledger           — TMMT token balances (500 tokens/mo per $97 member)
feature_flags          — gated flag registry (see AIXMOS_OPERATING_LAYER.md §8)
operator_profiles      — operator level, certified_at gate
operator_training_progress — training module completion (currently empty — #1 gap)
v_operator_360         — eval view across operator progress, revenue, profile
```

**Migration rule:** never replay local `supabase/migrations/` files blindly.
Always run `list_migrations` first to check prod state. Local ≠ prod.

**RLS note:** "always-true" RLS on public-facing forms (lead capture, $97 signup) is intentional — those forms must be writable by anonymous visitors. Do NOT lock them down.

---

## 4. AGENT SWARM

All agents draft and prepare. None act unsupervised. Every customer/money/legal/production action → owner-approval gate.

| Agent | Role | Dispatch when |
|-------|------|---------------|
| CHUMMO | People, intake, messages, client tone, relationship repair | Angry client, new lead, message draft |
| MOOSE | Execution, fulfillment, follow-up, backend ops | "Get it done" tasks, ClickUp creation |
| VISION | Quality control, risk, standards, second opinion | Before any customer-facing send |
| TANK | Infrastructure, devices, Docker, NAS, networking | System issues, deploy, infra changes |
| STICKS | Data, Supabase, records, structured scans | DB queries, ledger checks |
| JARVIS | Admin, calendar, documents, organization | Executive assistant work |

Best-fit squad only — do not call every agent for every task.

---

## 5. PRODUCT STACKS

### 5.1 Car Rental (most mature)
Plug-and-play. Ship first. Owner is the expert.
- Fleet management: `public.fleet` (47 columns)
- Dispatch: `/dispatch/*` routes
- Inspection: pre + post flows
- LTO pipeline: `lto_agreements` table

### 5.2 Credit Repair (CROA-gated)
No pricing, no offer, no execution until legal clears.
Routing inquiries to Moe Legacy is allowed — see `AIXMOS_OPERATING_LAYER.md §5`.
Flag: `CREDIT_MODULE` — Muhammad or Umar only.

### 5.3 E-commerce
Built out via Discovery Agent (consent-based, screen-monitoring requires signed consent per person).

---

## 6. OPERATOR PROGRAM

**Funnel:** provision → work-locked laptop → 15-module training → certify (`certified_at` gate) → unlock tools.

**Commission schedule (v1.0):**
- Margin-based comp; operators receive ≤ 1/3 of margin; owner keeps ≥ 50%.
- Tiers: 30% / 35% / 40% on $97 product depending on volume.
- Credit repair: 10% to operator; Moe Legacy paid as COGS.

**Current gap:** `operator_training_progress` table is empty — the 15-module program is not yet being driven. This is the #1 operator-program gap.

---

## 7. PARTNER PROGRAM — MOE LEGACY

Moe Legacy is the exclusive credit/funding brand. TMMT is exclusive transportation + Academy. AIXMOS is the engine only.

**What Moe gets:**
- Lean deploy (no credit module, no engine source, no admin keys).
- Local Brain (Ollama + Open WebUI) on his Surface Pro 4 (Arizona office).
- GHL white-label tenant with `RESELLER_ORG_KEY=moe_legacy` + `CREDIT_MODULE=false`.
- License server heartbeat — kill-switch on our side.

**What stays gated:**
- `MOE-RESELLER-KIT-DEPLOY/` — full reseller kit requires Master Partner Agreement signed + counsel cleared.
- Full engine source is never on the drive.

**Referral flow:** see `AIXMOS-COMMAND/MOE-LEGACY/06-ASCENSION-AUTOMATIONS.md` A1–A7.

---

## 8. SECURITY POSTURE

- **Assume-breach:** local lockdown active; RUBIK ever-revolving secrets (daily launchd).
- **Single master key:** `AIXMOS537` — main risk point.
- **RLS:** all sensitive tables row-level locked. Public forms intentionally open (by design).
- **Secrets:** never in repo. Pattern: `~/.config/tmmt/<svc>.env` mode 600 + wrapper script + plist references wrapper.
- **Tailscale:** mesh is the perimeter. iMessage relay bind: `100.77.126.8:8787` (tailnet-only).
- **Umar fence:** Muhammad Umar is fenced from engine source, admin keys, and operator data. Do not extend IP or trust to Umar without explicit owner directive.

---

## 9. DEPLOY POLICY

Auto-deploy is OFF on all 5 Vercel projects. Deploy only via owner-gated `scripts/ship`.
See `docs/DEPLOY-POLICY.md`.

Production deploy checklist: `00_START_HERE/GATE_FLIP_CHECKLIST.md`.

---

## 10. OPEN ITEMS (as of 2026-06-22)

| Item | Owner | Priority |
|------|-------|----------|
| Drive `operator_training_progress` — 15-module program not yet running | Justin | HIGH |
| Apply pending Supabase migrations (partner portal, AI cube, vendor onboarding) | Owner | HIGH |
| 10DLC registration for Twilio SMS (B3 agent blocked) | Owner | HIGH |
| GHL $203 dunning workflow — verify it is paused | Dominique | MEDIUM |
| BRAINIAC SSH access — `taha1` key missing | Owner | MEDIUM |
| iMessage relay test send (BRAINIAC relay secret needs rotation) | Owner | MEDIUM |
| Implement CREDIT_FUNDING_OS.md into live system | Owner + counsel | BLOCKED (legal gate) |

---

*This doc is pulled in on demand. Keep it accurate. When something ships, strike it from §10.*
