# Codex / AIXMOS Engine — GHL Dispatch Setup Runbook

Copy everything inside the **PROMPT** block below into Codex or AIXMOS Engine.  
Repo root: `dev/AIX_Command_Center/TMMT MANAGEMENT/tmmt-os`

---

## PROMPT (copy from here ↓)

```
You are setting up TMMT OS dispatch job delivery to GoHighLevel (GHL) sub-accounts.

REPO: tmmt-os (Next.js + Supabase)
GOAL: Staff dispatch jobs at /internal/dispatch/new → TMMT POSTs flat JSON to each GHL inbound webhook → GHL workflow creates contact, deal, tag, task.

DO NOT skip steps. DO NOT invent GHL webhook URLs — they come from GHL UI Inbound Webhook triggers only.

## Known GHL locations (edit scripts/ghl-dispatch/locations.json)

| location_id | partner_app_slug (default) | launchpad |
|-------------|---------------------------|-----------|
| Xcd8DZt5T4GWnBtBEC5V | tmmt_rentals | Rentals (confirmed) |
| s8QGoe5XXzyaDtHPUtBR | vendor_connect | RENAME after checking GHL sub-account name |
| MzniJxhyYzUndJDjMkvm | moving | RENAME |
| IUOThggAD347OwGX6qZZ | fleet_manager | RENAME |

## Phase A — Database (automated)

1. If SUPABASE_DB_URL or DATABASE_URL in .env.local:
   node scripts/ghl-dispatch/apply-dispatch-migration.mjs
2. Else: tell user to run supabase/migrations/0032_job_dispatch_hub.sql in Supabase SQL Editor.

## Phase B — GHL custom fields (automated if GHL_API_KEY works)

1. Ensure .env.local has GHL_API_KEY (Private Integration, contacts.write + locations.readonly).
2. Run dry-run: node scripts/ghl-dispatch/create-ghl-dispatch-fields.mjs --dry-run
3. Run: node scripts/ghl-dispatch/create-ghl-dispatch-fields.mjs
4. If API fails, user creates fields manually — list is in locations.json → custom_fields and docs/GHL_DISPATCH_SETUP.md.

## Phase C — GHL UI per location (browser or user — NOT fakeable)

For EACH location in scripts/ghl-dispatch/locations.json:

1. Open launchpad URL.
2. Settings → Custom Fields → Contact — verify 15 tmmt_* fields exist.
3. Opportunities → Pipelines → Create "TMMT Dispatch Jobs" stages: New, Assigned, In Progress, Complete, Closed.
4. Automation → Workflows → Create "TMMT — Dispatch Job Received":
   - Trigger: Inbound Webhook → COPY URL (https://services.leadconnectorhq.com/hooks/...)
   - Find/Create Contact by tmmt_vendor_email (or vendor.contact_email from webhook test)
   - Update Contact custom fields — map flat keys: tmmt_job_ref, tmmt_job_subject, tmmt_work_type, tmmt_vendor_company, tmmt_vendor_contact, tmmt_vendor_email, tmmt_vendor_phone, tmmt_pickup, tmmt_dropoff, tmmt_window_start, tmmt_window_end, tmmt_offered_price, tmmt_due_at, tmmt_job_details, tmmt_case_id
   - Create Opportunity in TMMT Dispatch Jobs / New — name: {{contact.tmmt_job_ref}} — {{contact.tmmt_job_subject}}
   - Add tag: tmmt-dispatch-job-new
   - Internal notification + task "Review job {{contact.tmmt_job_ref}}"
5. Optional workflow "TMMT — Dispatch Job Alert": tag tmmt-dispatch-job-new → wait 1m → SMS → remove tag.
6. Paste webhook URL into locations.json → webhook_url for that location.

If you have browser automation: do Phase C for all 4 locations, then update locations.json.

## Phase D — Wire TMMT env

1. node scripts/ghl-dispatch/build-partner-webhooks-env.mjs
2. node scripts/ghl-dispatch/build-partner-webhooks-env.mjs --write-env-local
3. Add same PARTNER_APP_WEBHOOKS_JSON to Vercel production + redeploy.
4. GHL_LOCATION_ID=Xcd8DZt5T4GWnBtBEC5V must stay set.

## Phase E — Test

1. npm run dev (or use production URL in NEXT_PUBLIC_PORTAL_URL)
2. node scripts/ghl-dispatch/send-test-dispatch.mjs
   (needs JOB_DISPATCH_SECRET or OPS_COMMAND_SECRET, or staff session won't work for script — use Bearer secret)
3. Verify in GHL: workflow ran, contact fields filled, opportunity in New.
4. Verify TMMT: case created, job_dispatch_deliveries rows in Supabase.

## Phase F — Report

Return:
- Which locations completed Phase C
- Final PARTNER_APP_WEBHOOKS_JSON line
- Test dispatch ref_code
- Anything blocked (missing GHL API scope, manual steps left)

Reference docs: docs/GHL_DISPATCH_SETUP.md, docs/GHL_LOCATION_MAP.md
Code: src/lib/job-dispatch/*, src/app/api/jobs/dispatch/route.ts
```

---

## PROMPT (copy to here ↑)

---

## Helper commands (human or agent)

```bash
cd "dev/AIX_Command_Center/TMMT MANAGEMENT/tmmt-os"

# 1. Migration
node scripts/ghl-dispatch/apply-dispatch-migration.mjs

# 2. GHL custom fields (all 4 locations)
node scripts/ghl-dispatch/create-ghl-dispatch-fields.mjs

# 3. After webhook URLs in locations.json
node scripts/ghl-dispatch/build-partner-webhooks-env.mjs --write-env-local

# 4. Test job
node scripts/ghl-dispatch/send-test-dispatch.mjs
```

Or via npm:

```bash
npm run ghl-dispatch:migrate
npm run ghl-dispatch:fields
npm run ghl-dispatch:env
npm run ghl-dispatch:test
```

---

## What the agent CAN vs CANNOT automate

| Task | Automated? |
|------|------------|
| Supabase migration | Yes (with DB URL) |
| GHL contact custom fields | Yes (with GHL_API_KEY) |
| GHL pipeline + inbound webhook workflow | **No** — GHL UI or browser agent |
| Copy webhook URL → locations.json | User or browser agent |
| Build PARTNER_APP_WEBHOOKS_JSON | Yes (`build-partner-webhooks-env.mjs`) |
| Vercel env + redeploy | Yes (vercel CLI if logged in) |
| Test dispatch API | Yes (`send-test-dispatch.mjs`) |

---

## After webhooks exist

Edit `scripts/ghl-dispatch/locations.json` — set `webhook_url` for each location, then:

```bash
npm run ghl-dispatch:env -- --write-env-local
```

Paste output into Vercel → Redeploy.
