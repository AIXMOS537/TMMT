#!/usr/bin/env bash
# occ-local.sh — free local terminal AI (no CCR profile · no Fable burn).
set -uo pipefail
TMMT="$HOME/.config/tmmt"
source "$TMMT/litellm-master.env" 2>/dev/null || true
export OPENAI_API_KEY="${LITELLM_MASTER_KEY:-sk-local}"
export OPENAI_BASE_URL="${OPENAI_BASE_URL:-http://127.0.0.1:4001/v1}"
export ANTHROPIC_API_KEY="$OPENAI_API_KEY"
export ANTHROPIC_BASE_URL="$OPENAI_BASE_URL"
MODEL="${1:-rick-safe}"
shift 2>/dev/null || true
cd "${HAILMARY_CWD:-$HOME/Brain/vault}"
exec occ --model "$MODEL" "$@"
