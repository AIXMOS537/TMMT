# AIXMOS OPERATING LAYER
> **Source of truth for how the AIXMOS/TMMT AI system routes, costs, gates, and complies.**
> Version: 1.0 — 2026-06-22
> Owner: Muhammad Taha (PROJECT X HAILMARY)
> Full project reference: `docs/AIXMOS_MASTER_PROJECT.md`

---

## 1. PURPOSE

This document is the single authoritative spec for:
- How AI requests are routed (local vs. cloud)
- How cost is controlled per role
- How intake is classified and dispatched
- How credit/funding work is routed to the Moe Legacy node
- What the owner-approval gate covers
- Which compliance flags are gated and who holds the key

Every agent, automation, and developer working in this repo must treat this file as law.
When this file conflicts with any other doc, this file wins — update the other doc, not this one.

---

## 2. ARCHITECTURE NOUNS

```
Mesh (Tailscale tailnet)
  ├─ Carry Mac (M5 Pro/24GB)  — Ollama hub: qwen2.5:14b, tailnet-only
  ├─ Work Mac (M1 Max)        — secondary compute, Rick/Sork persona
  ├─ BRAINIAC (Windows PC)    — always-on: n8n, Ollama, Open WebUI, Qdrant, Redis
  ├─ UGREEN NAS               — file vault, backups, NAS inbox
  └─ Operator/employee laptops — scoped access only

Cloud hub (Cloudflare Workers Gateway)
  Repo: ~/Projects/aixmos-gateway/
  Role-scoped secrets → tiered model routing → TMMT-token metering

Backbone
  GHL · Airtable (appcenWUju039rD7b) · n8n (BRAINIAC) · Supabase · Qdrant · Redis

TMMT OS (this repo)
  Next.js 16 · React 19 · Supabase · Stripe · Twilio · GHL
  Three Vercel apps: tmmt-ops · tmmt-command-center · aixmos-landing
```

---

## 3. COST ROUTING — 80 / 20 RULE

**Target: 80% of inference on local hardware (free), 20% or less on paid cloud.**

### 3.1 The Four Lanes

| Lane | Model | TMMT-token cost | Who uses it |
|------|-------|-----------------|-------------|
| `free` | Ollama (local via Cloudflare Tunnel) | 0 | All employees by default |
| `haiku` | claude-haiku-4-5 | 1 token / call | Light cloud tasks, VAs |
| `sonnet` | claude-sonnet-4-6 | 5 tokens / call | Ops leads, strategic drafts |
| `opus` | claude-opus-4-8 | 25 tokens / call | Owner only — strategic work |

Source: `~/Projects/aixmos-gateway/src/index.js` — `COST` and `TIERS` constants.

### 3.2 Per-Role Daily Caps (enforce in gateway)

| Role | Max tier allowed | Monthly token budget |
|------|-----------------|----------------------|
| Employee / VA | `haiku` | 300 tokens |
| Operator (white-label tenant) | `sonnet` | 1,000 tokens |
| Owner (PROJECT X HAILMARY) | `opus` | unlimited |

When a user exhausts their token balance they auto-drop to the `free` lane — they are never cut off entirely.

### 3.3 Enforcement

- Per-role `maxTier` is stored in `AIXMOS_KV` (Cloudflare KV), set at provisioning time.
- Spend limit is also set on the Anthropic console (monthly hard cap).
- Changing a user's `maxTier` requires an admin secret (`SECRET_PERSONAL`).

---

## 4. INTAKE GATE

Every inbound signal — GHL webhook, form, SMS, Telegram, WhatsApp — passes through this pipeline before any action is taken.

```
Inbound signal
  → GHL webhook (or direct webhook endpoint)
  → n8n (BRAINIAC: always-on broker)
      → Ollama classifier (local, zero cloud cost)
          → Routing matrix (switch on label)
```

### 4.1 Classifier Labels

| Label | Meaning | Escalate condition (Section 6) |
|-------|---------|-------------------------------|
| `TMMT_LEAD` | Rental inquiry | Immediately → Rida (<5 min target) |
| `AIXMOS_LEAD` | $97 program inquiry | Immediately → Sumaima |
| `CREDIT_FUNDING` | Credit repair / funding ask | Route to Moe Legacy node (see §5) |
| `PAYMENT` | Collection / A/R | → Wania; flag if past-due >$200 |
| `RENEWAL` | Retention / re-up | → Areesha |
| `OPERATOR` | Operator candidate / B2B | → Justin; CEO gate if deal >$5K |
| `LEGAL_FLAG` | Any banned word, complaint, legal threat | STOP — owner-approval gate (§7) |
| `CONTENT` | Social / content request | → Javeria |
| `UNKNOWN` | Can't classify | → Justin (AIXMOS) or Dominique (TMMT) |

### 4.2 Routing Matrix

```
TMMT_LEAD      → Rida → Bibbs → Dominique
AIXMOS_LEAD    → Sumaima → Justin
CREDIT_FUNDING → Moe Legacy node (A2 webhook) — NEVER to owner directly
PAYMENT        → Wania → Dominique
RENEWAL        → Areesha → Justin
OPERATOR       → Justin → CEO gate if >$5K
LEGAL_FLAG     → owner-approval gate → HALT
CONTENT        → Javeria → Justin
UNKNOWN        → Justin (AIXMOS default) or Dominique (TMMT)
```

### 4.3 Section 6 Escalation Thresholds

These are the KPI breach points that trigger an escalation (RED) rather than a normal queue entry.

| KPI | Target | Breach = escalate |
|-----|--------|-------------------|
| Lead response time | < 5 min | > 15 min → alert Justin/Dominique |
| Fleet utilization | ≥ 70% daily | < 50% → alert Dominique + CEO |
| Past-due A/R | decreasing weekly | single item > $200 → Wania + Dominique |
| AIXMOS sales | CEO-set monthly target | < 50% of target at week 2 → Justin + CEO |
| Renewal rate | ≥ 60% | < 40% trailing month → Areesha + Justin |
| Any banned word in output | zero | any detection → HALT + owner-approval gate |

Full KPI definitions: `OPERATIONS_BRAIN.md §6` (canonical) and `kb/section-6-kpis.md` (importable copy).

---

## 5. CREDIT-FUNDING → MOE LEGACY NODE

**All credit-repair and business-funding inquiries route to the Moe Legacy node. They never route to the owner directly.**

### 5.1 Rule

```
If classifier label == CREDIT_FUNDING:
  1. Verify consent-captured tag is present. If not → HALT, alert rep, request consent.
  2. Fire referral.aixmos_to_moe webhook → n8n → Moe GHL location Intake.
  3. Write partner_referrals row: source=aixmos, dest=moe_legacy, reason=credit_repair|funding.
  4. Create ClickUp task (venture=moe_legacy) → Moe POC.
  5. DO NOT create the contact in our system. Moe's system owns that contact.
```

### 5.2 What AIXMOS/TMMT Can Do

- Pitch credit repair as "our exclusive partner Moe Legacy's service."
- Collect consent to share the customer's information.
- Fire the referral webhook after consent.
- Log the commission row.

### 5.3 What AIXMOS/TMMT Cannot Do

- Execute any credit-repair action on the customer's behalf.
- Access Moe Legacy's GHL, client files, or dispute engine.
- Unlock the `CREDIT_MODULE` feature flag (owner/Umar only — §8).
- Charge the customer for credit services through our Stripe account.

Full automation spec: `AIXMOS-COMMAND/MOE-LEGACY/06-ASCENSION-AUTOMATIONS.md` — automations A1 (TMMT→Moe) and A2 (AIXMOS→Moe).

---

## 6. SECTION 7 — RESPONSE TEMPLATES

Agent drafts for customer-facing content MUST start from these templates. Customize from here; do not invent new scripts.

Full templates: `kb/section-7-scripts.md` (importable copy) and `OPERATIONS_BRAIN.md §7` (canonical).

### Quick-reference (abbreviated)

| Role | Opening line |
|------|-------------|
| Bibbs (TMMT closer) | "Hey [name], this is Bibbs with TMMT Rentals. Rida said you're looking for a car this week — that right?" |
| Sumaima (AIXMOS closer) | "Hey [name], this is Sumaima with AIXMOS. You reached out about getting your money and credit organized…" |
| Areesha (renewals) | "Hey [name], this is Areesha with [TMMT/AIXMOS] — checking in. How's everything going?" |
| Rida (lead response, TEXT) | "Hey [name]! Rida from TMMT Rentals — thanks for reaching out. Quick three so we can help fast…" |

**Banned words (never draft):** guarantee, approved, financed, funded, get you a car/house, no risk, 100%, I promise.
**Required substitutes:** coach, plan, guide, help, work with, most clients see results when.

---

## 7. OWNER-APPROVAL GATE

**No customer-facing message and no financial action may execute without explicit owner approval.**

### 7.1 What Requires the Gate

Every code path that does any of the following MUST route through `shared/owner-approval-gate/` and block on an `approved` status before proceeding:

- Send any message to a customer or client (SMS, email, dispute letter, status update)
- Charge a fee, pay a commission, move money, or submit a funding application
- Edit production automations or push automation changes live
- Send a credit-bureau dispute
- Provision, revoke, or modify a partner license or kill-switch
- Change DNS, deploy to production, or run a destructive/irreversible command

### 7.2 Enforcement Layers

1. **Code gate:** `shared/owner-approval-gate/` — every qualifying path imports and calls this.
2. **Hook:** `.claude/hooks/PreToolUse` — blocks tool calls that bypass the gate.
3. **Compliance:** banned-word detection in `src/lib/agent/compliance/` — any match → HALT.
4. **Escalation:** LEGAL_FLAG classifier label → intake gate routes to owner, not any agent.

### 7.3 Trusted Escalation Path

Only these three humans can reach the owner directly:
- **Justin** — AIXMOS daily ops
- **Dominique** — TMMT daily ops + Chief of Staff
- **Javeria** — direct exception (family/trust)

Everyone else routes through Justin or Dominique first.

Money decisions > $200, legal/compliance questions, new partner relationships, personnel decisions (hire/fire/pay change) → CEO only.

---

## 8. COMPLIANCE — GATED FLAGS

These flags are locked. Do not enable, default-on, remove, or route around them.
Full registry: `docs/compliance/feature-flags.md`.

| Flag | What it gates | Who can unlock | Legal prerequisite |
|------|--------------|----------------|-------------------|
| `CREDIT_MODULE` | Credit-repair feature set | Muhammad or Umar only | CROA compliance + VA Credit Services Businesses Act + written disclosures + cancellation window |
| `FUNDING_MODULE` | Business funding origination | Muhammad or Umar only | Lending/broker license review; no advance fees |
| `EQUITY_INSTRUMENT` | Profit-share / equity offers | Muhammad only | Reg D / Howey analysis; §83(b) within 30 days |
| `SCREEN_MONITOR` | Discovery Agent screen capture | Muhammad only | Signed per-person consent + monitoring policy |
| `PARTNER_LICENSE_REVOKE` | Kill-switch on partner tenant | Muhammad only | Written notice per partner agreement |
| `FULL_RESELLER_KIT` | Full engine source to partner | Muhammad only | Master Partner Agreement signed + counsel cleared |

**Routing inquiries about credit or funding is allowed. Executing any gated feature without the flag owner's explicit written approval is not.**

---

## 9. N8N FLOWS (BRAINIAC)

n8n runs always-on on BRAINIAC (Windows home PC). It is the automation broker between GHL webhooks, Supabase, ClickUp, and Moe Legacy.

Full flow specs: `docs/n8n/README.md`.

Core flows:
- **Intake classifier** — receives GHL webhook, calls Ollama, labels, routes per §4.2
- **A1 TMMT→Moe referral** — fires on `needs-credit` tag
- **A2 AIXMOS→Moe referral** — fires on `funding-prep` stage
- **A4 Moe→TMMT referral** — fires on `funding-approved` (vehicle referral back)
- **A5 Lease-qualified** — checks Supabase `rental_ledger` for N consecutive on-time payments
- **A6 Operator track** — fires on `operator-track` tag, routes to AIXMOS systems pipeline
- **Commission ledger writer** — writes `partner_referrals` row after every cross-entity move

All flows are fail-closed: missing consent → HALT, no contact created, alert rep.

---

## 10. IDEMPOTENCY GUARANTEE

Re-running any agent or automation defined by this spec produces zero new changes if the state already matches. Specifically:
- Webhooks include idempotency keys (`referral_id` / `ghl_contact_id`).
- `partner_referrals` rows have a unique constraint on `(source, dest, contact_id, reason)`.
- Owner-approval gate checks existing approval status before blocking.
- Feature flag checks read from a single source (Supabase `feature_flags` table or env var) — no dual-write.

---

*Last updated: 2026-06-22. Next review: when any section changes materially. Update this file first; then update implementing code to match.*
