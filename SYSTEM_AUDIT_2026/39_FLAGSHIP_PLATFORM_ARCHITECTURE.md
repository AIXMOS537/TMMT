# 39 · FLAGSHIP PLATFORM ARCHITECTURE
### Reinterpretation of the 2026-09-03 forensic audit — owner-directed

**Status:** supersedes the *reading* of `30_STOP_BUILDING.md` as "freeze the platform."
It does not overturn a single finding in it. Every number below comes from reports 01–38 or from the repo.

---

## 0 · The reconciliation

The audit and the flagship brief are not in conflict. They are talking about two different axes.

| | Audit's subject | Brief's subject |
|---|---|---|
| Axis | **Surface area** — routes, agents, tables added ahead of users | **Foundation** — identity, tenancy, customer, orchestration |
| Verdict | Stop widening | Start deepening |

`30_STOP_BUILDING.md` says *stop shipping new surfaces against empty tables.*
The brief says *stop treating the verticals as disconnected feature streams and build the substrate.*
**Both reduce to the same instruction: stop building sideways, start building down.**

So the operating line is not "freeze." It is:

> **Feature freeze on new surfaces. Foundation thaw on identity, customer and orchestration.**

---

## 1 · The one finding that changes meaning under the flagship reading

The audit scored P0-1 as *"the broken lead route."*

```
organizations.id            →  uuid            (database)
tenant-map.generated.ts     →  "aixmos" / "tmmt" / "moe-legacy"   (slugs)
OrgIdSchema (tenant.ts:60)  →  requires uuid
                            ↓
                   OrgRowShapeError  →  184 lost leads
```

Under the flagship reading it is not a broken route. **It is the platform's identity layer failing its first
integration test.** Every item in the brief — tenancy, Customer 360, product orchestration, per-tenant GHL,
per-tenant dispute state — resolves an org id. There is exactly one of these to fix and it is already P0.

> **Same fix. Ten times the value. Do it as the tenancy foundation, not as a hotfix.**

That is the whole reinterpretation. The rest of this document is the architecture that assumption implies.

---

## 2 · Four corrections to the brief

### 2.1 🟠 DisputeFox and MyFreeScoreNow — capability is *unverified*, in both directions

The brief designs bidirectional synchronization with both. Two of your own source files say that is impossible:

- `src/lib/credit-dispute/importers/disputefox.ts:12` — *"Dispute Fox has no public API. Operators export client data via screen capture + manual structured intake."*
- `src/lib/credit-dispute/importers/myfreescorenow.ts:12` — *"No public API — operators capture report data via affiliate portal."*

**Both comments appear to be out of date.** Public vendor material shows DisputeFox exposes webhooks, API
actions inside workflows, a Zapier app, and a documented GoHighLevel integration path; MyFreeScoreNow exposes
a Zapier app and an affiliate partner portal that third-party automation tools already drive.

That is *integration-grade*, not *native-API-grade*: no published REST spec, no schema contract, no
versioning guarantee. So the honest state is **UNKNOWN, and cheap to resolve.**

> **Owner action, not engineering:** ask each vendor for (a) API docs or webhook catalogue, (b) whether
> client/dispute/score records can be *read* programmatically, not just triggered on. One email each.
> **Do not design the sync layer until those two answers are in the repo.** Design the *adapter boundary* now
> — that is safe either way, and it is the same interface whether the transport ends up REST, webhook, Zapier
> or CSV.

### 2.2 🔴 The dispute engine's gate is legal, not architectural

Making disputes a first-class platform vertical does not change what blocks it:

- `20260707120000_dispute_engine.sql` — **nine tables, never applied to production.** Three UI routes and a
  CSV importer are built against tables that do not exist.
- `20260831200000_dispute_engine_rls.sql` is written with existence guards, so it is **a no-op today.**
- Performing disputes on a client's behalf is **regulated credit-repair activity.** TMMT is a **Maryland LLC**
  → MCSBA licensing + bond + prohibition on advance payment.

The architecture in this document builds the dispute subsystem *properly* — schema applied, org-scoped, welded
to Customer 360. It does **not** unlock *performing disputes*. Those are separable, and the split is the
product decision:

| Lane | Regulated? | Status |
|---|---|---|
| Credit **monitoring** (MFSN affiliate enrolment, score history, alerts) | No | **Open now** |
| Credit **education / guidance** (already built, disclaimers already tested) | No | **Open now** |
| **Referral** to a licensed CRO | No | **Open now** |
| **Performing disputes** for a client (letters sent on their behalf) | **Yes — MCSBA** | **Gated: lawyer's opinion in-repo, or separate licensed entity** |

Build the vertical. Ship three-quarters of it. Leave the fourth quarter behind a flag until legal clears it.

### 2.3 🟠 Multi-tenancy: the ambition is right, the current implementation is what broke revenue

The brief's endgame — other rental companies, dealerships and credit shops on isolated tenants — requires
multi-tenancy. The audit is right that it is **currently costing money**: `dealer_applications` = 0 rows,
9 organizations for effectively one business, and the 2026-08-27 host-tenancy work is the direct cause of P0-1.

The resolution is not freeze-or-finish. It is a split:

- **Identity & isolation layer → FINISH.** One org id type (uuid), everywhere. RLS is already done on 100% of
  tables — the hard part is behind you. This is P0 and it pays for itself immediately.
- **Tenant-facing surface (dealer applications, onboarding, white-label, billing) → HOLD** until tenant #1
  exists and is paying. That surface is what the audit means by "unpaid complexity."

### 2.4 🔴 NEW FINDING — the compliance gates are keyed to the wrong state (or the audit is)
> **OWNER DECISION / LEGAL INPUT REQUIRED** — carry this into the master backlog as its own line item.

Not in the audit, not in the brief. Found while grounding this document.

The credit vertical's entire legal safety system — `shared/compliance-gates/gates.config.json`, the mechanism
that *physically blocks* illegal features — is written for **Virginia**:

| Gate | What it asks the owner to do |
|---|---|
| `vdacs_registered_bonded` | Register with **Virginia VDACS**, post surety bond — *Va. Code §59.1-335.1* |
| `croa_contracts_attorney_approved` | Sign-off by a **licensed VA attorney** |
| `sbf_broker_registered` | Register as a **Virginia** sales-based financing broker with the SCC ($1,000) |
| `_launch_scope` | *"VIRGINIA ONLY at launch"* |

The audit says the opposite: *"TMMT is a **Maryland LLC**, which brings **MCSBA** licensing + bond
requirements"* (`19_CREDIT_LLC_FUNDING.md:32`, `30_STOP_BUILDING.md:13`).

Counted across the repo: **36 mentions of Virginia / VDACS · 4 of Maryland / MCSBA — all four in the audit
itself.** Nothing in the repo settles it: no articles of organization, no recorded state of formation.
And `docs/DMV-CLUBHOUSE-OFFICE.md` describes operating across **DC · Maryland · Virginia**, which — if the
credit vertical follows the rental footprint — implicates **three** credit-services regimes, not one.

**Why this outranks almost everything else in this document:** these gates exist to stop the owner from
breaking the law, and a gate that names the wrong statute does not protect anyone. Acting on it as written
means filing the wrong registration, in the wrong state, and binding the wrong bond — spending money to
become compliant with a law that may not apply while remaining non-compliant with the one that does.

**BACKLOG ITEM — OWNER DECISION / LEGAL INPUT REQUIRED.** Not resolvable by engineering: the repo does
not establish the entity's state of formation, and no amount of code reading will settle it.

**The question:** what state is TMMT Auto Services LLC formed in, and in which states
will credit clients live? Until that answer is in the repo, the gates stay `false` — which they already are.
No code is blocked by this. **Nothing here is urgent because everything it gates is already off.** But it must
be settled before the legal review in §2.2, or the lawyer gets briefed against the wrong statute.

---

## 3 · Layer model and the ownership contract

The single most useful artefact in the audit is `27_SOURCE_OF_TRUTH.md`. It is already a platform-architecture
document; it was just filed as a data-hygiene report. Promoted here to the contract.

```
                          AIXMOS  (agent / orchestration layer)
                                   │  reads state · proposes actions · never authors record-of-truth
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
   RENTAL / FLEET            CREDIT / FINANCE            BUSINESS SERVICES
        │                          │                          │
        │                  ┌───────┴───────┐                  │
        │              DISPUTES        MONITORING             │
        │              (gated)         (open)                 │
        └──────────────────────────┼──────────────────────────┘
                                   │
                    ╔══════════════▼══════════════╗
                    ║   PLATFORM CORE             ║
                    ║   org → user → role         ║
                    ║   person (Customer 360)     ║
                    ║   product enrolment         ║
                    ║   money · documents · audit ║
                    ╚══════════════╤══════════════╝
                                   │
     ┌──────────────┬──────────────┼──────────────┬──────────────┐
    GHL         DisputeFox       MFSN         Airtable        Stripe
 (contacts,     (disputes)     (scores)     (retire or      (payments)
 conversations)                              formalise)
```

**Ownership — one owner per fact, no exceptions:**

| Fact | Canonical owner | Everyone else |
|---|---|---|
| Contact, conversation, campaign, appointment reminder | **GoHighLevel** | app **mirrors, never authors** |
| Person / Customer 360 identity | **`people`** (app) | five other models collapse into it |
| Organization / tenant identity, authorization | **Supabase** — **uuid, one type, everywhere** | code never invents a slug id |
| Rental operations, fleet, money, compliance | **App** | GHL never authors these |
| Dispute case state | **DisputeFox** *(pending §2.1 answer)* | app mirrors for Customer 360 |
| Credit score / report / monitoring enrolment | **MyFreeScoreNow** *(pending §2.1)* | app stores history, not truth |
| Leads verification | **Decide: Airtable or `incoming_leads` — not both** | today three writers |

Rule the audit already wrote and this architecture adopts verbatim: **never duplicate contacts, campaigns,
nurture sequences, appointment reminders, or task queues.** GHL does these and GHL kept lead flow alive
through the entire 13-day outage. It scored **8/10 — the best integration in the system.**

---

## 4 · Customer 360 — the concrete first weld

The brief's central requirement is one customer, one record, many products. Today there are **six person
models** and the credit vertical is not attached to any of them:

```sql
-- supabase/migrations/20260707120000_dispute_engine.sql
CREATE TABLE IF NOT EXISTS credit_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_journey_id uuid,     -- no FK
  organization_id   uuid,     -- no FK, no RLS join
  party_id          uuid,     -- no FK, points at a table with 0 rows
  ...
```

Three foreign keys' worth of intent, zero foreign keys. `party_id` references `parties` (**0 rows**);
`portal_clients` (**0 rows**) is a seventh model. Meanwhile `people` holds 1,209 rows, GHL holds 1,642 contacts,
and `incoming_leads` holds 876 of which **759 have no status at all**.

**The weld, in order:**

1. `people` becomes canonical. `parties` and `portal_clients` are dropped (0 rows — free).
2. `credit_profiles.party_id` → **`person_id uuid REFERENCES people(id)`**, enforced.
3. `credit_profiles.organization_id` → **`NOT NULL REFERENCES organizations(id)`**, and the RLS policy joins
   through it like every other tenant table.
4. `people.ghl_contact_id` is the mirror key to GHL. One direction: GHL → app.
5. Everything a customer has — rental, credit profile, dispute case, enrolment, document, payment, task —
   hangs off `people.id` and is filtered by `organization_id`. That is Customer 360. There is no other trick to it.

Until step 3 exists, a "multi-tenant credit vertical" is a UI over an unscoped table.

---

## 5 · Capability matrix — the brief's 16 questions, answered on evidence

| # | Question | Answer today |
|---|---|---|
| 1 | What is already implemented | GHL sync (8/10) · auth (8/10) · RLS on 100% of 168 tables · 472 passing tests · credit **UI** (11 `/(learn)` + 3 dispute routes) · Metro2 letter generator |
| 2 | What is merely schema | **91 of 168 tables are empty.** Dispute engine: 9 tables **not in production at all.** `bookings`/`vehicles`/`payments` ~0 rows, 0 code references |
| 3 | What is connected | Supabase ↔ GHL ↔ Airtable ↔ Stripe ↔ Cal.com. Vercel 🔴 **20/20 deploys BLOCKED** |
| 4 | What has an API | GHL ✅ authenticated + idempotent + tested · Airtable ✅ · Stripe ✅ · **DisputeFox ⬜ unverified** · **MFSN ⬜ unverified** (§2.1) |
| 5 | What requires middleware | Both credit vendors. Adapter boundary exists (`importers/*.ts`, zod-validated) — transport does not |
| 6 | What can synchronize bidirectionally | **GHL only.** Everything else is one-way or manual today |
| 7 | What system owns each piece of data | §3. Currently contested on **Lead** (3 writers), **Person** (6 models), **Payment** (4 tables + free text) |
| 8 | What happens when sync fails | GHL: idempotency keys + `ghl_webhook_events`. Airtable: `sync_events`. **Everything else: silently.** A 13-day / 2,197-error outage went unnoticed — Sentry and Mixpanel are wired but nothing alerts |
| 9 | How tenant isolation works | RLS + `acting_org_id()` + `is_org_member()`, fail-closed. **Sound design, broken identity** — uuid vs slug (P0-1) |
| 10 | How customer identity is reconciled | **It is not.** §4 |
| 11 | How products trigger each other | **GHL tags today** — `src/lib/credit-dispute/ghl-tags.ts` is a real, working cross-product state bridge (`mfsn-enrolled`, `disputefox-active`, `funding-prep`, `dispute-round-N-sent`). Undocumented as architecture; it *is* the orchestration layer that exists |
| 12 | How GHL workflows interact with app state | Inbound webhooks (idempotent, tested) + outbound tags. Per-tenant via `org_ghl_connections` — subaccount or foreign-agency, credentials in Supabase Vault. **This is the best-built thing in the repo and the template for every other integration** |
| 13 | How DisputeFox interacts with the dispute engine | CSV import → zod schema → app tables. **No live link. Target tables not in production** |
| 14 | How MFSN interacts with credit state | CSV/manual import → `credit_reports` / `tradelines` / `credit_score_history`. `smartcredit_member_id` column suggests a third, older vendor bridge |
| 15 | How AIXMOS safely operates all of this | Compliance layer is genuinely strong — quiet hours, DNC fail-closed, opt-out, PII redaction, all tested. **And the agent has held 0 conversations.** Capability without activation |
| 16 | How it becomes repeatable for multiple orgs | ~70% built; DB isolation done. Blocked on org identity (P0-1), `moe_legacy` still live in the tenant map, and **0 dealer applications** |

---

## 6 · Build order

Foundation-first, revenue-honest. Ranks 1–3 are unchanged from `31_BUILD_NEXT.md` — they are prerequisites for
everything in the brief, not competitors to it.

| # | Work | Why it is here | Effort |
|---|---|---|---|
| **1** | **Unblock deploys** — stop the `swarm-coord` push loop | 20/20 blocked. Nothing below can ship until this clears | minutes |
| **2** | **One org id type: uuid, everywhere** | P0-1. **This is the platform identity layer, not a hotfix.** Reopens the revenue door and unblocks every tenancy item in the brief | hours |
| **3** | **Work the 81 approved-never-placed + 104 waitlisted** | 185 consented, reachable people. The only revenue item in the entire audit needing **zero engineering**. Draft-never-send, round-robin through GHL | days, no code |
| **4** | **Alerting on `/api/leads/webhook`** | A 13-day outage went undetected. Prevents recurrence of the #1 finding | hours |
| **5** | **Pull the 173 missing migrations + generate DB types** | Repo describes 41 of 214 applied migrations. Until it does, nothing below can be tested safely. Generated types turn column typos into compile errors — the exact class of bug that shipped 3 broken Interfaces screens | hours |
| **6** | **Customer 360 weld** (§4) — `people` canonical, drop the two 0-row models, FK + org-scope `credit_profiles` | The brief's core requirement. Cheap because the competing tables are empty | days |
| **7** | **Money as `amount_cents`** — backfill 32 free-text rows by hand | Nothing financial is automatable until this lands. 35 rows = one afternoon | days |
| **8** | **Two owner answers** — vendor API capability (§2.1) and **jurisdiction** (§2.4) — then apply the dispute-engine migration, org-scoped | Turns a UI-over-nothing into a real subsystem. **Performing disputes stays flagged off** | owner + days |
| **9** | **Adapter boundary** — one `CreditDataSource` interface behind which CSV / webhook / API all sit | Written once, survives whatever the vendors answer | days |
| **10** | **Arrears automation** — 3-day grace, late fee, `PAYMENT_ISSUE` | *"The business died of collections, not demand."* Needs #7 | week |

**Held until a paying tenant exists:** dealer applications, white-label theming, tenant billing, tenant
onboarding UI, new AI agents, new route groups, dispatch/rescue.

---

## 7 · What the flagship actually is

Not *TMMT rental software*. Not *a credit-repair app*.

> **A multi-tenant business operating platform whose core is one customer identity, one org identity, and a
> product-enrolment spine — with vertical modules for automotive, credit, funding and business services, an
> orchestration layer (GHL today, AIXMOS over it), and TMMT as tenant zero and reference implementation.**

That framing is correct, it is what the code is already reaching for, and the audit's own
`27_SOURCE_OF_TRUTH.md` is its first chapter. What the audit adds is the discipline that makes it survivable:

> **No expansion of surface area without a validated customer or revenue reason; foundational work
> continues where it unblocks, protects, or operationalizes the flagship.**

This is deliberately *not* "nothing new ships until something existing has a paying user." That wording
carries the right discipline but recreates the freeze this document rejects — it reads as a prohibition on
all work, when the thing to prohibit is **widening**. Foundation work has a different test: does it unblock,
protect, or operationalize what already exists? Ranks 1–7 all pass it while serving a customer who exists
today.
