# Retiring Airtable — what moves, what is already done, what is only in Airtable

**Owner decision, 2026-09-21:** stop using Airtable. Keep how it works, keep all of its data,
and bring both into Supabase and the TMMT OS app.

Base: `appcenWUju039rD7b` "TMMT Rentals" · 30 tables · dormant since roughly 2026-06-07.

---

## The headline: the data migration is already done

Supabase is **at or ahead of** Airtable on every table that carries real volume. Measured
2026-09-21, not assumed:

| Table | Airtable | Supabase | Verdict |
|---|---:|---:|---|
| Incoming Leads | 871 | **892** | Supabase ahead |
| Background Checks | — | 299 | Supabase has it |
| Fleet | 43 | **43** | equal |
| Tickets | — | 308 | Supabase has it |
| Waitlist | — | 104 | Supabase has it |
| Active Customers | — | 35 | Supabase has it |
| Customer Payments | — | 31 | Supabase has it |
| Contracts | 1 | **2** | Supabase ahead |
| Partner Acquisition | **0** | n/a | empty both sides |
| TMMT Operator Signups | **0** | n/a | empty both sides |

**Nobody needs to migrate 871 leads.** They are already there, plus 21 Airtable never got.
So switching off Airtable does not risk the book — it risks the *small tail* below.

---

## What is genuinely only in Airtable

Small, and worth doing properly rather than in a hurry.

| Airtable table | Rows | Supabase home | Action |
|---|---:|---|---|
| Money Command — Bills & Subscriptions | **8** | `bills` (**0 rows**) | copy the 8 rows in |
| 🔄 Change & Update Log | **2** | none | create `change_log`, copy 2 |
| Former Customers | 2 | `former_customers` (1) | copy the 1 missing row |
| Client Accounts | ? | none (`portal_clients` is not the same thing) | count, then decide |
| Content Pipeline | ? | none | count, then decide |
| OO – Workstreams / Drivers / Vehicle Build / Grant Budget | ? | none | **separate venture** (Operation Overdrive). Do not fold into the rental schema. |

---

## The part that actually matters: the logic, not the rows

Airtable's field *descriptions* hold business rules that exist nowhere else. Losing the base
loses these. They are transcribed here verbatim-in-substance so they can be implemented in the OS.

### Partner Acquisition — the supply side (how TMMT gets cars)

This is the most valuable table in the base and it is **empty**, which means the pipeline was
designed and never worked. Taha needs vehicles; this is the machine for getting them.

- **Stage** — move left to right. *"Anything sitting in one stage >7 days needs a Next Action or
  gets moved to Nurture/Lost."*
- **Source** — *"Track it religiously — this is how we learn which channel actually produces cars."*
- **Commercial Use Cleared** — ⚠️ **CRITICAL GATE**: *"A personal auto policy generally voids the
  moment the car is rented for money. Do not onboard until this is resolved."*
- **Finance Status / Monthly Note Payment** — *"Financed vehicles are not disqualifying, but the
  note payment must be covered by the owner payout or the deal fails for them in month 2."*
- **Proposed Partner %** — existing fleet precedent: **60% / 65% / 70%**.
- **Target Weekly Rate** — benchmark from the fleet: **$300–$550**.
- **Deal Tier** — *"The split is earned, not asked for. Tier is set by WHAT TMMT CARRIES on that
  vehicle. Never offer a richer TMMT share without moving cost onto TMMT's side of the line."*

Computed fields to reimplement (they were formulas):
- `owner_payout_week` = weekly rate × partner % — *"the number you say out loud in the pitch"*
- `tmmt_gross_week` = weekly rate × (1 − partner %) — *"before insurance, maintenance, claims,
  downtime and ops cost — this is NOT profit"*
- `owner_net_after_note_month` = (payout × 4.33) − monthly note — *"if this is near zero or
  negative, the partner quits in month 2 — do not onboard on those terms"*
- `days_in_pipeline` — *"anything over 14 without a Next Action Date is dead weight"*
- `gate_check` — hard stops before a car goes live. **Must read CLEAR.**

### Active Customers
*"When lead status from 'Incoming leads' is set to 'Contracting', the lead is moved to this table."*
A state transition, not a copy. In the OS this belongs in the case/journey machinery, not a trigger
that duplicates a row.

### 🔄 Change & Update Log
*"FAST LANE for any change… Log it the instant it happens. Sork reviews, applies the change to the
master tables, and marks it Done. This is what keeps the data from going stale."*
The point is a human-speed inbox that does **not** require touching production tables directly.
Worth keeping as a concept even though only 2 rows were ever filed.

### Insurance
Holds **LOGIN EMAIL / LOGIN PASSWORD / LOGIN PHONE** in plain fields.
🔴 **Do not replicate those three columns into Supabase.** Carrier portal credentials belong in
`~/.config/tmmt/` or a password manager, never in an application table that RLS mistakes can expose.

---

## Order of work

1. **Export the whole base to the NAS first** — safety net before anything is switched off.
   Needs a PAT (`data.records:read`, `schema.bases:read`) in
   `~/.config/tmmt/airtable.env` as `AIRTABLE_API_KEY=`, then extend
   `~/.rick/bin/nas-archive.sh`. MCP can read it today but a PAT makes it one scripted pass.
2. **Copy the small tail** — `bills` (8), `change_log` (2), the 1 missing former customer.
3. **Build Partner Acquisition into Supabase + the OS** — with the gate check and the three
   payout formulas as real columns/views. This is the one that earns money, because it is how a
   car arrives.
4. **Decide on the OO tables** — Operation Overdrive is a different business. Its own schema or
   its own base; do not bolt it onto rentals.
5. **Only then turn Airtable off**, and keep the NAS export forever.

---

## What NOT to do

- Do **not** port all 30 tables one-for-one. Supabase already models this better in places
  (`cases`, `journey_checkpoints`, `people`) and a literal copy would create a second source of
  truth — which is the problem being solved, not the solution.
- Do **not** migrate the `Insurance` login columns (above).
- Do **not** assume a table with 1 row in Supabase was migrated. Several are test inserts;
  `appointments`, `vehicle_handover`, `customer_inspection_photos` and `employee_access_rights`
  each hold exactly 1 row, which is the shape of a smoke test, not an import.
