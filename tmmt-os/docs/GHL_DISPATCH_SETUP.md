# GHL dispatch setup — all TMMT locations

Each GHL sub-account you control gets the same **custom fields**, **pipeline**, and **inbound webhook workflow**. TMMT OS POSTs jobs to each location’s webhook URL when staff creates a dispatch job at `/internal/dispatch/new`.

See also: [GHL_SETUP_CHECKLIST.md](./GHL_SETUP_CHECKLIST.md), [GHL_WORKFLOWS.md](./GHL_WORKFLOWS.md).

---

## TMMT prerequisites (once)

1. Run migration: `supabase/migrations/0032_job_dispatch_hub.sql` in Supabase SQL Editor.
2. Set `PARTNER_APP_WEBHOOKS_JSON` on Vercel (template below).
3. Redeploy TMMT OS.

---

## What TMMT sends (webhook JSON)

TMMT sends **flat keys** that match GHL custom field keys (easier mapping):

| GHL custom field key | Webhook key |
|----------------------|-------------|
| `tmmt_job_ref` | `tmmt_job_ref` |
| `tmmt_job_subject` | `tmmt_job_subject` |
| `tmmt_work_type` | `tmmt_work_type` |
| `tmmt_vendor_company` | `tmmt_vendor_company` |
| `tmmt_vendor_contact` | `tmmt_vendor_contact` |
| `tmmt_vendor_email` | `tmmt_vendor_email` |
| `tmmt_vendor_phone` | `tmmt_vendor_phone` |
| `tmmt_pickup` | `tmmt_pickup` |
| `tmmt_dropoff` | `tmmt_dropoff` |
| `tmmt_window_start` | `tmmt_window_start` |
| `tmmt_window_end` | `tmmt_window_end` |
| `tmmt_offered_price` | `tmmt_offered_price` |
| `tmmt_due_at` | `tmmt_due_at` |
| `tmmt_job_details` | `tmmt_job_details` |
| `tmmt_case_id` | `tmmt_case_id` |

Legacy nested keys (`vendor.company`, `route.pickup`, etc.) are still included for debugging.

---

## Part 1 — Every GHL location (clone checklist)

### 1A. Contact custom fields

**Settings → Custom Fields → Contact**

| Label | Field key |
|-------|-----------|
| TMMT Job Ref | `tmmt_job_ref` |
| TMMT Job Subject | `tmmt_job_subject` |
| TMMT Work Type | `tmmt_work_type` |
| TMMT Vendor Company | `tmmt_vendor_company` |
| TMMT Vendor Contact | `tmmt_vendor_contact` |
| TMMT Vendor Email | `tmmt_vendor_email` |
| TMMT Vendor Phone | `tmmt_vendor_phone` |
| TMMT Pickup | `tmmt_pickup` |
| TMMT Dropoff | `tmmt_dropoff` |
| TMMT Window Start | `tmmt_window_start` |
| TMMT Window End | `tmmt_window_end` |
| TMMT Offered Price | `tmmt_offered_price` |
| TMMT Due At | `tmmt_due_at` |
| TMMT Job Details | `tmmt_job_details` |
| TMMT Case ID | `tmmt_case_id` |

Optional: duplicate on **Opportunity** for deal-card visibility.

### 1B. Pipeline

**Opportunities → Pipelines → Create**

- Name: `TMMT Dispatch Jobs`
- Stages: `New` → `Assigned` → `In Progress` → `Complete` → `Closed`

### 1C. Workflow — `TMMT — Dispatch Job Received`

| Step | Action |
|------|--------|
| 1 | Trigger: **Inbound Webhook** (copy URL → worksheet below) |
| 2 | Find/Create Contact — email = `tmmt_vendor_email` |
| 3 | Update Contact — map webhook keys → custom fields (table above) |
| 4 | Create Opportunity — pipeline `TMMT Dispatch Jobs`, stage `New`, name `{{contact.tmmt_job_ref}} — {{contact.tmmt_job_subject}}` |
| 5 | Add tag `tmmt-dispatch-job-new` |
| 6 | Internal notification SMS/email to ops |
| 7 | Create task: `Review job {{contact.tmmt_job_ref}}` |

**Webhook → contact mapping:** use flat keys (`tmmt_job_ref`, not nested paths).

### 1D. Workflow — `TMMT — Dispatch Job Alert` (optional)

| Step | Setting |
|------|---------|
| Trigger | Tag added → `tmmt-dispatch-job-new` |
| Wait | 1 minute |
| SMS | `New TMMT dispatch: {{contact.tmmt_job_ref}} — {{contact.tmmt_vendor_company}}. {{contact.tmmt_pickup}} → {{contact.tmmt_dropoff}}` |
| Remove tag | `tmmt-dispatch-job-new` |

### 1E. Workflow — stage sync (optional)

When staff moves opportunity stage in GHL, mirror in TMMT via existing GHL → TMMT webhooks (`/api/webhooks/ghl`). Map pipeline `TMMT Dispatch Jobs` stages to case status updates in your GHL pipeline map JSON.

---

## Part 2 — Auto-routing (which locations get rung)

When a job is created, TMMT attempts delivery to these slugs **if** a webhook URL is registered in `PARTNER_APP_WEBHOOKS_JSON`. Unconfigured slugs are skipped silently.

| Job type | Hub (always) | Vertical locations |
|----------|--------------|-------------------|
| Pickup | `vendor_connect`, `freight_logistics`, `fleet_manager` | `moving`, `tmmt_rentals`, `express`, `auto`, `wholesale-cars`, `detailing` |
| Delivery | same hub | `moving`, `tmmt_rentals`, `express`, `black`, `luxury`, `auto`, `detailing`, `wholesale-cars` |
| Full move | same hub | `moving`, `service_arbitrage`, `cleaning`, `tmmt_rentals`, `express`, `auto`, `wholesale-cars`, `tmmt_property` |

**Skip dispatch webhooks:** `restoration` (credit/onboarding only).

Override per job via API: `"target_partner_apps": ["moving","cleaning"]`.

---

## Part 3 — Location worksheet

Fill in webhook URLs from each location’s inbound workflow trigger.

| # | GHL location | `partner_app_slug` | Location ID | Webhook URL | Done |
|---|--------------|-------------------|-------------|-------------|------|
| 1 | TMMT Rentals | `tmmt_rentals` | | | ☐ |
| 2 | TMMT Express | `express` | | | ☐ |
| 3 | TMMT Black | `black` | | | ☐ |
| 4 | TMMT Auto Services | `auto` | | | ☐ |
| 5 | TMMT Detailing | `detailing` | | | ☐ |
| 6 | TMMT Moving | `moving` | | | ☐ |
| 7 | TMMT Cleaning | `cleaning` | | | ☐ |
| 8 | TMMT Wholesale | `wholesale-cars` | | | ☐ |
| 9 | TMMT Luxury | `luxury` | | | ☐ |
| 10 | Vendor Connect | `vendor_connect` | | | ☐ |
| 11 | Fleet Manager Pro | `fleet_manager` | | | ☐ |
| 12 | Freight & Logistics | `freight_logistics` | | | ☐ |
| 13 | Service Arbitrage | `service_arbitrage` | | | ☐ |
| 14 | TMMT Property | `tmmt_property` | | | ☐ |

Location ID: from URL `https://app.gohighlevel.com/v2/location/LOCATION_ID/...`

---

## Part 4 — Vercel env template

Paste into Vercel → Project → Settings → Environment Variables:

```bash
PARTNER_APP_WEBHOOKS_JSON={"vendor_connect":{"url":"https://services.leadconnectorhq.com/hooks/PASTE"},"freight_logistics":{"url":"https://services.leadconnectorhq.com/hooks/PASTE"},"fleet_manager":{"url":"https://services.leadconnectorhq.com/hooks/PASTE"},"service_arbitrage":{"url":"https://services.leadconnectorhq.com/hooks/PASTE"},"moving":{"url":"https://services.leadconnectorhq.com/hooks/PASTE"},"tmmt_rentals":{"url":"https://services.leadconnectorhq.com/hooks/PASTE"},"express":{"url":"https://services.leadconnectorhq.com/hooks/PASTE"},"black":{"url":"https://services.leadconnectorhq.com/hooks/PASTE"},"auto":{"url":"https://services.leadconnectorhq.com/hooks/PASTE"},"detailing":{"url":"https://services.leadconnectorhq.com/hooks/PASTE"},"cleaning":{"url":"https://services.leadconnectorhq.com/hooks/PASTE"},"wholesale-cars":{"url":"https://services.leadconnectorhq.com/hooks/PASTE"},"luxury":{"url":"https://services.leadconnectorhq.com/hooks/PASTE"},"tmmt_property":{"url":"https://services.leadconnectorhq.com/hooks/PASTE"}}
```

Redeploy after saving.

---

## Part 5 — Test

1. Complete Vendor Connect workflow + env URL.
2. TMMT → `/internal/dispatch/new` → submit test job (full move).
3. Verify in Vendor Connect GHL:
   - Workflow executed
   - Contact fields populated
   - Opportunity in `New`
   - Tag `tmmt-dispatch-job-new`
4. Clone workflow to next location; repeat.

---

## Flow

```
Staff → /internal/dispatch/new
  → TMMT case + protocols
  → POST flat JSON to each configured GHL webhook
  → GHL workflow: contact → deal → tag → notify → task
```
