# 18 · AI AGENT AUDIT

## Verdict: **substantial, careful, compliance-aware AI infrastructure that has never processed a single conversation.**

`agent_conversations` = **0** · `agent_messages` = **0** · `counselor_*` (6 tables) = **0** · `agent_evaluations` = **0**
Live: `agent_jobs` 25 · `agent_definitions` 2 · `automation_outbox` 7 · `exec_va_tasks` **17,806** · `memory_facts` 57 · `coo_briefings` 57

## Inventory
| Agent / system | Purpose | Model | Guardrails | Status |
|---|---|---|---|---|
| **"Bella" SMS agent** (B3) | Inbound SMS sales/qualification | LLM router (`llm-router.ts`) — Anthropic SDK / Ollama / NVIDIA NIM | banned phrases, quiet hours, area-code TZ, opt-out, disclaimers, PII redaction, `guard.ts`, tenant overlay, rate limit | 🔵 **never run** |
| **Voice agent** | GHL inbound voice → tags, leads, handoff | GHL native | `GHL_VOICE_WEBHOOK_SECRET`, tested | 🔵 |
| **Agent spine** | Job queue over cases | `agent_definitions` (2) | `claim/finish/fail_agent_job` RPCs | 🟡 25 jobs |
| **Expense categorizer** | Auto-categorise expenses | — | migration `20260826_agent_expense_categorizer` | 🟡 |
| **Exec VA queue** | CHUMMO (SMS outreach) / VISION (internal ops) / HUMAN (escalation) | `generate_va_tasks()` daily | — | 🟠 **17,806 rows, no consumer** |
| **Memory fabric** | Entities/events/facts + local embeddings | `recall_memory_local`, `recall_memory_facts_local` | org-scoped | 🟡 57 facts |
| **Counselor layer** | DISC personality read, escalation state machine (gloves-up 0–4) | — | — | 🔵 0 rows |
| **Mission control** | Daily Telegram digest | — | `CRON_SECRET`, CI cron | 🟢 running |
| **COO briefings** | Ops summaries | — | — | 🟢 **57 generated** |
| **Credit engine** | Metro2 analysis + dispute letter drafts | Ollama / NVIDIA NIM / template | `CREDIT_ENGINE_AUTO_POLISH`, **owner approves before send** | 🟡 |

## What is excellent
**The compliance layer is the best-engineered part of the AI work.** `src/lib/agent/compliance/` implements banned phrases, quiet hours, area-code→timezone, opt-out and disclaimers — all unit-tested. `redact-pii.ts` is tested. `guard.ts` is tested. The DNC gate was explicitly fixed to **fail closed**. The credit engine drafts but does not send.

This is a team that understood TCPA exposure before writing the sender. That is rare and correct.

## Findings
**🟠 AI-1 · `exec_va_tasks`: a generator with no consumer.** 17,806 rows, **+614 in two days**. `generate_va_tasks()` runs daily; nothing drains it. This matches the long-standing pattern of queued outbound with zero sends. **The queue is not the bottleneck — the send decision is**, and that is deliberately gated by the comms hold. Recommendation: **stop the generator** until a consumer exists. It is currently manufacturing a backlog that makes the real queue depth unreadable.

**🟠 AI-2 · The SMS agent has never run.** Full stack — Twilio, personas, state machine, handoff, audit, tenant overlay, 8 test files — and 0 conversations. This is the single largest block of built-but-unused code in the repo. Correct given the comms hold, but it should be an explicit decision, not drift.

**🟡 AI-3 · `claim/finish/fail_agent_job` have mutable `search_path`** (added 2026-08-31, after the earlier hardening sweep). See `12_SECURITY_AUDIT.md` S-6.

**🟡 AI-4 · Model routing is multi-provider** (Anthropic / Ollama / NVIDIA NIM) with `llm_daily_cap_usd` per org — cost-disciplined by design. Good.

## Overprivileged AI? **No.**
No agent has unattended write access to money, sends, or customer-facing channels. Every outbound path is gated. Given the volume of AI code here, that restraint is the notable finding.
