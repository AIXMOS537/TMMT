# Rental GHL Pipeline — Document Your Stages

**Purpose:** One source of truth for rental leads (separate from dealer applicant pipeline).  
**Dealer pipeline reference:** `AIXMOSXTMMT-OPS/docs/ghl-pipelines.md` (Applicants – Dealership)

---

## Pipeline name in GHL

**TMMT Rentals** (create per `INTEGRATIONS/GHL_RENTAL_PIPELINE_BLUEPRINT.md`)

**Full workflow list (8 workflows):** same blueprint doc.

---

## Stages (edit to match your CRM)

| # | Stage | Definition | SLA / next action |
|---|--------|------------|-------------------|
| 1 | New lead | Form/call/text received | Contact within **15 min** (business hours) |
| 2 | Contacted | First touch sent | Qualify in 24h |
| 3 | Qualified | Meets radius, license, budget | Send booking link / quote |
| 4 | Booking sent | Rate + dates provided | Follow up in 2h if no reply |
| 5 | Booked / active | Agreement + payment scheduled | Confirmation + pick-up reminders |
| 6 | Active rental | Vehicle out | Return reminders + payment due |
| 7 | Payment overdue | Past due balance | Owner alert + collection script |
| 8 | Returned / closed | Vehicle back, account settled | Review request |
| 9 | Lost / DNR | Not interested, out of radius, repo | Do not re-engage per policy |

---

## Required custom fields

| Field | Use |
|-------|-----|
| `payment_due_date` | Automation rank 1–2 |
| `payment_status` | paid / due / overdue |
| `amount_due` | Collections queue |
| `vehicle_assigned` | Fleet conflict check |
| `pickup_date` / `return_date` | Reminders |
| `rental_customer_yn` | Dealer bridge (Y/N) |

---

## Automations tied to this pipeline

| Priority | Automation | Stage trigger |
|----------|------------|----------------|
| 1 | Overdue payment alert | Stage 7 or tag `payment-overdue` |
| 2 | Payment due reminder | Stage 6, 3 days + day-of |
| 4 | Booking confirmation | Stage 5 |
| 5 | Pick-up reminder | Stage 5 → 6 |
| 3 | Return reminder | Stage 6, 24h before return |

See: `AUTOMATIONS/GHL_OVERDUE_WORKFLOW_SETUP.md` · `docs/AUTOMATION_PRIORITY_BACKLOG.md`

---

## Upgrade / plan check

See **Should you upgrade GHL?** in `INTEGRATIONS/GHL_RENTAL_PIPELINE_BLUEPRINT.md`  
Test: can you add **Webhook** + **WhatsApp** actions in a workflow without "Premium" lock?

## This week

- [ ] Create pipeline **TMMT Rentals** (9 stages) + custom fields
- [ ] Publish **WF-07** overdue + **WF-00** stage webhook
- [ ] Confirm stage names match GHL exactly → update `GHL_PIPELINE_STAGE_MAP_JSON` on Vercel
- [ ] Move **Leo Auray** to correct stage after follow-up
- [ ] Tag **Hector Gomez** as JV / partner path (may use Partners pipeline instead)
