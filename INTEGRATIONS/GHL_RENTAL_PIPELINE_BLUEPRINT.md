# TMMT Rentals — New GHL Pipeline + Workflow Blueprint

**Use this when building a fresh pipeline** (or replacing a messy one).  
**Upgrade path** at the bottom if triggers/webhooks/WhatsApp are limited on your current plan.

---

## Pipeline overview

| Item | Value |
|------|--------|
| **Pipeline name** | `TMMT Rentals` |
| **Type** | Opportunity pipeline (one opp per rental customer journey) |
| **Channels** | WhatsApp + SMS + email (all through GHL Conversations) |
| **Truth for money/fleet** | Supabase / TMMT OS daily brief |
| **Truth for CRM stages** | GHL (this pipeline) |

**Keep separate:** Dealer applicants → `Applicants – Dealership` (see `AIXMOSXTMMT-OPS/docs/ghl-pipelines.md`).  
**Do not mix** credit/Slack leads into this pipeline — credit stays Slack per `CHANNEL_STACK_GHL_WHATSAPP_SLACK.md`.

---

## Stages (create in this order)

| # | Stage | Entry rule | Exit / next |
|---|--------|------------|-------------|
| 1 | **New lead** | Form, WhatsApp, call, referral | First outbound within **15 min** (business hours) |
| 2 | **Contacted** | Any first touch logged | Qualify within 24h |
| 3 | **Qualified** | License, dates, budget OK | Send quote / booking link |
| 4 | **Booking sent** | Rate + dates sent | Follow up in **2h** if no reply |
| 5 | **Booked** | Agreement signed or deposit taken | Pick-up reminders |
| 6 | **Active rental** | Vehicle out | Payment due + return reminders |
| 7 | **Payment overdue** | Past due balance | Collections until paid or repo path |
| 8 | **Returned / closed** | Vehicle back, balance $0 | Review request (optional) |
| 9 | **Lost / DNR** | No fit, repo, do-not-rent | No marketing re-entry |

**SLA tags (optional):** `sla-breach-contact`, `sla-breach-followup` for reporting.

---

## Custom fields (Contact)

Create under **Settings → Custom Fields → Contact**:

| Field | Type | Values / notes |
|-------|------|----------------|
| `payment_due_date` | Date | Next payment due |
| `payment_status` | Dropdown | `paid` · `due` · `overdue` |
| `amount_due` | Monetary | Current balance |
| `vehicle_assigned` | Text | Unit / plate |
| `pickup_date` | Date | |
| `return_date` | Date | |
| `rental_customer_yn` | Dropdown | `Y` · `N` |
| `last_collection_attempt` | Date | VA logs after each call |
| `tmmt_ghl_contact_id` | Text | Mirror for scripts (optional) |

---

## Tags

| Tag | When applied | Workflow |
|-----|----------------|----------|
| `payment-overdue` | Supabase push or manual | WF-07 Overdue alert |
| `overdue-alert-sent` | After owner notified (optional dedupe) | Remove when paid |
| `pickup-tomorrow` | Day before pickup | WF-05 Pick-up |
| `return-tomorrow` | 24h before return | WF-06 Return |
| `rental-active` | Stage 6 | Reporting |
| `dnr` | Stage 9 | Suppress automations |

---

## Workflows to build (7 total)

Build in **Automation → Workflows**. Name exactly so your team can search.

### WF-00 — Master: Stage sync → TMMT OS (required)

| | |
|--|--|
| **Trigger** | Opportunity **Pipeline Stage Changed** → Pipeline: `TMMT Rentals` → Any stage |
| **Action** | **Webhook** POST `https://tmmt-ops.vercel.app/api/webhooks/ghl` |
| **Header** | `X-GHL-Secret: <GHL_WEBHOOK_SECRET>` |
| **Body** | See `GHL_WORKFLOW_WALKTHROUGH.md` Workflow B |

**Why:** Every stage change queues Airtable verify + `/internal/sync`.

---

### WF-01 — New lead: speed-to-lead (15 min)

| | |
|--|--|
| **Trigger** | Pipeline stage → **New lead** |
| **Action 1** | Wait **5 minutes** (batch leads) |
| **Action 2** | **If** business hours → **Send WhatsApp/SMS** (CHUMMO-approved first touch) |
| **Action 3** | **Create task** — "First touch — {{contact.name}}" due in 15 min |
| **Action 4** | Move to **Contacted** when message sent (or manual) |

**Upgrade note:** If WhatsApp action is "Premium", you need **Workflows Pro** execution quota (see below).

---

### WF-02 — Booking sent: 2h follow-up

| | |
|--|--|
| **Trigger** | Stage → **Booking sent** |
| **Action 1** | Wait **2 hours** |
| **Action 2** | **If** still in **Booking sent** → internal notification + task "Follow up quote" |

---

### WF-03 — Booked: confirmation + pick-up prep

| | |
|--|--|
| **Trigger** | Stage → **Booked** |
| **Action 1** | WhatsApp/SMS booking confirmation (template from MESSAGE_TEMPLATE_LIBRARY) |
| **Action 2** | Task: verify vehicle + insurance checklist |
| **Action 3** | **If** `pickup_date` is tomorrow → tag `pickup-tomorrow` |

---

### WF-04 — Active rental: payment due (before overdue)

| | |
|--|--|
| **Trigger** | Stage → **Active rental** OR `payment_status` = `due` |
| **Action 1** | **If** `payment_due_date` is in 3 days → friendly reminder SMS |
| **Action 2** | **If** `payment_due_date` is today → day-of reminder |
| **Action 3** | **If** past due → move opp to **Payment overdue** + tag `payment-overdue` |

*(Alternative: let `push_overdue_to_ghl.py` set tag + stage from Supabase.)*

---

### WF-05 — Pick-up reminders

| | |
|--|--|
| **Trigger** | Tag `pickup-tomorrow` added OR calendar `pickup_date` = tomorrow |
| **Action** | WhatsApp/SMS pick-up time + location |

---

### WF-06 — Return reminders

| | |
|--|--|
| **Trigger** | Tag `return-tomorrow` OR `return_date` = tomorrow |
| **Action** | WhatsApp/SMS return reminder + extension offer (manual approve Week 1) |

---

### WF-07 — Payment overdue (collections) — **build first**

| | |
|--|--|
| **Trigger** | Tag **`payment-overdue`** added |
| **Action 1** | Internal SMS/email to owner |
| **Action 2** | Task due today — collect {{amount_due}} |
| **Action 3** | Wait 24h → if still tagged → second internal alert |
| **Action 4** | Customer WhatsApp — **OFF** until copy approved |

Full clicks: `GHL_WORKFLOW_WALKTHROUGH.md` Workflow A.

**Data path:** `push_overdue_to_ghl.py` → `POST /api/webhooks/ghl/overdue` → GHL API adds tag.

---

### WF-08 — Returned: review + cleanup

| | |
|--|--|
| **Trigger** | Stage → **Returned / closed** |
| **Action 1** | Remove tags `payment-overdue`, `rental-active` |
| **Action 2** | Set `payment_status` = `paid` |
| **Action 3** | Review request (optional, Week 2+) |

---

## Workflow build order (recommended)

```text
Week 1:  WF-07 (overdue) → WF-00 (stage webhook) → test
Week 2:  WF-04 (payment due) → WF-01 (speed-to-lead)
Week 3:  WF-03, WF-05, WF-06 (booked / pick-up / return)
Week 4:  WF-02, WF-08 + dedupe tags
```

---

## Map pipeline ID → TMMT OS

After you create the pipeline in GHL:

1. **Settings → Pipelines → TMMT Rentals** → copy **Pipeline ID** from URL or API.
2. Edit `INTEGRATIONS/GHL_PIPELINE_STAGE_MAP.example.json`:
   - Replace `RENTALS_PIPELINE_ID` with real ID.
   - Stage keys = **lowercase** stage names as shown in GHL.
3. Minify JSON → paste into Vercel env `GHL_PIPELINE_STAGE_MAP_JSON`.
4. Redeploy **tmmt-ops**.

---

## Agency account (your plan)

You are on **Agency** — you already have:

- Unlimited sub-accounts (TMMT Rentals location + dealer + partners separate)
- Full workflow builder + LC Phone / WhatsApp (when connected per location)
- API access for `GHL_API_KEY` (agency token or location token)
- White-label / SaaS mode if you resell later

**You do not need** Starter → Unlimited → Agency SaaS upgrades.

### Only optional add-on: Workflows Pro

Some actions (Webhook, certain AI/premium steps) bill as **premium executions**. If a workflow step shows **Premium**:

| Tier | Price | Executions |
|------|-------|------------|
| Starter | $10/mo | 10,000 |
| Growth | $25/mo | 30,000 |

Agency base plan does **not** remove premium execution metering — add Workflows Pro only if GHL prompts you at publish time.

### Agency setup checklist

1. **Sub-account:** Open the **TMMT Rentals** location (not agency dashboard) before building pipelines/workflows.
2. **Pipelines:** Create `TMMT Rentals` inside that location’s Opportunities.
3. **API key for TMMT OS:**  
   - **Settings → Business Profile → API Key** (location), or  
   - Agency **Settings → API Keys** → use location ID in requests.  
   Put in Vercel: `GHL_API_KEY` + `GHL_LOCATION_ID` (location ID from URL or Settings).
4. **Separate pipelines per brand:**  
   - `TMMT Rentals` — this blueprint  
   - `Applicants – Dealership` — dealer (existing doc)  
   - `Partners – Empire` — JV / shops (optional)

### Before paying extra — check in GHL

1. In the **rental location**, create test workflow → add **Webhook** + **WhatsApp**.  
2. Publish — if no premium warning, **Workflows Pro not required**.  
3. If blocked, enable **Workflows Pro Starter ($10/mo)** at agency billing.

---

## After pipeline is live

1. Fill `CUSTOMERS/RENTAL_GHL_PIPELINE.md` with exact pipeline name + stage screenshot.
2. Load top 5 overdue from `OPERATIONS/TODAY_COLLECTIONS.md` into stage **Payment overdue**.
3. Fill `AUTOMATIONS/WEBHOOKS/ghl_contact_map.json` for `push_overdue_to_ghl.py`.
4. Run dry-run → live push daily (or n8n `cron_overdue_to_tmmt.json`).

---

## Related files

- `INTEGRATIONS/GHL_WORKFLOW_WALKTHROUGH.md` — click-by-click WF-07 + WF-00
- `WEEK_1_GHL_WHATSAPP.md` — week-by-week rollout
- `CUSTOMERS/RENTAL_GHL_PIPELINE.md` — fill-in tracker
- `INTEGRATIONS/GHL_PIPELINE_STAGE_MAP.example.json` — Vercel JSON map
