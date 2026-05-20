# TMMT OS — Ops routing architecture

Three layers: **intake** → **detection** → **execution** (+ dispatch loads for freight).

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────────────────────┐
│   Intake    │────▶│  Detection   │────▶│ Execution                        │
│ GHL / web / │     │ rules.ts     │     │ ClickUp task · agent_draft ·     │
│ API / team  │     │ detect.ts    │     │ dispatch_loads (if dispatch_*)   │
└─────────────┘     └──────────────┘     └─────────────────────────────────┘
       │                    │                         │
       ▼                    ▼                         ▼
 sync_events          crm_sync_records          cases + ops_locations
 customer_intake     routing_result            clickup_task_*
```

## Intake sources

| Source | Entry | Tables |
|--------|--------|--------|
| GHL stage change | `POST /api/webhooks/ghl` | `sync_events`, `crm_sync_records` → routing |
| Website / API | `POST /api/intake`, `/intake` form | `customer_intake_forms`, `cases`, `sync_events` |
| Airtable verify | `POST /api/webhooks/airtable` | promotes case + routing |
| Ops roster | `POST /api/webhooks/airtable` (`ops_location.upsert`) | `ops_locations` |

Shared server helper: `src/lib/intake/unified.ts` → `processUnifiedIntake()`.

## Detection

- `src/lib/routing/rules.ts` — pipeline/stage/tags/source → `work_type`, `case_type`, ClickUp template, priority, `agent_profile` (`tank` \| `sticks`).
- `src/lib/routing/detect.ts` — `detectWorkFromEvent({ pipelineName, stage, tags, source, businessLine })`.

## Execution

- `src/lib/routing/execute.ts` — `executeRouting()` persists detection, optional ClickUp (`src/lib/clickup/create-task.ts`), agent stub (`src/lib/agents/run-on-case.ts`), and `dispatch_loads` when `work_type` is `dispatch_*`.
- Location list IDs come from `ops_locations.clickup_list_id` (matched by `ghl_pipeline_id` / name).

## Dispatch

- GHL dispatch pipelines: `resolveDispatchStage()` in `src/lib/crm-sync/stage-map.ts`.
- UI: `/internal/dispatch`.

## Database

Run migrations (SQL editor, in order):

1. `supabase/migrations/RUN_OPS_ROUTING.sql` — tables + columns  
2. `supabase/migrations/0007_ops_routing.sql` — `routing_result` on sync records  

Optional seed: `supabase/seed_ops_locations.sql`

## Environment (Vercel)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Webhooks + routing writes |
| `GHL_WEBHOOK_SECRET` | GHL ingress |
| `INTAKE_WEBHOOK_SECRET` | `/api/intake` |
| `SYNC_WEBHOOK_SECRET` | Airtable webhooks |
| `CLICKUP_API_TOKEN` | Create tasks |
| `CLICKUP_TEAM_ID` | Task URLs |
| `CLICKUP_DEFAULT_LIST_ID` | Fallback list |
| `GHL_PIPELINE_STAGE_MAP_JSON` | Rental + dispatch stage map |
| `AIRTABLE_OPS_LOCATIONS_TABLE` | Default `Ops Locations` |
| `OPENAI_API_KEY` | Optional future LLM enrichment |

RLS: authenticated `admin` / `internal_team` read `ops_locations` and `dispatch_loads`; service role bypasses for webhooks.
