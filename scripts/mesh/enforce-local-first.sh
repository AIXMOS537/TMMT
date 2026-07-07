#!/usr/bin/env bash
# enforce-local-first.sh — audit: no paid tokens on daemons · local OSS only.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMMT_CFG="${TMMT:-$HOME/.config/tmmt}"
say(){ printf '%s\n' "$*"; }
warn(){ printf '⚠ %s\n' "$*"; }
ok(){ printf '✓ %s\n' "$*"; }

say "— LOCAL-FIRST AUDIT —"

# Paid env vars should NOT be set for daemon context
for v in ANTHROPIC_API_KEY OPENAI_API_KEY CLAUDE_CODE_USE_OPENAI VERCEL_OIDC_TOKEN; do
  if [[ -n "${!v:-}" ]]; then
    warn "$v is SET — daemons must not use paid routes"
  else
    ok "$v unset (good for loops)"
  fi
done

# God mode should be OFF for background unless owner session
if [[ -f "$TMMT_CFG/.god-on" ]]; then
  warn "god mode marker present — OK for Taha session ONLY, not fleet loops"
else
  ok "god mode off (loops stay local)"
fi

# List TMMT launchagents
say "LaunchAgents (review):"
launchctl list 2>/dev/null | grep -E 'com\.tmmt\.|hailmary' | sed 's/^/  /' || say "  (none)"

# M1 fleet daemon — should only run local executor
if launchctl list 2>/dev/null | grep -q 'com.tmmt.m1-fleet'; then
  ok "M1 fleet daemon loaded — must use m1-fleet-executor (local build only)"
else
  say "  M1 fleet daemon not on this machine"
fi

# Ollama / LiteLLM local
curl -sf --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null && ok "Ollama local :11434" || warn "Ollama down"
curl -sf --max-time 2 http://127.0.0.1:4001/health >/dev/null && ok "LiteLLM local :4001" || warn "LiteLLM down"

say "— Rule: forge/booyah/occ for loops · god on ONLY when Taha types it —"
