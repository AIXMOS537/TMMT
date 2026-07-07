# Quo Support Line → Brain → Dispatch — Design Spec

**Date:** 2026-06-16
**Status:** Draft — pending owner review
**Author:** Engineering planning pass (for the owner)
**Builds on:** Memory Fabric (`docs/superpowers/specs/2026-06-16-memory-fabric-design.md`),
Dispatch Core (`docs/DISPATCH-CORE.md`, `supabase/migrations/20260530120000_rescue_dispatch_core.sql`),
Mesh Access (`docs/MEMORY-MESH-ACCESS.md`).

---

## One-sentence goal

Make **Quo the single backend support number** clients call for urgent help with
the service they **opted into** — every inbound call/SMS is forwarded into the
**brain**, then an **evaluation/planning/routing agent** assigns the work to the
**best-capable candidate** (employee, agent, vendor, …).

## Scope decision (records the owner's call)

- **Quo's role is narrowed:** Quo is now the **sole backend customer-support
  channel** — not a general team phone. One number = urgent assistance / support
  requests for opted-in services. (This refines, not contradicts, "keep Quo": we
  keep Quo precisely *for this*.)
- Support is **gated by entitlement**: a caller is only routed for a service they
  selected during initial setup.

## The flow

```
Client calls/texts the ONE Quo support number
        │  (Quo webhook: call.completed / message.received  — or scheduled MCP poll)
        ▼
/api/quo/inbound   (Bearer/secret gated, fail-closed)
        │  1. resolve caller -> memory_entity (person)  [phone in external_refs]
        │  2. resolve their opted-in service/entitlement
        │  3. remember(): memory_event  source=quo, actor_kind=external, action=support_request
        ▼
THE BRAIN  (Memory Fabric: memory_events + facts + entities)
        │  4. create a support request  (Dispatch Core incident / case)
        ▼
EVALUATE · PLAN · ROUTE   (Dispatch Core CAPTAIN + routing engine)
        │  rank best-capable candidate by capability tags, availability, service,
        │  proximity; fail-open to deterministic SQL ranking if CAPTAIN is down
        ▼
ASSIGN -> best candidate (employee / agent / vendor / unit)
        │  5. remember(): memory_event action=routed/assigned (audit trail)
        ▼
Notify the assignee (existing Telegram/responder ping) + log outcome back to brain
```

## Components (reuse first)

| Need | Reuse | New |
|---|---|---|
| Capture inbound to brain | `logMemoryEvent()` (`src/lib/memory.ts`) | — |
| Caller identity | `memory_entities` (phone in `external_refs`) | resolver helper |
| Opted-in service | `services` / `entitlements` / `organization_licenses` | lookup helper |
| Support request record | Dispatch Core `incidents` (or `cases`) | mapping |
| Evaluate/plan/route | CAPTAIN dispatch agent + `src/lib/routing/*` | thin adapter |
| Notify assignee | existing Telegram/responder ping | — |
| Inbound transport | webhook route pattern (`api/webhooks/ghl/route.ts`) | `/api/quo/inbound` |

> Exact function signatures for the routing/agent adapter are being confirmed
> against `src/lib/routing/execute.ts` and `src/lib/agents/run-on-case.ts` before
> the adapter is written, so we plug into the real entry points.

## Inbound transport: webhook vs. poll

- **Preferred: Quo (OpenPhone) webhooks** — `message.received`,
  `call.completed`/`call.recording.completed` → POST to `/api/quo/inbound`.
  Real-time, no polling cost. Gated by a shared secret header (fail-closed, same
  pattern as the GHL webhook).
- **Fallback: scheduled MCP poll** — a cron route calls Quo `fetch-messages` /
  `fetch-missed-calls` every N minutes and ingests new items (idempotent via
  `dedupe_key = quo:msg:<id>` / `quo:call:<id>`). Useful if webhooks aren't set
  up yet.

## Routing inputs (how "best candidate" is decided)

Candidate pool spans **employees, agents, vendors, and units**. Ranking signals:
- **Capability match** — service requested vs. candidate capability tags
- **Availability / on-shift** — who can take it now
- **Proximity** — for physical jobs (Dispatch Core already geocodes via OSM)
- **Load / fairness** — current open assignments
- **Entitlement tier** — higher service tiers may get priority SLAs

CAPTAIN produces a ranked plan (JSON); if CAPTAIN is unavailable, deterministic
SQL ranking is used and `captain_skipped=true` is logged (existing fail-open).

## Idempotency, privacy, failure

- Every ingest carries a `dedupe_key` so re-delivery never double-creates.
- Capture **never blocks**: `logMemoryEvent` is fire-and-forget; routing failures
  leave the request in a "needs manual triage" state, never lost.
- Customer SMS/call content is sensitive — store on the entitlement's org scope;
  Quo is **not HIPAA-compliant**, so no PHI.

## Phased build

1. **3a — Inbound capture:** `/api/quo/inbound` (secret-gated) → resolve caller
   entity → `logMemoryEvent(source=quo, actor=external, action=support_request)`.
   *Ships value immediately: the brain hears every support contact.*
2. **3b — Service gating:** resolve caller → opted-in service/entitlement; tag
   the event; flag unknown/uncovered callers for manual triage.
3. **3c — Create support request:** map the event to a Dispatch Core incident/
   case.
4. **3d — Route:** adapter calls the CAPTAIN+routing engine; assign best
   candidate; `remember()` the routing decision.
5. **3e — Poll fallback + notify:** cron MCP poll for missed items; reuse
   Telegram/responder ping for the assignee.

## Acceptance

1. A text to the Quo support number appears in the brain within seconds as a
   `support_request` event attributed to the caller entity.
2. A known client's request resolves to their opted-in service and is routed to a
   ranked best candidate; the decision is itself a memory event.
3. Re-delivered webhooks create no duplicates.
4. CAPTAIN down → deterministic routing still assigns; logged.

## One-time owner setup
- Designate the single Quo support number; point its webhooks at `/api/quo/inbound`.
- Set `QUO_WEBHOOK_SECRET` (and `MEMORY_API_TOKEN` if routing via the API door).
- Ensure candidates (employees/agents/vendors/units) have capability tags +
  availability so ranking has signal.
