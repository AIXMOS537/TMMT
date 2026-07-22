# Lead Net — GHL Runbook (the click-together parts)

> Companion to `docs/LEAD-NET-SPEC.md`. The code + database side is BUILT and live:
> Supabase runs the first-touch clock (every new lead → 1h timer), escalates untouched
> leads every 15 min, and posts a daily 9am ET digest. The app bridges every webhook
> lead into GHL (dedupe by phone → lane tag → 1h task) and starts a reply clock on
> inbound messages. What remains is UI-only in GHL (workflows can't be created by API)
> plus a few env vars. ~45 minutes of clicking, once.

## A. Env vars (Vercel → tmmt-c919 → Settings → Environment Variables)
Required for the GHL bridge to switch on (it silently no-ops until then):
- `GHL_API_KEY` — GHL → Settings → Private Integrations (scopes: contacts write, tasks write, conversations write)
- `GHL_LOCATION_ID` — the TMMT Rentals location id
- `GHL_WEBHOOK_SECRET` — any long random string; used below in C
- `SLACK_WEBHOOK_URL` — incoming webhook for #front-desk

## B. Slack digest + escalations (2 minutes, works even before the site is live)
The DB posts straight to Slack. Give it the webhook once (staff login → SQL editor):
```sql
update leadnet_config set slack_webhook_url = 'https://hooks.slack.com/services/…';
```
Off-switches (no code): `update leadnet_config set sweep_enabled=false;` / `digest_enabled=false;`
Change SLA: `update leadnet_config set sla_minutes = 30;`

## C. GHL workflows to click together (all start as DRAFT)
1. **Inbound message → webhook** — Workflow: trigger *Customer Replied / Inbound Message* →
   action *Webhook (POST)* to `https://<prod-domain>/api/webhooks/ghl` with header
   `x-ghl-webhook-secret: <GHL_WEBHOOK_SECRET>`, include contactId + message body +
   direction. This powers the reply clock + Slack ping.
2. **Pipeline** — create pipeline **TMMT Leads** with stages
   `New → Contacted → Qualified → Booked/Quoted → Won → Cold`.
3. **Rental cadence** (DRAFT until owner flips): trigger *contact tagged `lane:rental`* →
   send first-touch SMS (template in spec §3) → wait 12h, if no reply → nudge →
   wait 36h → alternative offer → wait 5d → move to Cold. **Add condition: skip if DND.**
4. **Detail cadence** (DRAFT): tag `lane:detail` → first-touch → 24h nudge → 3d offer →
   7d final → Cold. Skip if DND.
5. **Routing question** (DRAFT): contact created with tag `lead-net` but NO lane tag →
   send "book a rental or get a detail?" → reply containing detail keywords → add
   `lane:detail`, else `lane:rental`.
6. **Kill the old firehose:** the automation that creates ClickUp "New Lead Alert"
   tasks in OPS TASKS + ADMIN TASKS — switch OFF (it double-logs junk). ClickUp lists
   can then be archived per BOOKMARK cut list.
7. **While you're in there:** set "Rental in Progress (Payment Reminder)" to **Draft**
   (the bad $203 step — still pending from June).

## D. Google Voice → the net (5 minutes)
Gmail (tmmtautodetail@gmail.com) → Settings → Filters: from `voice-noreply@google.com`
→ forward to your GHL location's inbound email address. Leads then flow in like any
other source instead of dying in the inbox.

## E. Verify it end to end (after A–C)
1. Submit a test lead: `POST /api/leads/webhook?org=<slug>` with your own phone.
2. Check: GHL contact exists (once), tagged `lane:rental`, task due in 1h.
3. Check Supabase: `select * from lead_followups order by created_at desc limit 1;`
4. Wait past the SLA (or `update leadnet_config set sla_minutes=1;` temporarily) →
   escalation appears in #front-desk within 15 min.
5. Text the GHL number from another phone → Slack ping + reply-clock task appear.
6. Reset `sla_minutes` to 60. Cadences stay DRAFT for a week of owner review (spec §7).
