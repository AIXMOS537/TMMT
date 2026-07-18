#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# m1-fleet-executor.sh — the M1 side of the WORK LAW pipeline.
#
# m1-work-router.sh scores incoming work and drops missions into FLEET-INBOX.
# THIS script is what those missions tell the M1 to run. Its job is Option A —
# SURFACE FOR APPROVAL. It never sends/pays/signs/ships and it never approves
# itself: it shows the owner the highest-priority mission and STOPS. Work only
# moves forward after a human explicitly approves at the keyboard.
#
# This exists precisely because of CLAUDE.md's non-negotiable OWNER-APPROVAL GATE:
# "Never auto-execute send/pay/sign/ship." An auto-runner would violate that. So
# the executor is a checkpoint, not an actuator. The PreToolUse gate
# (.claude/hooks/owner-approval-gate.py) remains the backstop on any real action.
#
#   m1-fleet-executor.sh              surface the top mission (default; safe to auto-run)
#   m1-fleet-executor.sh list         list pending missions, highest score first
#   m1-fleet-executor.sh show [top|F] print a mission in full
#   m1-fleet-executor.sh approve [top|F]  INTERACTIVE ONLY — approve + stage for work
#   m1-fleet-executor.sh reject  [top|F]  move a mission out of the queue
#   m1-fleet-executor.sh status       queue + ledger summary
# ═══════════════════════════════════════════════════════════════════════════════
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INBOX="${FOREVER_RICK_INBOX:-$HOME/Sync/rick/FLEET-INBOX}"
APPROVED="$INBOX/approved"
REJECTED="$INBOX/rejected"
LEDGER="${M1_WORK_LEDGER:-$HOME/.config/tmmt/.owner-only/work-ledger.tsv}"
NOTIFY="$ROOT/scripts/mesh/notify-owner.sh"
HOST="$(hostname -s 2>/dev/null || echo m1)"
APPROVAL_PHRASE="APPROVE"

mkdir -p "$INBOX" "$APPROVED" "$REJECTED" "$(dirname "$LEDGER")" 2>/dev/null
touch "$LEDGER" 2>/dev/null || true

if [[ -t 1 ]]; then G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; BD=$'\e[1m'; X=$'\e[0m'
else G=; Y=; R=; C=; BD=; X=; fi
say(){ printf '%s\n' "$*"; }
hdr(){ printf '\n%s%s== %s ==%s\n' "$C" "$BD" "$*" "$X"; }

# ── DARK kill-switch (same one autopilot honors) ────────────────────────────────
if [[ -f "$ROOT/.swarm/DARK" ]]; then
  say "${Y}⛔ DARK — fleet executor paused (remove $ROOT/.swarm/DARK to resume).${X}"
  exit 0
fi

log_ledger() { # verb  file
  printf '%s\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$HOST" "$2" >> "$LEDGER" 2>/dev/null || true
}

# Highest score first: score is the zero-padded first field of law-<score>-<ts>-<key>.md,
# so a reverse lexical sort is a reverse numeric sort.
top_mission() { ls -1 "$INBOX"/law-*.md 2>/dev/null | sort -r | head -1; }

# Resolve a selector ("", "top", a basename, or a full path) to a real file.
resolve() {
  local sel="${1:-top}"
  case "$sel" in
    ""|top) top_mission ;;
    /*)     [[ -f "$sel" ]] && printf '%s\n' "$sel" ;;
    *)      [[ -f "$INBOX/$sel" ]] && printf '%s\n' "$INBOX/$sel" ;;
  esac
}

pending_count() { ls -1 "$INBOX"/law-*.md 2>/dev/null | wc -l | tr -d ' '; }

cmd_list() {
  hdr "FLEET-INBOX — pending missions (highest priority first)"
  local n; n="$(pending_count)"
  if [[ "$n" == "0" ]]; then say "  ${G}✓ inbox clear — nothing waiting.${X}"; return 0; fi
  local f base score
  while IFS= read -r f; do
    base="$(basename "$f")"
    score="$(printf '%s' "$base" | sed -n 's/^law-\([0-9]\{1,\}\)-.*/\1/p')"
    printf "  ${BD}[%s]${X}  %s\n" "${score:-????}" "$base"
  done < <(ls -1 "$INBOX"/law-*.md 2>/dev/null | sort -r)
  say ""
  say "  $n waiting. Review the top one:  ${BD}m1-fleet-executor.sh show top${X}"
}

cmd_show() {
  local f; f="$(resolve "${1:-top}")"
  [[ -n "$f" && -f "$f" ]] || { say "${Y}no such mission (try: m1-fleet-executor.sh list)${X}"; return 1; }
  hdr "Mission — $(basename "$f")"
  cat "$f"
  say ""
  say "  ${G}approve:${X} m1-fleet-executor.sh approve $(basename "$f")"
  say "  ${R}reject :${X} m1-fleet-executor.sh reject  $(basename "$f")"
}

# Default action — SURFACE. Safe to run unattended (autopilot / LaunchAgent).
# It shows the top mission and pings the owner rail. It NEVER approves or acts.
cmd_surface() {
  local n; n="$(pending_count)"
  hdr "M1 FLEET EXECUTOR — surface (owner approval required)"
  if [[ "$n" == "0" ]]; then say "  ${G}✓ inbox clear — nothing needs you.${X}"; return 0; fi
  local f; f="$(top_mission)"
  say "  ${BD}$n mission(s) waiting.${X} Top of the stack:"
  say ""
  sed 's/^/    /' "$f"
  say ""
  say "  ${Y}Nothing runs until you approve.${X}"
  say "    review : ${BD}m1-fleet-executor.sh show top${X}"
  say "    approve: ${BD}m1-fleet-executor.sh approve top${X}"
  # Owner rail: log-level only (routine). notify-owner escalates loudly only for urgent/emergency.
  bash "$NOTIFY" log "fleet-executor: $n mission(s) awaiting approval (top: $(basename "$f"))" 2>/dev/null || true
}

cmd_approve() {
  local f; f="$(resolve "${1:-top}")"
  [[ -n "$f" && -f "$f" ]] || { say "${Y}no such mission (try: m1-fleet-executor.sh list)${X}"; return 1; }

  # HARD GATE: approval requires a human at the keyboard. No TTY → never approve.
  if [[ ! -t 0 ]]; then
    say "${R}✗ refusing to approve without an interactive owner.${X}"
    say "  This ran non-interactively; per the owner-approval gate it will only surface."
    bash "$NOTIFY" log "fleet-executor: approve refused (no TTY) for $(basename "$f")" 2>/dev/null || true
    return 2
  fi

  hdr "Approve mission — $(basename "$f")"
  sed 's/^/    /' "$f"
  say ""
  say "  ${Y}This authorizes the M1 to carry out the mission above.${X}"
  printf "  Type ${BD}%s${X} to confirm (anything else cancels): " "$APPROVAL_PHRASE"
  local reply; read -r reply || reply=""
  if [[ "$reply" != "$APPROVAL_PHRASE" ]]; then
    say "  ${Y}• cancelled — mission left untouched in the inbox.${X}"
    return 0
  fi

  local base dest; base="$(basename "$f")"; dest="$APPROVED/$base"
  mv "$f" "$dest" 2>/dev/null || { say "${R}✗ could not stage the mission${X}"; return 1; }
  log_ledger "APPROVED" "$base"
  say ""
  say "  ${G}✓ approved${X} → staged at: $dest"
  say ""
  say "  ${BD}Next — do the work (still gated on any real send/pay/sign/ship):${X}"
  say "    Hand it to Rick on this M1:  ${BD}claude \"$dest\"${X}"
  say "    Outbound actions still block unless you set AIXMOS_OWNER_APPROVED=1 for that step."
  # We deliberately do NOT auto-run the work here. Approval ≠ blind execution.
}

cmd_reject() {
  local f; f="$(resolve "${1:-top}")"
  [[ -n "$f" && -f "$f" ]] || { say "${Y}no such mission${X}"; return 1; }
  local base; base="$(basename "$f")"
  mv "$f" "$REJECTED/$base" 2>/dev/null || { say "${R}✗ could not move${X}"; return 1; }
  log_ledger "REJECTED" "$base"
  say "  ${G}✓ rejected${X} → $REJECTED/$base"
}

cmd_status() {
  hdr "M1 FLEET EXECUTOR — status"
  say "  inbox   : $INBOX"
  say "  pending : $(pending_count)"
  say "  approved: $(ls -1 "$APPROVED"/law-*.md 2>/dev/null | wc -l | tr -d ' ')"
  say "  rejected: $(ls -1 "$REJECTED"/law-*.md 2>/dev/null | wc -l | tr -d ' ')"
  say "  ledger  : $LEDGER"
  [[ -s "$LEDGER" ]] && { say "  recent  :"; tail -n 5 "$LEDGER" | sed 's/^/    /'; }
}

case "${1:-surface}" in
  surface|"")     cmd_surface ;;
  list|ls)        cmd_list ;;
  show|view)      shift; cmd_show "${1:-top}" ;;
  approve|ok)     shift; cmd_approve "${1:-top}" ;;
  reject|no)      shift; cmd_reject "${1:-top}" ;;
  status)         cmd_status ;;
  *) say "usage: m1-fleet-executor.sh [surface|list|show|approve|reject|status] [top|<file>]"; exit 1 ;;
esac
