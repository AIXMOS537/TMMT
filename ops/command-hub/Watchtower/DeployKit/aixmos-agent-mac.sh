#!/bin/bash
# ============================================================
#  AIXMOS AGENT (macOS)
#  Reports this Mac's health + activity to the Fleet Watchtower hub.
#  Runs in the logged-in user's session (LaunchAgent) so it can
#  read the active app + idle time. Loops, posting every 20s.
# ============================================================
HUB="${HUB:-http://100.117.163.93:8787}"   # Brainiac (hub) Tailscale IP
EVERY="${EVERY:-20}"

NAME="$(scutil --get ComputerName 2>/dev/null || hostname)"
MEM_TOTAL_BYTES="$(sysctl -n hw.memsize)"
PAGE="$(sysctl -n hw.pagesize)"

while true; do
  # CPU used % (100 - idle), from the 2nd top sample
  CPU="$(top -l 2 -n 0 2>/dev/null | awk '/CPU usage/{idle=$7} END{gsub(/%/,"",idle); printf "%.0f", 100-idle}')"

  # RAM: used = total - (free + inactive) pages
  VM="$(vm_stat 2>/dev/null)"
  FREE="$(echo "$VM"     | awk '/Pages free/{gsub(/\./,"",$3); print $3}')"
  INACT="$(echo "$VM"    | awk '/Pages inactive/{gsub(/\./,"",$3); print $3}')"
  SPEC="$(echo "$VM"     | awk '/speculative/{gsub(/\./,"",$3); print $3}')"
  AVAIL=$(( (FREE + INACT + SPEC) * PAGE ))
  MEM_USED_GB="$(awk -v t="$MEM_TOTAL_BYTES" -v a="$AVAIL" 'BEGIN{printf "%.1f",(t-a)/1073741824}')"
  MEM_TOTAL_GB="$(awk -v t="$MEM_TOTAL_BYTES" 'BEGIN{printf "%.1f",t/1073741824}')"
  MEM_PCT="$(awk -v t="$MEM_TOTAL_BYTES" -v a="$AVAIL" 'BEGIN{printf "%.0f",(t-a)/t*100}')"

  # Disk (root volume)
  DF="$(df -k / | tail -1)"
  DISK_TOTAL_GB="$(echo "$DF" | awk '{printf "%.0f",$2/1048576}')"
  DISK_FREE_GB="$(echo  "$DF" | awk '{printf "%.0f",$4/1048576}')"
  DISK_PCT="$(echo "$DF"      | awk '{gsub(/%/,"",$5); print $5}')"

  # Uptime hours
  BOOT="$(sysctl -n kern.boottime | awk -F'[ ,}]' '{print $4}')"
  NOW="$(date +%s)"
  UPTIME_H="$(awk -v b="$BOOT" -v n="$NOW" 'BEGIN{printf "%.1f",(n-b)/3600}')"

  # Logged-in console user
  USERNAME="$(stat -f%Su /dev/console 2>/dev/null)"

  # Active app (needs Accessibility permission for the agent once)
  ACTIVE="$(osascript -e 'tell application "System Events" to name of first application process whose frontmost is true' 2>/dev/null)"

  # Idle seconds
  IDLE="$(ioreg -c IOHIDSystem 2>/dev/null | awk '/HIDIdleTime/{print int($NF/1000000000); exit}')"
  [ -z "$IDLE" ] && IDLE=0

  read -r -d '' PAYLOAD <<EOF
{"name":"$NAME","cpu":${CPU:-0},"memPct":${MEM_PCT:-0},"memUsedGB":${MEM_USED_GB:-0},"memTotalGB":${MEM_TOTAL_GB:-0},"diskPct":${DISK_PCT:-0},"diskFreeGB":${DISK_FREE_GB:-0},"diskTotalGB":${DISK_TOTAL_GB:-0},"uptimeH":${UPTIME_H:-0},"user":"${USERNAME}","active":"${ACTIVE}","idleSec":${IDLE:-0}}
EOF

  curl -s -m 8 -X POST -H "Content-Type: application/json" -d "$PAYLOAD" "$HUB/api/report" >/dev/null 2>&1
  sleep "$EVERY"
done
