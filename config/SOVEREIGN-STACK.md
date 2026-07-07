# Sovereign Stack — never blocked by tokens, credits, or API limits (legally)

**Goal (owner):** work on anything, anytime, locally — never backstopped by an
API quota, a free-tier deploy cap, or prepaid credits. And the same resilience
for every client later.

**The principle:** *own the critical path; rent only the overflow.* Run the
things you depend on daily on **your** hardware (Brainiac PC + NAS, on the
Tailscale mesh). Keep cloud providers as **fallbacks** with budget caps — never
the single point that can halt you. This is legitimate self-hosting, not a hack.

---

## What backstops you today → the local/self-hosted answer

| Dependency | The cap that bit you | Sovereign alternative (legal, local-first) | Keep cloud as… |
|---|---|---|---|
| **LLM tokens** (Anthropic/OpenAI) | per-token billing / rate limits | **Local models on Brainiac GPU** via **Ollama** / vLLM / llama.cpp (Llama 3.x, Qwen2.5, DeepSeek, Mistral). **Local embeddings** (nomic-embed / bge) instead of OpenAI. | hard tasks only, with a $ cap |
| **Vercel deploys** | 100 deploys/day free | **Self-host** with **Coolify** / **Dokploy** / CapRover on Brainiac (or a $5 VPS); or `next build && next start` in Docker. Unlimited deploys. | public prod only |
| **Supabase** | row/usage tiers | **Self-hosted Supabase** (Docker) or plain **Postgres** on Brainiac/NAS. | prod mirror / managed convenience |
| **Quo/SMS credits** | prepaid ran out (402) | **Twilio pay-as-you-go** for bulk/automation; set **auto-recharge**. Keep Quo for the team line. | the human phone UX |
| **Automation** (Zapier/Make) | task limits | **n8n** self-hosted (you already have it) | — |
| **Auth** | MAU tiers | Supabase Auth self-hosted, or **Authentik/Keycloak** | — |
| **File storage / egress** | storage + egress fees | **The NAS (~25–30 TB)** for files, artifacts, backups, model weights | cold backup |
| **Email** | send limits | **Listmonk/Postal** self-hosted, or metered Resend/SES | deliverability |

## The architecture (you already own most of it)

```
                 TAILSCALE MESH (private, no public IP needed)
  work Mac · carry Mac · iPhones · client appliances
                          │
              ┌───────────┴───────────────────────────────┐
              │  BRAINIAC PC  (always-on sovereign node)    │
              │  • Ollama / vLLM  → local LLM + embeddings   │
              │  • Self-hosted Supabase/Postgres            │
              │  • Coolify/Dokploy → deploy apps locally     │
              │  • n8n → automations                         │
              │  • the Memory Fabric brain (/api/memory)     │
              └───────────┬───────────────────────────────┘
                          │
                   HOME NAS (25–30 TB): files · backups · model weights
                          │
        Cloudflare Tunnel (optional) → public URLs WITHOUT exposing your IP
                          │
        CLOUD = FALLBACK ONLY: Claude (hard tasks), Vercel (public prod),
                managed Supabase (mirror) — each with a budget cap + alarm
```

## The pattern that makes you unblockable

1. **Local-first router with cloud fallback.** Every AI call tries the **local
   model first** (free, unlimited on your GPU); only escalates to Claude for the
   hard stuff, behind a **monthly $ cap**. One interface, two backends — your
   `remember/recall` brain already abstracts this; do the same for generation.
2. **Graceful degradation everywhere** (you already build this): fail-open,
   idempotent (`dedupe_key`), queue-and-retry. A throttled provider pauses a
   feature; it never stops the business.
3. **Caching.** Cache prompts/results/embeddings on the NAS so you never pay
   twice for the same answer.
4. **Budget alarms + auto-recharge** on the few metered services you keep
   (Anthropic, Twilio, Quo) — so "ran out of credits" becomes "auto-topped-up"
   or "alarm at 70%", never a hard stop.
5. **Deploy locally, publish deliberately** (already done): `bin/ship` for
   Vercel; Coolify for everything internal — no per-push caps.

## Phased rollout (quickest wins first)

- **Now (hours):**
  - Vercel CLI deploys — **done** (`bin/ship`, ignore-build).
  - Set **auto-recharge + a usage alarm** on Anthropic and Quo (kills the "ran
    out" class of failure today).
  - Install **Ollama** on Brainiac; pull a model: `curl -fsSL https://ollama.com/install.sh | sh && ollama pull qwen2.5:14b` (and `nomic-embed-text` for embeddings).
- **Phase 1 (this week):** point HAILMARY `do` + the brain's distillation/embeddings at **local Ollama by default**, Claude as fallback with a cap. (Local for routine, cloud for hard.)
- **Phase 2:** stand up **Coolify/Dokploy** on Brainiac; host internal/preview apps there (unlimited deploys); Vercel only for public prod.
- **Phase 3:** **self-host Supabase/Postgres** on Brainiac, NAS for storage/backups; cloud Supabase becomes a mirror.
- **Phase 4:** **n8n** for automations; self-host auth/email as volume warrants.
- **Per client (scale):** the **sovereign appliance** (your supercomputer) ships
  with local models + self-hosted stack pre-loaded — so **clients are never
  metered either**. This is the $50k installation's technical moat.

## Legality (be clear)
Everything above is **fully legal**: your own hardware, open-source software
(Ollama, Supabase, Postgres, n8n, Coolify — all OSS licenses), and standard
pay-as-you-go billing. No ToS violations, no circumvention. "Never blocked" comes
from **owning the infrastructure**, not from gaming anyone's limits.

## The one mindset shift
Cloud APIs are **convenience and overflow**, not the foundation. The foundation
is Brainiac + NAS + the mesh — which you already built. Once the local LLM is the
default, a dead API key or an empty credit balance becomes a non-event.
