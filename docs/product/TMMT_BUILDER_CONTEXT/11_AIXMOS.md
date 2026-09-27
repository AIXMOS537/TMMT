# 11 — AIXMOS (the AI layer)

Source: SPEC §5.10, §19 (+ E5 §B) · Snapshot 2026-09-21 · canon `4cca6835`

> **CURRENT** = "Boundary (verified today)", "Per-feature status", "Model access". **TARGET** = "Target boundary (PM-15)" and the GHL M13 tool layer (PLANNED ONLY). The "Rules for builders" are binding now.

## Boundary (binding)

**AIXMOS acts only through authenticated, scoped TMMT services, never the raw DB or a shell.**

Verified today:
- There is no `child_process`, `exec`, `spawn`, `eval` or `new Function` in `src/`, `aria/`, `apps/engine` or `packages/aixmos-core`.
- There is no LLM tool/function-calling. The SMS agent returns a fixed `next_action` enum (`src/lib/agent/llm-router.ts:4-16`), and a deterministic state machine performs every action.
- The agent spine writes AI output only into the `source_table.target_field` named in `agent_definitions`.

Agents may draft, route, remind and roll up. They may **not** decide eligibility, move money, send externally, sign, or run shell/DB directly [SoR §5.4].

## Per-feature status

| # | Feature | Status | Note |
|---|---|---|---|
| 1 | SMS sales agent (`api/agent/sms/inbound` → `process-inbound.ts`) | EXISTING/WORKING (code), never ran live | Twilio HMAC, replay gate, kill switch, licence, daily spend cap, PII redaction, **owner-hold by default** (`auto-reply-policy.ts`) |
| 2 | `sendSms` | ORPHANED | |
| 3 | Handoff (`agent/handoff.ts`) | WORKING (Slack) / PARTIAL (iMessage tailnet) | |
| 4 | GHL voice "Bella" | EXISTING/PARTIAL (BROKEN-ish) | **nil-UUID org fallback → 500** (`ghl-voice-handler.ts:42-66`); AI reply stored **without owner hold** (`ghl-voice-leads.ts:111-117`) (KD-27) |
| 5 | Cal / Stripe per-tenant webhooks | EXISTING/WORKING (no AI) | |
| 6 | Ops AI fact-check + owner draft refine (`ops-ai.ts`) | EXISTING/WORKING | fails safe |
| 7 | Pocket assistant (`/api/pocket/chat`) | EXISTING/PARTIAL | dead on Vercel without a public brain URL |
| 8 | Dispatch captain ranking | EXISTING/PARTIAL | `127.0.0.1:7777` default; never runs on Vercel |
| 9 | `agents/run-on-case.ts` | PLACEHOLDER | template, no AI |
| 10 | AIXMOS prequal lane | EXISTING/WORKING (rules) | consent before handoff |
| 11 | DB agent spine (`agent_definitions` 3, `agent_jobs` 32) | EXISTING/PARTIAL | off-repo local worker; dormant since 09-16 |
| 12 | `packages/aixmos-core` | EXISTING/WORKING (rules) | localhost defaults in `cube/config.ts:31,35` |
| 13 | `apps/engine` | ORPHANED | duplicates `(learn)`; not deployed |
| 14 | `aria/` | ORPHANED, **unsafe if deployed** | unauthenticated `/api/chat` (`aria/app/api/chat/route.ts:11`); filesystem read |
| 15 | `workstream-1-aixmos-core/` | PLANNED ONLY | |
| 16 | `AIXMOS/` static site | LEGACY | |
| 17 | Agent pause/resume `/pocket/agents` | EXISTING/WORKING | |
| – | `/lp/aixmos` | EXISTING (marketing) | owner review of copy and price pending |
| – | Remote support / "HailMary" | **UNKNOWN — not in canon** | no route, module, table or evidence file in `AIXMOS537/TMMT` mentions it; if it exists it lives outside this repo and this extraction. Do not build on it or assume it exists |

## Model access

| Call site | Provider | Reachable from Vercel? |
|---|---|---|
| `llm-router.ts` | Anthropic SDK | Yes |
| `ops-ai.ts` | Anthropic via fetch | Yes |
| `pocket-brain.ts` | LiteLLM / Ollama (tailnet) | Only with a public URL |
| `captain-client.ts` | `127.0.0.1:7777` | No |
| agent spine worker | local Ollama `rick` | No |
| `aria` | Ollama `127.0.0.1:11434` | Not deployed |

## Target boundary (PM-15)

| Layer | Rule | Foundation |
|---|---|---|
| Read tools | scoped queries through TMMT services with the caller's org and role; no raw SQL | GHL M13 (`LeadRoutingService`, `GhlGateway`) — PLANNED ONLY |
| Action tools | confirm-gated: draft → owner/staff approval → service call; attributed and reversible | SMS owner-hold pattern (`auto-reply-policy.ts`) |
| Never | decide eligibility, move money, send externally, sign, run shell/DB | – |
| Model access from cloud | an authenticated public gateway, or cloud models only | NEW BUILD (OWNER DECISION) |
| Voice | same owner hold as SMS; no nil-UUID fallback | PM-15 |

Responsibility map: operations, customers, comms and CRM have foundations. Fleet, maintenance, documents and knowledge retrieval are NEW BUILD (there is no vector store in canon).

## Rules for builders

- Any new AI feature reuses the SMS agent's gates: kill switch, licence check, spend cap, PII redaction (`redactPii`) before the model call, and owner hold on outbound drafts.
- No customer-facing AI path may depend on a tailnet or localhost endpoint.
- Do not deploy or wire `aria/` or `apps/engine`.
- AI output that reaches customers goes through the gated outbox (PM-18), never direct.
