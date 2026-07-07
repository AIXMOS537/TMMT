#!/usr/bin/env bash
# sovereign-status.sh — one screen: mesh + agents + money blockers + inbox.
set -uo pipefail
source "$(dirname "$0")/../lib/swarm-common.sh" 2>/dev/null || true
cd "$SWARM_ROOT"
ROOT="$SWARM_ROOT"

if [[ -t 1 ]]; then
  G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; W=$'\e[97m'; D=$'\e[2m'; BD=$'\e[1m'; X=$'\e[0m'
else G=; Y=; R=; C=; W=; D=; BD=; X=; fi

ROLE="$(cat "$ROOT/.swarm/role" 2>/dev/null || echo unset)"
MACHINE="$(cat "$ROOT/.swarm/machine" 2>/dev/null || hostname -s)"
DARK="clear"; [[ -f "$ROOT/.swarm/DARK" ]] && DARK="DARK"

cat <<EOF
${C}${BD}╔══════════════════════════════════════════════════════════════╗
║  S O V E R E I G N   S T A T U S  —  apex · now · forever     ║
╚══════════════════════════════════════════════════════════════╝${X}
  device: ${W}${MACHINE}${X} · role: ${W}${ROLE}${X} · blackout: ${DARK}
EOF

printf '\n%s  DAEMONS (launchd)%s\n' "$BD" "$X"
for lbl in com.tmmt.forever-loop com.tmmt.router com.aixmos.hailmary com.tmmt.memory-sync com.hailmary.litellm-local com.hailmary.ccr; do
  if launchctl list 2>/dev/null | grep -q "$lbl"; then
    printf '  %s●%s %-28s loaded\n' "$G" "$X" "$lbl"
  else
    printf '  %s○%s %-28s offline\n' "$Y" "$X" "$lbl"
  fi
done

printf '\n%s  LOCAL AI%s\n' "$BD" "$X"
curl -sf --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1 \
  && printf '  %s●%s Ollama\n' "$G" "$X" \
  || printf '  %s○%s Ollama\n' "$Y" "$X"
curl -sf --max-time 2 -H "Authorization: Bearer ${LITELLM_MASTER_KEY:-x}" \
  "${OPENAI_BASE_URL:-http://127.0.0.1:4001/v1}/models" >/dev/null 2>&1 \
  && printf '  %s●%s LiteLLM gateway\n' "$G" "$X" \
  || printf '  %s○%s LiteLLM gateway\n' "$Y" "$X"

printf '\n%s  MESH PRESENCE%s\n' "$BD" "$X"
bash "$ROOT/scripts/heartbeat.sh" status 2>/dev/null | sed 's/^/  /' | head -6 || true

printf '\n%s  MONEY GATE (owner only)%s\n' "$BD" "$X"
if [[ -f "$ROOT/package.json" ]]; then
  blockers="$(cd "$ROOT" && npm run ghl:check 2>&1 | grep -c 'P0 blocker' || true)"
  if [[ "${blockers:-0}" -gt 0 ]]; then
    printf '  %s!%s %s P0 GHL checkout URL(s) empty — paste in GHL → ghl:sync-vercel\n' "$Y" "$X" "$blockers"
  else
    printf '  %s✓%s GHL P0 checkouts configured\n' "$G" "$X"
  fi
fi

INBOX="$HOME/Brain/vault/03-Systems/watchtower-inbox/events.log"
if [[ -f "$INBOX" ]]; then
  printf '\n%s  AGENT INBOX (last 8)%s\n' "$BD" "$X"
  tail -n 8 "$INBOX" 2>/dev/null | sed 's/^/  /' || true
fi

printf '\n%s  COMMANDS%s\n' "$BD" "$X"
printf '  apex          re-arm everything\n'
printf '  watchtower    League + health\n'
printf '  forever       mesh loop status\n'
printf '  tmmt          control board\n'
printf '\n'
