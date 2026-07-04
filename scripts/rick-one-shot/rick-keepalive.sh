#!/usr/bin/env bash
# rick-keepalive — ONE self-healing pass: make sure Rick is UP on the M1, and
# restart anything that's down. The LaunchAgent (com.aixmos.rick.plist) runs this
# on login and every couple minutes, so Rick Sorkin stays ACTIVE with no human in
# the loop. Idempotent + cheap when everything's already healthy.
set -uo pipefail
TMMT="${TMMT:-$HOME/Projects/TMMT}"
mkdir -p "$HOME/.rick"
LOG="$HOME/.rick/keepalive.log"
log(){ printf '%s  %s\n' "$(date '+%F %T')" "$*" >> "$LOG"; }

# Trim the log so it can't grow forever.
if [ -f "$LOG" ]; then tail -n 400 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG" 2>/dev/null || true; fi

# 1) Ollama — Rick's brain. Bring it back if the API isn't answering.
if ! curl -sf --max-time 3 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  if command -v ollama >/dev/null 2>&1; then
    (ollama serve >/dev/null 2>&1 &)
    log "restarted ollama"
    sleep 2
  else
    log "ollama not installed — install from ollama.com"
  fi
fi

# 2) The agent army (:7777). If it's down, run the full office boot once — that
#    also rejoins the mesh and wakes HAILMARY. Heavy, so it only fires when the
#    healthz check actually fails (first login, or a crash).
if ! curl -sf --max-time 3 http://127.0.0.1:7777/healthz >/dev/null 2>&1; then
  if [ -x "$TMMT/scripts/office-up-rick.sh" ]; then
    bash "$TMMT/scripts/office-up-rick.sh" >> "$LOG" 2>&1 || true
    log "rebooted agent army (office-up-rick)"
  else
    log "office-up-rick.sh missing under $TMMT/scripts"
  fi
fi

# 3) Heartbeat so `rick-sorkin status`, the mesh, and X's phone know Rick's alive.
date -u +%FT%TZ > "$HOME/.rick/last-heartbeat"
log "heartbeat ok"
