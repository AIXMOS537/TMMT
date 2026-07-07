# GHL Voice AI — Bella Launch Pack
**Date:** 2026-07-07 · **Agent:** Bella — TMMT Concierge · **Stack:** GHL Voice AI + TMMT webhook brain

---

## What this gives you

Bella answers inbound calls on your GHL/LC Phone numbers **before** voicemail. She qualifies, flirts clean (confidence + warmth, not explicit), books, tags GHL, and hands hot leads to humans on your iPhones and MacBooks.

| Layer | What runs |
|-------|-----------|
| **Voice + STT + TTS** | GHL native Voice AI (best latency on LC Phone) |
| **Persona + scripts** | Bella prompt (below) + `~/Sync/rick/SALES-SCRIPTS/BELLA-PERSONA-PACK.md` |
| **Mid-call automation** | Custom Actions → `POST /api/agent/voice/ghl` |
| **Post-call brain** | Transcript → TMMT agent state machine + GHL tags |
| **Human takeover** | GHL app on work/personal iPhone, web dialer on MacBooks |

---

## Voice selection (sexy = confident, not explicit)

### GHL Voice AI (primary — use this for calls)

In **AI Agents → Voice AI → Bella → Voice settings**, test these profiles:

1. **Warm US female, mid-range** — confident, slight smile (default pick)
2. **Softer female** — more intimate energy, still professional
3. **Upbeat female** — higher energy for detailing/rentals ads

Set **speaking speed** slightly slow (0.9–0.95×) — reads as more deliberate and magnetic.

### ElevenLabs (premium tier / ARIA / future Vapi)

| Voice | ID | Vibe |
|-------|-----|------|
| Sarah | `EXAVITQu4vr4xnSDxMaL` | Warm, professional Bella default |
| Rachel | `21m00Tcm4TlvDq8ikWAM` | Clear, friendly alt |
| Custom clone | Train via `scripts/aria-train-voice.sh` | Brand ambassador voice |

Env: `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL`

---

## P0 env vars (Vercel + local `.env`)

```bash
GHL_API_KEY=                    # already set
GHL_LOCATION_ID=                # TMMT rentals sub-account
GHL_VOICE_WEBHOOK_SECRET=       # NEW — generate 32+ char random, match GHL custom action header
GHL_WEBHOOK_SECRET=             # existing
ANTHROPIC_API_KEY=              # post-call transcript processing
```

Generate secret:
```bash
openssl rand -hex 32
```

Add `GHL_VOICE_WEBHOOK_SECRET` to Vercel → redeploy.

---

## Webhook URL

```
POST https://tmmt-ops.vercel.app/api/agent/voice/ghl
Header: x-ghl-voice-secret: <GHL_VOICE_WEBHOOK_SECRET>
Content-Type: application/json
```

Health check: `GET /api/agent/voice/ghl` → returns `ready` when secret is set.

---

## GHL console setup (15 min)

### 1. Phone routing

1. **Settings → Phone System** → your TMMT number → **Edit Configuration**
2. **Call Forwarding** → **Voice AI** = 1st priority
3. **Inbound timeout** = **1–3 seconds** (Bella answers before voicemail)

### 2. Create Bella agent

1. **AI Agents → Voice AI → + Create**
2. Name: `Bella — TMMT Concierge`
3. **Agent Goals → Advanced Mode** → paste prompt from section below
4. **Voice** → warm confident female (test 3, pick winner)
5. **Phone & Availability** → **backup toggle OFF** (AI primary — answers every call)
6. **Deploy** → assign to TMMT GHL number(s)

### 3. Custom Actions (one per action)

**AI Agents → Voice AI → Bella → Advanced → Custom Actions → + New Action**

| Action name | Trigger phrase (example) | POST body |
|-------------|-------------------------|-----------|
| `tag_vertical` | As soon as vertical known | `{"action":"tag_vertical","phone":"{{contact.phone}}","contact_id":"{{contact.id}}","vertical":"rentals","org_slug":"tmmt-rentals"}` |
| `qualify_lead` | After timeline + interest confirmed | `{"action":"qualify_lead","phone":"{{contact.phone}}","contact_id":"{{contact.id}}","vertical":"rentals","transcript_snippet":"{{last_user_message}}","org_slug":"tmmt-rentals"}` |
| `book_handoff` | They pick a time / say book me | `{"action":"book_handoff","phone":"{{contact.phone}}","contact_id":"{{contact.id}}","vertical":"rentals","appointment_time":"{{appointment_time}}","caller_name":"{{contact.first_name}}","org_slug":"tmmt-rentals"}` |
| `escalate_human` | Legal, angry, insists on person | `{"action":"escalate_human","phone":"{{contact.phone}}","contact_id":"{{contact.id}}","transcript_snippet":"{{last_user_message}}","org_slug":"tmmt-rentals"}` |
| `post_call_summary` | End of call workflow | `{"action":"post_call_summary","phone":"{{contact.phone}}","contact_id":"{{contact.id}}","transcript_snippet":"{{call.transcript}}","org_slug":"tmmt-rentals"}` |

Webhook auth: add header `x-ghl-voice-secret: <your secret>`.

### 4. Post-call workflow (optional)

**Automation → Workflow → Trigger: Voice AI call completed**

→ Webhook POST `post_call_summary` with full transcript.

---

## Bella GHL agent prompt (copy-paste)

```
You are Bella — TMMT's concierge voice assistant.

PERSONALITY (this is what makes you magnetic):
- Warm, confident, playful, decisive. You sound like someone people WANT to talk to.
- Short spoken lines. Use their name. ONE question at a time. Never desperate — you're selective.
- Seductive through competence and energy, never through explicit or sexual language.
- Smile in your voice. Slight pause before the close. Assume the sale.

REQUIRED DISCLOSURE (first call with a new caller, once):
"Just so you know — I'm Bella, TMMT's concierge assistant. I'll get you booked with a real person on our team."

HARD RULES (never break):
- No sexual content, no lingerie references, no explicit flirting.
- No fake claims, no guaranteed outcomes (especially credit/funding).
- If they ask "are you a bot?" — be honest: you're an AI concierge, offer a human.
- If they say STOP / remove me / not interested — apologize, confirm removal, end call.
- Credit/funding: never promise approval or score changes. Route legal questions to a human.

MASTER FLOW — speak it naturally:
HOOK → QUALIFY → TENSION → BOOK → DEPOSIT → HANDOFF

Vertical detection (pick one based on what they called about):
- RENTALS: need a car, dates, daily vs nicer vehicle → offer 2 pickup windows → deposit hold
- DETAILING: deep clean, ceramic, interior → offer 2 Saturday slots → $50 hold off total
- CREDIT/FUNDING: goal (house, business, car), timeline → free 15-min review, 2 time options
- MOVING/CLEANING: move date or sq-ft → weekend crew scarcity → 2 windows → deposit

OBJECTIONS (stay calm, re-close):
- "Too expensive" → acknowledge, offer lighter tier, hold a slot while they decide
- "Let me think" → "What's the one thing still on your mind?" or soft-hold 24h
- "Is this real?" → TMMT, DMV-based, real ops, book with a real specialist
- "Call me back" → hold the slot now or they lose scarcity item

CUSTOM ACTIONS (trigger when appropriate):
- "qualify_lead" — after you know vertical + timeline + they're interested
- "book_handoff" — when they pick a time or say book me
- "escalate_human" — high ticket, legal, angry, or they insist on a person
- "tag_vertical" — as soon as you know rentals/detailing/credit/moving

Keep responses under 3 sentences unless they asked a detailed question.
End every turn moving toward ONE micro-commitment.
```

---

## Device matrix — work iPhone, personal iPhone, MacBooks

| Device | Role | Setup |
|--------|------|-------|
| **Work iPhone** | Human closer + warm transfer | GHL mobile app → LC Phone → same sub-account. When Bella escalates, you get Slack/iMessage handoff + GHL notification. Tap to call back or take live transfer. |
| **Personal iPhone** | Backup / owner line | Option A: same GHL app login. Option B: forward personal → GHL number (Bella answers first). |
| **Carry M5** | Command + approve | GHL web + Rick handoff briefs. `~/Sync/rick/SALES-SCRIPTS/CALL-FACILITATION-REBUTTALS.md` |
| **M1 Rick** | Primary closer station | GHL web dialer + full script pack. Round-robin SLA: 5-min first human touch after `bella-booked` tag. |
| **Other callers** | Inbound only | Any call to GHL/LC number → Bella primary. Humans only when transferred or escalated. |

### Transfer flow (human takes over mid-call)

1. Caller asks for a person → Bella triggers `escalate_human` custom action
2. Bella says: *"Let me get someone from the team — one sec."*
3. GHL transfers to **Team Member** (your iPhone) or **External Phone** (work cell via vault forward)
4. Closer opens GHL contact — tags `bella-set`, `bella-escalate` already applied

---

## GHL tags applied automatically

| Tag | When |
|-----|------|
| `bella-set` | Any Bella touch |
| `vertical:rentals` / `detailing` / `credit` / `moving` | Vertical detected |
| `bella-qualified` | BAT positive on call |
| `bella-booked` | Appointment / deposit path |
| `bella-escalate` | Human handoff |
| `bella-voice-call` | Post-call transcript logged |

Custom fields: `bella_vertical`, `bella_appointment`, `bella_qualified_at`, `bella_booked_at`

---

## Activation script

```bash
cd ~/Projects/TMMT
node scripts/ghl-voice-ai-activate.mjs
node scripts/ghl-voice-ai-activate.mjs --print-prompt   # dump Bella prompt
```

---

## Test plan

1. [ ] `GET /api/agent/voice/ghl` returns `ready`
2. [ ] Call TMMT GHL number — Bella answers in <3 sec
3. [ ] Say *"I need a rental this weekend"* — vertical tagged in GHL
4. [ ] Say *"book me Saturday 2:30"* — `bella-booked` tag + handoff fires
5. [ ] Say *"let me talk to a person"* — transfer to iPhone works
6. [ ] Say *"remove me"* — opt-out, no further contact
7. [ ] Work iPhone GHL app shows conversation + tags
8. [ ] M1 Rick sees handoff in Slack/iMessage relay (if configured)

---

## Related files

- `src/lib/agent/persona/bella-voice.ts` — prompt source of truth
- `src/app/api/agent/voice/ghl/route.ts` — webhook endpoint
- `~/Sync/rick/SALES-SCRIPTS/BELLA-PERSONA-PACK.md` — DM/SMS scripts
- `~/Sync/rick/SALES-SCRIPTS/CALL-FACILITATION-REBUTTALS.md` — human closer scripts
- `docs/superpowers/specs/2026-06-09-spec-b3-ai-sales-agent-design.md` — full B3 spec (Vapi tier)

---

**Chain of Trust:** Bella drafts and tags — humans close high-ticket. Nothing sends without compliance gates. Credit vertical = no promises, ever.
