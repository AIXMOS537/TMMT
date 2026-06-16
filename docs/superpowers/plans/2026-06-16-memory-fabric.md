# Memory Fabric — Implementation Plan

**Date:** 2026-06-16
**Spec:** `docs/superpowers/specs/2026-06-16-memory-fabric-design.md`
**Branch:** `claude/text-number-current-setup-mfmn1f`
**Status:** Phases 0–2 SHIPPED (code committed, build green). Phase 0 migration
authored but **not yet applied** to live Supabase. Phases 3–5 pending.

Goal: a self-maintaining, org-wide memory layer that captures every actor's
work and lets any agent recall it — built *under* the existing command center,
brain-dump agent, workflow engine, and dispatch core, reusing `organizations`,
`profiles`, RLS, and the MCP pattern already in the repo.

---

## Phase 0 — Schema + bridge (½ day)  ▸ build first  ✅ DONE (authored)

- [x] New migration `supabase/migrations/20260616000000_memory_fabric.sql`:
  - [x] `create extension if not exists vector;`
  - [x] `memory_entities`, `memory_events`, `memory_facts` tables (per spec)
  - [x] indexes: `memory_events(org_id, occurred_at desc)`, `memory_events(entity_id)`, `dedupe_key unique`, ivfflat on `embedding`
  - [x] RLS: org-scoped via `is_staff()`; owner-only facts via `is_owner()`; `external`/`system` write via service role
  - [x] backfill: insert existing `activity_logs` rows into `memory_events` (actor_kind from `profiles.role`, source='app')
- [x] `npm run build` stays green
- [x] Commit: `feat(memory): schema + activity_logs backfill bridge`
- [ ] **APPLY to live Supabase** (run the migration against the project) — pending

## Phase 1 — Capture from the app (1 day)  ✅ DONE

- [x] Added `logMemoryEvent()` / `logMemoryEventForUser()` in `src/lib/memory.ts` (server-only, service-role write, never throws)
- [x] Called from `admin-actions.ts` (every `adminUpsert`) and `forms/actions.ts` (every public submission, actor=external)
- [ ] AIXMOS agents (`~/AIXMOS-AGENTS`) emit a memory event per action (lives in that repo)
- [x] Acceptance (code): admin edit + form submission write to `memory_events` with actor/role — verify after Phase 0 apply
- [x] Commit: `feat(memory): capture app + agent actions`

## Phase 2 — Recall + remember/recall interface (1–2 days)  ✅ DONE

- [x] `recallMemory()` in `src/lib/memory.ts` (vendor-neutral; recency+keyword now, pgvector in Phase 4)
- [x] HTTP entry `POST /api/memory` (Bearer `MEMORY_API_TOKEN`), ops `remember` / `recall`
- [x] Optional MCP bridge `scripts/memory-mcp-server.mjs` (proxies to /api/memory; needs `@modelcontextprotocol/sdk`)
- [x] Wired "recall before / remember after" discipline into `CLAUDE.md`
- [ ] Wire the same discipline into AIXMOS persona prompts (that repo)
- [ ] Acceptance: `recall("John Lopez")` returns texting history — verify after Phase 0 apply + some captured events

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
