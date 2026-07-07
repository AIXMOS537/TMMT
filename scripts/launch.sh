#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# launch.sh — the GO-LIVE one shot. Not a tool menu — your execution dashboard.
# Shows where you stand on the road to the FIRST DOLLAR and names the one next move.
# ───────────────────────────────────────────────────────────────────────────
set -uo pipefail
B(){ printf "\033[1m%s\033[0m\n" "$1"; }
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
GR="$ROOT/.aixmos/grants"; OPS="$ROOT/.aixmos/operators"; QF="$ROOT/.aixmos/queue/pending.tsv"
granted=$(ls "$GR"/*-GRANTED.md 2>/dev/null | wc -l | tr -d ' ')
pending=$(ls "$OPS"/*.md 2>/dev/null | wc -l | tr -d ' ')
qn=$(grep -c . "$QF" 2>/dev/null || echo 0)

clear 2>/dev/null || true
cat <<'H'
[1m╔══════════════════════════════════════════════════╗
║   🚀  GO LIVE — the road to the FIRST DOLLAR      ║
╚══════════════════════════════════════════════════╝[0m
H
mark(){ [ "$1" = 1 ] && printf "\033[42;30m ✓ \033[0m" || printf "\033[100;97m · \033[0m"; }
printf "%s 1. House clean — Airtable token revoked\n" "$(mark "${AIRTABLE_DONE:-0}")"
printf "%s 2. Team granted — %s in, %s waiting\n" "$(mark "$([ "$granted" -ge 1 ] && echo 1 || echo 0)")" "$granted" "$pending"
printf "%s 3. An operator pointed at REAL prospects\n" "$(mark 0)"
printf "%s 4. First qualified call BOOKED\n" "$(mark 0)"
printf "%s 5. First DOLLAR — the proof\n" "$(mark 0)"
echo
B "── YOUR ONE NEXT MOVE ──"
if [ "$granted" -lt 1 ] && [ "$pending" -ge 1 ]; then
  echo "  🪪 You have $pending onboarded, 0 granted → GRANT one now:"
  echo "     bash scripts/grant.sh"
elif [ "$granted" -lt 1 ]; then
  echo "  📤 Nobody's in yet → onboard your first operator (send the file):  open dist"
else
  echo "  💬 $granted operator(s) granted → point ONE at real prospects TODAY."
  echo "     Justin: open his 10 best leads, run the opener, book ONE call."
  echo "     (his scripts: docs/kits/AIXMOS-SETTER-KIT.md §4)"
fi
[ "$qn" -gt 0 ] && { echo; printf "  📥 \033[105;97m %s decision(s) waiting your YES \033[0m → bash scripts/queue.sh\n" "$qn"; }
echo
printf "\033[2m  the machine is built. revenue is the only frontier left. go cut something. 👑\033[0m\n"
printf "\033[1m  one real call. one real client. that's the next milestone — not more code.\033[0m\n"
