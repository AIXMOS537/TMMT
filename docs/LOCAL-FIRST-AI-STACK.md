# Local-First AI Stack — run (almost) everything locally, Claude only on escalation

> Goal: do **most** work locally through the terminal / PowerShell against your own
> models on your own hardware — private, cheap, fast — and call a frontier model
> (Claude, etc.) **only** when a task genuinely needs it. Built on what you already
> run: Ollama on the carry Mac, `qwen2.5:14b`, Private LLM, n8n, Qdrant, Redis,
> Tailscale.
>
> **Knowledge moves fast** (cutoff Jan 2026). The *architecture* below is durable;
> verify exact model versions/benchmarks before you commit (ask me to web-check).

---

## 0. The mental model

```
            ┌─────────────── one endpoint (LiteLLM router) ───────────────┐
 you / aider / n8n  ──►  EASY  → tiny local model (3–8B)   on carry Mac    │
 (terminal,             MED   → mid local model (14–32B)  on brainiac/GPU  │
  PowerShell)           HARD  → escalate to hosted (Claude/Kimi/DeepSeek)  │
            └──────────── routes by task; logs + caches via Redis ─────────┘
```

**Rule:** local by default, escalate by exception. Most coding/ops/triage is "easy/
med" and never leaves your tailnet. You only pay (money + data egress) on the rare
"hard" task — and even that can be a privacy-preserving hosted open model.

## 1. Serving layer (the local brains)

| Tool | Use | Platform |
|---|---|---|
| **Ollama** | Easiest local serving, OpenAI-compatible at `:11434`. You already run it. | Mac/Win/Linux |
| **llama.cpp** (`llama-server`) | Max control over GGUF + speed (speculative decoding, KV cache). | all |
| **MLX / mlx-lm** | **Fastest on Apple Silicon** — use this on the Macs. | Mac only |
| **vLLM** | High-throughput **batched** serving if brainiac has an NVIDIA GPU. | Linux+GPU |
| **LM Studio** | GUI + local server + CLI if you want a console. | Mac/Win/Linux |
| **LiteLLM** | **The router.** One OpenAI-compatible endpoint that fans out to all of the above + hosted fallback. This is the keystone. | all |

## 2. The router = one endpoint for everything (`litellm`)

Everything (terminal, Aider, n8n, Shortcuts) points at **one** URL; LiteLLM decides
where it runs. Example `litellm.config.yaml` on the hub:

```yaml
model_list:
  - model_name: fast            # easy tasks
    litellm_params: { model: ollama/qwen2.5:3b, api_base: http://carry-mac:11434 }
  - model_name: code            # coding / med tasks
    litellm_params: { model: ollama/qwen2.5-coder:14b, api_base: http://carry-mac:11434 }
  - model_name: heavy           # bigger local (brainiac GPU)
    litellm_params: { model: openai/Qwen2.5-32B, api_base: http://brainiac:8000/v1 }
  - model_name: escalate        # frontier, only when needed
    litellm_params: { model: anthropic/claude-... , api_key: os.environ/ANTHROPIC_KEY }
router_settings:
  redis_host: redis            # cache identical calls = speed + $0
  fallbacks: [{ code: ["heavy", "escalate"] }]
```

Run tailnet-only: `litellm --config litellm.config.yaml --port 4000`. Now your
"AI endpoint" is `http://<hub-tailnet-ip>:4000` for the whole mesh.

## 3. Model picks — honest, by job and hardware

> Carry Mac (M5, 24GB) comfortably runs up to ~14B at good quant; 32B is tight.
> A GPU box (brainiac) or vLLM is where 32–70B+ and batching live.

| Job | Recommended local | Why |
|---|---|---|
| **Coding (terminal agent)** | **Qwen2.5-Coder 14B/32B**, **Devstral** (Mistral, agentic) | Best local coding track record in their size classes |
| **General / reasoning / ops** | **Qwen2.5/Qwen3 14B–32B**, **Llama 3.3 70B** (on GPU) | Reliable, huge quant ecosystem |
| **Agentic / tool-calling / steerable** | **Hermes 3** (Nous, on Llama 3.1 8B/70B) | Strong function-calling, steerable — good for your agents |
| **Phone / offline** | **Qwen 4B in Private LLM** (you have it) | On-device, no network |
| **Frontier-only hard tasks** | **Kimi K2**, **DeepSeek V3/R1** (hosted or big GPU), Claude | Top agentic/reasoning — but heavy |

Honest notes on the ones you named:
- **Hermes** — yes, run it locally (Llama-based GGUF/MLX). Great default for agent/
  tool work. ✅ truly local.
- **Kimi (K2)** — excellent agentic/coding, but it's a ~trillion-param MoE: **not**
  runnable on a 24GB Mac. Use it **hosted** (or on a serious GPU cluster) as an
  *escalation* target, not your local default.
- **Venice** — Venice.ai is a **privacy-preserving hosted** service (no logging),
  not a local model. It's a good *private escalation* endpoint, but it's still a
  network call — so it's "private cloud," not "super local." Treat it like the
  `escalate` tier, swappable with Claude/Kimi.

## 4. Quantization — the "best quant track record"

- **Format:** **GGUF** (llama.cpp/Ollama) everywhere; **MLX 4-bit/6-bit** on Macs for speed.
- **Sweet spot:** **Q4_K_M** (best size/quality balance), step up to **Q5_K_M / Q6_K**
  if you have RAM and want fidelity. Below Q4 quality drops fast — avoid Q2/Q3 for
  real work.
- **Reputable quant sources (track record):**
  - **Unsloth "dynamic" GGUF** (e.g., `UD-Q4_K_XL`) — quality-preserving, well-regarded.
  - **bartowski** GGUF with **imatrix** (importance-matrix) — strong, widely trusted.
  - **mlx-community** — the go-to for Apple-Silicon MLX quants.
- **Rule of thumb:** a **bigger model at Q4** usually beats a **smaller model at Q8**.
  Pick the largest model that fits at Q4_K_M, then raise quant only if RAM allows.

## 5. Terminal / PowerShell workflow (use less Claude)

- **Aider** — terminal pair-programmer, git-native, points at any OpenAI-compatible
  endpoint. This is your "Claude Code, but local":
  ```bash
  export OPENAI_API_BASE=http://<hub-tailnet-ip>:4000  # the LiteLLM router
  export OPENAI_API_KEY=local
  aider --model code        # codes against your local Qwen2.5-Coder
  ```
- **Ollama CLI:** `ollama run qwen2.5-coder:14b "refactor this..."`
- **Raw curl** (works in bash *and* PowerShell):
  ```bash
  curl http://<hub-tailnet-ip>:4000/v1/chat/completions -H "Content-Type: application/json" \
    -d '{"model":"code","messages":[{"role":"user","content":"..."}]}'
  ```
  PowerShell: `Invoke-RestMethod -Uri ... -Method Post -Body (... | ConvertTo-Json)`
- **n8n** (you have it): every workflow node calls the **same** router URL → automations
  run on local models for free.
- **Other agents that take a local endpoint:** Cline / Continue (VS Code), OpenCode, goose.

## 6. The macOS-VM question (be careful here)

- macOS in a VM is **only licensed on Apple hardware.** Running it on a Windows/Linux
  PC violates Apple's EULA — don't build the business on that.
- **Recommended:** run the heavy local stack on **Linux (or Windows + WSL2)** with a
  GPU; keep your **real Macs** for MLX-accelerated local inference and anything
  macOS-only. Tailscale ties them together regardless of OS.

## 7. Speed — the realistic "2× faster" levers

1. **Right-size + route** (§2): don't send easy tasks to a 70B. Biggest win.
2. **MLX on Apple Silicon** — typically faster than llama.cpp on Macs.
3. **Quant to the sweet spot** (Q4_K_M / MLX-4bit) — smaller = faster.
4. **Speculative decoding** (small draft model + big target) in llama.cpp/vLLM.
5. **Redis response cache** — identical/similar calls return instantly, $0.
6. **Keep models warm** (`OLLAMA_KEEP_ALIVE`), preload at boot.
7. **vLLM batching** on a GPU box for concurrent team requests.
8. **Qdrant RAG** so the model reads retrieved context instead of re-deriving.

## 8. Security / cost (why local wins)

- **Data never leaves the tailnet** for local tiers — air-gap-capable, no third-party
  logging. Escalation is the only egress, and it's explicit + logged.
- **Cost:** local tiers are ~$0/token after hardware; you pay only on `escalate`.
- Same guardrails as the mesh: outbound/irreversible actions still hit **owner
  approval** (`docs/MESH-COORDINATION.md §4`); offshore reaches the router only per
  the **Tailscale ACL** (`infra/tailscale-acl.jsonc`) — never the raw model hosts'
  admin ports.

## 9. Next steps (in order)

1. Stand up **LiteLLM** on the hub (tailnet-only, Redis cache) → one endpoint.
2. Pull a **fast** (Qwen2.5 3B) + **code** (Qwen2.5-Coder 14B) model in Ollama.
3. Point **Aider** + **n8n** at the router; do a week of real work local-only.
4. Add `escalate` (Claude/Kimi/DeepSeek/Venice) as fallback for the hard 5%.
5. Measure: % handled locally, latency, $ saved. Tune routing + quant from data.

---

_Want me to web-check the **current** best local models + quant releases and drop
exact versions into §3/§4? Just ask._
_See also: `docs/DEVICE-SYNC-PRIVATELLM.md`, `docs/MESH-COORDINATION.md`,
`infra/tailscale-acl.jsonc`, AIXMOS Master File §1._
