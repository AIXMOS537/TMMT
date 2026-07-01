#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# queue.sh — the owner's decision queue. The master is often away handling things
# physically; the digital verse keeps running. Anything that needs HIS yes/no waits
# here — it never stops the world and never blows up his phone. He clears it in a
# batch when he's back. (The backstops still hold — just asynchronous.)
# ───────────────────────────────────────────────────────────────────────────
#   queue.sh add "deploy Acme to prod" --from justin --risk high   # agent/operator adds
#   queue.sh                # OWNER inbox: what's waiting for your decision
#   queue.sh yes <id>       # approve   ·   queue.sh no <id>   # deny
#   queue.sh log            # decision history   ·   queue.sh count
# ───────────────────────────────────────────────────────────────────────────
set -uo pipefail
B(){ printf "\033[1m%s\033[0m\n" "$1"; }
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
QDIR="$ROOT/.aixmos/queue"; PEND="$QDIR/pending.tsv"; LOG="$QDIR/decided.log"
mkdir -p "$QDIR"; touch "$PEND" "$LOG"
risk_color(){ case "$1" in high) printf '\033[41;97m';; med) printf '\033[43;30m';; *) printf '\033[42;30m';; esac; }

CMD="${1:-list}"; shift || true
case "$CMD" in
  add)
    DESC="${1:-}"; [ -n "$DESC" ] || { echo 'usage: queue.sh add "what needs your YES" [--from who] [--risk low|med|high]'; exit 2; }
    shift || true; FROM="agent"; RISK="med"
    while [ $# -gt 0 ]; do case "$1" in --from) FROM="${2:-agent}"; shift 2;; --risk) RISK="${2:-med}"; shift 2;; *) shift;; esac; done
    ID="$(date +%s | tail -c 5)$RANDOM"; ID="${ID: -5}"
    printf '%s\t%s\t%s\t%s\t%s\n' "$ID" "$(date -u +%FT%TZ)" "$FROM" "$RISK" "$DESC" >> "$PEND"
    echo "📥 queued #$ID ($RISK, from $FROM) — waits for the owner's YES. World keeps moving."
    ;;
  list|"")
    n=$(grep -c . "$PEND" 2>/dev/null || echo 0)
    B "📥 OWNER QUEUE — $n waiting for your decision"
    [ "$n" -gt 0 ] || { printf '\033[2m  (empty — nothing needs you right now. you are free.)\033[0m\n'; exit 0; }
    while IFS=$'\t' read -r id ts from risk desc; do
      [ -n "$id" ] || continue
      printf "  #%-5s $(risk_color "$risk") %-4s \033[0m from %-10s %s\n" "$id" "$risk" "$from" "$desc"
    done < "$PEND"
    printf '\033[2m  decide:  queue.sh yes <id>   |   queue.sh no <id>\033[0m\n'
    ;;
  yes|no)
    ID="${1:-}"; [ -n "$ID" ] || { echo "usage: queue.sh $CMD <id>"; exit 2; }
    LINE="$(grep -m1 "^$ID	" "$PEND" || true)"; [ -n "$LINE" ] || { echo "no pending item #$ID"; exit 1; }
    DEC="$([ "$CMD" = yes ] && echo APPROVED || echo DENIED)"
    printf '%s\tdecided=%s\tat=%s\n' "$LINE" "$DEC" "$(date -u +%FT%TZ)" >> "$LOG"
    grep -v "^$ID	" "$PEND" > "$PEND.tmp" && mv "$PEND.tmp" "$PEND"
    [ "$CMD" = yes ] && printf '\033[42;30m ✅ APPROVED #%s \033[0m — go.\n' "$ID" || printf '\033[41;97m ✋ DENIED #%s \033[0m — held.\n' "$ID"
    ;;
  count) grep -c . "$PEND" 2>/dev/null || echo 0;;
  log) B "Decision history:"; tail -30 "$LOG" | sed 's/^/  /' | grep . || echo "  (none)";;
  -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//';;
  *) echo "usage: queue.sh {add|list|yes <id>|no <id>|log|count}";;
esac
