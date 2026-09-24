# 5. Vehicle status lifecycle

Source: Fleet (`tblubnSDZkvsc9L6I`) `Vehicle Status` (`fldScUqs8HAfOIXPY`). Read live 2026-09-15.

---

## 5.1 The five states

`Available` · `Rented` · `Under Maintenance` · `Coming Soon` · `Retired`

Matches the plan's §5 list exactly — VERIFIED.

## 5.2 Live distribution — and the staleness finding

VERIFIED by query against `public.fleet` (43 vehicles):

| Status | Vehicles |
|---|---:|
| Rented | **21** |
| Retired | 6 |
| Under Maintenance | 5 |
| Available | 4 |
| **NULL** | **4** |
| Coming Soon | 3 |

**Two findings:**

1. **21 vehicles are marked `Rented`, but the fleet ceased operating in April 2026.** The
   status field is stale — it records the state at the moment the business stopped, not
   reality. Anyone treating `vehicle_status` as current is reading a five-month-old snapshot.
   This matters directly for the demo/sales path: a fleet dashboard shown to a prospective
   buyer will display 21 active rentals that do not exist.
2. **4 vehicles have NULL status** — not one of the five states. A `singleSelect` in Airtable is
   optional, so "no status" was always reachable, and `vehicle_status` is plain `text` in
   Supabase with no constraint (VERIFIED).

**Consistently enforced?** **No, on both counts.** The state set was never mandatory and the
values were never reconciled to reality at shutdown.

**Disposition: DECISION REQUIRED.**
- What is the correct status for the 21 `Rented` and 4 NULL vehicles today? (Likely `Retired`
  or a new `Inactive`, but that is the owner's call — Prime Directive 5.)
- Should status be `NOT NULL` with a CHECK constraint or an enum in the product? Recommend yes.

---

## 5.3 Legal transitions — not encoded

The plan asks for "legal transitions, who may make each, what must be true first."

**None of the three is encoded. VERIFIED** — `Vehicle Status` is a free `singleSelect` with no
automation, no formula, and no guard. Any value could move to any other value, by anyone with
edit access, at any time.

| Question | Encoded? |
|---|---|
| Which transitions are legal | **No** — all 20 ordered pairs are reachable |
| Who may make each | **No** — no role restriction, no `changed_by` |
| What must be true first | **No** — no preconditions |

**There is no transition history either.** The base records the *current* status and nothing
else. There is no way to answer "when did this vehicle go from Available to Rented", which
means utilisation and downtime — the metrics a fleet OS exists to produce — are not derivable
from this data at all.

**Disposition: DECISION REQUIRED — and this is a build item, not just a policy one.**

A proposed transition model is offered below **as a starting point for the owner to correct,
not as a rule to adopt.** It is inferred from ordinary fleet operations, not extracted from
the base, and is tagged INFERRED accordingly:

```
Coming Soon      -> Available            (onboarding inspection passed)
Available        -> Rented               (contract signed + handover complete)
Rented           -> Available            (vehicle returned + inspection)
Rented           -> Under Maintenance    (breakdown during rental)
Available        -> Under Maintenance    (scheduled service)
Under Maintenance-> Available            (service complete)
any              -> Retired              (terminal)
```

`Retired` should be terminal, and 6 vehicles already hold it. Whether `Retired` can be reversed
is **BUSINESS POLICY REQUIRED**.

The precondition on `Available -> Rented` is the real prize: it is where the handover checklist
(doc 7) becomes an enforced gate rather than a set of checkboxes nobody had to tick.
