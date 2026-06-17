#!/usr/bin/env bash
# setup-llm — turn THIS laptop into its owner's first private, self-hosted LLM.
# Local-only, contained, self-sustaining. Detects RAM and picks the right model,
# installs Ollama, pulls the model, and verifies. Their brain — on their machine.
#   bash scripts/setup-llm.sh            auto (by RAM)
#   bash scripts/setup-llm.sh <model>    force a specific Ollama model tag
# See docs/OFFER-STACK.md (the laptop tiers) and docs/PROJECT-X-HAILMARY.md.
set -uo pipefail
OS="$(uname -s 2>/dev/null)"

# --- detect RAM (GB) ---
ram_gb() {
  case "$OS" in
    Darwin) echo $(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1024/1024/1024 ));;
    Linux)  awk '/MemTotal/{printf "%d", $2/1024/1024}' /proc/meminfo 2>/dev/null || echo 0;;
    *)      echo 0;;
  esac
}
RAM="$(ram_gb)"; [ "$RAM" -gt 0 ] 2>/dev/null || RAM=8

# --- choose model by RAM (override with arg) ---
pick() {
  if   [ "$RAM" -lt 12 ]; then echo "llama3.2:3b";    # 8GB  — a taste
  elif [ "$RAM" -lt 28 ]; then echo "llama3.1:8b";    # 16/24GB — real helper
  elif [ "$RAM" -lt 56 ]; then echo "qwen2.5:14b";    # 32GB — hosts everything
  else                          echo "qwen2.5:32b";   # 64GB — full power
  fi
}
MODEL="${1:-$(pick)}"

echo ""
echo "  🧠  SELF-HOSTED BRAIN SETUP"
echo "  ───────────────────────────────"
echo "  RAM detected : ${RAM} GB"
echo "  model        : ${MODEL}"
echo "  privacy      : 100% local — nothing leaves this machine"
echo ""

# --- install Ollama if missing ---
if ! command -v ollama >/dev/null 2>&1; then
  echo "  › installing Ollama…"
  case "$OS" in
    Darwin) if command -v brew >/dev/null 2>&1; then brew install ollama 2>/dev/null || true; fi
            command -v ollama >/dev/null 2>&1 || { echo "  → finish install: https://ollama.com/download (open the app once), then re-run."; exit 0; } ;;
    Linux)  curl -fsSL https://ollama.com/install.sh | sh || { echo "  ✗ install failed — see https://ollama.com/download"; exit 1; } ;;
    *)      echo "  → Windows: install from https://ollama.com/download, open 'Git Bash', re-run this."; exit 0 ;;
  esac
fi
command -v ollama >/dev/null 2>&1 && echo "  ✓ Ollama present"

# --- start the daemon (best effort) + pull the model ---
( ollama serve >/dev/null 2>&1 & ) 2>/dev/null || true
echo "  › pulling ${MODEL} (one-time download)…"
if ollama pull "$MODEL"; then
  echo "  ✓ model ready"
else
  echo "  ✗ pull failed — check internet, then: ollama pull ${MODEL}"; exit 1
fi

# --- quick proof of life ---
echo ""
echo "  › testing the brain…"
printf 'Reply in one short sentence: say hello as a helpful business assistant.' \
  | ollama run "$MODEL" 2>/dev/null | head -3
echo ""
echo "  ✓ DONE. Their first LLM is live + private."
echo "    chat anytime:  ollama run ${MODEL}"
echo "    upgrade later: bash scripts/setup-llm.sh qwen2.5:32b   (needs more RAM)"
