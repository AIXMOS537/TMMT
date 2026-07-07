#!/usr/bin/env bash
# m1-fleet-executor.sh — execute highest-scored FLEET-INBOX mission (M1 WORK LAW).
set -uo pipefail
INBOX="${FOREVER_RICK_INBOX:-$HOME/Sync/rick/FLEET-INBOX}"
DONE="${INBOX}/done"
LOG="${HOME}/Library/Logs/m1-fleet-executor.log"
TMMT="${TMMT:-$HOME/projects/TMMT}"
[[ -d "$HOME/Projects/TMMT" ]] && TMMT="$HOME/Projects/TMMT"
mkdir -p "$INBOX" "$DONE" "$(dirname "$LOG")"
log(){ printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*" >> "$LOG"; }

# Highest score first: law-NNNN-*.md sorts descending by prefix
mission="$(
  find "$INBOX" -maxdepth 1 -name '*.md' -type f 2>/dev/null \
    | while read -r f; do
        base="$(basename "$f")"
        if [[ "$base" =~ ^law-([0-9]+)- ]]; then
          printf '%s\t%s\n' "${BASH_REMATCH[1]}" "$f"
        else
          printf '0000\t%s\n' "$f"
        fi
      done \
    | sort -t$'\t' -k1,1nr \
    | head -1 \
    | cut -f2-
)"
[[ -n "$mission" && -f "$mission" ]] || exit 0
base="$(basename "$mission")"
score="?"
[[ "$base" =~ ^law-([0-9]+)- ]] && score="${BASH_REMATCH[1]}"
log "executing [$score] $base"
export PATH="$HOME/.local/bin:$PATH"
if [[ -d "$TMMT" ]]; then
  cd "$TMMT"
  bash scripts/sync-machine.sh >/dev/null 2>&1 || true
  if [[ -x "$HOME/Sync/rick/M1-SCRIPTS/brainiac-via-m1.sh" ]]; then
    bash "$HOME/Sync/rick/M1-SCRIPTS/brainiac-via-m1.sh" >> "$LOG" 2>&1 || true
  elif [[ -x "$TMMT/scripts/mesh/brainiac-via-m1.sh" ]]; then
    bash "$TMMT/scripts/mesh/brainiac-via-m1.sh" >> "$LOG" 2>&1 || true
  fi
  [[ -d node_modules ]] && npm run build >/dev/null 2>&1 && log build_ok || log build_skip
  [[ -x "$TMMT/scripts/mesh/go-live-integration-test.sh" ]] \
    && bash scripts/mesh/go-live-integration-test.sh >/dev/null 2>&1 && log integration_ok || log integration_fail
  [[ -x "$TMMT/scripts/mesh/m1-work-router.sh" ]] \
    && bash scripts/mesh/m1-work-router.sh route >> "$LOG" 2>&1 || true
fi
[[ -x "$TMMT/scripts/blip/m1-autopilot.sh" ]] \
  && M1_ONESHOT_NO_AUTO=1 bash "$TMMT/scripts/blip/m1-autopilot.sh" >> "$LOG" 2>&1 || true
mv -f "$mission" "$DONE/$base" 2>/dev/null || mv -f "$mission" "$INBOX/COMPLETED/$base" 2>/dev/null || true
log "archived $base"
exit 0
