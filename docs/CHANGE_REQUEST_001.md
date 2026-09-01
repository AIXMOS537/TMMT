# CHANGE REQUEST 001 — Vehicle owners and per-vehicle agreements

**Raised** 2026-09-01 · **Status: AWAITING OWNER APPROVAL. Nothing has been applied.**
Migration file: `supabase/migrations/20260901120000_vehicle_owners_and_agreements.sql`

Format per `CLAUDE.md` §4.

---

## CURRENT — what exists now, with evidence

Verified read-only against production `uapxakmlwnpfsftfeezx`, 2026-09-01.

**Ownership is a free-text field.** `fleet.partner_name`, 43 vehicles, **21 distinct strings** for roughly **17 real owners**.

**The split is recorded on 7 of 43 vehicles (16%).** 36 vehicles have `partner_percentage = NULL`. **21 vehicles are currently rented.**

**There is no table that can hold an owner agreement.**

| Table | Rows | Why it does not fit |
|---|---:|---|
| `revenue_splits` | **0** | Keyed on `operator_id` / `deal_id`. **No `vehicle_id` column at all.** It models the operator-network business, not vehicle-owner payouts |
| `partners` | 1, deactivated | A referral-routing table — `slug`, `email`, `ghl_tag`, `priority`. Not an ownership record |
| `partner_fleet_access` | **0** | Maps a login to a vehicle. Has no terms, and no owner entity to point at |
| `bookings` | **0** | Well-designed (29 cols, `vehicle_id`, cents pricing, `insurance_verified`) but empty |

> **The assumption that `revenue_splits` was "built but unused" and just needed data is wrong.** It is built for a different purpose. This is the single most useful correction in this change request — it would have been discovered the hard way.

**Consequence:** TMMT cannot calculate what an owner is owed, cannot produce a statement, and cannot show an owner their vehicle. 21 rented vehicles are generating money with no ledger behind them.

---

## PROPOSED

Three additive objects. **No existing row is modified, moved or deleted.**

1. **`vehicle_owners`** — the owner identity. Carries `known_aliases text[]` so every original spelling is preserved and the reconciliation stays auditable and reversible.
2. **`fleet.owner_id`** — a nullable FK. `partner_name` and `partner_percentage` **stay exactly as they are** until the backfill is verified.
3. **`owner_agreements`** — per-vehicle terms, because you stated terms *"vary per person and per car."*

### The one design decision worth your attention

`owner_agreements` has **both** `owner_share_bps` *and* `cost_recovery_cents`, because a flat percentage cannot express your written model.

`docs/PARTNERSHIP-MODEL.md` and `scripts/deal.sh` both implement: **TMMT's carrying cost comes off the top first, then the remainder is split.** A single percentage column would silently throw that away. `cost_recovery_cents = NULL` means a straight-percentage deal; `0` means something different and is allowed.

Shares are stored in **basis points** (`7000` = 70.00%), not floats, so money never carries rounding error.

### ✅ A semantics question, settled with evidence

**`partner_percentage` has always meant the OWNER's share, not TMMT's.** Proven by cross-referencing production against the Drive payout reports:

| Owner | DB `partner_percentage` | Drive report | Payout math | ✓ |
|---|---:|---|---|:-:|
| Asad | **0.70** | *"Split: 30/70"* | `(1280 × 70%) − 120 = 776` — report says **$776** | ✅ |
| Marc | *NULL* | *"Split: 40/60"* | `(1000 × 60%) − 120 = 480` — report says **$480** | ✅ |

Nobody had confirmed which way round that number ran. Now it is confirmed, and the direction is preserved in a column comment so it cannot be lost again.

---

## WHY — the business reason

You asked to *"get more cars and more partners and collect more for the company."*

**You cannot collect what you never invoiced.** 84% of the fleet has no recorded agreement. This is not a renegotiation — it is writing down deals that already exist, so they can be invoiced. It requires no conversation with any partner and risks no relationship.

It is also step 1 of the only path to an owner statement, which is the actual collection fix.

---

## THE RECONCILIATION — 21 strings → 17 owners

**This is the part that needs a human. Please check every row.**

### Safe merges — obvious duplicates

| Merge | Vehicles | Confidence |
|---|---:|---|
| `Duval / Jimmy` + `Jimmy/ Duval` | 2 | High — same pair, spelling only |
| `TMMT Rentals` + `TMMT` + `Tmmt ` → **house-owned** | **10** | High — three spellings of the company |

### 🔴 Three questions only you can answer

**1. Are `Esmat` and `Ismatullah` the same person?** `Esmat` has 1 vehicle (2017 Sienna, not rented). `Ismatullah` has 2 (2017 + 2020 Corolla, both rented). *Esmat* is a common short form of *Ismatullah*. **I have NOT merged them.** Wrong either way is bad: merging two people misdirects a payout; splitting one person creates two half-statements.

**2. `TAHA` owns one vehicle at 0.65 (2020 Corolla, rented).** Is that you personally — a real owner with a real 65% share — or should it be house-owned? It changes whether that car generates a payout to you as an individual.

**3. Seven vehicles have no owner recorded at all.** None are rented, so no money is moving. Five are identifiable; two have no make or model either:

| Vehicle | Status |
|---|---|
| 2013 Toyota Corolla | not rented |
| 2017 Toyota Camry | not rented |
| 2017 Ford Edge (Sports utility) | not rented |
| 2017 Ford Edge | not rented |
| 2018 Nissan Sentra | not rented |
| *(blank — no year, make or model)* | not rented |
| *(blank — no year, make or model)* | not rented |

### Full proposed owner list

| # | Owner | Cars | Rented | `partner_percentage` | Aliases merged |
|---|---|---:|---:|---|---|
| 1 | Asad | 2 | 2 | **0.70** ✅ confirmed | `Asad`, `Asad ` |
| 2 | Ayyan | 1 | 0 | — | |
| 3 | Chidi | 4 | 2 | — | |
| 4 | Duval / Jimmy | 2 | 2 | — | both spellings |
| 5 | Esmat | 1 | 0 | — | 🔴 see Q1 |
| 6 | Ismatullah | 2 | 2 | — | 🔴 see Q1 |
| 7 | John Lopez | 1 | 1 | **0.70** | |
| 8 | Kenny | 1 | 1 | — | |
| 9 | Lewis | 1 | 0 | — | |
| 10 | Marc | 1 | 1 | *NULL* → **0.60** proposed ✅ | evidenced by Drive report |
| 11 | Robin | 3 | 1 | **0.60** on one, NULL on two 🔴 | same terms on all three? |
| 12 | S & A Consulting | 1 | 1 | **0.65** | company |
| 13 | Shaker | 3 | 1 | — | |
| 14 | TAHA | 1 | 1 | **0.65** | 🔴 see Q2 |
| 15 | **TMMT (house)** | **10** | 4 | — | 3 spellings |
| 16 | Umar | 1 | 1 | **0.70** | ⚠️ also named as compliance co-approver |
| 17 | Wayne | 1 | 1 | — | |
| — | *(no owner)* | 7 | 0 | — | 🔴 see Q3 |

**Totals: 43 vehicles, 21 rented.** ✓ reconciles.

### ⚠️ Two things this surfaces

**A `$75` payout gap.** Asad's Camry line in the March Drive report: `(1440 × 70%) − 120 = $888`, but the report says **$813**. Either a deduction went unrecorded or a partner was underpaid. **Worth checking whether it repeated before more statements go out.**

**Umar is a vehicle owner at 70% and is named in `CLAUDE.md` §5 as a compliance co-approver.** If that is the same person, he should be recused from anything touching owner splits or payouts.

---

## DEPENDENCIES — what else touches this

| Thing | Impact |
|---|---|
| `src/app/(admin)/fleet/page.tsx` | Edits `partner_name` / `partner_percentage` as raw inputs. **Keeps working** — those columns are untouched |
| `get_partner_fleet()` RPC | Returns `partner_percentage`. **Keeps working** |
| `src/app/(partner)/partner/page.tsx` | Reads `partner_percentage`. **Keeps working** |
| `scripts/sync-airtable.mjs` | Would truncate `fleet`. **Now locked** (`--i-understand-this-truncates-prod`) |
| `is_org_member()`, `is_platform_admin()` | Both verified to exist with the expected signatures |
| Schema drift | ~130 prod migrations vs 38 in repo. **This one is written to the repo first**, so it does not widen the gap |
| Concurrent sessions | Another session merged to `master` during this work (`b96603a7`, `87ca628f`). **Re-check `schema_migrations` immediately before applying** |

---

## RISK — what breaks if this is wrong

| Risk | Severity | Mitigation |
|---|---|---|
| Wrong owner merge → payout to the wrong person | **High** | No merge is executed by this migration. Backfill is a separate approved step; `known_aliases` keeps it reversible |
| Existing fleet screens break | **Low** | Nothing existing is altered. Only an additive nullable column |
| RLS too permissive | **Medium** | Deny-by-default; `anon` explicitly revoked; writes restricted to `is_platform_admin()` so a VA cannot change a split |
| Owner sees another owner's terms | **Medium** | Read scoped through `partner_fleet_access`, matching your stated rule |
| Widens schema drift | **Low** | Committed to the repo before it is applied |
| Applied while another session is migrating | **Medium** | Check `schema_migrations` before and after |

**No data-loss risk exists in this change.** It creates two empty tables and one empty nullable column.

---

## ROLLBACK — exact steps

```sql
begin;
  drop policy if exists owner_agreements_read_own      on public.owner_agreements;
  drop policy if exists owner_agreements_write_admin   on public.owner_agreements;
  drop policy if exists owner_agreements_read_internal on public.owner_agreements;
  drop policy if exists vehicle_owners_write_admin     on public.vehicle_owners;
  drop policy if exists vehicle_owners_read_internal   on public.vehicle_owners;
  drop trigger if exists owner_agreements_touch on public.owner_agreements;
  drop trigger if exists vehicle_owners_touch   on public.vehicle_owners;
  drop table if exists public.owner_agreements;
  alter table public.fleet drop column if exists owner_id;
  drop table if exists public.vehicle_owners;
commit;
```

Safe at any point before the backfill: the tables are empty and `fleet.owner_id` is unpopulated. `tg_touch_updated_at()` is left in place — generic and harmless.

---

## WHAT THIS DELIBERATELY DOES NOT DO

- ❌ Backfill `fleet.owner_id` — needs your answers to Q1–Q3 first
- ❌ Drop `partner_name` / `partner_percentage` — only after the backfill is verified against real payouts
- ❌ Create `owner_statements` or `payouts` — those need expense attribution first, and payouts are owner-gated money movement
- ❌ Seed any percentage, fee or cost figure. **Every commercial number stays `[OPEN]`**

---

## APPROVAL

| | |
|---|---|
| Migration reviewed | ⬜ |
| Q1 — Esmat / Ismatullah: same person? | ⬜ |
| Q2 — TAHA: personal owner or house? | ⬜ |
| Q3 — the 7 unowned vehicles | ⬜ |
| Robin: same terms on all three cars? | ⬜ |
| Approved to apply to production | ⬜ |
