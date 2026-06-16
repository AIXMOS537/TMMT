# Memory Fabric — Design Spec

**Date:** 2026-06-16
**Status:** Draft — pending owner review
**Author:** Master-engineer planning pass (Taha)
**Builds on:** `20260516120000_workflow_engine.sql` (`activity_logs`, `profiles`, `organizations`, `cases`), `20260516140000_ops_command_center.sql` (`ops_threads`, `ops_messages`), `20260520120000_aixmos_program_cube.sql` (`program_audit_log`), `2026-05-21-brain-dump-clickup-agent-design.md`

---

## The one-sentence goal

A single, durable layer that **captures everything every actor does** — AI agents, operators, team members, bosses/owners, and outside parties (customers, vendors, lawyers) — and lets **any agent recall the relevant slice of it** before it acts, **without the owner having to manage, remember, or feed it anything**.

## Why this is needed (the gap)

Memory is not a switch you flip on an AI. Every Claude / AIXMOS session is *ephemeral* — it forgets on container reclaim. "Remembering across the board" therefore means building a **shared store that lives outside any one agent or person**, that everyone writes to and every agent reads from.

You already have the seed of this — but it is too narrow:

| What exists today | The limitation |
|---|---|
| `activity_logs(case_id, actor_id→auth.users, action, details)` | **Only** logs authenticated humans, **only** when tied to a `case`. An AI agent, a logged-out operator, or an outside party (e.g. John Lopez texting in) cannot be recorded at all. |
| `program_audit_log`, `ops_messages`, `case_status_history` | Siloed per-feature. No unified timeline, no recall. |
| `CLAUDE.md` | Persistent memory, but only for the *codebase* — nothing about customers, ops, or decisions. |
| MCP tools (Slack, ClickUp, Gmail, Quo, Airtable, Calendar) | Rich human activity flows through them, but **none of it is captured** into a queryable memory. |

The fabric closes all four gaps with three layers: **Capture → Store → Recall.**

---

## Architecture: the three layers

```
                          ┌─────────────────────────────────────────┐
  ACTORS                  │              CAPTURE                     │
  ───────                 │                                          │
  AI agents ──────────────┤  remember() MCP tool  ───────────────┐  │
  operators ──────────────┤  (agents call directly)              │  │
  team members ───────────┤                                      ▼  │
  owners / bosses ────────┤  ingestors (webhook + scheduled) ──► events │
  customers / vendors ────┤  Slack · ClickUp · Gmail · Quo ·      │  │
  (outside parties)       │  Calendar · Airtable · app actions    │  │
                          └──────────────────────────┬───────────────┘
                                                      ▼
                          ┌─────────────────────────────────────────┐
                          │               STORE  (Supabase)         │
                          │  memory_events   — raw, append-only      │
                          │  memory_facts    — distilled, durable    │
                          │  memory_entities — people/vehicles/deals │
                          │  + pgvector embeddings on both           │
                          └──────────────────────────┬───────────────┘
                                                      ▼
                          ┌─────────────────────────────────────────┐
                          │               RECALL                    │
                          │  recall(query, scope) MCP tool          │
                          │  → semantic + recency + role-filtered    │
                          │  every agent calls this BEFORE acting    │
                          └─────────────────────────────────────────┘
```

### Layer 1 — CAPTURE

The principle that makes it "across the board": **you cannot observe humans directly — you capture them through the systems they already use.**

- **AI agents** call the `remember()` MCP tool on every meaningful action (they're code — trivial).
- **App actions** (admin upserts, form submissions) write events via the existing server-action path.
- **Humans (operators, team, owners)** are captured by **ingestors** that pull from the tools they already live in:
  - **Slack** → messages/decisions (MCP already connected)
  - **ClickUp** → task create/assign/complete (already the task source of truth)
  - **Gmail / Outlook** → sent/received threads tied to customers
  - **Quo** → calls + SMS (the John Lopez channel)
  - **Calendar** → meetings, appointments
  - **Airtable** → legacy records still in use
- **Outside parties** (customers, vendors, a lawyer texting in) appear as events with an *unauthenticated actor* — which today's `activity_logs` cannot represent. The fabric fixes this with a polymorphic actor (below).

Every captured event is tagged with **actor + role + entity + outcome** so it can later be filtered and attributed.

### Layer 2 — STORE (Supabase / Postgres + pgvector)

Three new tables, designed to *coexist with* and eventually *supersede* the narrow `activity_logs`.

**`memory_entities`** — the nouns the business cares about (a person, vehicle, deal, vendor, org). Gives every event/fact something stable to hang on.

```
id            uuid pk
kind          text         -- 'person' | 'vehicle' | 'deal' | 'vendor' | 'org' | 'other'
display_name  text
org_id        uuid -> organizations(id)
external_refs jsonb        -- { clickup_id, airtable_id, phone, email, fleet_id, ... }
created_at    timestamptz
updated_at    timestamptz
```

**`memory_events`** — the raw, append-only timeline ("across the board"). Polymorphic actor so it can hold *anyone*.

```
id             uuid pk
org_id         uuid -> organizations(id)
actor_kind     text NOT NULL    -- 'ai_agent' | 'operator' | 'team' | 'owner' | 'external' | 'system'
actor_id       uuid             -- -> auth.users(id) when known, else null
actor_label    text             -- 'CAPTAIN agent', 'John Lopez (lawyer)', operator name
source         text NOT NULL    -- 'app' | 'slack' | 'clickup' | 'gmail' | 'quo' | 'calendar' | 'airtable' | 'agent'
action         text NOT NULL    -- verb: 'sent_sms', 'created_task', 'approved', 'note', ...
entity_id      uuid -> memory_entities(id)
summary        text             -- one-line human-readable
details        jsonb DEFAULT '{}'
embedding      vector(1536)     -- pgvector, for semantic recall
occurred_at    timestamptz NOT NULL
created_at     timestamptz NOT NULL DEFAULT now()
dedupe_key     text UNIQUE      -- 'quo:msg:<id>' etc. so re-ingest is idempotent
```

**`memory_facts`** — distilled, durable knowledge (not raw events): decisions, preferences, standing truths. This is what makes recall *fast and trustworthy* instead of re-reading the whole timeline.

```
id           uuid pk
org_id       uuid -> organizations(id)
entity_id    uuid -> memory_entities(id)
fact         text NOT NULL    -- 'Prefers SMS to the 571 number', 'Owner approved fleet +5 on 6/15'
confidence   real             -- 0..1
source_event uuid -> memory_events(id)
valid_from   timestamptz
valid_to     timestamptz      -- null = still true (temporal: supersede instead of delete)
embedding    vector(1536)
created_at   timestamptz
```

Notes:
- **`pgvector`** extension enables semantic search on `embedding`.
- **Temporal by design**: facts are *superseded* (set `valid_to`), never destructively overwritten — so the system can answer "what did we believe last month?"
- **RLS** (you already use it) scopes rows by `org_id` and actor role — owners see everything; operators see their slice. This is how owner-level work and operator-level work coexist safely in one store.
- The legacy `activity_logs` is **bridged, not broken**: a one-time backfill copies existing rows into `memory_events`, and the app keeps writing both during a transition window.

### Layer 3 — RECALL

The missing link in today's setup. A small **MCP "memory server"** exposing exactly two tools so *every* agent — Claude Code, the brain-dump agent, the AIXMOS specialist personas, dispatch CAPTAIN — shares one brain:

- **`remember(actor, action, entity, summary, details)`** → writes a `memory_events` row (and, when warranted, a `memory_facts` row). Idempotent via `dedupe_key`.
- **`recall(query, scope?)`** → returns the relevant slice: semantic match on `embedding` + recency boost + role/scope filter. Returns distilled `facts` first, then supporting `events`.

Agents are instructed (via their persona prompts + `CLAUDE.md`) to **`recall()` at the start of a task and `remember()` at the end.** That single discipline is what produces "remembers across the board, without your input."

---

## How "without my help or understanding or input" is actually achieved

Honest framing — full autonomy is the *operating* state, reached after a *one-time* wiring:

| Concern | How it's handled |
|---|---|
| Owner shouldn't feed it data | Ingestors pull automatically from Slack/ClickUp/Gmail/Quo/Calendar; agents write via `remember()`. No manual entry. |
| Owner shouldn't manage it | Append-only + scheduled ingestion + idempotent dedupe = self-maintaining. Runs on the existing always-on home PC / Supabase. |
| Owner shouldn't need to understand it | The only surface the owner ever touches is chat ("what do we know about X?") — recall does the rest. |
| It must hold *everything we've done* | Backfill from `activity_logs`, `program_audit_log`, `ops_messages`, `case_status_history`, ClickUp, and this very session's history seeds the store on day one. |
| Cohesion with existing work | Built *under* the command center, brain-dump agent, workflow engine, and dispatch core — not beside them. They all become both producers (capture) and consumers (recall) of the one fabric. |

**The one thing that still needs a human once:** connecting each ingestor's credentials (ClickUp token, Gmail scope, Quo, etc.) and approving the RLS policy. After that, it runs itself.

---

## Build vs. buy (the evaluation you asked for)

| Option | Fit for TMMT | Verdict |
|---|---|---|
| **DIY: Supabase + pgvector + custom MCP memory server** | Lives next to your data; reuses RLS, orgs, profiles; full control | **Recommended.** Lowest long-run cost, maximum cohesion. |
| **Zep** (temporal knowledge graph) | Great recall + "what changed over time" out of the box | Strong fallback if DIY recall quality lags; can wrap it behind the same MCP tools. |
| **Mem0** | Fastest to bolt onto existing agents | Good for a quick pilot; less control over schema/RLS. |
| **Letta (MemGPT)** | Agent *with* self-editing memory | Overkill — would mean rebuilding the agents. |

Decision: **build DIY on Supabase**, but keep the `remember()/recall()` MCP interface vendor-neutral so Zep/Mem0 can be swapped in behind it if needed. The agents never know the difference.

---

## Phased rollout (hardest → easiest to *operate*, easiest → hardest to *build*)

1. **Phase 0 — Schema + bridge** (½ day): migration for `pgvector`, `memory_entities`, `memory_events`, `memory_facts`, RLS, and a backfill from `activity_logs`. *No behavior change yet.*
2. **Phase 1 — Capture from the app** (1 day): app server actions + AIXMOS agents write `memory_events`. The system starts accumulating immediately.
3. **Phase 2 — Recall MCP server** (1–2 days): `remember()` / `recall()` tools; wire `CLAUDE.md` + agent personas to call them.
4. **Phase 3 — Human ingestors** (2–4 days, incremental): one connector at a time — Quo (calls/SMS) first since it's already in play, then ClickUp, Slack, Gmail, Calendar.
5. **Phase 4 — Distillation + semantic recall** (2–3 days): background job that rolls events into `memory_facts`, embeddings, temporal supersession, role-scoped owner/operator views.
6. **Phase 5 — Seed history** (rolling): backfill ClickUp, email, Airtable, and prior session logs so the fabric holds "everything we've done together."

Each phase is independently shippable and leaves the system working.

---

## Open questions (for owner review)

1. **Embedding provider** — OpenAI `text-embedding-3-small` (cheap, 1536-dim) vs. a local model on the home PC GPU (no data leaves the box). Privacy vs. convenience.
2. **Retention** — keep raw `memory_events` forever, or roll older than N months into facts only?
3. **External-party privacy** — capturing customer/lawyer SMS into memory has implications; confirm consent/retention policy (and note Quo MCP is not HIPAA-compliant).
4. **Owner-only facts** — some owner decisions shouldn't be visible to operators; confirm the role boundary in RLS.

---

## Success criteria

1. A new Claude/AIXMOS session, given only `recall("John Lopez")`, surfaces the texting history, his role (lawyer), and his number preference — with **zero** manual setup that session.
2. An operator action in ClickUp and an owner approval in Slack both appear in one unified, attributed timeline within minutes.
3. The owner never manually enters a memory; everything arrives via agents or ingestors.
4. Swapping the recall backend (DIY ↔ Zep) requires **no** change to any agent.
</content>
</invoke>
