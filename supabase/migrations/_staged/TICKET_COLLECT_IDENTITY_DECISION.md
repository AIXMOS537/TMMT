# `ticket_collect` — identity decision packet

**State:** SCHEMA / CONTRACT BLOCKED · owner decision required · nothing applied
**Raised:** 2026-09-06

## 1. What the 2026-09-03 contract said
`SYSTEM_AUDIT_2026/40_AIXMOS_TRIAGE_CONTROL_PLANE.md`:

> The obvious key is the `name|phone|email` composite. **The evidence says it is not a key.**
> A unique constraint on that composite would silently **collapse distinct leads into one work
> item**. That is strictly worse than duplicating them: duplication is visible and countable,
> collapse is invisible and lossy.

and:

> `generate_va_tasks_v2()` converts **only `bgcheck_review`** … The other four still need their
> source primary key threaded through before conversion.

## 2. What the 2026-09-06 migration implemented
`20260906022113_generate_va_tasks_idempotent_all_categories` converted all five. Its header
states *"All five source tables have a uuid primary key (verified)"* — true of the tables, but
**two categories do not use that PK**. For `ticket_collect` the deployed identity is:

    source_table = 'tickets'
    source_id    = t.requested_by_customer     -- free text

with `GROUP BY t.requested_by_customer` and `HAVING sum(t.amount) >= 50`.

## 3. The author's stated rationale — and the precise gap
Lines 170-174 of that migration:

> This category has no single source row: it rolls up every open ticket per customer. Its
> identity is therefore the generator's OWN grouping key. That is not the forbidden
> contact-detail match -- the grouping already defines the work item.

**That argument is sound as far as it goes, and it is not the naive mistake the contract warned
about.** If the work item *is* the group, the group key does identify it.

**The gap it does not address:** identity is faithful to the grouping, but the *grouping itself*
is unstable. `requested_by_customer` is free text, so one person can occupy several groups:

    "Aayan"       -> group A
    "Aayan "      -> group B   (trailing space)
    "Aayan Khan"  -> group C

Each group is tested against `HAVING sum(amount) >= 50` **independently**. A person owing $120
across three name variants at $40 each generates **zero** work items. The failure is therefore
not duplication and not identity drift — it is **silent under-generation at the threshold**,
which no row count will reveal.

Observed in production: `Aayan` / `Aayan ` / `Aayan Khan` are three live `ticket_collect`
identities; 8 raw `subject_name` values normalise to 6 under `lower(btrim())`.

## 4. Why it cannot be repaired in place
`tickets` has **no referential customer identity**:
- PK `id` (uuid); the **only** FK is `org_id -> organizations`
- every customer-like field is free text: `requested_by_customer`, `customer_linked`,
  `customer_name`, `phone`, `total_customer_ticket_balance`

`phone` is not a substitute — it is the key class already proven to collapse distinct people
(one number mapped to 3 different `customer_id`s in `background_checks`).

**Do not normalise names and declare this solved.** Normalisation reduces the collision rate;
it does not make the key referential, and it silently merges genuinely distinct people who
share a name.

## 5. Options — owner decision
### OPTION 1 — REFERENTIAL FIX (correct, larger)
Add and backfill a real customer FK on `tickets`, aggregate on that.
- schema: `alter table tickets add column customer_id uuid references <customer table>`
- backfill: requires an entity-resolution pass over free text; **unmatched and ambiguous rows
  must be quarantined, not guessed**
- validation: every qualifying ticket resolves to exactly one customer, or is quarantined
- rollback: drop column; generator reverts to the current key
- cost: real data work; blocks on which table is the customer system of record

### OPTION 2 — CHANGE THE WORK-ITEM CONTRACT (smaller, changes meaning)
Make it one task per ticket, identity `t.id`.
- removes the threshold semantics entirely (`HAVING sum >= 50` has no meaning per ticket)
- changes what the business is being asked to do: 308 individual collections rather than
  per-person balances
- **do NOT choose this merely because `t.id` exists and is convenient**

### Which fits existing contract evidence
**Option 1.** The `HAVING sum(amount) >= 50` threshold and the `total_owed` context field both
show the intended work item is a per-person balance, not a per-ticket chase. Option 2 would
discard a deliberate business rule to solve a technical identity problem.

## 6. Blast radius today
- 464 rows / 8 identities / 6 normalised entities
- `subject_phone` is NULL on every row, so nothing can dispatch from these rows
- 232 rows target fenced parties (Aayan x3 variants, Muhammad Umar) — see the fenced-row invariant
- **No sends have ever occurred from this queue**

## 7. Owner decision required
Choose Option 1 or Option 2, or explicitly defer. Until then `ticket_collect` stays
CONTRACT BLOCKED and must not be drained, normalised, or re-keyed.

---

## 8. Evidence search for a WRITTEN business rule (2026-09-06)

Searched vault, `SYSTEM_AUDIT_2026/`, and `TMMT/docs/` for a stated collection policy.

**Found — customer-level framing, in business language:**
> "**Open tickets** — Toll violations, speeding citations — **customer charges not yet collected**"
> (`vault/05-Reference/TMMT-Knowledge`)

"Customer charges", not "ticket charges".

**Found — customer-level balance already exists as a schema concept on `tickets`:**
- `total_customer_ticket_balance` (text)
- `ticket_balance_status` (text)
- `customer_linked` (text)

Someone has already modelled a per-customer running balance. That is Option 1's concept,
denormalised into free-text columns because no FK exists.

**Found — nothing anywhere describes per-ticket collection work.** Option 2 has no
supporting evidence in code, schema, or documentation.

**NOT found — any written provenance for the `$50` threshold.** It exists only inside
`generate_va_tasks_v2`. Preserving Option 1 preserves a rule whose origin is uncorroborated.
That is a separate question from customer-level vs ticket-level and should not block this
decision, but it should not be mistaken for a validated policy either.

### Conclusion of the evidence review
Three independent sources — the generator's aggregate rule, the denormalised balance
columns on `tickets`, and the business-language description — all describe **customer-level**
collection work. **Option 1 is what the system already encodes.** Option 2 would be a
change of business concept, not a repair.
