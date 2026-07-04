#!/usr/bin/env bash
# hailmary-session — MASTER access is a SESSION, not a permanent state.
#
#   Default state ......... AIXMOS-only (restricted / public).
#   unlock (auth code) .... opens HAILMARY MASTER for a TTL (default 12h).
#   lock / timeout / ...... auto-revert to AIXMOS-only.
#   anyone-not-Taha ....... never has master (they don't have the word).
#
# Safe by construction: "AIXMOS-only" is the existing `godark` restricted mode,
# NOT an OS lockout. The owner passphrase always re-opens master, so the owner
# can never be locked out. Enforcement is DRY-RUN until you `arm` it.
#
#   bash scripts/hailmary-session.sh unlock [ttl_min]   auth-code -> MASTER
#   bash scripts/hailmary-session.sh lock               -> AIXMOS-only now
#   bash scripts/hailmary-session.sh status             which mode am I in?
#   bash scripts/hailmary-session.sh guard              the auto-revert check (launchd calls this)
#   bash scripts/hailmary-session.sh arm | disarm       turn REAL enforcement on/off (auth-gated)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEAL_SH="$ROOT/scripts/owner-seal.sh"
GODARK="$ROOT/scripts/godark"
STATE="$HOME/.hailmary"; mkdir -p "$STATE"
SESSION="$STATE/session"; ARMED="$STATE/armed"; LOG="$STATE/guard.log"
DEFAULT_TTL=720   # minutes

now(){ date +%s; }
log(){ printf '%s  %s\n' "$(date '+%F %T')" "$*" >> "$LOG"; }
session_valid(){ [ -f "$SESSION" ] && [ "$(cat "$SESSION" 2>/dev/null || echo 0)" -gt "$(now)" ] 2>/dev/null; }

case "${1:-status}" in
  unlock)
    ttl="${2:-$DEFAULT_TTL}"
    # Auth code = the Owner Seal. Never stored; verified by owner-seal.sh.
    if bash "$SEAL_SH" check; then
      echo $(( $(now) + ttl*60 )) > "$SESSION"
      log "MASTER unlocked (ttl ${ttl}m)"
      echo "  ✓ HAILMARY MASTER — active for ${ttl} minutes. Locks back to AIXMOS-only on timeout/lock."
    else
      echo "  ✗ Wrong word. Still AIXMOS-only."; exit 1
    fi
    ;;
  lock)
    rm -f "$SESSION"; log "locked -> AIXMOS-only (manual)"
    if [ -x "$GODARK" ]; then bash "$GODARK" >/dev/null 2>&1 || true; fi
    echo "  ✓ Reverted to PROJECT X AIXMOS only."
    ;;
  status)
    if session_valid; then
      left=$(( ( $(cat "$SESSION") - $(now) ) / 60 ))
      echo "  MODE: 🟢 HAILMARY MASTER  (${left}m left)"
    else
      echo "  MODE: 🔒 PROJECT X AIXMOS only"
    fi
    [ -f "$ARMED" ] && echo "  Enforcement: ARMED (auto-revert live)" || echo "  Enforcement: dry-run (guard only logs; arm when ready)"
    ;;
  guard)
    if session_valid; then exit 0; fi          # owner is present in master session — nothing to do
    if [ -f "$ARMED" ]; then
      # already dark? avoid re-running
      if [ -x "$GODARK" ] && ! bash "$GODARK" status 2>/dev/null | grep -qi dark; then
        bash "$GODARK" >/dev/null 2>&1 || true; log "AUTO-REVERT -> AIXMOS-only (armed)"
      fi
    else
      log "WOULD auto-revert -> AIXMOS-only (dry-run; not armed)"
    fi
    ;;
  arm)
    if bash "$SEAL_SH" check; then touch "$ARMED"; log "enforcement ARMED"; echo "  ✓ Enforcement ARMED — machine now auto-reverts to AIXMOS-only when you're not in a master session."; \
    else echo "  ✗ Wrong word. Enforcement unchanged."; exit 1; fi
    ;;
  disarm)
    if bash "$SEAL_SH" check; then rm -f "$ARMED"; log "enforcement DISARMED"; echo "  ✓ Enforcement DISARMED (back to dry-run)."; \
    else echo "  ✗ Wrong word. Enforcement unchanged."; exit 1; fi
    ;;
  *) echo "hailmary-session words: unlock [ttl] | lock | status | guard | arm | disarm";;
esac
