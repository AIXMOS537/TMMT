# 40 · AIXMOS TRIAGE CONTROL PLANE — `exec_va_tasks`

**Status:** classifier **APPLIED AND VERIFIED IN PRODUCTION** 2026-09-03 (versions `20260903193844`, `20260903193917`, `20260903194001`).
**Generator fix: STILL STAGED, NOT APPLIED** — cron continues to call the old `generate_va_tasks()`.
**Applied files:** `supabase/migrations/20260903193844_exec_va_tasks_triage_schema.sql` · `20260903194001_classify_va_tasks_fn.sql`
**Still staged:** `_staged/20260904010000_generate_va_tasks_idempotent_STAGED.sql` · `_staged/TRIAGE_ADVERSARIAL_TESTS.sql`

> **The queue is NOT idempotent yet.** What was proven is that the *classifier*
> is idempotent over a static corpus. The corpus still grows ~300 rows/day, and
> the next 12:00 UTC sweep will add another. The classifier is currently a
> reliable measuring instrument attached to a leak.

---

## The headline: 17,806 rows are 364 pieces of work

`generate_va_tasks()` runs daily at 12:00 UTC. It is idempotent *per day* — it skips if a sweep already exists for today — but it re-inserts the **same underlying subjects** on every new day. Over **58 sweeps** (2026-06-22 → 2026-09-03) that produced 17,806 rows describing **364 distinct people**.

| Category | Rows | Distinct subjects | Ratio |
|---|---:|---:|---:|
| `bgcheck_review` | 7,888 | 132 | 60× |
| `lead_reengagement` | 5,800 | 163 | 36× |
| `waitlist_contact` | 2,146 | 35 | 61× |
| `payment_followup` | 1,508 | 26 | 58× |
| `ticket_collect` | 464 | 8 | 58× |
| **Total** | **17,806** | **364** | **49×** |

**~98% of the corpus is duplication, not backlog.** The queue was never 17,761 deep. It was 364 deep, 49 times over. That is why "0 completed" looked catastrophic and is actually tractable.

---

## Design: authority is a separate dimension from lifecycle

`status` answers *where is this task in its life?* — `pending → handled`.
`triage` answers *who is allowed to act on it?* — `auto | needs_approval | ignore`.

Collapsing them is what makes a queue unreadable: you cannot ask "how many things need Muhammad?" without parsing a state machine. Kept separate, the CEO decision queue is one indexed predicate:

```sql
select * from exec_va_tasks where triage = 'needs_approval';
```

**Safety boundary, enforced structurally:**
> Classification can **recommend** authority. It cannot **exercise** authority.
> `auto` = eligible for future automation. It never means "execute now."

The classifier writes **only** the five `triage_*` columns. It cannot touch `status`, `handled_at` or `result`; it does not send, charge, approve, delete, or schedule.

---

## Rule set (`ruleset/v1`) — first match wins

| # | Reason | Triage | Conf | Basis |
|---|---|---|---:|---|
| 1 | `dnc_blocked` | ignore | 1.00 | TCPA opt-out — never contact |
| 2 | `already_handled` | ignore | 1.00 | Terminal |
| 3 | `superseded_by_later_sweep` | ignore | 1.00 | An older copy of the same subject |
| 4 | `source_condition_resolved_close_only` | **auto** | 0.95 | **Source** cleared; close only — evaluated for **every** category, **before** any category rule |
| 5 | `no_contact_method` | needs_approval | 0.90 | No phone **and** no email |
| 6 | `money_contact_owner_gate` | needs_approval | 0.98 | Money movement |
| 7 | `outbound_contact_tcpa_gate` | needs_approval | 0.98 | Outbound message to a person |
| 8 | `source_data_incomplete` | needs_approval | 0.85 | Source row has no status at all |
| 9 | `human_decision_required` | needs_approval | 0.98 | A manager must decide |
| 10 | `unclassified_default_safe` | needs_approval | 0.50 | Fail safe — never fail open |

Rule 10 matters: an unrecognised task defaults to **needs_approval**, not `auto`. The corpus has already shown this codebase twice what fail-open costs (`do_not_contact_numbers`, `outreach_touches`).

**Authority is derived, not declared.** Rule 4 evaluates live source state for *all five* categories and is checked *before* any category rule, so any category reaches `auto` the moment its source clears. Rules 6–9 are the fallback for work still outstanding — they are not a claim that those categories are permanently an approval queue. This was a deliberate revision: the first draft keyed rules 6–8 on `category`, which encoded today's distribution as structure.

---

## Dry-run result — reconciles exactly

| Triage | Reason | Rows |
|---|---|---:|
| ignore | `superseded_by_later_sweep` | 17,397 |
| needs_approval | `outbound_contact_tcpa_gate` | 198 |
| needs_approval | `human_decision_required` | 64 |
| needs_approval | `source_data_incomplete` | 64 |
| ignore | `dnc_blocked` | 45 |
| needs_approval | `money_contact_owner_gate` | 26 |
| needs_approval | `no_contact_method` | 12 |
| | **TOTAL** | **17,806** |

**17,806 classified = 17,806 source rows. 0 dropped, 0 duplicated.**
By triage: **ignore 17,442 · needs_approval 364 · auto 0.**
`needs_approval` (364) equals the distinct-subject count exactly — an independent check that rule 3 removed precisely the duplicates and nothing else.

---

## `auto` is zero, and that is the honest answer

Not one of 17,806 tasks is safe to automate today. Four of the five categories are **outbound contact to a person** (TCPA + your standing comms hold); the fifth is **a manager's decision**. There is no automation win hiding in this corpus.

**Rule 4 is not dead code.** Every category's source predicate runs on every pass, and all four joins match **100%** of rows:

| Category | Match rate | Key | Fan-out |
|---|---|---|---|
| `bgcheck_review` | 132/132 | `context->>'customer_id'` | none |
| `payment_followup` | 26/26 | `subject_phone` | none |
| `waitlist_contact` | 38/38 | `subject_phone` | **35 subjects → 38 rows** |
| `lead_reengagement` | 227/227 | `subject_email` | **163 subjects → 227 rows** |

### ⚠️ A correction I had to make mid-analysis

A first pass using `JOIN` appeared to find **6 automatable lead tasks**. That was **wrong** — an artifact of the fan-out. Checked directly: of 163 lead subjects, **64 match multiple source rows**, **6** have at least one resolved lead, and **0** have *all* their leads resolved. Under cardinality-safe semantics every one correctly stays `needs_approval`.

This is why the classifier uses `NOT EXISTS`, never `JOIN`. A join would have duplicated 64 lead rows and 3 waitlist rows into the output and silently broken the "0 duplicated" invariant — producing a plausible number that reconciliation would not have caught, because the inflated total would have been internally consistent.

---

## What the 364 actually are

| Work | Count | Who |
|---|---:|---|
| Outbound re-engagement (leads + waitlist) | 198 | Owner-gated send |
| Background checks awaiting a decision | 64 | Manager |
| **Background checks with no eligibility status at all** | **64** | Data repair |
| Overdue payment follow-up | 26 | Owner-gated, money |
| No contact method on file (8 ticket + 4 bgcheck) | 12 | Find contact first |

The middle row is a finding in its own right: **67 of 299 background checks carry no `eligibility_status`.** They are in the queue because a field is *missing*, not because anyone is deliberating. That is a data-quality task masquerading as a decision task — and it inflates the apparent decision backlog by roughly double.

`ticket_collect` deserves a note: all 8 have **no phone and no email**, because the generator explicitly inserts `NULL` for phone. Those tasks were never actionable by CHUMMO in any form.

---

## Apply sequence (postconditions before trust)

```sql
select public.classify_va_tasks(true);   -- (a) dry run; require "reconciles": true
select public.classify_va_tasks(false);  -- (b) persist
```
Then (c) every row classified, 0 unclassified · (d) distribution sums to total · (e) `triaged_at`/`triaged_by` present on every classified row · (f) `status` unchanged (`pending` 17,761 / `blocked_dnc` 45) · (g) **second pass writes 0** — proves idempotency · (h) advisors show no new SECURITY DEFINER function and no new RLS-without-policy table.

The full block is at the bottom of the migration file.

---

## Recommended follow-ups

1. ~~**Fix the generator.**~~ ✅ **Now staged** as `20260904010000_generate_va_tasks_idempotent_STAGED.sql` — keyed on `(category, source_table, source_id)`, NOT the `subject_key` composite (see "Why the key is *not* `(category, subject_key)`" below). Covers `bgcheck_review` only; the other four need their source primary key threaded through first.
2. **The 64 missing eligibility statuses** are the cheapest real work in the whole audit — a data fix that shrinks the decision queue by half.
3. **`triage` is the CEO decision queue.** Once populated, the count of `needs_approval` grouped by category is exactly the "🔴 N decisions require your attention" surface, with no new tables.


---

## The durable fix: idempotent generation

**Staged:** `supabase/migrations/_staged/20260904010000_generate_va_tasks_idempotent_STAGED.sql`

The classifier treats a symptom. `generate_va_tasks()` INSERTs the same subjects daily, so the table grows ~300 rows/day forever. Triage cannot safely compensate for non-idempotent generation — even a perfect classifier leaves a growing historical artifact masquerading as a queue.

### Why the key is *not* `(category, subject_key)`

The obvious key is the `name|phone|email` composite. **The evidence says it is not a key.**

> Of 163 latest `lead_reengagement` subjects, **64 (39%) match more than one `incoming_leads` row.**

A unique constraint on that composite would silently **collapse distinct leads into one work item**. That is strictly worse than duplicating them: duplication is visible and countable, collapse is invisible and lossy.

So identity comes from the **source row**, not the person:

```
UNIQUE (category, source_table, source_id) WHERE source_id IS NOT NULL AND status = 'pending'
```

Partial, so the 17,442 historical rows keep `source_id IS NULL` and are untouched.

### Deliberately a partial fix

`generate_va_tasks_v2()` converts **only `bgcheck_review`** — the one category whose source row is identifiable today (`customer_id` in context, join proven 132/132). The other four still need their source primary key threaded through before conversion. Converting them without a real key is exactly the silent-collapse failure above.

A partial fix honest about its boundary beats a complete one that guesses at identity.

**The cron is untouched.** Job 2 still calls the old `generate_va_tasks()`. Cutting over is a separate explicit decision, and the migration says not to make it until the "run twice, table does not grow" postcondition has been observed.

---

## Change-control items — tracked, NOT silently corrected

| Item | State | Why untouched |
|---|---|---|
| `SYSTEM_AUDIT_2026/39_FLAGSHIP_PLATFORM_ARCHITECTURE.md` | Another session's file, **uncommitted edits in the working tree**. Collides on the `39_` prefix with `39_CORRECTIONS_AND_FIXES_APPLIED.md`. | Ownership not established. Renaming or reverting another session's in-flight work is a change-control decision, not a cleanup. |
| `moe_legacy` → `aixmos_credit` | Code renamed in `0f5282fcc`. **Database row `bbbbbbbb-…` is still `name: 'Moe Legacy'`.** Code and data disagree. | Needs an explicit data-reconciliation migration with owner sign-off, not an in-flight `UPDATE` while other work is staging. |
