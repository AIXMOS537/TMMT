# MASTER OPERATOR RUNBOOK — Get All Three Businesses Live

**Date:** 2026-06-09
**Owner:** ceo.moe (AIXMOS537)
**Tenants:** TMMT Auto Services LLC / AIXMOS / Moe Legacy

This is the single source of truth for **every external action a human must take** to put TMMT, AIXMOS, and Moe Legacy in a position to **run ads → get leads → close → fulfill** 24/7.

Code is already on disk + in the database. This document is everything that lives **outside** of code — signups, paperwork, configs, API keys.

---

## What's already built (you can stop worrying about these)

✅ Database schema (organizations, organization_licenses, audit_events, agent_conversations, agent_messages, incoming_leads extended) — applied to prod
✅ Three live tenants seeded:
   - **AIXMOS** — org id `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`, slug `aixmos`, agent `Aida`
   - **Moe Legacy** — org id `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`, slug `moe_legacy`, agent `Riley`
   - **TMMT RENTALS** — org id `8e651b25-e7c8-4356-af64-1716a82053b0`, slug `tmmt_property`, agent `Taj`
✅ All three have `active=true` license rows; kill-switch is live
✅ Code:
   - `src/lib/agent/*` — guard, FSM, LLM router, compliance (opt-out, quiet hours, CFPB disclaimers, banned phrases), persona, handoff, audit, Twilio sender
   - `src/app/api/license/{provision,heartbeat,revoke}/route.ts` — partner deploy control plane
   - `src/app/api/audit/events/route.ts` — append-only audit ingest
   - `src/app/api/agent/sms/inbound/route.ts` — Twilio webhook → state machine
   - `src/app/api/agent/stripe/webhook/[slug]/route.ts` — payment closed listener
   - `src/app/api/agent/cal/webhook/[slug]/route.ts` — booking listener
   - `src/app/api/leads/webhook/route.ts` — public landing-page form endpoint
   - `src/app/lp/[org]/[sku]/page.tsx` — landing page template (5 SKUs)
   - `scripts/provision-partner.sh` — one-shot new-partner onboarding
   - `scripts/test-three-tenant-smoke.sh` — three-tenant kill-switch smoke test

---

## CRITICAL ORDER OF OPERATIONS

Do these in order. Steps 1–5 are **owner-side** (you). Steps 6–9 are **per-tenant** (you, AIXMOS, Moe Legacy each do their own).

| # | Action | Tier | Time | Cost |
|---|---|---|---|---|
| 1 | Pause broken GHL $203 dunning workflow | OWNER | 5 min | $0 |
| 2 | Add 7 environment variables to Vercel | OWNER | 15 min | $0 |
| 3 | Buy Anthropic API credits | OWNER | 5 min | $50 starter |
| 4 | Deploy TMMT to production | OWNER | 10 min | $0 |
| 5 | Smoke-test the three tenants | OWNER | 5 min | $0 |
| 6 | Each tenant: Twilio + 10DLC | PER-TENANT | 1-4 wks calendar | $50-$200 setup |
| 7 | Each tenant: Stripe Payment Links | PER-TENANT | 30 min | $0 |
| 8 | Each tenant: Cal.com event | PER-TENANT | 15 min | $0 (free tier OK) |
| 9 | Each tenant: Meta + TikTok Pixel | PER-TENANT | 1 hour | $0 (free) |

---

## STEP 1 — Pause broken GHL workflow (DO THIS FIRST)

**Why:** [[project_ghl_203_dunning_misfire]] memo says the broken $203 dunning workflow is still PUBLISHED. Every misfire leaves a customer a dud dunning notice + costs you trust. **Do this before anything else.**

1. Log into GoHighLevel
2. Navigate to: Automation → Workflows
3. Find the workflow tagged with `$203 dunning` or similar
4. Click the three-dot menu → **Pause**
5. Add a note: `paused 2026-06-09 — replaced by apps/partner dunning loop (B4 plan)`
6. Confirm status shows `Draft` / `Paused`

**Verify:** Wait 1 hour. Confirm no new $203 dunning events arrive in your inbox.

---

## STEP 2 — Vercel environment variables (owner-side only, one time)

In Vercel dashboard → **TMMT project** → Settings → Environment Variables, add:

| Variable | Value | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | sk-ant-… | https://console.anthropic.com (after Step 3) |
| `ADMIN_KEY` | random hex | Run: `openssl rand -hex 32` |
| `AUDIT_INGEST_KEY` | random hex | Run: `openssl rand -hex 32` |
| `IMESSAGE_RELAY_URL` | `http://100.77.126.8:8787/send` | Already documented in [[project_imessage_relay_live]] |
| `B3_KILL_SWITCH` | (leave empty) | Set to `1` only as emergency stop |
| `PARTNER_APP_URL` | `https://tmmt-ops.vercel.app` | Or your custom domain |
| `SUPABASE_SERVICE_ROLE_KEY` | (existing) | Already wired per [[project_pending_vercel_tmmt_ops]] (RESOLVED) |

**Save** both `ADMIN_KEY` and `AUDIT_INGEST_KEY` to **1Password / Dashlane / your secrets vault** — these are your kill-switch credentials.

---

## STEP 3 — Anthropic API credits

1. Go to https://console.anthropic.com
2. Sign up / log in (use the AIXMOS LLC account, not personal)
3. Billing → Add credits → **$50 minimum** to start
4. Create an API key labeled `tmmt-prod-sales-agent`
5. Copy the key → paste into Vercel as `ANTHROPIC_API_KEY` (Step 2 above)

**Daily spend math:** ~$0.04 per conversation (10 turns × Sonnet 4.6). At 100 leads/day across all 3 tenants = ~$4/day = $120/month. Per-tenant cap is enforced in code (`organizations.llm_daily_cap_usd`).

---

## STEP 4 — Deploy to production

```bash
cd ~/Projects/TMMT
git status                  # confirm clean
git push                    # CI auto-deploys to Vercel
```

**Verify** within 60 seconds:

```bash
curl https://tmmt-ops.vercel.app/api/agent/_health
# Expect: {"ok":true,"service":"tmmt-agent-layer",...}
```

If `_health` returns 503, the `B3_KILL_SWITCH` env var is engaged — unset and redeploy.

---

## STEP 5 — Three-tenant smoke test

```bash
cd ~/Projects/TMMT
export ADMIN_KEY=<from your vault>
export BASE_URL=https://tmmt-ops.vercel.app
./scripts/test-three-tenant-smoke.sh
```

Expected output: 6 green checks (1 health + 5 per tenant × 2 tenants in script). If any red ✗, **STOP and debug before going to Step 6.**

---

## STEP 6 — Per-tenant: Twilio + 10DLC (CALENDAR BOTTLENECK — start NOW)

**This takes 1–4 weeks for approval. Each tenant must do their own.**

Each business needs:
- Active EIN
- Registered business name + address
- A privacy policy URL (https://<your-domain>/privacy)
- A terms of service URL (https://<your-domain>/terms)

### For each of TMMT / AIXMOS / Moe Legacy:

1. Sign up at https://twilio.com under that EIN
2. Console → Messaging → A2P 10DLC → **Brand registration**
   - Brand name = business legal name
   - Submit EIN
   - Wait 24–72 hours for brand approval
3. Console → Messaging → A2P 10DLC → **Campaign registration**
   - Use-case: `Mixed`
   - Sample message 1: *"Hey {{name}}, this is {{agent_name}} from {{brand}}. Saw you just looked at our offer — what's your main goal with this? Reply STOP to opt out."*
   - Sample message 2: *"Here's the link to get started: {{stripe_link}} — let me know if you have questions!"*
   - Wait 1–4 weeks for campaign approval
4. Buy a local SMS+Voice number; assign to the campaign
5. Configure the number's webhook:
   - Messaging URL: `https://tmmt-ops.vercel.app/api/agent/sms/inbound`
   - HTTP method: `POST`
6. **Save the number** to the org row:
   ```sql
   UPDATE organizations SET twilio_inbound_number = '+1NNNNNNNNNN'
   WHERE partner_app_slug = '<aixmos|moe_legacy|tmmt_property>';
   ```

### Stop-gap while waiting for 10DLC: toll-free number

Toll-free numbers don't need 10DLC. Lower throughput cap. OK for first 30 days.

1. Buy a Twilio toll-free number
2. Configure same webhook
3. Save same way
4. **Switch to 10DLC when approved** — just `UPDATE` the row, no code change

---

## STEP 7 — Per-tenant: Stripe Payment Links

**Each tenant brings their own Stripe account** per [[feedback_protect_the_llc]]. No Connect.

### For each of TMMT / AIXMOS / Moe Legacy:

1. https://dashboard.stripe.com → log in (under that tenant's EIN)
2. Products → New product, for each SKU:
   - **Lead Magnet** ($0 — only used for upsell, skip creating)
   - **$97 Intro** — recurring? No, one-time $97
   - **Training** — $7,000 (or split: 50% deposit + 50% on Day 30)
   - **Rental-in-a-Box** — $15,000
   - **Flagship** — $50,000
3. For each product → click → Payment links → Create payment link
4. Copy each link → save to a sticky note for the next sub-step
5. Stripe → Webhooks → Add endpoint:
   - URL: `https://tmmt-ops.vercel.app/api/agent/stripe/webhook/<slug>` (e.g. `/moe_legacy`)
   - Events: `payment_intent.succeeded`
   - Reveal signing secret → save to Vercel as `STRIPE_WEBHOOK_SECRET_<SLUG_UPPERCASE>` (e.g. `STRIPE_WEBHOOK_SECRET_MOE_LEGACY`)

**Save** the slug-keyed payment links: we'll add a `tenant_stripe_links` table next sprint to auto-fetch them from the agent. For now they're hardcoded in `process-inbound.ts` (TODO).

---

## STEP 8 — Per-tenant: Cal.com event

### For each tenant:

1. https://cal.com → sign up under that tenant
2. Event Types → New
   - Name: `Strategy Call`
   - Length: 30 minutes
   - Availability: business hours
3. Get the public link (e.g. `https://cal.com/aixmos/strategy-call`)
4. Save to org row:
   ```sql
   UPDATE organizations SET cal_com_event_link = 'https://cal.com/<...>'
   WHERE partner_app_slug = '<slug>';
   ```
5. Cal.com → Webhooks → Add:
   - URL: `https://tmmt-ops.vercel.app/api/agent/cal/webhook/<slug>`
   - Events: `BOOKING_CREATED`
   - Signing secret → save to Vercel as `CAL_WEBHOOK_SECRET_<SLUG_UPPERCASE>`

---

## STEP 9 — Per-tenant: Meta + TikTok Pixel

### For each tenant:

#### Meta Business Manager
1. https://business.facebook.com → log in under tenant
2. Business Settings → Data Sources → Pixels → Create
3. Copy the Pixel ID
4. Install on landing pages by adding to env: `META_PIXEL_ID_<SLUG_UPPERCASE>=<ID>`
5. (CAPI server-side wiring → next sprint via `src/app/api/conversion/capi-meta/route.ts`)

#### TikTok Ads Manager
1. https://ads.tiktok.com → log in
2. Assets → Events → Web Events → Create Pixel
3. Copy the Pixel ID + Access Token
4. Save: `TIKTOK_PIXEL_ID_<SLUG_UPPERCASE>=<ID>`, `TIKTOK_ACCESS_TOKEN_<SLUG_UPPERCASE>=<token>`

#### Create ad accounts + Business Manager structure
- Per-tenant separate ad accounts (no sharing)
- Daily budget cap suggested: **$50/day starter** per tenant
- Audiences: lookalike from your current closed customers

---

## CRITICAL — Hand-off configuration (so YOU get pinged)

For each tenant, set who gets pinged when the agent escalates to human:

```sql
UPDATE organizations SET
  handoff_slack_webhook = 'https://hooks.slack.com/services/T.../B.../...',
  handoff_imessage_target = '+1XXXXXXXXXX'    -- the iPhone for SEV1 push
WHERE partner_app_slug = '<slug>';
```

**Per-tenant routing:**
- **AIXMOS** → ceo.moe's Slack `#leads` + ceo.moe's iPhone
- **Moe Legacy** → Moe's Slack channel + Moe's iPhone
- **TMMT RENTALS** → ceo.moe's Slack + Taha's (COO) iPhone

The iMessage relay is live per [[project_imessage_relay_live]] at `100.77.126.8:8787`.

---

## Kill-switch operations

If anything goes wrong with a tenant, you have four levers:

### Soft kill (apps refuse to start, files preserved)
```bash
curl -X POST https://tmmt-ops.vercel.app/api/license/revoke \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -H 'content-type: application/json' \
  -d '{"organization_id":"<UUID>","mode":"soft"}'
```

### Hard kill (next heartbeat = wipe directive sent to partner Mac)
```bash
curl -X POST https://tmmt-ops.vercel.app/api/license/revoke \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -H 'content-type: application/json' \
  -d '{"organization_id":"<UUID>","mode":"hard"}'
```

### Restore (undo soft kill)
```bash
curl -X POST https://tmmt-ops.vercel.app/api/license/revoke \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -H 'content-type: application/json' \
  -d '{"organization_id":"<UUID>","mode":"restore"}'
```

### Operational kill (B3 only — independent of license)
In Vercel: set `B3_KILL_SWITCH=1` → redeploy. All B3 webhooks return 503. License layer unaffected. Use this if the SMS agent specifically misbehaves.

---

## Landing page URLs (live after Step 4 deploy)

| URL | Tenant | SKU |
|---|---|---|
| `tmmt-ops.vercel.app/lp/aixmos/lead-magnet` | AIXMOS | Free playbook |
| `tmmt-ops.vercel.app/lp/aixmos/intro-97` | AIXMOS | $97 audit |
| `tmmt-ops.vercel.app/lp/aixmos/training` | AIXMOS | Training cohort |
| `tmmt-ops.vercel.app/lp/moe_legacy/lead-magnet` | Moe Legacy | Free playbook |
| `tmmt-ops.vercel.app/lp/moe_legacy/intro-97` | Moe Legacy | $97 audit |
| `tmmt-ops.vercel.app/lp/tmmt_property/lead-magnet` | TMMT | Free playbook |

Each respects UTM query params for ad attribution.

---

## What you still need a future sprint for (deferred, by design)

- **B3.2 Voice** — Vapi inbound + outbound (2-3 weeks)
- **B1 Pixel CAPI server-side** — Conversions API for Meta + TikTok (1 week)
- **B4 Dunning loop** — replacement for paused GHL workflow (1 week)
- **B5 Mission Control inline rebuild** — KPI dashboards (1 week)
- **Tauri partner shell for Moe's Mac** — Plan A Phase 2 (2 weeks)
- **PyInstaller Brain.app** — Plan A Phase 2 (1 week)
- **Tailscale ACL `tag:partner-moe`** — Plan A Phase 4 (half day)
- **Apple notarization pipeline** — Plan A Phase 2 (1 day after Developer ID active)
- **Twilio 10DLC approval** — calendar wait, not build work

These have specs + plans already committed. Pick them up in 7-day sprints.

---

## Daily ops checklist (after Steps 1–9 done)

| Daily | Time | What |
|---|---|---|
| 09:00 ET | 5 min | Check `audit_events` table for overnight `agent.llm_call` cost (per tenant) |
| 12:00 ET | 2 min | Check `incoming_leads WHERE agent_status='HUMAN_HANDOFF' AND contacted_at > now() - interval '24 hours'` |
| 16:00 ET | 5 min | Spot-check 3 random conversations from `agent_messages` for compliance flags |
| 22:00 ET | 1 min | Confirm `B3_KILL_SWITCH` is empty (not engaged) |

| Weekly | Time | What |
|---|---|---|
| Monday | 30 min | Review per-tenant LLM spend vs. `llm_daily_cap_usd`; adjust if needed |
| Wednesday | 15 min | Verify all three tenants' heartbeats are within 24h |
| Friday | 10 min | Check `compliance_flags` distribution — anything trending up flag for review |

---

## Audit + safety verification (run anytime)

```sql
-- All three tenants healthy?
SELECT o.name, o.partner_app_slug, l.active, l.kill_command,
       o.llm_daily_cap_usd, o.twilio_inbound_number, o.cal_com_event_link IS NOT NULL AS has_cal,
       o.handoff_slack_webhook IS NOT NULL AS has_slack,
       o.handoff_imessage_target IS NOT NULL AS has_imessage
FROM organizations o
JOIN organization_licenses l ON l.organization_id = o.id
WHERE o.partner_app_slug IN ('aixmos','moe_legacy','tmmt_property')
ORDER BY o.name;

-- 24h activity per tenant
SELECT o.name, count(*) FILTER (WHERE l.agent_status = 'NEW') AS new,
       count(*) FILTER (WHERE l.agent_status = 'CONTACTED') AS contacted,
       count(*) FILTER (WHERE l.agent_status = 'QUALIFIED') AS qualified,
       count(*) FILTER (WHERE l.agent_status = 'BOOKED') AS booked,
       count(*) FILTER (WHERE l.agent_status = 'CLOSED') AS closed,
       count(*) FILTER (WHERE l.agent_status = 'LOST') AS lost,
       count(*) FILTER (WHERE l.agent_status = 'HUMAN_HANDOFF') AS handoff
FROM organizations o
LEFT JOIN incoming_leads l ON l.organization_id = o.id
   AND l.created_at > now() - interval '24 hours'
WHERE o.partner_app_slug IN ('aixmos','moe_legacy','tmmt_property')
GROUP BY o.name
ORDER BY o.name;

-- Compliance flag distribution (last 7 days)
SELECT jsonb_array_elements_text(compliance_flags) AS flag, count(*)
FROM agent_messages
WHERE ts > now() - interval '7 days'
GROUP BY flag
ORDER BY 2 DESC;

-- Today's LLM spend per tenant
SELECT o.name, sum((payload->>'cost_usd')::numeric) AS spend_usd
FROM audit_events e JOIN organizations o ON o.id = e.organization_id
WHERE e.action = 'agent.llm_call' AND e.ts > date_trunc('day', now())
GROUP BY o.name;
```

---

## Memory pointers

- [[project_moe_legacy_partner_deploy]] — Spec A (partner deploy)
- [[project_spec_b_revenue_engine]] — Spec B (revenue engine)
- [[project_ghl_203_dunning_misfire]] — Step 1 reason
- [[project_imessage_relay_live]] — SEV1 push target
- [[project_slack_workspace]] — channel structure
- [[feedback_protect_the_llc]] — why separate Stripe/Twilio
- [[feedback_middleman_only]] — posture
- [[project_aixmos_empire_editions]] — SKU pricing

---

## Final reality check

If Steps 1–5 are done: **TMMT, AIXMOS, and Moe Legacy can all run ads, collect leads, and serve landing pages** — that's most of the way to "in position." Inbound SMS conversations work for any tenant with a Twilio number wired (Step 6).

If Steps 1–9 are done for at least one tenant: **that tenant is closing deals 24/7.**

The calendar bottleneck is Step 6 (10DLC, 1–4 weeks). Start that **today**. Everything else is a few hours of clicking through admin UIs.
