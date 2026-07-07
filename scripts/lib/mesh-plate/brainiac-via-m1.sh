#!/usr/bin/env bash
# brainiac-via-m1.sh — M1 Rick reaches Brainiac over tailnet (no separate owner BLIP).
set -uo pipefail
BRAINIAC_HOST="${BRAINIAC_HOST:-brainiac-7}"
BRAINIAC_IP="${BRAINIAC_IP:-100.117.163.93}"
LOG="${HOME}/Library/Logs/brainiac-via-m1.log"
mkdir -p "$(dirname "$LOG")" "$HOME/.config/tmmt"
log(){ printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*" | tee -a "$LOG"; }
ok=0
for url in \
  "http://${BRAINIAC_HOST}.tailceb455.ts.net:11434/api/tags" \
  "http://${BRAINIAC_IP}:11434/api/tags"; do
  curl -sf --max-time 5 "$url" >/dev/null 2>&1 && { log "Brainiac Ollama OK $url"; ok=1; break; }
done
cat > "$HOME/.config/tmmt/brainiac-via-m1.env" <<ENV
BRAINIAC_VIA_M1=1
BRAINIAC_HOST=${BRAINIAC_HOST}
BRAINIAC_IP=${BRAINIAC_IP}
ENV
[[ "$ok" -eq 1 ]] && exit 0 || { log "Brainiac down — M1 local stack active"; exit 1; }
