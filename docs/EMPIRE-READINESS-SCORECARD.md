# Empire Readiness Scorecard — multi-entity sync

**Last run:** 2026-06-21 (automated sweep on Carry Mac)  
**Command:** `bash scripts/empire-sync.sh`  
**Metaphor:** Each vertical = a chess board. Supabase + GHL tags = the Rubik's cube spine. Moves on one board must stay legal on all others.

---

## Score summary (live run)

| Layer | Status | Notes |
|-------|--------|-------|
| **Code spine** | ✅ **100%** | `npm run build` pass · 143/143 unit tests pass |
| **Deployed apps** | ✅ **3/3 up** | tmmt-ops · command-center · aixmos-landing (200) |
| **TMMT Ops smoke** | ✅ | All forms + `/api/health` 200 |
| **Command Center smoke** | ⚠️ | `/forms/customer-intake` 404 — **by design** (ops-only form; use tmmt-ops URL) |
| **Mesh hygiene** | ✅ | swarm-doctor 16 pass / 1 warn (no local .env before pull) |
| **Device integrity** | ✅ | Clean |
| **Supabase security** | ✅ | Anon blocked from token grant/spend (tonight migration) |
| **GHL revenue spine** | 🔴 | **7 P0 env blockers** on Vercel — checkout URLs + `NEXT_PUBLIC_OWNER_HUB_HOST` |
| **Operator factory** | 🟡 | Brain docs ✅ · `operators.csv` not created yet |
| **Watchtower targets** | 🟡 | Credit + E-commerce URLs still `TODO` in `watch/targets.tsv` |

**Composite readiness: ~72/100** — tech stack is live; **revenue wiring** is the gap.

---

## The three chess boards (separate entities, one spine)

```mermaid
flowchart TB
  subgraph ops["🚗 TMMT Ops — The Crew"]
    O1[fleet · customers · tickets]
    O2[public forms · /kits · /build]
  end
  subgraph cc["🛡️ Command Center — The Boss"]
    C1[/command · /executive]
    C2[/operator · /investor]
  end
  subgraph aix["🤝 AIXMOS — Funnel"]
    A1[membership $97]
    A2[credit guidance ladder]
  end
  subgraph spine["🧊 Rubik's cube spine"]
    DB[(Supabase orgs + RLS)]
    GHL[GoHighLevel tags + checkout]
    LIC[organization_licenses + booyah]
  end
  ops --> DB
  cc --> DB
  aix --> DB
  ops -->|"rental-completed"| GHL
  GHL -->|"ready-for-aixmos · member-97"| aix
  aix -->|"credit-guidance-active"| cc
  LIC --> ops
  LIC --> cc
  LIC --> aix
```

| Entity | Vercel project | URL | Org / license | Who plays |
|--------|----------------|-----|---------------|-----------|
| **TMMT Rentals (Ops)** | `tmmt-ops` | https://tmmt-ops.vercel.app | `8e651b25-…` full_os | Crew + staff |
| **AIXMOS platform** | `aixmos-landing` | https://aixmos-landing.vercel.app | AIXMOS org `aaaaaaaa-…` | Public funnel |
| **Command Center** | `tmmt-command-center` | https://tmmt-command-center.vercel.app | Owner hub | Boss + leadership |
| **Moe Legacy** | separate portal repo | scoped portal | `bbbbbbbb-…` custom | Red Hood (Umar) |
| **Nightwing / Khan** | operator seat | TBD | own org when enrolled | Field ops |

**Licenses in prod (verified):**

| Org ID | Tier | Modules (sample) |
|--------|------|------------------|
| `8e651b25-…` | full_os | rentals_app, credit_repair, lease_to_own, operator_program |
| `bbbbbbbb-…` | custom | agent_sales, partner_deploy, revenue_engine |
| `aaaaaaaa-…` | full_os | agent_sales, partner_deploy, revenue_engine |

Each org = **separate chess board**. `organization_licenses` + RLS = **legal moves only on their board**.

---

## Value ladder sync (all verticals climb the same cube)

```
🚗 Rental → 💳 $97/mo → 📈 Credit Guidance → 🏗️ Kits/Builds → 🤝 Affiliate/Operate
```

| Step | GHL tag | App surface | Operator doc |
|------|---------|-------------|--------------|
| 1 Rental | `tmmt-customer`, `rental-completed` | TMMT Ops admin | OPERATOR-START-HERE |
| 2 Membership | `ready-for-aixmos`, `member-97` | aixmos-landing checkout | OFFER-STACK |
| 3 Credit | `credit-guidance-active` | `/legal/credit`, SOPs | CREDIT-GUIDANCE-SOP |
| 4 Build | kit checkout env vars | `/kits`, `/build` | FLASH-DRIVE-PRODUCT-LINE |
| 5 Operate | operator provisioned | `/operator` portal | OPERATOR-BRAIN |

**Rule:** Never skip a face on the cube — no `ready-for-aixmos` before `rental-completed`.

---

## What's GREEN (ready to move)

- Production build + all unit tests
- Three Vercel apps responding
- Public intake forms on **tmmt-ops** (use this URL in ads)
- Operator brain + agent rules + Cursor rules wired
- License/kill-switch architecture in Supabase
- Mesh scripts: health, swarm-doctor, device-integrity, quarantine-downloads
- `.env` pulled from Vercel (`tmmt-ops` production)

---

## What's RED (blocks money + multi-entity sync)

### P0 — Vercel env (7 blockers from `ghl-activation-check`)

Set in **Vercel → tmmt-ops → Environment Variables → Production**, then redeploy:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_OWNER_HUB_HOST` | Staff domain routing (target: tmmtrentals.net) |
| `NEXT_PUBLIC_GHL_CHECKOUT_97` | $97/mo membership |
| `NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT` | Ops kit checkout |
| (+ other P0/P1 checkout URLs) | See `/tmp/empire-ghl.log` after `empire-sync` |

Then: `npm run ghl:sync-vercel` · redeploy all three apps.

### P0 — GHL location API (local ops)

`GHL_API_KEY` + `GHL_LOCATION_ID` not in pulled env — add to Vercel if you want automated product discovery.

### P1 — Operator roster

```bash
cp operators.csv.example operators.csv
# edit emails
node scripts/provision-operators.mjs --file operators.csv --dry-run
```

### P1 — Watchtower unconfigured verticals

Edit `watch/targets.tsv`:

- 📈 Credit Guidance → Moe portal URL or `/legal/credit` on ops
- 🛒 E-commerce → store URL when live

---

## Daily sync rhythm (keep all boards moving)

| When | Command | What it syncs |
|------|---------|---------------|
| **Morning** | `bash scripts/empire-sync.sh --compact` | All verticals + build + GHL |
| **Before deploy** | `npm run build && npm test` | Code spine |
| **After env change** | `vercel env pull .env --environment=production` | Local matches prod |
| **New operator** | `provision-operators.mjs` + send OPERATOR-BRAIN | New chess board |
| **Advance rung** | `booyah-unlock.sh` (owner + ADMIN_KEY) | License face turns |
| **Weekly** | Tag audit in GHL (Fri per AIXMOS-TMMT-FUNNEL) | Cube faces aligned |

---

## Separate businesses rule (non-negotiable)

| Wall | TMMT Ops | Moe Legacy | AIXMOS funnel | Dealer |
|------|----------|------------|---------------|--------|
| **Code** | This repo | Own portal repo | Shared codebase, different host | Own instance |
| **Data** | org `8e651b25…` | org `bbbbbbbb…` | tags + member rows | **Separate DB** |
| **Secrets** | Vercel tmmt-ops | Scoped portal token only | Public checkout URLs | Their keys |
| **Power** | staff role | booyah rungs | owner hub | no kill-switch |

Dealers get **their own instance** — never shared Supabase ([DEALER-KIT-ONE-PAGER.md](sales/DEALER-KIT-ONE-PAGER.md)).

---

## One-command empire check

```bash
bash scripts/empire-sync.sh
```

Exit 0 = safe to soft-launch operators. Exit 1 = fix fails (usually GHL env).

**Owner go-live (mutating — your approval):**

```bash
node scripts/go-live.mjs --apply
```

---

## Related docs

- [THREE-APP-ECOSYSTEM.md](THREE-APP-ECOSYSTEM.md) — app topology
- [SYSTEM-BLUEPRINT.md](SYSTEM-BLUEPRINT.md) — whole machine
- [AIXMOS-TMMT-FUNNEL.md](AIXMOS-TMMT-FUNNEL.md) — tag sequence
- [TONIGHT-ONBOARDING-GO-LIVE.md](TONIGHT-ONBOARDING-GO-LIVE.md) — first operators tonight
- [BUILD_MEMORY.md](BUILD_MEMORY.md) — owner session load
