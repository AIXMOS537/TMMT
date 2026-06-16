# Memory Fabric — Implementation Plan

**Date:** 2026-06-16
**Spec:** `docs/superpowers/specs/2026-06-16-memory-fabric-design.md`
**Branch:** `claude/text-number-current-setup-mfmn1f`
**Status:** Ready to execute, phase by phase

Goal: a self-maintaining, org-wide memory layer that captures every actor's
work and lets any agent recall it — built *under* the existing command center,
brain-dump agent, workflow engine, and dispatch core, reusing `organizations`,
`profiles`, RLS, and the MCP pattern already in the repo.

---

## Phase 0 — Schema + bridge (½ day)  ▸ build first

- [ ] New migration `supabase/migrations/2026XXXX_memory_fabric.sql`:
  - [ ] `create extension if not exists vector;`
  - [ ] `memory_entities`, `memory_events`, `memory_facts` tables (per spec)
  - [ ] indexes: `memory_events(org_id, occurred_at desc)`, `memory_events(entity_id)`, `dedupe_key unique`, ivfflat on `embedding`
  - [ ] RLS: org-scoped; `owner` role sees all, `operator`/`team` see their slice, `external`/`system` write-only via service role
  - [ ] backfill: insert existing `activity_logs` rows into `memory_events` (actor_kind='operator'/'owner' from `profiles.role`, source='app')
- [ ] `npm run build` stays green (no app code touched yet)
- [ ] Commit: `feat(memory): schema + activity_logs backfill bridge`

## Phase 1 — Capture from the app (1 day)

- [ ] Add `logMemoryEvent()` helper in `src/lib/` (server-only, service-role write)
- [ ] Call it from `admin-actions.ts` (every `adminUpsert`) and `forms/actions.ts` (every public submission)
- [ ] AIXMOS agents (`~/AIXMOS-AGENTS`) emit a memory event per action
- [ ] Acceptance: an admin edit and a form submission both appear in `memory_events` with correct actor/role/entity
- [ ] Commit: `feat(memory): capture app + agent actions`

## Phase 2 — Recall MCP server (1–2 days)

- [ ] New MCP server `memory` exposing `remember()` and `recall()` (vendor-neutral interface per spec)
- [ ] `recall()` = semantic (pgvector) + recency boost + role/scope filter; returns facts then events
- [ ] Wire into agents: add a "recall before you act, remember after" instruction to `CLAUDE.md` and the AIXMOS persona prompts
- [ ] Acceptance: `recall("John Lopez")` in a fresh session returns texting history + role + number preference
- [ ] Commit: `feat(memory): recall/remember MCP server`

## Phase 3 — Human ingestors (2–4 days, one connector at a time)

- [ ] **Quo** (calls/SMS) — first, already in play. Scheduled `fetch-messages` → `memory_events` (dedupe `quo:msg:<id>`)
- [ ] **ClickUp** — task create/assign/complete → events (dedupe `clickup:<id>:<ts>`)
- [ ] **Slack** — decisions/messages in ops channels
- [ ] **Gmail / Outlook** — customer-tied threads
- [ ] **Calendar** — meetings/appointments
- [ ] Each ingestor is idempotent and independently deployable
- [ ] Commit per connector: `feat(memory): ingest <source>`

## Phase 4 — Distillation + semantic recall (2–3 days)

- [ ] Background job: roll `memory_events` → `memory_facts` (LLM summarization), set embeddings
- [ ] Temporal supersession (set `valid_to`, never destructive overwrite)
- [ ] Role-scoped views: owner dashboard ("who did what across the board") vs. operator view
- [ ] Commit: `feat(memory): distillation + temporal facts`

## Phase 5 — Seed history (rolling)

- [ ] Backfill ClickUp history, prior email threads, Airtable records, and prior session logs
- [ ] Commit: `chore(memory): seed historical backfill`

---

## Sequencing rules

- Each phase ships independently and leaves `npm run build` green.
- Capture (Phase 1) precedes recall (Phase 2) so there's something to recall.
- Ingestors (Phase 3) are additive — start with Quo, prove the pattern, repeat.
- Keep the `remember()/recall()` interface vendor-neutral so Zep/Mem0 can be
  swapped behind it with zero agent changes.

## One-time owner actions (the only manual steps)

1. Approve the RLS role boundary (owner-only vs operator-visible facts).
2. Provide/confirm ingestor credentials (ClickUp token, Gmail scope, Quo, Slack).
3. Pick embedding provider (hosted vs. local on home PC GPU) — privacy call.

After these, the fabric runs itself: agents and ingestors keep it current with
no further owner input.
</content>
