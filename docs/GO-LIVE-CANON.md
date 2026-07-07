# GO-LIVE CANON — READ FIRST (ALL AI TOOLS)

**Authority:** PROJECT X HAILMARY · **Updated:** 2026-07-04  
**Repo:** `~/projects/TMMT` only · **Deploy:** `tmmt-ops.vercel.app`

---

## Non-negotiables (every session)

| Rule | Meaning |
|------|---------|
| **Proprietary forever** | Nothing open-sourced. Ever. |
| **Moe Legacy frozen** | No wiring, docs, YAML, ads, or go-live work for Moe until owner unlocks. |
| **No fleet yet** | Zero vehicles on lot. Do not plan ops around live fleet KPIs. |
| **Credit is the front door** | Every customer/operator path starts with credit guidance intake — mandatory gate to work with TMMT. |
| **AIXMOS runs ads** | Primary ad tenant: org slug `aixmos`, agent **Aida**. |
| **TMMT OS houses operators** | Partners/operators get vertical modules on your engine; you expand forever. |

---

## What we are (one sentence)

**AIXMOS is the engine (ads, AI, GHL agency, credit). TMMT OS is the platform (operators, garage, verticals). TMMT Rentals is the flagship transportation vertical — live when inventory exists (yours or a partner's).**

---

## Active orgs (go-live only)

| Org | Slug | Agent | Use |
|-----|------|-------|-----|
| **AIXMOS** | `aixmos` | Aida | **All ads**, credit gate, $97, operator recruit |
| **TMMT Rentals** | `tmmt_property` | Taj | Transportation vertical (when fleet exists) |
| ~~Moe Legacy~~ | `moe_legacy` | — | **FROZEN** |

---

## Money funnel (no fleet required)

```
Meta/TikTok ad → /lp/aixmos/lead-magnet (or /credit)
  → POST /api/leads/webhook?org=aixmos
  → First SMS ≤60s (triggerFirstOutbound)
  → AI qualifies (inbound SMS)
  → Tag hot-ready-now → closer (GHL)
  → $97 / credit guidance checkout (GHL)
  → Operator apply → /join → /operator/training (Avatar → Garage → Drive)
  → Partner brings fleet → enable TMMT vertical modules
```

**Interim cash (today):** GHL checkouts on `/kits`, `/build`, `/forms/credit-funding-intake` — no cars needed.

---

## Revenue routes (live in code)

| Route | Money |
|-------|-------|
| `/lp/aixmos/*` | Ad landing → lead webhook → SMS |
| `/credit`, `/funding` | Credit intake (front door) |
| `/forms/credit-funding-intake` | Scored intake + handoff |
| `/kits` | Ops / Command / Academy / Dealer kits |
| `/build` | High-ticket deposits ($3.75k–$50k) |
| `/join` | Operator onboarding |
| `/forms/dealer-apply` | Partner vertical recruit |

---

## TMMT Rentals product lanes (one vertical, phased)

Long-term · Daily/Express · Corporate lease · Rent-to-own · Dealer buy · Credit gate (runs now)

Enable fleet modules only when **you or a partner** has inventory.

---

## Operator journey (TRAP)

1. **Trap** — ad / referral / apply  
2. **Avatar** — operator identity + brand (build UX on `/operator/training`)  
3. **Garage** — vertical modules + empty slots until inventory  
4. **Drive** — live ops on TMMT OS  

---

## Quarantine (do not ship, wire, or recommend)

- All `moe-legacy-*` repos and `AIXMOS-COMMAND/MOE-LEGACY/`  
- Open-source / GitHub trending plans  
- Duplicate command centers (`PROJECTAIXMOS`, `AIX-Command-Center`, etc.)  
- `TMMT-swarm`, `TMMT.broken.*`, mesh dev experiments for go-live  
- Lane wiring docs that cross-sell to Moe  

Archive to `~/projects/_ARCHIVE/` when owner approves — never delete.

---

## P0 blockers for money (check every session)

1. **Middleware public:** `/lp`, `/api/leads/*`, `/api/agent/*` — must not redirect to login  
2. **First outbound SMS:** `lead.received` → `triggerFirstOutbound()` — wired in webhook  
3. **GHL P0 env:** run `npm run ghl:check` — real checkout URLs on Vercel  
4. **GHL webhook:** `POST https://tmmt-ops.vercel.app/api/webhooks/ghl` + `GHL_WEBHOOK_SECRET`  
5. **Twilio:** `TWILIO_*` env + `organizations.twilio_inbound_number` for `aixmos`  
6. **Deploy:** `vercel.json` has `deploymentEnabled: false` — manual `vercel --prod` after push  

---

## Owner commands (fast)

```bash
cd ~/projects/TMMT
npm run ghl:check              # what's blocking checkout
npm run go-live                # full audit (no mutations)
npm run ghl:test-webhook payment
npm run smoke:prod
bash scripts/mesh/go-live-device.sh --role forge
bash scripts/mesh/go-live-integration-test.sh
```

**Full mesh playbook:** [`docs/MESH-GO-LIVE-PACK.md`](MESH-GO-LIVE-PACK.md)

**BLIP drop (one folder → every device):**

```bash
bash scripts/blip/make-blip-bundle.sh
# → send ~/Sync/BLIP-DROP/LATEST/ via BLIP to each device
# → on each device: bash DROP-AND-GO.sh
```

**AI paste:** `docs/ONE-SHOT-AI.md` · **Notify policy:** `config/notify-policy.json` (owner URGENT/EMERGENCY only; else watchtower)

---

## AI behavior

- Lead with **one next move** and blockers — not essays  
- Never assume fleet, Moe, or open source  
- All code changes in `~/projects/TMMT` unless owner says otherwise  
- Confirm before irreversible prod actions (deploy, DNS, kill-switch, real SMS to customers)

---

*This file overrides conflicting handoff docs for go-live. Factory score / vertical YAML still applies — proof vertical is TMMT/AIXMOS, not Moe.*
