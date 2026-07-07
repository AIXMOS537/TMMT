# Spec B3 — AI Sales Agent (SMS + Voice, the "Close 24/7" Core)

- **Date:** 2026-06-09
- **Author:** ceo.moe (AIXMOS537)
- **Status:** Draft, awaiting user review before plan phase
- **Parent:** `2026-06-09-spec-b-revenue-engine-umbrella.md`
- **Reference:** `2026-06-09-moe-legacy-partner-deploy-design.md` §6 (reserved Sales Qualifier slot)

## 1. Problem Statement

Leads arrive at 3am from TikTok ads. The TMMT/AIXMOS funnel ([[../../../memory/project_aixmos_tmmt_funnel]]) is designed for impulse-driven traffic but requires fast, qualified human-like contact to convert. Today: leads sit in GHL until morning; conversion rate craters because the moment passes.

The AI Sales Agent is the differentiator. It:
- Picks up new leads within 60 seconds of form submission
- Runs an SMS-first scripted conversation aligned with [[../../../memory/project_operations_brain]] voice
- Closes <$97 SKUs directly via Stripe Payment Link in the conversation
- Qualifies >$97 SKUs on Budget / Authority / Timing, books a Cal.com slot
- Picks up calls via Vapi for callers who refuse SMS
- Hands off hot leads or red flags to human within the lead's tenant
- Never makes a credit promise; always inserts CFPB disclaimers where required

It carries Spec A's kill-switch — when Moe's license is revoked, his agent stops processing within milliseconds.

## 2. Goals

1. **First outbound message ≤ 60 seconds** of `lead_received` event.
2. **<$97 SKUs close in-conversation** without human intervention. Target: 15% close rate from `CONTACTED → CLOSED`.
3. **>$97 SKUs book a call** within 24 hours of first contact. Target: 30% book rate from `QUALIFIED → BOOKED`.
4. **Compliance gates non-bypassable** — quiet hours, opt-out, CFPB disclaimers enforced in code.
5. **Hand-off rules transparent** — every escalation explains why (lead's request / red flag / confidence drop / ambiguous turns).
6. **Voice equally available** — inbound caller routes through Vapi to the same state machine.
7. **Per-tenant config** — Moe can tune HIS agent's persona within bounded guardrails.
8. **Conversations queryable** — every message lands in `partner.tmmt-ops.com/inbox` (Spec A §6 reserved surface).

## 3. Non-Goals

- Outbound cold calling at scale (this is INBOUND-triggered only).
- Decisioning credit applications (we are NEVER the decisioner).
- Replacing human closers for high-ticket — Flagship SKU always escalates to human.
- Multi-language v1 (English only; Spanish queued for B3.2).
- Sentiment-based dynamic pricing (out of scope; SKU pricing is fixed).

## 4. Constraints (locked decisions)

| Decision | Choice |
|---|---|
| Voice provider | Vapi (each tenant brings own number) |
| SMS provider | Twilio (each tenant brings own EIN + 10DLC + number) |
| LLM primary | Claude Sonnet 4.6 |
| LLM fallback | Claude Haiku 4.5 (cost-bounded simple routing) |
| State machine | NEW → CONTACTED → QUALIFIED → {BOOKED, CLOSED, LOST, HUMAN_HANDOFF} |
| <$97 close path | Direct via Stripe Payment Link in SMS/voice |
| >$97 close path | BAT-qualify + Cal.com booking |
| Persona source | [[../../../memory/project_operations_brain]] voice + tenant overlay |
| Compliance source | `COMPLIANCE_DISCLAIMERS.md` rule engine |
| Audit | Every message + decision to `audit_events` (Spec A) |
| Kill-switch | `guardTenant()` on every webhook + every LLM call |

## 5. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  EXTERNAL                                                    │
│                                                              │
│  Twilio Number ─┐     Vapi Number ─┐    Stripe Webhook       │
│  (per tenant)   │     (per tenant) │    (per tenant Stripe)  │
└─────────────────┼──────────────────┼─────────────────────────┘
                  ▼                  ▼
┌──────────────────────────────────────────────────────────────┐
│  apps/sales-agent (Vercel — sales.tmmt.tools)                │
│                                                              │
│  /api/sms/inbound  /api/voice/inbound  /api/stripe/paid     │
│  ─────┬─────────────────┬────────────────┬──────             │
│       │                 │                │                    │
│       └─►─ guardTenant() (Spec A license live-check)         │
│              │                                                │
│              └─► tenantContext = resolveTenantFromNumber()   │
│                    │                                          │
│                    └─► leadCtx = loadLead(phone, tenant)     │
│                          │                                    │
│                          └─► stateMachine.step(event)        │
│                                │                              │
│                                ├─► complianceCheck()         │
│                                │     (quiet hours, opt-out)  │
│                                │                              │
│                                ├─► llmRouter() ──┐           │
│                                │                  │           │
│                                │     Sonnet 4.6 ◀┤           │
│                                │     Haiku 4.5  ◀┘           │
│                                │                              │
│                                ├─► guardrailPostProcess()    │
│                                │     (banned-phrase scan)    │
│                                │                              │
│                                ├─► sendVia(twilio|vapi|...)  │
│                                │                              │
│                                ├─► auditLog()                │
│                                │                              │
│                                └─► emit Realtime event        │
└──────────────────────────────────────────────────────────────┘
```

## 6. State Machine (full)

```
                              ┌─────────────────────────┐
                              ▼                         │
       ┌───────┐  ≤60s    ┌──────────┐      ≥3 turns   │
       │ NEW   │ ───────▶ │CONTACTED │ ────────────────┘
       └───────┘  outbound└──────────┘
                              │
                              │ BAT positive
                              ▼
                          ┌──────────┐
                          │QUALIFIED │
                          └──────────┘
                              │
                  ┌───────────┼────────────┐
                  │           │            │
                  ▼           ▼            ▼
              (≤$97)      (>$97)      (red flag /
              CLOSED       BOOKED      ambiguous /
              ────────────────────     "want human")
              Stripe link  Cal.com           │
              paid         held              ▼
                                        HUMAN_HANDOFF
                                        ────────────
                                        Slack ping + iMessage push
                                        to tenant's designated human

   AT ANY STATE:
   - STOP/UNSUB keyword → opt_out=true, conversation halted, future outbound rejected
   - Quiet hours (9pm–8am local) → outbound queued for 8am
   - 5 unanswered outbound in a row → LOST (status transition + nurture 30d later)
```

## 7. Conversation Goals by State

### NEW → CONTACTED (≤60s)
First message acknowledges lead by source. Example template (tenant-overridable):
> *"Hey {first_name}, this is {agent_name} from {tenant_brand}. Saw you just checked out {sku_friendly_name} — what's your main goal with this? Reply STOP to opt out."*

The STOP disclaimer is required by 10DLC; appended on first message only.

### CONTACTED → QUALIFIED
LLM-driven free-form qualification on **B-A-T**:
- **Budget:** can they afford the SKU?
- **Authority:** are they the decision-maker?
- **Timing:** are they ready in the next 30 days?

LLM emits a per-turn structured assessment:
```json
{ "B": 0.0..1.0, "A": 0.0..1.0, "T": 0.0..1.0, "confidence": 0.0..1.0, "next_action": "ask_budget|ask_authority|ask_timing|close|escalate" }
```

Threshold for QUALIFIED: `B + A + T >= 2.0` AND `confidence >= 0.6`.

### QUALIFIED → CLOSED (sub-$97 path)
Agent sends:
> *"Sounds like we're a fit. Here's the link to get started — it's $97 and you can be inside the system tonight: {stripe_link}"*

Listens for `stripe.payment_intent.succeeded` webhook within 30 minutes. On success → CLOSED + congrats message + onboarding instructions. On timeout → 1 follow-up nudge, then back to QUALIFIED for re-engagement.

### QUALIFIED → BOOKED (>$97 path)
Agent sends Cal.com link scoped to the tenant's calendar:
> *"Let's get you on a call to make sure this is the right fit. Here are the next 3 open slots: {cal_link}. Pick what works."*

On `cal.booking.created` webhook → BOOKED + confirmation message. On no-book within 24h → 1 follow-up, then HUMAN_HANDOFF.

### Any → HUMAN_HANDOFF
Triggers (any one):
1. Lead says any of: "talk to a person", "is this a bot", "real human", "speak with someone" (regex + LLM intent classifier).
2. Red-flag phrases: legal language, distress, mention of attorney, fraud accusation, threats.
3. LLM `confidence < 0.4` for 2 consecutive turns.
4. 3 consecutive ambiguous responses (intent classifier returns "unclear").
5. Tenant-configurable hot-lead keywords (e.g. "ready now", "send invoice").

Handoff action:
- Mark lead `status='HUMAN_HANDOFF'`.
- Last 10 messages + LLM assessments shipped to tenant's designated Slack channel (`tenants.handoff_slack_webhook`).
- iMessage push to tenant's designated iPhone (via `tenants.handoff_imessage_target` and the relay at `100.77.126.8:8787`).
- Auto-reply to lead: *"Got it — having someone from the team reach out personally in the next hour."* (or off-hours: "first thing in the morning").

## 8. Compliance Gates (non-bypassable, in code not policy)

### 8.1 10DLC + STOP/UNSUB
Twilio inbound webhook checks message body against case-insensitive regex:
```typescript
const STOP_PATTERNS = /^(stop|stopall|unsubscribe|cancel|end|quit|stop please|opt[\s-]?out)\s*\.?$/i
```
On match: `leads.opted_out=true`, conversation halted, future outbound throws. Auto-reply confirmation: *"You're opted out. Reply START to opt back in."*

### 8.2 Quiet hours
Lead's local time inferred from `phone_e164` area code lookup table. Outbound between 21:00 and 08:00 local is rejected by `quietHoursBlock()` → message queued for 08:00. Audit event `compliance.quiet_hours_blocked`.

### 8.3 CFPB disclaimer rule engine
Every outbound message run through `compliance/disclaimers.ts` BEFORE send. Rules from [[../../../memory/project_phase_9_credit_funding]] and `COMPLIANCE_DISCLAIMERS.md`:

| If outbound mentions… | Append disclaimer |
|---|---|
| "credit", "score", "approval" | *"Credit decisions are made by lenders, not us. Results vary."* |
| "funding", "loan", "$X funded" | *"Funding amounts are estimates; actual amounts depend on lender review."* |
| "guaranteed", "definitely", "you will" | BLOCK and log compliance violation; do NOT send. Switch to safer phrasing via LLM regenerate (max 2 retries). |

### 8.4 Banned phrase post-processor
After LLM emits a message, `guardrailPostProcess()` scans for:
- "guaranteed approval"
- "credit repair", "fix your credit" (we are NOT credit repair)
- "I'm a real person", "I'm human", "actual person" (no deception)
- Any phrase from a tenant-overridable banlist

On match: regenerate (max 2 attempts) → fall back to scripted safe message → audit log compliance violation.

### 8.5 Opt-out persistence
`leads.opted_out=true` is irreversible from the agent side. Re-opt-in requires either:
- Inbound message containing "START"
- Tenant admin action through dashboard (logged)

## 9. Persona + Guardrails

### 9.1 System prompt structure (per turn)

```
[BASE]      ~600 tokens — fixed persona from project_operations_brain
            voice, style, do/don't list, compliance reminders
[TENANT]    ~200 tokens — tenant overlay (brand name, agent name, SKU details, calendar URL)
[COMPLIANCE]~150 tokens — current applicable disclaimers based on current message content
[CONTEXT]   ~400 tokens — last 10 turns of this conversation
[GOAL]      ~50 tokens — current state machine goal ("qualify on T", "send Stripe link")
[OUTPUT]    JSON structured response (message + assessment + next_action)
```

Total ~1400 tokens per turn. At ~10 turns per conversation × 100 conversations/day × $3/MTok input + $15/MTok output ≈ $20–40/day for both tenants combined at Sonnet 4.6. Acceptable.

### 9.2 Tenant overlay constraints

`tenants.agent_persona_overlay` (jsonb) allows Moe to tweak:
- `agent_name`, `tenant_brand` (display name)
- `tone_adjustment`: "more casual" | "more formal" | "match input"
- `forbidden_phrases`: array of additional banlist entries (additive, never subtractive — can't remove core compliance)
- `hot_lead_keywords`: array

NOT overridable (hardcoded guardrails):
- Compliance disclaimer rules
- Opt-out behavior
- Banned credit-promise phrases
- Hand-off triggers (can be additive but not removable)

## 10. Voice (Vapi)

### 10.1 Inbound calls
Each tenant has a Vapi assistant configured pointing to `apps/sales-agent/api/voice/inbound/[tenant_id]`. Vapi's STT → our LLM (same Sonnet 4.6 with `[CHANNEL=voice]` system prompt addendum to keep responses shorter + speakable) → TTS via Vapi → caller.

Same state machine, same compliance gates, same audit log. Channel-aware adjustments:
- No "reply STOP" appendix (verbal opt-out is implicit "remove me from your list" → matches via LLM intent).
- Stripe link → SMS the link mid-call instead of speaking it.
- Cal.com link → SMS the link mid-call.

### 10.2 Outbound calls
Triggered only by hot-lead handoff opt-out: if lead requested voice instead of SMS, agent initiates Vapi outbound. Daily cap: 50 outbound calls per tenant (anti-spam).

## 11. Storage + Audit

### 11.1 `conversations` table

```sql
CREATE TABLE conversations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid NOT NULL REFERENCES leads(id),
  tenant_id    text NOT NULL REFERENCES tenants(id),
  channel      text NOT NULL CHECK (channel IN ('sms','voice')),
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  state_at_end text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE messages (
  id              bigserial PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations(id),
  ts              timestamptz NOT NULL DEFAULT now(),
  direction       text NOT NULL CHECK (direction IN ('in','out')),
  body            text NOT NULL,
  llm_assessment  jsonb,                    -- per-turn LLM B/A/T scores
  compliance_flags jsonb NOT NULL DEFAULT '[]'::jsonb,  -- e.g. ["cfpb_disclaimer_appended","banned_phrase_blocked_retry"]
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX messages_conv_ts_idx ON messages(conversation_id, ts);
```

RLS: tenant_id-scoped via `conversations.lead_id → leads.tenant_id` join policy. (No direct `tenant_id` column on `messages` — denormalize-via-join keeps the schema clean.)

### 11.2 Audit events emitted by B3

- `sms.outbound_sent` / `sms.inbound_received`
- `voice.call_started` / `voice.call_ended` (with duration, recording URL)
- `agent.state_transition` (NEW→CONTACTED, etc.)
- `agent.handoff_triggered` (with reason)
- `agent.llm_call` (with model used + token counts for cost tracking)
- `compliance.opt_out_received`
- `compliance.quiet_hours_blocked`
- `compliance.disclaimer_appended`
- `compliance.banned_phrase_blocked`

## 12. Kill-Switch Integration (Safety Carry-Through from Spec A)

Every B3 entry point runs `guardTenant(tenant_id)` BEFORE any work:

```typescript
// apps/sales-agent/lib/guard.ts
import { createServiceClient } from '@/lib/supabase'

export async function guardTenant(tenantId: string): Promise<void> {
  const db = createServiceClient()
  const { data } = await db.from('licenses')
    .select('active, kill_command')
    .eq('tenant_id', tenantId).single()
  if (!data || !data.active || data.kill_command === 'wipe') {
    throw new Error('LICENSE_DISABLED')
  }
}
```

Called from:
- Twilio inbound webhook (refuse to read message)
- Vapi inbound webhook (hang up call gracefully with "Service temporarily unavailable, please try again later.")
- Outbound message sender (refuse send)
- LLM router (refuse to call LLM)
- Stripe webhook (refuse to process payment for this tenant)

When ceo.moe revokes Moe's license:
1. Within milliseconds, Moe's tenant's webhooks all 401
2. In-flight conversations halt (lead sees no further responses; manual reach-out only)
3. New leads land in DB but no agent picks them up
4. Audit event `agent.license_disabled_blocked` for each refused request

**This is the operational reality of "TMMT and AIXMOS always safe":** Moe's agent is your agent, and your license server holds the dead-man switch.

## 13. Test Plan

1. **Happy path SMS close (<$97 SKU)**
   - Seed a lead with phone, sku='lead-magnet'
   - Emit `lead_received`
   - Within 60s, agent sends first SMS via mock Twilio
   - Reply "yes I'm interested"
   - Agent asks BAT questions
   - Lead replies positively to all 3
   - Agent sends Stripe link
   - Mock Stripe webhook fires `payment_intent.succeeded`
   - Verify: `status='CLOSED'`, audit log has full trail, lead.closed_at set

2. **Happy path SMS booking (>$97 SKU)**
   - Same as above but sku='training' ($7K)
   - Agent qualifies + sends Cal.com link
   - Mock Cal.com webhook `booking.created`
   - Verify: `status='BOOKED'`

3. **STOP keyword opt-out**
   - Mid-conversation, reply "STOP"
   - Verify: lead.opted_out=true, no further outbound succeeds, audit event present

4. **Quiet hours block**
   - At 22:00 lead's local time, trigger lead_received
   - Verify: outbound queued, not sent; queue fires at 08:00 next day

5. **CFPB banned phrase regeneration**
   - Manually inject system prompt that would generate "you are guaranteed approval"
   - Verify: post-processor blocks, regenerates, falls back to safe template if 2 regens fail
   - Audit event `compliance.banned_phrase_blocked` present

6. **License revoke kills agent**
   - Mid-conversation, soft-kill the tenant's license
   - Next inbound webhook returns 401 within milliseconds
   - Verify: audit event `agent.license_disabled_blocked`

7. **Hand-off on red flag**
   - Reply "I'm calling my attorney about this"
   - Verify: state transitions to HUMAN_HANDOFF, Slack webhook fired, iMessage push sent

8. **Voice inbound smoke**
   - Vapi inbound webhook called with a transcript
   - Verify: same LLM, same compliance, same audit log; first response speakable (<160 chars when read aloud)

9. **Cross-tenant isolation**
   - Two tenants, two phone numbers, two leads with same phone digits
   - Verify: each conversation isolated, RLS denies cross-reads

10. **LLM cost tracking**
    - Run 100 simulated conversations
    - Verify: per-tenant cost summed in audit events totals to within 5% of Anthropic billing

## 14. Components

```
apps/sales-agent/                                # new Vercel project, sales.tmmt.tools
├── app/api/
│   ├── sms/inbound/route.ts                     # Twilio webhook
│   ├── sms/outbound/[lead_id]/route.ts          # internal send endpoint
│   ├── voice/inbound/[tenant_id]/route.ts       # Vapi webhook
│   └── voice/outbound/route.ts                  # internal trigger
├── lib/
│   ├── state-machine.ts                         # the FSM, pure function
│   ├── llm-router.ts                            # Sonnet primary, Haiku fallback by intent
│   ├── persona/
│   │   ├── base-prompt.ts                       # from project_operations_brain
│   │   └── tenant-overlay.ts                    # merges tenants.agent_persona_overlay
│   ├── compliance/
│   │   ├── opt-out.ts                           # STOP/UNSUB regex + state
│   │   ├── quiet-hours.ts                       # phone area code → timezone → block
│   │   ├── disclaimers.ts                       # CFPB rule engine
│   │   └── banned-phrases.ts                    # post-processor
│   ├── guard.ts                                 # license live-check from Spec A
│   ├── handoff.ts                               # escalation: Slack + iMessage push
│   ├── stripe-link.ts                           # send + listen
│   ├── cal-link.ts                              # send + listen
│   └── audit.ts                                 # ships to log.tmmt.tools
└── tests/
    └── ...                                      # the 10 test scenarios above

supabase/migrations/
├── 20260609000010_leads.sql
├── 20260609000011_conversations_messages.sql
└── 20260609000012_tenant_agent_columns.sql      # adds twilio_inbound_number, agent_persona_overlay, handoff_slack_webhook, handoff_imessage_target to tenants
```

## 15. Open Questions

1. **Cost cap per tenant** — should LLM cost have a per-tenant daily cap to prevent abuse? Recommend yes, $50/day default, configurable per tenant.
2. **Recording voice calls** — Vapi can record; do we keep recordings for audit? Recommend yes, encrypted at rest, 90-day retention, tenant-acknowledged in their AUP.
3. **Multi-turn timeout** — if lead stops mid-conversation, when do we auto-mark `LOST`? Recommend 7 days of silence after last outbound.
4. **Nurture sequence for LOST leads** — out of B3 scope (deferred to future sub-spec); just emit `lead_lost` event and let a future nurture service subscribe.
5. **Cal.com vs GHL native calendar** — recommend Cal.com per umbrella spec §9 Q1.

## 16. Memory References

- [[../../../memory/project_operations_brain]] — persona base
- [[../../../memory/project_phase_9_credit_funding]] — compliance vocabulary + disclaimers
- [[../../../memory/project_aixmos_agents]] — LLM cost ceiling
- [[../../../memory/project_aixmos_empire_editions]] — SKU pricing
- [[../../../memory/project_slack_workspace]] — handoff channels
- [[../../../memory/project_imessage_relay_live]] — handoff push
- [[../../../memory/project_moe_legacy_partner_deploy]] — Spec A kill-switch contract
