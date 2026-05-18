# GHL Overdue Payment Alert — Wire Guide (Tier 1 #1)

**ROI:** Very high — matches #1 daily brief priority (19 overdue accounts).  
**Time:** ~45–90 min in GoHighLevel  
**Reference:** `docs/AUTOMATION_PRIORITY_BACKLOG.md` rank 1

---

## Goal

When a payment is **overdue** in your CRM/pipeline (or tagged overdue in Supabase sync), automatically:

1. Notify owner (SMS/email/Slack)
2. Create a follow-up task with customer name + amount
3. Optional: send customer payment reminder from approved template

---

## Steps in GoHighLevel

### 1. Trigger

- **Option A:** Opportunity / contact tag `payment-overdue` applied (manual or Zapier/n8n from Supabase)
- **Option B:** Custom field `payment_due_date` is in the past AND `payment_status` ≠ paid
- **Option C:** Pipeline stage moved to **Overdue**

### 2. Actions

1. **Internal notification** → owner phone + email  
   - Body: `{{contact.name}} — ${{custom.amount_due}} overdue since {{custom.due_date}}`
2. **Task** → assign to finance owner, due **today**
3. **Wait 24h** → if still overdue, second internal alert
4. **Optional SMS to customer** — use template from `CUSTOMERS/MESSAGE_TEMPLATE_LIBRARY.md` (payment reminder trigger)

### 3. Supabase sync (if using TMMT OS as source of truth)

- **Script:** `python3 AUTOMATIONS/SCRIPTS/push_overdue_to_ghl.py` (tags `payment-overdue` via TMMT OS)
- **Endpoint:** `POST /api/webhooks/ghl/overdue` — see `INTEGRATIONS/GHL_WEBHOOK_SETUP.md`
- **Example payload:** `AUTOMATIONS/WEBHOOKS/ghl_overdue_payment.example.json`
- n8n: schedule daily → HTTP Request to same endpoint

---

## Test checklist

- [ ] Test contact fires notification
- [ ] Task appears with correct amount
- [ ] No duplicate alerts same day (add filter: last alert > 24h)
- [ ] Customer SMS uses approved wording only

---

## Next after live

Wire **rank 2:** payment due **before** overdue (`AUTOMATION_MAP.md` P2) — 3-day and day-of reminders.
