#!/usr/bin/env bash
#
# heartbeat.sh — last-ping presence for every device on the mesh.
# The dispatch backbone: know when any machine was last alive, to the millisecond.
# ---------------------------------------------------------------------------
#   scripts/heartbeat.sh beat            # record THIS device's heartbeat now
#   scripts/heartbeat.sh status          # show last-seen for ALL devices
#   scripts/heartbeat.sh watch           # beat every 5s (run via launchd/systemd)
#
# Shared store (so the whole fleet shows up in `status`):
#   set HEARTBEAT_DIR to a path synced across the mesh — a NAS share or a
#   Tailscale-mounted dir. Default: .aixmos/heartbeat (local only).
#   Optional: HEARTBEAT_SUPABASE_URL + HEARTBEAT_SUPABASE_KEY to also POST beats.
# ---------------------------------------------------------------------------
set -uo pipefail
DIR="${HEARTBEAT_DIR:-.aixmos/heartbeat}"
mkdir -p "$DIR" 2>/dev/null || true
HOST="$(hostname)"
ONLINE_WINDOW="${ONLINE_WINDOW:-30}"   # seconds: beats newer than this = ONLINE

now_ms(){ node -e 'process.stdout.write(String(Date.now()))' 2>/dev/null || echo "$(( $(date +%s) * 1000 ))"; }
tnip(){ command -v tailscale >/dev/null && tailscale ip -4 2>/dev/null | head -1 || echo "-"; }

beat(){
  local ms iso ip; ms="$(now_ms)"; iso="$(date -u +%FT%T.%3NZ 2>/dev/null || date -u +%FT%TZ)"; ip="$(tnip)"
  printf '%s\t%s\t%s\t%s\n' "$ms" "$HOST" "$ip" "$iso" > "$DIR/$HOST.beat"
  # optional: stream to Supabase for a live web board
  if [ -n "${HEARTBEAT_SUPABASE_URL:-}" ] && [ -n "${HEARTBEAT_SUPABASE_KEY:-}" ]; then
    curl -sS -m 5 -X POST "$HEARTBEAT_SUPABASE_URL/rest/v1/device_heartbeats" \
      -H "apikey: $HEARTBEAT_SUPABASE_KEY" -H "Authorization: Bearer $HEARTBEAT_SUPABASE_KEY" \
      -H "Content-Type: application/json" -H "Prefer: resolution=merge-duplicates" \
      -d "{\"host\":\"$HOST\",\"last_ms\":$ms,\"tailnet_ip\":\"$(tnip)\",\"seen_at\":\"$iso\"}" >/dev/null 2>&1 || true
  fi
  echo "♥ $HOST beat @ $ms ($iso)  ip=$ip"
}

status(){
  local nowms; nowms="$(now_ms)"
  printf "\033[1m== mesh presence ==  window=%ss  @ %s\033[0m\n" "$ONLINE_WINDOW" "$(date -u +%FT%TZ)"
  local any=0
  for f in "$DIR"/*.beat; do [ -e "$f" ] || continue; any=1
    IFS=$'\t' read -r ms host ip iso < "$f"
    local age_ms=$(( nowms - ms )) age_s=$(( (nowms - ms) / 1000 ))
    if [ "$age_s" -le "$ONLINE_WINDOW" ]; then
      printf "  \033[32m● ONLINE \033[0m %-20s ip=%-15s last %sms ago\n" "$host" "$ip" "$age_ms"
    else
      printf "  \033[31m○ offline\033[0m %-20s ip=%-15s last seen %ss ago (%s)\n" "$host" "$ip" "$age_s" "$iso"
    fi
  done
  [ "$any" = 1 ] || echo "  (no beats yet — run 'heartbeat.sh beat' on each device; set HEARTBEAT_DIR to a shared path)"
}

case "${1:-status}" in
  beat) beat;;
  status) status;;
  watch) echo "beating every 5s — Ctrl-C to stop"; while :; do beat >/dev/null; sleep 5; done;;
  -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//';;
  *) echo "usage: heartbeat.sh {beat|status|watch}"; exit 2;;
esac
