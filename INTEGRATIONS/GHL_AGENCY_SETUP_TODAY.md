# GHL Agency setup — do this today (follow in order)

**Time:** ~90–120 min · **Account:** Agency → **TMMT Rentals** sub-account only  
**Keep this open:** [app.gohighlevel.com](https://app.gohighlevel.com)

Print-friendly checklist at the bottom.

---

## Part 0 — Open the correct location (2 min)

1. Log in to **GoHighLevel** (agency dashboard).
2. Top-left **location switcher** (building name / dropdown).
3. Select your **rental** sub-account — name may be **TMMT Auto Services**, **TMMT Rentals**, or similar (**not** the agency name at the top level).
4. Confirm the URL contains something like `/location/XXXXXXXX/` — that `XXXXXXXX` is your **Location ID** (save for Part 5).

**Wrong place if you see:** “All locations” agency overview with no Conversations inbox for one shop.

---

## Part 1 — Pipeline `TMMT Rentals` (15 min)

1. Left menu → **Opportunities** (or **CRM** → **Opportunities**).
2. Tab **Pipelines** → **+ Create pipeline** (or **Add pipeline**).
3. **Pipeline name:** `TMMT Rentals`
4. Add **9 stages** in this exact order (copy/paste names):

```
New lead
Contacted
Qualified
Booking sent
Booked
Active rental
Payment overdue
Returned / closed
Lost / DNR
```

5. **Save** pipeline.
6. On `CUSTOMERS/RENTAL_GHL_PIPELINE.md` — note the exact name if GHL changed spacing.

---

## Part 2 — Contact custom fields (10 min)

1. **Settings** (gear, bottom-left) → **Custom Fields**.
2. **Object:** Contact → **+ Add field** for each:

| Field name | Type | Options (if dropdown) |
|------------|------|------------------------|
| `payment_due_date` | Date | — |
| `payment_status` | Dropdown | paid, due, overdue |
| `amount_due` | Monetary | — |
| `vehicle_assigned` | Text | — |
| `pickup_date` | Date | — |
| `return_date` | Date | — |
| `rental_customer_yn` | Dropdown | Y, N |

3. **Save** each field.

---

## Part 3 — Tag (1 min)

1. **Settings** → **Tags** → **+ Create tag**
2. Name: `payment-overdue`
3. Save.

---

## Part 4 — WF-07 Overdue workflow (25 min)

**Name:** `WF-07 TMMT Overdue Payment Alert`

1. **Automation** → **Workflows** → **+ Create workflow** → **Start from scratch**.
2. **Workflow name:** `WF-07 TMMT Overdue Payment Alert`

### Trigger

3. **Add new trigger** → search **Tag** → **Contact Tag**
4. Tag: `payment-overdue`
5. Condition: tag is **Added** (not removed)

### Action 1 — Alert you

6. Click **+** below trigger → **Internal notification**  
   *(If you don’t see it: try **Send internal notification**, **Notify user**, or **Send email** to assigned user.)*
7. **Send to:** your user (Muhammad / owner account).
8. Enable **SMS** and **Email** if both available.
9. **Message** (use **Custom values** / field picker for merge fields):

```text
OVERDUE: {{contact.full_name}}
Amount: {{contact.amount_due}}
Due: {{contact.payment_due_date}}
Phone: {{contact.phone}}
```

### Action 2 — Task

10. **+** → **Create task** (or **Add task**)
11. **Title:** `Collect overdue — {{contact.full_name}}`
12. **Due date:** Today
13. **Assigned to:** you (or finance VA)
14. **Description:** `Call today per TODAY_COLLECTIONS.md`

### Action 3 — 24h (optional today)

15. **+** → **Wait** → **1 day**
16. **+** → **If/Else** → **Contact** → **Tags** → includes `payment-overdue`
17. **Yes** → **Internal notification:** `Still overdue: {{contact.full_name}}`
18. **No** → end branch

### Publish WF-07

19. **Save**
20. Toggle **Publish** / **Active** (top-right) → **ON**
21. **Do not** add customer SMS yet.

### Test WF-07 (5 min)

22. **Contacts** → open **yourself** or a test contact.
23. **Tags** → add `payment-overdue`
24. You should get internal SMS/email + task within 1–2 min.
25. Remove tag when done testing.

---

## Part 5 — WF-00 Stage sync webhook (20 min)

**Name:** `WF-00 TMMT Stage Sync to Ops`

1. **Automation** → **Workflows** → **+ Create workflow**
2. Name: `WF-00 TMMT Stage Sync to Ops`

### Trigger

3. **Add trigger** → **Pipeline stage changed**  
   *(May appear as **Opportunity status changed** or **Opportunity stage changed**.)*
4. **Pipeline:** `TMMT Rentals`
5. **Stage:** All stages (any change)

### Action — Webhook

6. **+** → **Webhook**  
   *(If missing: **Custom webhook**, **HTTP request**, or under **Integrations**.)*
7. **Method:** POST
8. **URL:**

```text
https://tmmt-ops.vercel.app/api/webhooks/ghl
```

9. **Headers** — add two rows:

| Key | Value |
|-----|--------|
| Content-Type | application/json |
| X-GHL-Secret | *(paste from `tmmt-os/.env.local` → `GHL_WEBHOOK_SECRET` — do not share in chat)* |

10. **Body** — choose **Raw** / **JSON**. Paste this, then **replace every `{{...}}` using GHL’s “Custom value” picker** (do not type wrong field names):

```json
{
  "event": "opportunity.stage_changed",
  "pipeline_id": "{{opportunity.pipeline_id}}",
  "pipeline_name": "{{opportunity.pipeline_name}}",
  "opportunity_id": "{{opportunity.id}}",
  "contact_id": "{{contact.id}}",
  "contact": {
    "name": "{{contact.full_name}}",
    "email": "{{contact.email}}",
    "phone": "{{contact.phone}}"
  },
  "previous_stage": "{{opportunity.previous_stage_name}}",
  "stage": "{{opportunity.stage_name}}",
  "business_line": "rentals",
  "custom_fields": {
    "amount_due": "{{contact.amount_due}}",
    "payment_due_date": "{{contact.payment_due_date}}"
  }
}
```

11. **Save** → **Publish** ON.

### Test WF-00

12. Open a test contact’s **Opportunity** in pipeline `TMMT Rentals`.
13. Drag to another stage (e.g. **Contacted**).
14. In TMMT OS (browser): log in → **Internal** → **Sync** — look for a new pending row within a minute.

---

## Part 6 — API key → Vercel (10 min)

### Get from GHL (rental location)

**Location ID** (you noted in Part 0):

- From URL: `/location/ABC123xyz/...` → `ABC123xyz` is `GHL_LOCATION_ID`

**API key** (pick one method):

**Method A — Location API key**

1. In **TMMT Rentals** location → **Settings** → **Business Info** or **API Keys** / **Integrations**.
2. Create or copy **API key** (v2).

**Method B — Agency**

1. Agency **Settings** → **API Keys** → create key with access to this location.

### Add to Vercel

1. Open [vercel.com](https://vercel.com) → project **tmmt-ops** → **Settings** → **Environment Variables**.
2. Add or edit for **Production**:

| Name | Value |
|------|--------|
| `GHL_API_KEY` | paste API key |
| `GHL_LOCATION_ID` | paste location ID |
| `GHL_WEBHOOK_SECRET` | same as `tmmt-os/.env.local` |

3. **Redeploy** latest deployment (Deployments → … → Redeploy).

### Add to local files (optional)

Edit `TMMT MANAGEMENT/tmmt-os/.env.local`:

```
GHL_API_KEY=paste_here
GHL_LOCATION_ID=paste_here
```

---

## Part 7 — Load top 5 overdue contacts (30 min)

Use `OPERATIONS/TODAY_COLLECTIONS.md` Priority 1.

For each: **Rodrigue**, **Charrisse**, **Abeal**, **Tyler**, **Patrick**:

1. **Contacts** → search name → open (create if missing).
2. Set custom fields: `amount_due`, `payment_due_date`, `payment_status` = **overdue**.
3. **Opportunity** → pipeline **TMMT Rentals** → stage **Payment overdue**.
4. Add tag **`payment-overdue`** (fires WF-07 once per apply).
5. Log call in **Notes**.

**After Vercel has `GHL_API_KEY`:** you can run `push_overdue_to_ghl.py` to auto-tag (needs `ghl_contact_map.json` with contact IDs).

---

## Part 8 — Contact ID map (for script later)

1. In GHL, open contact → URL or sidebar shows **Contact ID**.
2. Copy into `AUTOMATIONS/WEBHOOKS/ghl_contact_map.json` (copy from `.example.json`).
3. Start with Priority 1 names only.

---

## Stuck? Common Agency UI labels

| Looking for | Also called |
|-------------|-------------|
| Opportunities | CRM → Opportunities |
| Pipelines | Opportunities → Pipelines tab |
| Workflows | Automation → Workflows |
| Internal notification | Notify user · Send email to assigned user |
| Pipeline stage changed | Opportunity status changed |
| Webhook | Custom webhook · HTTP request |

---

## Checklist (check as you go)

- [ ] Switched to **TMMT Rentals** location (not agency parent)
- [ ] Pipeline **TMMT Rentals** — 9 stages
- [ ] 7 custom fields on Contact
- [ ] Tag `payment-overdue`
- [ ] **WF-07** published + test tag worked
- [ ] **WF-00** published + stage move → `/internal/sync`
- [ ] Vercel: `GHL_API_KEY`, `GHL_LOCATION_ID`, `GHL_WEBHOOK_SECRET`
- [ ] Top 5 overdue contacts in stage + tag

---

**Next week:** WF-04 payment due, WF-01 speed-to-lead — see `GHL_RENTAL_PIPELINE_BLUEPRINT.md`
