# Local Brain — abundant, cheap, private agents (own your compute)

> The right answer to "lots of agents, cheap, everywhere" is **local models you own**,
> not a stack of borrowed API keys. Same lesson that fixed the Vercel cap: **don't depend
> on someone else's quota.** This is the local-first agent brain for the whole mesh.

## ❌ What we do NOT do (and why)

**Pooling/rotating a bunch of free API keys** to dodge rate limits is **out**:
- It's **ToS abuse** → keys (and often the whole account) get **banned**.
- It's **fragile** → breaks the instant a provider tightens limits.
- It's **not local** → you're right back to depending on someone else's quota.

If you want more than one model behind one endpoint, the legit way is a **router** (below),
with **your own** local models primary and **one legitimate** cloud key as optional fallback.

## ✅ Quick start

```bash
bash scripts/tmmt brain            # install + run the general brain (Pocket assistant)
bash scripts/tmmt brain --coder    # code-tuned model for the SWARM agents
bash scripts/tmmt brain serve      # share THIS machine's brain across the mesh (tailnet)
```

Models are auto-picked by RAM (override with a tag, e.g. `tmmt brain qwen2.5-coder:14b`).

## Best current local models (by machine, early-2026)

| RAM | General / Pocket | Coding agents (`--coder`) |
|---|---|---|
| 8 GB | `llama3.2:3b` | `qwen2.5-coder:3b` |
| 16–24 GB | `llama3.1:8b` | `qwen2.5-coder:7b` |
| 32 GB | `qwen2.5:14b` | `qwen2.5-coder:14b` |
| 64 GB+ (M1 Max / the $3k Windows) | `qwen2.5:32b` | `qwen2.5-coder:32b` |

Also worth pulling on the big boxes: a **reasoning** model (`deepseek-r1` distill) for
planning/hard logic. Newer tags work too — just pass the ollama tag as the arg.

## One brain, the whole mesh (the multi-device move)

Run the brain on a powerhouse (M1 `brainiac-mac` or `brainiac-win`) and **share it** so every
device's agents use it — no need to host a model on each laptop:

```bash
# on the brain box:
bash scripts/tmmt brain serve            # binds ollama on the tailnet (OpenAI-compatible)
# on every other device / in .env:
POCKET_BRAIN_URL=http://<brain-tailnet-ip>:11434/v1/chat/completions
POCKET_BRAIN_MODEL=qwen2.5:14b
```
**Tailnet-only — never expose port 11434 publicly.**

## The router (the legit "many models behind one endpoint")

Want local-primary with a **single, legitimate** cloud fallback for the hard 5%? Run a
**LiteLLM** router (the Pocket brain already speaks its format on `:4000`):

```yaml
# litellm.config.yaml  — local first, ONE real key for fallback (not a pool)
model_list:
  - model_name: code            # what agents/POCKET_BRAIN_MODEL ask for
    litellm_params: { model: ollama/qwen2.5-coder:14b, api_base: http://127.0.0.1:11434 }
  - model_name: code            # fallback — your ONE legit key, used only when local is busy
    litellm_params: { model: anthropic/claude-..., api_key: os.environ/ANTHROPIC_API_KEY }
router_settings: { routing_strategy: simple-shuffle, num_retries: 1 }
```
```bash
litellm --config litellm.config.yaml --port 4000
# POCKET_BRAIN_URL=http://<brain-tailnet-ip>:4000/v1/chat/completions
```
This gives you "lots of capacity, one endpoint" **without** pooling free keys: local does the
volume for free; a single real key catches overflow. Cost-bounded, ToS-clean, resilient.

## Local coding agents for the swarm (cheap + private)

The `swarm` launches **Claude Code** agents (cloud, best quality — keep them for the heavy
lifts). For **cheap/private volume**, point a local agent runner at the brain:

```bash
# Aider against the local brain (free, offline-capable):
pip install aider-chat
export OPENAI_API_BASE=http://<brain-tailnet-ip>:11434/v1 OPENAI_API_KEY=ollama
aider --model openai/qwen2.5-coder:14b
```
Mix-and-match: Claude Code for hard tasks, local Aider/Continue for routine refactors, docs,
tests — all claiming from the same atomic swarm board.

## Moe Legacy (partner node)

`moe-legacy` runs the **same** `tmmt brain` setup **fenced / least-privilege** — his own local
brain on his own machine. **Do not** hand a partner the owner's shared brain or keys; he hosts
his own (or uses his own legit key in his own router). Compliance vocabulary still applies to
anything customer-facing (guidance, not repair).

## TL;DR

- **Own the compute:** local models on your boxes (free, private, unlimited).
- **Share one brain** across the mesh over Tailscale (`tmmt brain serve`).
- **Router, not pooled keys:** local-primary + one legit fallback if you want overflow.
- **Right tool per task:** Claude Code for the hard 5%, local agents for the cheap 95%.
