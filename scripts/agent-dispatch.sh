#!/usr/bin/env bash
# agent-dispatch.sh — auto-route P0 work to Rick/forge without owner typing.
# Reads vault queue + handoffs; writes missions to Syncthing inbox once per dedupe window.
set -uo pipefail
source "$(dirname "$0")/../lib/swarm-common.sh" 2>/dev/null || true
cd "${SWARM_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

ROOT="$SWARM_ROOT"
NOTIFY="$ROOT/scripts/mesh/notify-owner.sh"
DISPATCH_LOG="$ROOT/.swarm/dispatch-log.tsv"
DEDUPE="${FOREVER_DISPATCH_DEDUPE:-3600}"
QUEUE="${FOREVER_QUEUE:-$HOME/Brain/vault/00-Dashboard/IDEA-QUEUE-LIVE.md}"
HANDOFF="${FOREVER_HANDOFF:-$HOME/Brain/vault/00-Dashboard/HANDOFF-TO-FORGE}"
RICK_INBOX="${FOREVER_RICK_INBOX:-$HOME/Sync/rick/FLEET-INBOX}"
HOST="$(swarm_machine 2>/dev/null || hostname -s)"

mkdir -p "$ROOT/.swarm" "$RICK_INBOX" "$(dirname "$DISPATCH_LOG")"
touch "$DISPATCH_LOG"

recently_sent() {
  local key="$1" now cutoff line
  now="$(date +%s)"
  cutoff=$(( now - DEDUPE ))
  while IFS=$'\t' read -r ts k _; do
    [[ "$k" == "$key" && "$ts" -ge "$cutoff" ]] && return 0
  done < "$DISPATCH_LOG"
  return 1
}

log_dispatch() {
  printf '%s\t%s\t%s\n' "$(date +%s)" "$1" "$2" >> "$DISPATCH_LOG"
}

send_mission() {
  local key="$1" title="$2" body="$3"
  recently_sent "$key" && return 0
  local ts f
  ts="$(date +%Y%m%d-%H%M%S)"
  f="$RICK_INBOX/auto-${ts}-${key}.md"
  cat > "$f" <<EOF
# AUTO MISSION — forever-loop · ${HOST}
from: ${HOST} · $(date -u +%Y-%m-%dT%H:%M:%SZ)
priority: P0
dedupe_key: ${key}

## ${title}

${body}

## RUN ON FORGE / RICK
cd ~/projects/TMMT || cd ~/Projects/TMMT
bash scripts/mesh/go-live-device.sh --role forge
npm run build && npm run go-live
EOF
  log_dispatch "$key" "$f"
  bash "$NOTIFY" log "dispatch → Rick: ${title} (${f##*/})"
  echo "✓ dispatched: $title"
}

# P0 rows from IDEA queue
if [[ -f "$QUEUE" ]]; then
  while IFS= read -r line; do
    [[ "$line" =~ ^\|[[:space:]]*[0-9]+[[:space:]]*\| ]] || continue
    [[ "$line" =~ OPEN ]] || continue
    [[ "$line" =~ P0 ]] || continue
    key="$(printf '%s' "$line" | tr -cs 'A-Za-z0-9' '-' | cut -c1-48)"
    title="$(echo "$line" | awk -F'|' '{print $3}' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    send_mission "$key" "P0 queue: ${title:-work item}" "Queue row:
$line

Execute per docs/GO-LIVE-CANON.md — log to watchtower, notify owner urgent only if blocked on human gate."
  done < "$QUEUE"
fi

# Pending handoff files
if [[ -d "$HANDOFF" ]]; then
  find "$HANDOFF" -maxdepth 1 -name '*.md' -type f 2>/dev/null | head -5 | while read -r hf; do
    key="handoff-$(basename "$hf" .md)"
    recently_sent "$key" && continue
    send_mission "$key" "Handoff: $(basename "$hf")" "See vault handoff:
$hf

$(head -80 "$hf" 2>/dev/null)"
  done
fi

exit 0
