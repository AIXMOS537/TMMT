# Deploy checklist — post 4-track build

## Track 1 — tmmt-os + GHL (do first)

### Local verify (done)

- [x] `npm run build` passes with routes:
  - `/api/webhooks/ghl`
  - `/api/webhooks/ghl/overdue`
  - `/api/webhooks/airtable`
  - `/internal/sync`

### Vercel env (you)

```bash
# Generate once:
openssl rand -hex 32   # → GHL_WEBHOOK_SECRET
```

| Variable | Notes |
|----------|--------|
| `GHL_WEBHOOK_SECRET` | Header `X-GHL-Secret` on all GHL webhooks |
| `GHL_OVERDUE_WEBHOOK_SECRET` | Optional; defaults to `GHL_WEBHOOK_SECRET` |
| `GHL_API_KEY` | Outbound tags (`payment-overdue`, case status) |
| `GHL_LOCATION_ID` | Sub-account / location ID |
| `GHL_PIPELINE_STAGE_MAP_JSON` | Minify `INTEGRATIONS/GHL_PIPELINE_STAGE_MAP.example.json` |
| `SYNC_WEBHOOK_SECRET` | Airtable verify webhook |
| `INTAKE_WEBHOOK_SECRET` | Public intake |

Copy the same `GHL_WEBHOOK_SECRET` into:

- `tmmt-os/.env.local`
- `AUTOMATIONS/.env` (for `push_overdue_to_ghl.py`)

### Supabase SQL (if not applied)

Run in SQL Editor:

1. `tmmt-os/supabase/migrations/0002_crm_sync.sql`
2. `tmmt-os/supabase/migrations/0003_portal_renter_view.sql`

### Deploy

```bash
cd "TMMT MANAGEMENT/tmmt-os"
vercel --prod
```

### GHL UI

1. Workflow: opportunity stage changed → `POST …/api/webhooks/ghl` (see `INTEGRATIONS/GHL_WEBHOOK_SETUP.md`)
2. Overdue workflow per `AUTOMATIONS/GHL_OVERDUE_WORKFLOW_SETUP.md` (trigger tag `payment-overdue`)

### Overdue push script

```bash
cd "TMMT MANAGEMENT"
python3 AUTOMATIONS/SCRIPTS/push_overdue_to_ghl.py --dry-run
python3 AUTOMATIONS/SCRIPTS/push_overdue_to_ghl.py
```

Requires `ghl_contact_id` on payment rows **or** `GHL_CONTACT_MAP_JSON` name → id map.

---

## Track 2 — AIXMOSXTMMT-OPS

```bash
cd AIXMOSXTMMT-OPS
cp .env.example .env   # set SUPABASE_URL (not xxxx placeholder)
npm run setup && npm run doctor
# Start Docker Desktop, then:
npm run start
# Supabase: sql/001 → 002 → 004
npm run clock:install && npm run clock:dev
```

---

## Track 3 — all_in_one_platform

```bash
cd all_in_one_platform && npm install && npm run dev
```

See `credit_business_corporate_system/MILESTONE_1_STATUS.md`.

---

## Track 4 — CHUMMO

```bash
cd ops/chummo-stack && npm install && node serve.js
```
