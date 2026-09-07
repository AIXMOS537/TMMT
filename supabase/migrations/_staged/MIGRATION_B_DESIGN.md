# Migration B — canonical customer identity for `ticket_collect`

**Owner decision LOCKED 2026-09-06:** customer-level aggregation preserved.
**Authority:** design + dry-run only. **No production mutation authorized.**
**Status:** PARTIAL — three dry-run measurements are gate-blocked (see owner packet).

## ★ ROOT CAUSE — it is not a data problem, it is an input problem

`src/app/(admin)/tickets/page.tsx:95`

```tsx
<FormField label="Customer">
  <input name="requested_by_customer" defaultValue={...} />
</FormField>
```

A **bare text input**. No customer picker, no dropdown, no FK. Every ticket's customer is
**typed by hand by an admin.** `Aayan` / `Aayan ` / `Aayan Khan` are three human typings,
not three data records. **A backfill alone cannot fix this — the form recreates the problem
on the next ticket.** Section B7 is therefore not optional polish; it is the actual repair.

## Canonical customer — `public.active_customers`
| property | value |
|---|---|
| PK | `id` uuid |
| tenant | `org_id` → `organizations` (FK exists — cross-org isolation available) |
| identity fields | `customer_name`, `contact_phone`, `contact_email`, `airtable_id` |
| **corroborating signal** | carries **`ticket_balance_status`** — the *same column name* as on `tickets` |
| rows | 35 |

That shared column is the strongest evidence: the customer-level ticket-balance concept is
already modelled on `active_customers`, and `tickets.ticket_balance_status` /
`tickets.total_customer_ticket_balance` are denormalised copies of it.

**Open question:** `former_customers` (1 row) exists. A customer with unpaid tickets may have
become "former". Whether canonical identity spans active+former is an owner question — see
the decision register.

## Upstream identity — STRONG HYPOTHESIS, needs one check
- `tickets.airtable_id` and `active_customers.airtable_id` both exist → both synced from Airtable.
- The Airtable field is literally **`"Requested By (Customer)"`**
  (`daily_command_center.py:289`). The parenthetical `(Customer)` is the Airtable convention
  for a **linked-record** field.
- If it is a linked record, Airtable held a real customer record ID and **the sync flattened it
  to display text**, discarding TIER A identity.
- `tickets.customer_linked` exists and **no application code writes it** (grep: zero writers) —
  consistent with a linked-record column that was created then abandoned.

**If `customer_linked` is populated, Migration B collapses to a trivial re-key and no
entity resolution is needed at all.** Owner packet Q2 settles this. **Check it before
building any matching.**

## Entity-resolution ladder (only if Q2 comes back empty)
| Tier | Rule | Auto-apply? |
|---|---|---|
| **A** | `customer_linked` / Airtable record id → `active_customers.airtable_id` | YES — referential |
| **B** | normalised 10-digit `tickets.phone` = `active_customers.contact_phone`, unique within `org_id` | YES |
| **C** | `lower(btrim(name))` unique within `org_id` **and** no Tier-B conflict | YES |
| **D** | multiple candidates, or Tier-B and Tier-C disagree | **NO — quarantine** |
| **E** | no candidate | **NO — quarantine** |

Tier B before Tier C deliberately: a phone is more stable than a typed name. But phone is
**not** promoted to referential truth — one phone mapped to 3 distinct `customer_id`s in
`background_checks`, so Tier B still requires uniqueness within tenant.

**Never promote fuzzy similarity to canonical identity.** No Levenshtein, no soundex, no
"closest match".

## Staged design

### B1 — schema (additive, reversible)
```sql
alter table public.tickets add column if not exists customer_id uuid
  references public.active_customers(id);
create index if not exists tickets_customer_id_idx on public.tickets(customer_id);
alter table public.tickets add column if not exists customer_match_tier text;
alter table public.tickets add column if not exists customer_match_evidence jsonb;
```
Nullable throughout. `customer_match_tier` / `_evidence` record **which rule matched and why** —
required so a match can be audited or reversed individually.

### B2 — deterministic backfill
Populate Tier A/B/C only. Writes `customer_match_tier` + evidence on every row it touches.
Rows failing tenant compatibility are never linked.

### B3 — quarantine surfacing
Tier D/E stay `customer_id IS NULL` with `customer_match_tier` set to `ambiguous` / `unmatched`.
They are **visible and countable**, never silently dropped. Operational path = owner decision
(see register); do not invent a new workflow.

### B4 — validation (must pass before B5)
- every linked ticket's customer exists and shares `org_id`
- zero rows linked at Tier D/E
- `customer_match_tier` non-null on every qualifying ticket

### B5 — generator cutover
`group by t.customer_id`, `source_id = t.customer_id::text`, threshold `HAVING sum(amount) >= 50`
**preserved unchanged**. Human-facing `subject_name` keeps `customer_name` for readability —
**prose stays display-only; identity is the uuid.**
Tickets with `customer_id IS NULL` are **excluded** from generation and remain in quarantine.

### B6 — existing task reconciliation
Classify current `ticket_collect` rows KEEP / REKEY / SPLIT / REVIEW / STALE. Deterministic
mappings only. **No production task deleted or rewritten in this mission.**

### B7 — ★ forward ingestion fix (NOT optional)
Replace the free-text `<input>` in `src/app/(admin)/tickets/page.tsx` with a customer picker
writing `customer_id`. Without B7, B2's backfill decays immediately and the defect returns
on the next hand-typed ticket.

## Rollback
| Stage | Rollback |
|---|---|
| B1 | `alter table tickets drop column customer_id, drop column customer_match_tier, drop column customer_match_evidence;` |
| B2 | `update tickets set customer_id=null, customer_match_tier=null, customer_match_evidence=null where customer_match_tier is not null;` — scoped to rows this migration set |
| B5 | restore the generator from `20260906150000_…dnc_enqueue_filter.sql` |
| B7 | revert the component |

## Decision register — open owner questions
1. **`$50` threshold — POLICY UNVALIDATED.** Implementation provenance only; no written policy
   found. Preserved unchanged in B5. Not decided by this mission.
2. Does canonical customer span `active_customers` **+ `former_customers`**?
3. Operational path for Tier D/E quarantined tickets.
4. Is `customer_linked` the discarded Airtable link? (owner packet Q2)

---

# ★ REVISION 2 — 2026-09-06 · THE FK TARGET WAS WRONG, AND THE PLAN GETS SMALLER

## `active_customers` is a LIFECYCLE table, not an identity domain

Evidence:
- `active_customers` and `former_customers` are **separate tables with separate uuid PKs**,
  sharing 12 columns (`airtable_id`, `customer_name`, `contact_phone`, `contact_email`, …).
- `former_customers` carries `reason_for_removal`, `rental_end_date` — a lifecycle destination.
- The only code path is `adminUpsert("former_customers", record)` — a **human re-entry**, not
  an id-preserving move.

**Therefore a customer who becomes "former" plausibly gets a NEW uuid in a DIFFERENT table.**
An FK to `active_customers.id` would break on that transition — a perfect FK to the wrong
lifecycle entity, creating the next migration rather than ending this one.

## ★ `public.people` is the durable identity spine — and it already exists

`20260820000000_people_form_spine.sql`:

```sql
-- People spine: one human, many forms, many ops tables.
create table public.people (
  id uuid primary key default gen_random_uuid(),
  full_name text, email text, phone_e164 text, phone_digits text,
  tenant_slug text not null default 'aixmos',
  ghl_contact_id text,
  incoming_lead_id uuid,
  active_customer_id uuid,      -- POINTS AT the lifecycle table
  ...
);
create unique index people_email_uniq on public.people (lower(email))
  where email is not null and length(trim(email)) > 0;
create unique index people_phone_uniq on public.people (phone_digits)
  where phone_digits is not null and length(phone_digits) >= 7;
```

This is the canonical domain:
- durable uuid PK that **survives lifecycle transitions** — it *references* `active_customer_id`
  rather than being replaced by it
- **entity resolution is already built and DB-enforced**: unique normalised email, unique
  `phone_digits`
- already populated from `incoming_leads` **and** `active_customers` (1,209 rows)

## Consequence — DELETE COMPLEXITY

The Tier A/B/C ladder I designed **largely collapses**. `people` *is* the resolution layer.
Matching a ticket becomes a deterministic join on already-unique normalised keys, not an
entity-resolution framework I build and defend.

**Revised target:** `tickets.person_id → people.id`

**Revised ladder:**
| Tier | Rule | Note |
|---|---|---|
| **A** | `tickets.customer_linked` → upstream id, if Q2 shows it populated | still unmeasured |
| **B** | `regexp_replace(tickets.phone,'\D','','g')` = `people.phone_digits` | **referential** — uniqueness is DB-enforced, not assumed |
| **C** | `lower(btrim(tickets.requested_by_customer))` = `lower(people.full_name)`, unique | weakest; only where B yields nothing |
| **D/E** | ambiguous / unmatched | quarantine, never guess |

Tier B is now *stronger than in Revision 1*: `people_phone_uniq` means one `phone_digits` maps
to at most one person **by constraint**. The earlier objection (one phone → 3 `customer_id`s in
`background_checks`) does not apply to `people`, because `people` forbids it.

## ⚠️ NEW ISSUE — tenant model mismatch, must resolve before B1
- `tickets.org_id` is **uuid** → `organizations(id)`
- `people.tenant_slug` is **text** (`'aixmos'` / `'tmmt_property'`)

These are different tenancy mechanisms. A join across them is not tenant-safe until the
mapping is established. **Do not create the FK until `org_id` ↔ `tenant_slug` is resolved.**

## ⚠️ GAP — `former_customers` is not in the spine
The spine migration inserts from `incoming_leads` and `active_customers` **only**. Former
customers with open tickets may have no `people` row. Sizing this requires a gated query;
it is added to the owner packet register.

## Superseded
Revision 1's FK target (`active_customers.id`) is **withdrawn**. Its Tier ladder is retained
only as the fallback for rows `people` cannot resolve.

---

# ★ REVISION 3 — 2026-09-06 · TENANCY IS A HARD BLOCKER

## `people`: DESIGNED AS SPINE · PARTIALLY OPERATING AS SPINE
- **Written by:** the one-time backfill in `20260820000000` (3 inserts from `ghl_contacts`,
  `incoming_leads`, `active_customers`) **plus** `linkFormToPerson()` in
  `src/lib/people/upsert.ts`.
- **That function IS live** — called from `src/app/workflow-actions.ts:19` and
  `src/app/forms/actions.ts:8`.
- **But only on the FORM-INTAKE path.** Ticket creation and admin customer creation never
  call it. No migration after `20260820000000` touches `people`.

**Verdict: OPERATING, but only for form submissions.** It is a real spine for inbound forms
and a stale 2026-08-20 snapshot for everything else. Promoting `people.id` to an FK target is
defensible *only if* B7 also threads ticket creation into it — otherwise the FK points at a
table that ticket-world never updates.

## ★ HARD BLOCKER — `org_id` and `tenant_slug` are unrelated mechanisms
| | |
|---|---|
| `tickets.org_id` | **uuid** → `organizations(id)`, 9 rows |
| `people.tenant_slug` | **text** — observed values `'aixmos'`, `'tmmt_property'` |

**`organizations` has NO slug column.** Its columns are `id`, `name`, `kind`, `airtable_id`,
`partner_app_slug` (a *partner app* identifier, not a tenant slug), … There is **no
`organizations.slug`**, and `organization_domains` maps `org_id → hostname`, not to a slug.

**No mapping exists in schema or application code** — grep for `tenant_slug` alongside
org/organization returns nothing.

### Consequence
`tickets.person_id → people.id` **cannot be made tenant-safe today.** Validating that a
ticket's `org_id` and a person's `tenant_slug` denote the same tenant requires a mapping that
does not exist. **Inventing one is exactly the guess this whole effort has refused to make.**

**Migration B is blocked on an architecture decision, not on a measurement.**

## ⚠️ `people` uniqueness is GLOBAL, not tenant-scoped
```sql
create unique index people_phone_uniq on public.people (phone_digits)
  where phone_digits is not null and length(phone_digits) >= 7;
create unique index people_email_uniq on public.people (lower(email))
  where email is not null and length(trim(email)) > 0;
```
Neither index includes `tenant_slug`.

- **Upside:** cross-tenant identity collision is *structurally impossible* — one phone maps to
  at most one person, period.
- **Downside:** a human who exists in two tenants gets **one row with one `tenant_slug`** —
  first writer wins. That is a single-tenant assumption embedded in a multi-tenant schema.

Correction to Revision 2: phone uniqueness makes phone strong **resolution evidence**, and
`people.id` the resulting identity. The FK still points at `people.id`, never at the phone.

## Owner decisions now required (Migration B cannot proceed without #1)
1. **Define the tenancy relationship.** Either add `organizations.slug` with a contractual
   1:1 to `tenant_slug`, or move `people` to `org_id`, or declare single-tenant explicitly.
2. Is global (non-tenant-scoped) uniqueness on `people` intentional?
3. Should `former_customers` be represented in `people`? The spine backfill omitted them.
4. `$50` threshold — **POLICY UNVALIDATED**, unchanged.

---

# ★ REVISION 4 — 2026-09-06 · TENANCY RESOLVED AS A SEMANTIC MISMATCH

## The mapping does not exist because the concepts do not correspond

`people.tenant_slug` is **not a tenant identifier.** It is derived from the HTTP request host:

```ts
// src/lib/people/upsert.ts:40-48
const site = explicit?.site ?? siteFromHost(h.get("host"), h.get("x-forwarded-host"));
const tenantSlug = explicit?.tenantSlug
  ?? h.get("x-aixmos-tenant")
  ?? (site === "aixmos" ? "aixmos" : "tmmt_property");
```

and `siteFromHost` (`src/lib/forms/site.ts:7`) returns `FormSite = "aixmos" | "tmmt"` by
matching the request hostname against `aixmos.com` / `allinonemanagementsolutions` / TMMT
public hosts.

| | meaning | cardinality |
|---|---|---|
| `people.tenant_slug` | **which public website the form was submitted on** | **2** |
| `tickets.org_id` | **which business organization owns the ticket** | **9** |

These are categorically different. It is not a naming mismatch that a slug column would fix —
**2 brand sites cannot map onto 9 organizations.** `tenant_slug` is *provenance*, not tenancy.

**Code evidence:** `tenant_slug` appears in exactly two places in the entire application
(`upsert.ts:96`, `:125`), and **no file that references `tenant_slug` also references
`org_id` or `organizations`.** No code path resolves both. The mapping was never built
because it was never a mapping.

## ★ SELF-CORRECTION — Revision 3's "multi-tenancy bug" was wrong

Revision 3 flagged global (non-tenant-scoped) uniqueness on `people_phone_uniq` /
`people_email_uniq` as a single-tenant assumption leaking into a multi-tenant schema.
**That was incorrect.** Since `tenant_slug` denotes a *website*, not a tenant, one human who
submits forms on both sites **should** be one `people` row. Global uniqueness on normalised
phone/email is **coherent and correct** for a person spine.

The open question is not "why is uniqueness global" — it is **"`people` has no organization
relationship at all."**

## Consequence for Migration B
`tickets.person_id → people.id` cannot be tenant-safe, because `people` carries **no
organization relationship of any kind**. Adding `organizations.slug` (former Option A) is now
positively **wrong** — it would map 9 organizations onto a 2-value site discriminator.

## Owner decision — revised options

### ~~Option A — add `organizations.slug` ↔ `tenant_slug`~~ **WITHDRAWN**
Refuted by cardinality (9 vs 2) and by semantics (`tenant_slug` is a website).

### ★ Option B — give `people` a real organization relationship *(recommended)*
Add `people.org_id uuid references organizations(id)`, **retain `tenant_slug` unchanged** as
form-provenance.
- **schema:** one nullable FK + index. Additive.
- **application:** `linkFormToPerson` must resolve an org; today it knows only the host.
  That resolution is the actual work and needs a rule (e.g. `organization_domains.hostname`,
  which already maps `org_id → hostname` — the nearest existing authoritative mechanism).
- **backfill:** derivable for rows sourced from `active_customers` / `incoming_leads`, which
  already carry `org_id`. Rows sourced from `ghl_contacts` may not.
- **integrity:** enables a tenant-safe `tickets.person_id` FK check.
- **global uniqueness:** unaffected — one human stays one row; org becomes an attribute, and
  a person legitimately reachable by two orgs is then a modelling question to settle
  deliberately, not by accident.
- **rollback:** drop column.

### Option C — declare single-tenant
Contradicted by 9 populated `organizations` rows and live `org_id` FKs across the schema.

### Option D — a person↔organization join table
If one human can belong to several organizations, Option B's single FK is wrong and a
`people_organizations` join is the correct shape. **This cannot be decided from schema
evidence** — it is a business question about whether customers are shared across orgs.

**Recommendation: Option B, unless customers are shared across organizations, in which case
Option D.** This is a recommendation requiring owner approval, not authorization to implement.

---

# ★ REVISION 5 — 2026-09-06 · RETRACTION: THE MAPPING EXISTS

## I was wrong. Migration B is NOT blocked on architecture.

Revision 3 and 4 concluded "no authoritative org ↔ tenant mapping exists."
**That conclusion is withdrawn.** It exists, in `src/lib/platform/tenant-org.ts`, whose own
header reads:

> *"The bridge between the two tenancy systems, which until now did not know about each other."*

```ts
export const HOUSE_ORG_IDS = {
  tmmt:   "8e651b25-e7c8-4356-af64-1716a82053b0",
  aixmos: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
} as const;

const SLUG_TO_ORG: Record<string, string> = {
  tmmt: HOUSE_ORG_IDS.tmmt,
  tmmt_property: HOUSE_ORG_IDS.tmmt,     // <- exact people.tenant_slug value
  "tmmt-rentals": HOUSE_ORG_IDS.tmmt,
  aixmos: HOUSE_ORG_IDS.aixmos,          // <- exact people.tenant_slug value
  aixmos537: HOUSE_ORG_IDS.aixmos,
};
export function orgIdForTenantSlug(slug): string | undefined
export function orgIdForHostStatic(host): string | undefined
```

**Both observed `people.tenant_slug` values are keys in that map.**

### Why the earlier search missed it
I grepped for files containing `tenant_slug` **and** `org_id`/`organizations`.
`tenant-org.ts` contains neither literal — it uses `slug` and `HOUSE_ORG_IDS`. A negative
grep result was reported as "no mapping exists." **Absence of a grep hit is not absence of a
mechanism** — the same error as the earlier "364 has no evidentiary basis."

### The resolution model is deliberately two-tier
1. **House brands** — `orgIdForTenantSlug()` / `orgIdForHostStatic()`, in-code constants.
   Documented rationale: avoid a DB round trip in Edge middleware for an answer that never changes.
2. **Everyone else** — `public.org_id_for_host(text)`, SECURITY DEFINER, reading
   `organization_domains`, which has `unique index on (hostname)` so *"a hostname resolves to
   exactly one org."*

`orgIdForHostStatic` returns `undefined` for non-house hosts **on purpose**:
> *"That is not a failure: it is the caller's cue to fall back to `org_id_for_host()`.
> Guessing here would be worse than admitting ignorance, because a wrong org id silently
> writes one tenant's data into another's."*

`moe-legacy` is deliberately excluded from the house map — it has an organizations row but
resolves through the database like any other tenant.

### What this changes
- Option A stays withdrawn (still don't add `organizations.slug`).
- **Option D (many-to-many) is now implementable** — owner-decided, and the org resolver it
  needs already exists and is in production use via `src/middleware.ts`.
- The remaining gap is narrow: **`linkFormToPerson()` resolves `tenant_slug` from the host but
  never resolves the org**, though both tiers of the resolver are available to it.

Staged: `_staged/20260907000000_people_organizations_STAGED.sql`
