#!/usr/bin/env bash
# operator-dispatch.sh — ping available student-operators for local jobs (non-emergency = no owner).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REG="$ROOT/config/operator-dispatch.json"
QUEUE="$HOME/Sync/rick/FLEET-INBOX/OPERATOR-JOBS"
LOG="$HOME/Library/Logs/operator-dispatch.log"

mkdir -p "$QUEUE" "$(dirname "$LOG")"
[[ -f "$REG" ]] || exit 0

scan_jobs() {
  local pending
  pending="$(find "$QUEUE" -maxdepth 1 -name '*.md' -type f 2>/dev/null | wc -l | tr -d ' ')"
  [[ "$pending" -gt 0 ]] || return 0

  if ! command -v node >/dev/null 2>&1; then return 0; fi
  node -e "
    const fs=require('fs');
    const reg=JSON.parse(fs.readFileSync('$REG','utf8'));
    const avail=(reg.operators||[]).filter(o=>o.available&&o.telegram_chat_id);
    if(!avail.length){ process.exit(0); }
    const token=process.env.TELEGRAM_BOT_TOKEN;
    if(!token) process.exit(0);
    const job=fs.readdirSync('$QUEUE').find(f=>f.endsWith('.md'));
    if(!job) process.exit(0);
    const body=fs.readFileSync('$QUEUE/'+job,'utf8').slice(0,400);
    const op=avail[0];
    const text='TMMT local job for '+op.name+':\\n'+body+'\\nReply ACCEPT to claim.';
    fetch('https://api.telegram.org/bot'+token+'/sendMessage',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({chat_id:op.telegram_chat_id,text})
    }).then(()=>console.log('dispatched to',op.name));
  " >> "$LOG" 2>&1 || true
}

case "${1:-scan}" in
  scan) scan_jobs ;;
  job)
    shift
    ts="$(date +%Y%m%d-%H%M%S)"
    cat > "$QUEUE/job-$ts.md" <<EOF
# Local operator job
created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
${*}

Accept only if you can complete 100% in your area.
EOF
    scan_jobs
    ;;
  *) echo "usage: operator-dispatch.sh [scan|job description...]" ;;
esac
