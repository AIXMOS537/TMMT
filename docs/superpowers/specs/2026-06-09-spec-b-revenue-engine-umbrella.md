# Spec B — Always-On Revenue Engine (Umbrella Architecture)

- **Date:** 2026-06-09
- **Author:** ceo.moe (AIXMOS537)
- **Status:** Draft, awaiting user review before plan phase
- **Reference:** Spec A handoff §17 — `2026-06-09-moe-legacy-partner-deploy-design.md`
- **Sub-spec details:** B3 = `2026-06-09-spec-b3-ai-sales-agent-design.md` (this commit)

## 1. Problem Statement

Spec A built the **partner infrastructure** (license, kill-switch, sealed binaries, tenant scoping). Spec B builds the **money-making layer** on top: turning paid traffic into closed deals 24/7 for both ceo.moe's tenant AND Moe Legacy's tenant, without anyone manually responding at 3am.

Today (2026-06-09):
- Leads land in GHL forms or ClickUp, sometimes go unanswered for hours
- The TMMT/AIXMOS funnel ([[../../../memory/project_aixmos_tmmt_funnel]]) is documented but not wired end-to-end
- A $203 GHL dunning workflow is in a misfire state ([[../../../memory/project_ghl_203_dunning_misfire]]) and must be paused
- Mission Control is BLOCKED ([[../../../memory/project_mission_control_blocked]]) — no live revenue visibility
- No ad budget running because the close-side isn't reliable
- AIXMOS Empire editions ([[../../../memory/project_aixmos_empire_editions]]) are defined but no SKU has an automated lead → close pipeline

Spec B fixes this for both tenants in parallel, preserving:
- Tenant isolation (no data crosses)
- Legal isolation (Moe runs his own EIN, Stripe, Twilio under license)
- AIXMOS / TMMT IP safety (kill-switch from Spec A revokes B-layer agents too)
- Compliance with CFPB credit-related advertising rules and US SMS/TCPA law

## 2. Goals

1. **Inbound lead → first contact in ≤ 60 seconds** any hour of day, any day of week.
2. **Sub-$97 SKUs close DIRECTLY** in the SMS/voice conversation via Stripe Payment Link — no human required.
3. **>$97 SKUs qualify on Budget/Authority/Timing**, book a Cal.com slot, escalate hot leads to human.
4. **Per-tenant attribution end-to-end** — every lead carries `tenant_id` from ad-click to payment.
5. **Compliance gates non-bypassable** — quiet hours, opt-out, CFPB disclaimers enforced in code, not policy.
6. **Kill-switch carry-through from Spec A** — when ceo.moe revokes Moe's license, his B-layer agents stop processing within one heartbeat window (≤24h).
7. **Dunning misfire scar healed** — the $203 GHL workflow is paused and replaced with an idempotent in-app dunning loop.
8. **Mission Control rebuilt INLINE** — no more stale "package" approach; dashboards live alongside the partner app.

## 3. Non-Goals

- New operating businesses on either side — middleman/reseller posture per [[../../../memory/feedback_middleman_only]].
- Migrating existing GHL contacts to a new CRM — GHL stays the contact store; Spec B writes overlay state (conversation, qualification, payment).
- Stripe Connect (rejected during brainstorming) — each tenant runs fully separate Stripe orgs per [[../../../memory/feedback_protect_the_llc]] + [[../../../memory/project_legal_ops_structure]].
- Voice-first design — voice is in v1 but text is the primary channel; voice handles callers who refuse SMS.
- Brokering credit decisions — we are NEVER the decisioner; agents always disclaim and route to licensed partners per [[../../../memory/project_phase_9_credit_funding]].
- Building partner #2's ad accounts for them — they bring their own EIN, Meta BM, Twilio, Stripe, Vapi number.

## 4. Constraints (locked decisions from brainstorming)

| Decision | Choice | Why |
|---|---|---|
| Voice in v1 or v2 | **v1** | Covers callers who refuse SMS; older funding demographic |
| Stripe topology | **Fully separate per tenant** | Veil-pierce protection ([[../../../memory/feedback_protect_the_llc]]); cleaner legal isolation; no platform-level dispute exposure |
| Twilio 10DLC | **Each tenant brings own EIN + 10DLC** | True white-label; sender liability rests with tenant; aligns with middleman-only |
| Vapi numbers | **Per-tenant, brought by tenant** | Same logic as Twilio |
| Meta + TikTok BM | **Per-tenant** | Per-tenant attribution; ad-account suspensions don't cascade |
| Tenant scoping | **Re-uses Spec A `tenants` + `tenant_id`** | One scoping primitive across A and B |
| Kill-switch | **Spec A heartbeat carries through** | When license is killed, B agents stop reading from the leads queue and Twilio webhook handlers 401 |
| Audit | **All B events ship to Spec A's `audit_events`** | Single source of truth for compliance + legal |

## 5. Shared Substrate (built once in Sprint 1)

The substrate is what makes B1–B5 actually independent and parallel-buildable. It lives in `apps/partner` (existing from Spec A) plus a small new package.

### 5.1 Canonical `leads` table

```sql
CREATE TABLE leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL REFERENCES tenants(id),
  status          text NOT NULL DEFAULT 'NEW'
                  CHECK (status IN ('NEW','CONTACTED','QUALIFIED','BOOKED','CLOSED','LOST','HUMAN_HANDOFF')),
  phone_e164      text NOT NULL,
  email           text,
  ghl_contact_id  text,                    -- the lead's true home in GHL
  source          jsonb NOT NULL DEFAULT '{}'::jsonb,  -- utm_*, pixel_id, click_id
  sku             text,                    -- inferred from LP/UTM
  qualification   jsonb NOT NULL DEFAULT '{}'::jsonb,  -- BAT scores, last LLM assessment
  conversation_id text,                    -- pointer to the convo thread (B3)
  stripe_payment_intent_id text,           -- if closed via Stripe (B4)
  created_at      timestamptz NOT NULL DEFAULT now(),
  contacted_at    timestamptz,
  qualified_at    timestamptz,
  closed_at       timestamptz,
  lost_at         timestamptz,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX leads_tenant_status_idx ON leads(tenant_id, status);
CREATE INDEX leads_tenant_created_idx ON leads(tenant_id, created_at DESC);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON leads
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
REVOKE ALL ON leads FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON leads TO authenticated;
GRANT ALL ON leads TO service_role;
```

### 5.2 Event bus — Supabase Realtime channels

One channel per tenant: `tenant:<tenant_id>:leads`. Events:
- `lead_received` — emitted by B1/B2 when a form fires
- `lead_contacted` — emitted by B3 after first outbound message
- `lead_qualified` — emitted by B3 after BAT positive
- `lead_booked` — emitted by B3 after Cal.com slot held
- `lead_closed` — emitted by B4 after Stripe webhook `payment_intent.succeeded`
- `lead_lost` — emitted by B3 (no-response) or B4 (3rd dunning failure)
- `lead_escalated_to_human` — emitted by B3 hand-off; pings Slack + iMessage

Each event payload contains `lead_id`, `tenant_id`, `event_ts`, `details: jsonb`. Subscribers (B5 monitoring, Slack relay) listen via Supabase JS client.

### 5.3 Tenant scoping reinforcement

**Every** B-layer code path MUST set `app.tenant_id` on the Supabase connection before any DB read/write. Helper:

```typescript
// apps/partner/lib/tenant-scoped.ts
export async function withTenant<T>(tenantId: string, fn: (db: SupabaseClient) => Promise<T>): Promise<T> {
  const db = createServiceClient()
  await db.rpc('set_config', { setting: 'app.tenant_id', value: tenantId, is_local: true })
  try { return await fn(db) } finally { await db.rpc('set_config', { setting: 'app.tenant_id', value: '', is_local: true }) }
}
```

Any handler that bypasses `withTenant` fails RLS and returns 401 — defense in depth.

### 5.4 Kill-switch carry-through (the safety layer)

This is the part the user emphasized: **TMMT and AIXMOS always safe.**

Every B-layer entry point (Twilio webhook, Vapi webhook, Stripe webhook, dashboard route, agent API call) starts with:

```typescript
// apps/partner/lib/guard.ts
export async function guardTenant(tenantId: string): Promise<void> {
  const { data } = await supabase
    .from('licenses')
    .select('active, kill_command')
    .eq('tenant_id', tenantId)
    .single()
  if (!data || !data.active || data.kill_command === 'wipe') {
    throw new Error('LICENSE_DISABLED')
  }
}
```

Called on EVERY request. If the user soft-kills Moe's license, his B-layer agents stop processing in real-time (not next heartbeat — instant). The cost is one Supabase query per request; with PGBouncer + connection pooling this is sub-2ms.

### 5.5 Audit extension

Every B-layer action emits an event to `log.tmmt.tools` (Spec A endpoint):

- `lead.created`, `lead.first_contact`, `lead.qualified`, `lead.booked`, `lead.closed`, `lead.lost`, `lead.handoff`
- `sms.sent`, `sms.received`, `voice.call_started`, `voice.call_ended`
- `stripe.payment_link_sent`, `stripe.payment_collected`, `stripe.dunning_attempt`, `stripe.refund_issued`
- `compliance.opt_out_received`, `compliance.quiet_hours_blocked`, `compliance.disclaimer_inserted`

Every audit row carries `tenant_id`, `hardware_uuid` (if applicable), `ip`, full payload. Append-only.

## 6. Sub-Spec Charters

### B1 — Ad delivery + Pixel + CAPI + Creative pipeline

**Goal:** Get paid traffic flowing per-tenant with accurate conversion tracking.

**In scope:** Meta Business Manager wiring, Meta Pixel browser-side, Conversions API server-side (Vercel route), TikTok Pixel + Events API, UTM convention, daily budget cap auto-enforcement, creative generation pipeline (nano-banana + ElevenLabs + freelance polish).

**Out of scope:** Snap, Google Ads, YouTube (deferred). Agency-grade attribution windowing (use Meta defaults).

**Key components:**
```
apps/partner/app/api/conversion/capi-meta/route.ts
apps/partner/app/api/conversion/capi-tiktok/route.ts
apps/partner/lib/pixel-relay.ts
apps/partner/lib/ad-budget-guardrail.ts        # daily cap auto-pause
scripts/generate-creatives.sh                    # nano-banana + ElevenLabs + freelance handoff
```

**Safety:** Per-tenant Meta/TikTok BM = ad-account suspensions don't cascade across tenants. Daily budget cap = no runaway spend. Creative review queue ensures CFPB disclaimers present.

**Estimated build:** 1 week (Sprint 5).

---

### B2 — Landing pages + UTM-driven personalization

**Goal:** High-converting LPs that turn ad clicks into phone numbers in the leads table.

**In scope:** New Vercel project `lp.tmmt-ops.com`, one LP per SKU (4 SKUs from Empire Editions), UTM-driven variant rendering, phone-only single-step form, A/B framework, mobile-first responsive.

**Out of scope:** Customer dashboards, post-purchase UX (those live in `apps/partner`).

**Key components:**
```
apps/lp/                                # new Vercel project
  app/[sku]/page.tsx                    # dynamic per-SKU LP
  lib/utm-personalize.ts                # variant resolver
  lib/form-submit.ts                    # POSTs to apps/partner/api/leads/webhook
  components/PhoneOnlyForm.tsx
```

**Safety:** Forms POST to `apps/partner/api/leads/webhook` which enforces `guardTenant` — even if Moe's LP is up, his license being revoked = the form returns 503 within milliseconds.

**Estimated build:** 1 week (Sprint 4).

---

### B3 — AI Sales Agent (THE CORE) ⭐

**See dedicated sub-spec:** `2026-06-09-spec-b3-ai-sales-agent-design.md`

Summary: Twilio (SMS) + Vapi (voice) + Claude Sonnet 4.6 → SMS-first conversational qualifier with voice fallback. State machine: NEW → CONTACTED → QUALIFIED → {BOOKED | CLOSED | LOST | HUMAN_HANDOFF}. <$97 SKU closes directly via Stripe link; >$97 SKU books a call. Hard compliance gates from `COMPLIANCE_DISCLAIMERS.md`.

**Estimated build:** 3 weeks (Sprints 2-3, SMS first then voice).

---

### B4 — Stripe + payment links + dunning fix

**Goal:** One-tap close in the conversation + fix the bleeding $203 misfire.

**In scope (in order of urgency):**
1. **DAY 1:** Manually pause the broken GHL workflow per [[../../../memory/project_ghl_203_dunning_misfire]] — 30 seconds in the GHL UI. THIS IS THE FIRST ACTION BEFORE ANYTHING ELSE.
2. Per-tenant Stripe webhook handlers on `apps/partner/api/stripe/webhook/[tenant_id]/route.ts`.
3. Payment Links per SKU per tenant — auto-generated by `scripts/sync-payment-links.ts` from a `products` table.
4. Replacement dunning loop in `apps/partner/lib/dunning.ts`:
   - Retry at T+1d, T+3d, T+7d
   - Email + SMS only (NEVER voice)
   - Max 3 attempts → emit `lead_lost`
   - Idempotency key per `(payment_intent_id, attempt_n)` — eliminates the misfire root cause

**Out of scope:** Subscription billing migration, ACH (use card-only for v1).

**Key components:**
```
apps/partner/app/api/stripe/webhook/[tenant_id]/route.ts
apps/partner/lib/dunning.ts
apps/partner/lib/payment-links.ts
scripts/sync-payment-links.ts
docs/runbooks/dunning-pause-ghl.md      # the day-1 action with screenshots
```

**Safety:** Separate Stripe accounts per tenant = no cross-tenant refund risk. Idempotency keys = misfire pattern provably impossible to repeat. Dunning never calls voice (the original misfire fear).

**Estimated build:** 1 week (Sprint 1, parallel with substrate).

---

### B5 — Monitoring + Mission Control rebuild

**Goal:** Always-on visibility into the funnel + early warning when anything's off.

**In scope:**
- **Rebuild Mission Control INLINE** in `apps/partner/app/dashboard/` per [[../../../memory/project_mission_control_blocked]] — do NOT copy the stale package.
- KPI cards: lead arrival rate (24h trailing), qualified rate, book rate, close rate, churn rate, ad spend, ROAS per channel, per-SKU revenue, per-tenant breakdown.
- Alert rules in `apps/partner/lib/alerts/rules.ts`:
  - **SEV1:** Lead unattended >5 min (B3 should have responded), ad spend exceeded daily cap, Stripe webhook failures, license heartbeat failed
  - **WARN:** Conversion rate dropped >30% day-over-day, dunning attempt count rising
  - **INFO:** New booking, new close, daily summary
- Alert channels: Slack `#ops` + `#leads` (existing per [[../../../memory/project_slack_workspace]]); iMessage relay push for SEV1 only (via `100.77.126.8:8787` per [[../../../memory/project_imessage_relay_live]]).
- External uptime check via UptimeRobot free tier hitting `/_health`.

**Out of scope:** Custom Grafana, pager rotation, on-call schedules (single-on-call until partner #5+).

**Key components:**
```
apps/partner/app/dashboard/page.tsx           # the rebuilt Mission Control
apps/partner/lib/metrics/                     # query helpers
apps/partner/lib/alerts/
  slack.ts
  imessage.ts                                 # relay via Tailscale to 100.77.126.8:8787
  rules.ts
apps/partner/app/api/_health/route.ts
```

**Safety:** Monitoring runs server-side on YOUR Vercel — Moe never sees your aggregate dashboards (per-tenant only). Alerts go to YOUR Slack and YOUR iMessage by default; partner tenants get their OWN Slack webhook URL configured per `tenants.alert_webhook_url`.

**Estimated build:** 1 week (Sprint 6).

## 7. Sequencing

| Sprint | Builds | Duration | Outcome |
|---|---|---|---|
| **1** | B0 substrate + B4 (DAY 1: pause GHL workflow) + B5 alerts skeleton | 1 week | Stop bleeding, basic visibility |
| **2** | B3 SMS (Twilio + 10DLC + LLM router + state machine) | 1.5 weeks | Close-24/7 begins for inbound SMS |
| **3** | B3 voice (Vapi inbound + outbound, same state machine reused) | 1.5 weeks | Voice channel live |
| **4** | B2 landing pages (lp.tmmt-ops.com) | 1 week | Conversion surface ready |
| **5** | B1 ads + pixel + CAPI + first 10 creatives + $50/day starter budget | 1 week | Real paid traffic flowing |
| **6** | B5 dashboards + Mission Control rebuild | 1 week | Full visibility, ready for partner #2 |

**Total: ~7 weeks** to all 5 sub-systems running for both tenants. Bottleneck = 10DLC approval (calendar time, not build time) — start the registration paperwork in Sprint 1 so it's approved by Sprint 2.

## 8. Safety-by-Design Across All Sub-Specs

A consolidated list of how "TMMT and AIXMOS always safe" is enforced:

| Concern | Enforcement |
|---|---|
| **Cross-tenant data leak** | `withTenant()` wrapper on every DB call + RLS policies + tenant_id on every row + linter check rejecting raw `supabase.from()` calls outside the wrapper |
| **License revoke not respected by B agents** | `guardTenant()` called on every entry point (Twilio webhook, Vapi webhook, Stripe webhook, dashboard route); fail-closed if license check fails |
| **Veil-piercing from commingled Stripe/Twilio** | Fully separate accounts per tenant; each tenant brings own EIN; we never hold customer funds |
| **CFPB violation in ad copy or SMS conversation** | Compliance gate in code: every outbound message run through `COMPLIANCE_DISCLAIMERS.md` rule engine; ads reviewed by a checklist before going live; offending messages logged + auto-blocked |
| **TCPA violation (calling/texting after quiet hours)** | `quietHoursBlock()` checks lead's state from area code; blocks outbound between 9pm and 8am local time; logged as `compliance.quiet_hours_blocked` |
| **Opt-out not honored** | Twilio inbound webhook checks for STOP/UNSUB/STOPALL keywords; immediately marks lead `opted_out=true`; outbound to opted-out leads throws |
| **Runaway ad spend** | Per-tenant daily cap enforced by `ad-budget-guardrail.ts` polling Meta/TikTok spend every 15 min and auto-pausing campaigns at threshold |
| **Dunning misfire recurrence** | Idempotency key per `(payment_intent_id, attempt_n)`; dunning loop refuses to re-send within same key |
| **Mission Control re-blocking** | Inline rebuild against current app structure (not a package); no module path resolution issues possible |
| **Hot lead lost to no-response** | SEV1 alert at 5min unattended; pings Slack + iPhone push |
| **Audit gap (no evidence in legal claim)** | Every action emits to `audit_events` via Spec A's `log.tmmt.tools`; append-only; tenant_id + timestamp + payload |
| **Wrong tenant gets Moe's leads** | Tenant scoping by Twilio number → `tenants.twilio_inbound_number` lookup; if no match, lead is quarantined for human review (NEVER routed to wrong tenant) |
| **LLM hallucinates a credit promise** | Sales agent system prompt loaded fresh per turn (no in-context drift); guardrail post-processor scans LLM output for banned phrases (e.g. "guaranteed", "approved", "you will get") before send |

## 9. Open Questions

1. **Cal.com vs. GHL native calendar for B3 bookings?** Cal.com is more flexible; GHL native is already wired. Recommend Cal.com for portability across tenants; revisit in B3 implementation.
2. **Where do refunds live in the dashboard?** Owner sees refund button; tenant sees refund button for THEIR Stripe only. Permissions matrix to draft in B5 detailed spec.
3. **Vapi voice persona — same LLM as SMS or different?** Recommend same Sonnet 4.6 to keep voice/text continuity. Worth testing.
4. **Slack workspace for Moe's tenant** — Moe's alerts go to HIS Slack or yours? Recommend HIS, with optional CC to your `#leads` channel for shared visibility.
5. **Hot-lead human handoff routing** — when B3 escalates, who gets pinged? Recommend tenant-configurable: ceo.moe's `tag:partner-moe` gets Moe's iPhone, your shared tenant gets your iPhone + Taha (COO).

## 10. Memory References

- [[../../../memory/project_moe_legacy_partner_deploy]] — Spec A foundation
- [[../../../memory/project_aixmos_tmmt_funnel]] — funnel shape
- [[../../../memory/project_aixmos_empire_editions]] — SKU ladder
- [[../../../memory/project_ghl_203_dunning_misfire]] — Day-1 pause action
- [[../../../memory/project_mission_control_blocked]] — rebuild not copy
- [[../../../memory/project_phase_9_credit_funding]] — compliance vocabulary
- [[../../../memory/project_slack_workspace]] — alert channels
- [[../../../memory/project_imessage_relay_live]] — SEV1 push
- [[../../../memory/feedback_middleman_only]] — posture constraint
- [[../../../memory/feedback_protect_the_llc]] — Stripe/Twilio separation
- [[../../../memory/feedback_tmmt_marketing_channels]] — mobile-first
- [[../../../memory/feedback_revoke_from_public_not_anon]] — RLS pattern
- [[../../../memory/project_aixmos_agents]] — LLM cost constraint
