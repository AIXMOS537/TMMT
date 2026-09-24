# CHANGE REQUEST 001 — Vehicle owners and per-vehicle agreements

**Raised** 2026-09-01 · **Status: ⏸️ ON HOLD, REVIVED as Phase 2 of `OPERATOR-PROGRAM-BUILD.md`**
> Un-voided the same day. The operator programme routes clients to buy their own car and have
> TMMT manage it -- which is exactly what `vehicle_owners` + `owner_agreements` model. The
> migration is unchanged and still not applied; it now waits on real client-owners rather than
> on a fleet that no longer exists.

**Superseded status below applied only to the old investor fleet · Status: ⬛ SUPERSEDED — DO NOT APPLY. Nothing was applied.**
Migration file: `supabase/migrations/20260901120000_vehicle_owners_and_agreements.sql`

> ## ⬛ Superseded the same day — the fleet is empty
>
> The stocktake came back **0 here, 43 gone**. Every vehicle in the database is gone.
> See **`STOCKTAKE-RESULT-2026-09-01.md`**.
>
> This change request assumed a fleet existed and needed its ownership reconciled.
> **That premise is void.** There are no vehicles to attach an owner to, no agreements
> to record, and no statements to produce.
>
> The migration is sound and costs nothing on the shelf — if vehicles return, it is
> ready. But it must not be applied to an empty fleet, and there is no backfill to run.
>
> **Everything below is retained as the record of what was investigated and why.** Two
> findings in it survive the fleet and stay useful:
>
> * `revenue_splits` cannot hold vehicle-owner payouts — it is keyed on
>   `operator_id`/`deal_id` with no `vehicle_id`. Relevant to the operator business,
>   which is still live.
> * `fleet.partner_percentage` means the **owner's** share, proven against the Drive
>   payout reports. Worth keeping if the model is ever restarted.

Format per `CLAUDE.md` §4.

---

## 🔴 BLOCKING FINDING — the fleet data is 76 days stale

**Discovered 2026-09-01 while checking the owner's answers.** The owner replied *"it's gone now"* and *"no longer here"* to three separate reconciliation questions. That prompted a check of when this data was last written.

| Table | Last updated | Distinct update days | Rows | Age |
|---|---|---:|---:|---|
| **`fleet`** | **2026-06-17** | **1** | 43 | **76 days** |
| **`expenses`** | **2026-06-17** | **1** | 34 | **76 days** |
| `active_customers` | 2026-06-22 | 2 | 35 | 71 days |
| `customer_payments` | 2026-07-16 | 4 | 31 | 47 days |
| `incoming_leads` | 2026-08-31 | 3 | 875 | ✅ live |

**Every one of the 43 fleet rows was written on the same single day and never touched again.** Same for all 34 expenses. These are not operational tables — they are a **one-day migration dump from 17 June that nothing has written to since.**

Only `incoming_leads` is live, because GHL feeds it.

### What this actually means

> **The rental operations side of Supabase is not a stale database. It is a snapshot of a business that has moved on without it.**

Consequences for every figure in circulation:

- **"21 vehicles rented" is not a current fact.** It is what was true on 17 June. The owner has since confirmed several of those vehicles are gone.
- **"16 active customers" is a 22 June figure.**
- **"$21,884 revenue"** — already flagged as undated — cannot be checked against this data either.
- My own earlier framing, *"21 rented vehicles generating money with no ledger behind them,"* **was wrong and is withdrawn.** The correct statement is: **nobody can say from this database what is rented today.**

The real operational truth has been living in Airtable, spreadsheets and people's heads for 76 days. That is precisely the *"honestly, it's all a mess"* the owner described — now measured.

### 🔴 Why this blocks the migration

`owner_agreements` records terms **per vehicle**. Building agreements against a 76-day-old vehicle list would write contracts for cars that no longer exist and miss every car acquired since June. **It would encode the staleness into the new schema and make it permanent.**

The migration itself is still correct and stays as written. **It just must not be applied until the fleet list is current.**

### Fleet data quality — worse than 43 rows suggests

| Problem | Detail |
|---|---|
| **Duplicate plate `5CW4654`** | 2013 Toyota Corolla appears **twice** — one row owned by **Marc**, status *Rented*; one row with **no owner**, status *Available*. **Same car, two rows, two contradictory states.** This is Marc's car from the Drive payout report |
| **Duplicate plate `SZF4776`** | 2017 Ford Edge twice — one *Retired*, one *null status* |
| **Duplicate plate `6GJ4314`** | 2017 Toyota Camry twice, both *Available* |
| **`SZF477` vs `SZF4776`** | Almost certainly a typo'd third copy |
| **11 vehicles have no plate at all** | Including a *Rented* Nissan Versa, a *Rented* Tesla Model 3 and a *Rented* Honda CRV |
| **2 completely blank rows** | No year, make, model, plate, owner or status |

**At least 3 of the 7 "unowned" vehicles are duplicates of owned ones.** The true distinct fleet is **around 38, not 43** — before removing what the owner says is gone.

### The revised first step

**Getting a current fleet list is now step 1, ahead of everything else.** It is also the cheapest step: one person walking the lot, or one export from wherever the real list lives.

`[RECOMMENDED]` the fastest safe version:

1. Owner or a VA produces the **current** vehicle list — plate, make/model, owner, status, current renter.
2. Reconcile against these 43 rows: mark departed vehicles **`Returned to owner` / `Sold` / `Retired` with an end date — never delete them.** The blueprint's rule holds: *history, not overwrite.* A car that left still has rental and payout history that must remain answerable.
3. Merge the three duplicate-plate pairs, keeping the row with the richer history.
4. Delete only the two entirely blank rows — they carry no history to preserve.
5. **Then** apply this migration and do the owner backfill.

Steps 1–2 need no code and no schema change.

### ✅ What the owner has already settled

| Question | Answer |
|---|---|
| Esmat / Ismatullah | **Same person** `[STATED]` — merge into one owner |
| TAHA's 2020 Corolla | **Gone** `[STATED]` — despite the table saying *Rented* with a customer attached |
| The 7 unowned vehicles | **Gone** `[STATED]` — and at least 3 are duplicates of vehicles that are not |
| Robin's cars | **No longer here** `[STATED]` — needs clarifying whether that means all three or only the two without a recorded share |

---

## CURRENT — what exists now, with evidence

Verified read-only against production `uapxakmlwnpfsftfeezx`, 2026-09-01.

**Ownership is a free-text field.** `fleet.partner_name`, 43 vehicles, **21 distinct strings** for roughly **17 real owners**.

**The split is recorded on 7 of 43 vehicles (16%).** 36 vehicles have `partner_percentage = NULL`. **21 vehicles were marked rented as of 17 June** — see the blocking finding above; that is not a current figure.

**There is no table that can hold an owner agreement.**

| Table | Rows | Why it does not fit |
|---|---:|---|
| `revenue_splits` | **0** | Keyed on `operator_id` / `deal_id`. **No `vehicle_id` column at all.** It models the operator-network business, not vehicle-owner payouts |
| `partners` | 1, deactivated | A referral-routing table — `slug`, `email`, `ghl_tag`, `priority`. Not an ownership record |
| `partner_fleet_access` | **0** | Maps a login to a vehicle. Has no terms, and no owner entity to point at |
| `bookings` | **0** | Well-designed (29 cols, `vehicle_id`, cents pricing, `insurance_verified`) but empty |

> **The assumption that `revenue_splits` was "built but unused" and just needed data is wrong.** It is built for a different purpose. This is the single most useful correction in this change request — it would have been discovered the hard way.

**Consequence:** TMMT cannot calculate what an owner is owed, cannot produce a statement, and cannot show an owner their vehicle. Worse, per the blocking finding above, it cannot even say which vehicles are rented today.

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

---

## Addendum — the stocktake sheet (2026-09-01)

The owner was asked whether Robin's "no longer here" meant all three cars or two.
The reply was **"ALL CARS ARET HERE, DOO ALLLLL"**.

That reads as *"all cars aren't here"* — but it is genuinely ambiguous between
*Robin's cars* and *the fleet as a whole*, and the difference is material: one is a
three-row correction, the other means the 43-row table is fiction.

**Rather than guess, the ambiguity is resolved by construction.** A walk-the-lot
stocktake sheet now exists — `docs/fleet-stocktake.html`, also published as an
artifact. It lists all 43 rows grouped by owner, phone-sized, three taps per car
(Here / Gone / ?), with a "mark all gone" shortcut per owner. Whoever walks the lot
produces the current list, and the ambiguity disappears.

The sheet carries the findings inline so the walker sees them in context:
- the 17 June staleness warning, with a plain instruction to trust their eyes over the label
- the four duplicate rows flagged as duplicates (`5CW4654`, `SZF4776` ×2, `6GJ4314`)
- the two blank rows flagged as safe to delete
- `Esmat` and `Ismatullah` already merged per the owner's answer
- the two `Duval / Jimmy` spellings already merged
- the three TMMT spellings already merged into "TMMT (company)"

So the reconciliation the migration needs is **already applied in the sheet**. What
comes back is a current fleet list against clean owner names.

### Vehicle counts as they now stand

| | |
|---|---:|
| Rows in `fleet` | 43 |
| Duplicate rows (same plate + VIN) | −4 |
| Blank rows (nothing identifies them) | −2 |
| **Distinct vehicles on paper** | **37** |
| Actually present today | **unknown — this is what the walk determines** |

### One more data defect found

`fleet.vin` is corrupted. Values come back as JSON fragments — `2226"}`, `": ""}` —
so the column holds stringified JSON leftovers from the Airtable migration rather than
VINs. Enough survives to prove the duplicate pairs match, but **VIN is not currently a
usable identifier** and should be re-captured during the walk. Added to the migration
follow-up list.
