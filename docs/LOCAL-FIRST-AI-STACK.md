# Local-First AI Stack — run (almost) everything locally, Claude only on escalation

> Goal: do **most** work locally through the terminal / PowerShell against your own
> models on your own hardware — private, cheap, fast — and call a frontier model
> (Claude, etc.) **only** when a task genuinely needs it. Built on what you already
> run: Ollama on the carry Mac, `qwen2.5:14b`, Private LLM, n8n, Qdrant, Redis,
> Tailscale.
>
> **Model picks researched June 15 2026** (sources at bottom). The architecture is
> durable; the space moves weekly, so re-verify exact versions before a big commit.

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

## 3. Model picks — honest, by job and hardware  _(updated June 15 2026)_

> Carry Mac (M5, 24GB): comfortably runs up to ~27B at Q4 (e.g. Qwen3.6-27B Q4 GGUF
> is ~16.8 GB and fits with headroom). True 70B needs an M5 Max 128 GB or a GPU box;
> trillion-param MoEs (Kimi) are **hosted/cluster only**. brainiac/vLLM is where
> 32–70B+ and batching live.

| Job | Recommended (mid-2026) | Why |
|---|---|---|
| **Coding (terminal agent), local** | **Qwen3-Coder-Next** (≈58.7% SWE-bench Verified, 256K ctx, fits a 24 GB GPU) · **Devstral Small 2 24B** (smartest viable coder on a Mac) · **Qwen3.6-27B** | Best local coding track record in class; Apache-2.0 (Qwen) |
| **General / ops / reasoning, local** | **Qwen3.6 27B** · **Gemma 4** · **DeepSeek V3.2/V4** (reasoning, on GPU) | Reliable, Apache-2.0 (Qwen/Gemma), huge quant ecosystem |
| **Agentic / tool-calling, local** | **Hermes 4.3 36B** (Nous, GGUF, local-optimized) + the **Hermes Agent** framework | Strong steerable function-calling for your agents — runs on the Macs |
| **Huge context** | **Llama 4 Scout** (up to ~10M tokens) | Paste a whole codebase in one prompt |
| **Phone / offline** | **Qwen ~4B in Private LLM** (you have it) | On-device, no network |
| **Frontier escalation (hosted/cluster)** | **Kimi K2.6** (≈80.2% SWE-bench Verified, ~Claude Opus 4.6 level) · **Qwen 3.6 Plus/Max** (1M ctx) · **GLM 5.1** · **MiniMax M2.7** · **DeepSeek V4** · Claude | Top agentic — but heavy; use only on the hard 5% |

Honest notes on the ones you named:
- **Hermes** — ✅ truly local. Current is **Hermes 4.3 (36B)** (released Dec 2 2025),
  GGUF, tuned for local; pair with Nous's **Hermes Agent** for a local Mac agent.
- **Kimi** — current is **Kimi K2.6** (Moonshot, Apr 2026): a **~1T-param MoE** that
  sustains multi-hour agent runs and spins up swarms of sub-agents. Class-leading
  open agentic model, **but not runnable on a 24 GB Mac** — use it **hosted** (e.g.
  via OpenRouter/Venice) or on a GPU cluster as your `escalate` target.
- **Venice** — **Venice.ai** is **privacy-preserving hosted inference**: zero data
  retention, and some models run in a **TEE with hardware attestation** (verifiable
  private enclave). It hosts **GLM 5.1, MiniMax M2.7, Venice Uncensored 1.2**, etc.
  So it's an excellent *private escalation* endpoint — "private cloud," not "super
  local." Slot it into the `escalate` tier, swappable with Claude/Kimi.

## 4. Quantization — the "best quant track record"  _(updated June 15 2026)_

- **Format:** **GGUF** (llama.cpp/Ollama) everywhere; **MLX** on the Macs for speed.
- **Best-in-class quant:** **Unsloth Dynamic 2.0 GGUF**, start at **`UD-Q4_K_XL`**.
  It's calibrated on real datasets and upscales important layers, and benchmarks
  show **lower KL-divergence than standard imatrix *and* QAT** quants across Llama 4,
  Gemma 3, Qwen3.5 — i.e. closest-to-full-precision at a Q4 file size.
- **Sweet spot stays Q4_K_M**; step to **Q5_K_M / Q6_K** if RAM allows. Avoid Q2/Q3
  for real work. Unsloth also added Apple-Silicon/ARM-tuned formats (Q4_NL, Q5.1, etc.).
- **MLX vs GGUF on Apple Silicon (2026):** MLX wins **~15–40% throughput** on the same
  Mac; GGUF wins on ecosystem/portability and is *slightly* better quality at 4-bit
  (Q4_K_M). → **Use MLX for speed on the Macs, GGUF for everything cross-platform.**
- **Reputable sources:** **Unsloth** (Dynamic 2.0), **bartowski** (imatrix), **mlx-community** (Apple).
- **Rule of thumb:** a **bigger model at Q4** beats a **smaller model at Q8**. Example:
  **Qwen3.6-27B Unsloth Q4 (~16.8 GB)** runs ~**25 tok/s on a single Mac** with
  flagship-class coding output — a great carry-Mac default.

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
- **Other terminal/CLI agents that take a local endpoint (mid-2026, all run local via
  Ollama/LM Studio/OpenAI-compatible):**
  - **OpenCode** (~172k★, MIT) — most-starred open CLI agent.
  - **Cline** (~63k★) — now ships a standalone **CLI + SDK** (not just the IDE extension).
  - **Aider** (~46k★, Apache-2.0) — cleanest **terminal + git-first** flow; uses LiteLLM.
  - Continue (VS Code), goose. Pick OpenCode/Cline for autonomy, Aider for git-discipline.

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

## Sources (researched June 15 2026)

Model landscape moves weekly — re-verify versions before a big commit.

- HuggingFace — Best open-source LLMs 2026 (coding/local/agentic): https://huggingface.co/blog/daya-shankar/open-source-llms
- MindStudio — Best open-source LLMs for agentic coding 2026: https://www.mindstudio.ai/blog/best-open-source-llms-agentic-coding-2026
- DeepLearning.ai (The Batch) — Kimi K2.6 vs Qwen3.6 Max / DeepSeek V4: https://www.deeplearning.ai/the-batch/kimi-k2-6-matches-open-qwen3-6-max-anddeepseek-v4-falls-just-behind-top-closed-models
- Atlas Cloud — Kimi K2.6 vs GLM 5.1 vs Qwen 3.6 Plus vs MiniMax M2.7 (coding 2026): https://www.atlascloud.ai/blog/guides/kimi-k2-6-vs-glm-5-1-vs-qwen-3-6-plus-vs-minimax-m2-7-coding-2026
- Unsloth — Dynamic 2.0 GGUFs: https://unsloth.ai/docs/basics/unsloth-dynamic-2.0-ggufs
- BuildFastWithAI — Qwen3.6-27B review: https://www.buildfastwithai.com/blogs/qwen3-6-27b-review-2026
- Contra Collective — GGUF vs MLX on Apple Silicon (2026): https://contracollective.com/blog/gguf-vs-mlx-quantization-formats-apple-silicon-2026
- Nous Research — Hermes Agent / local LLM on Mac: https://hermes-agent.nousresearch.com/docs/guides/local-llm-on-mac
- Morph — Open-source AI coding assistants ranked (2026): https://www.morphllm.com/ai-coding-assistant-open-source
- SiliconScore — Best Mac for local LLMs 2026 (M4–M5 Max): https://siliconscore.com/guides/best-mac-for-local-llms/
- Venice provider (OpenRouter): https://openrouter.ai/provider/venice

_See also: `docs/DEVICE-SYNC-PRIVATELLM.md`, `docs/MESH-COORDINATION.md`,
`infra/tailscale-acl.jsonc`, AIXMOS Master File §1._
