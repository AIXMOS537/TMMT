# 36 · TARGET ARCHITECTURE

**Not a rewrite.** ~80% of what exists is correct and should be kept. The target is the same stack with the duplicates resolved, the ownership boundaries enforced, and the unpaid complexity frozen.

## Ownership boundaries (the core of the target)
```
┌──────────────────────────────────────────────────────────┐
│ GOHIGHLEVEL — owns the relationship                      │
│  contacts · conversations · SMS/email delivery           │
│  pipelines · calendars · campaigns · checkout            │
│  ✱ the app MIRRORS, never authors ✱                      │
└──────────────────────────────────────────────────────────┘
                          ▲ ▼  one documented contract
┌──────────────────────────────────────────────────────────┐
│ THE APP — owns operations                                │
│  rental lifecycle · fleet · inspections · documents      │
│  money ledger · arrears · payouts                        │
│  compliance gates (DNC, quiet hours, disclaimers)        │
│  licensing · entitlements · portals                      │
└──────────────────────────────────────────────────────────┘
                          ▲ ▼
┌──────────────────────────────────────────────────────────┐
│ SUPABASE — owns identity, authorization, truth           │
│  auth · RLS on every table · ONE org id type: UUID       │
│  storage · audit_events                                  │
└──────────────────────────────────────────────────────────┘

  AIRTABLE — owns nothing, OR formally owns Leads
             verification. Declared, not both.
```

## Data-model target
| Concept | Keep | Retire |
|---|---|---|
| Vehicle | **one** of `fleet` / `vehicles` | the other |
| Rental | **one** of `active_customers` / `bookings` | the other |
| Payment | `customer_payments` **as `amount_cents`** | `payments`, `deal_payments` |
| Person | `people` (canonical) + `ghl_contacts` (mirror) | `parties`, `portal_clients` |
| Task | `exec_va_tasks` | `tasks`, `clickup_tasks` |
| Document | `document_uploads` | `documents` |

**Recommendation on the big one:** migrate **to** `bookings`/`vehicles` (the better design) **but only when rental operations restart** — and delete the legacy tables in the same change. Maintaining both is what caused the Interfaces failure.

## Non-negotiable invariants
1. **One org id type: UUID.** No slugs as identities. *(This is P0-1.)*
2. **Generated DB types in CI.** Column typos must be compile errors.
3. **Migrations only through the repo.** Never the dashboard.
4. **Every table has an RLS policy** — enabled-with-no-policy is a functional outage (`outreach_touches`).
5. **Money is `integer` cents.** Never text.
6. **Every booking has a `tstzrange` EXCLUDE constraint.**
7. **One public-path allowlist.**
8. **Draft never send · track never pay · stage never sign** — already honoured; keep it.

## Keep / Fix / Freeze / Remove
| Verdict | Items |
|---|---|
| **KEEP** | Next 16/React 19 stack · RLS model · compliance layer · `fetchTable` error semantics · offline PWA · GHL integration · CI (`verify.yml`, `pii-guard.yml`) · component system · token ledger · operator network |
| **FIX** | Org identity · money type · duplicate models · generated types · anon RPC grants · middleware consolidation · monitoring · migration drift |
| **FREEZE** | Multi-tenancy · dealer/white-label · dispute engine · new AI agents · partner payouts |
| **ARCHIVE** | Dispatch · ClickUp · counselor layer · marketplace · `(program)`/`(vendor)`/`(investor)` routes |
| **REMOVE** | `lead_pool` call sites · snapshot table from `public` · duplicate migration timestamp · `dist/` from version control |
| **OWNER DECISION** | `moe_legacy` tenant · `~/HAILMARY` tree · Airtable's future · 12,788 unreachable commits |

## What this is not
Not a rewrite, not a framework change, not a new database. **The code is good. The problem is that it serves three businesses at once and two of them have no customers.** The target architecture is mostly an act of subtraction.
