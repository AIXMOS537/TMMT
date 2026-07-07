#!/usr/bin/env bash
# go.sh — THE ONLY COMMAND. Forever. M1 executes; Carry handoffs only.
#   bash ~/projects/TMMT/scripts/mesh/go.sh
set -uo pipefail

# Install canonical copy to Sync/rick (Syncthing may lag; git is source of truth)
_CANON="${HOME}/Sync/rick/go.sh"
mkdir -p "${HOME}/Sync/rick"
if [[ "$(readlink -f "$0" 2>/dev/null || realpath "$0" 2>/dev/null || echo "$0")" != "$(readlink -f "$_CANON" 2>/dev/null || echo "$_CANON")" ]]; then
  cp -f "$0" "$_CANON" 2>/dev/null && chmod +x "$_CANON" 2>/dev/null || true
fi

RICK="${FOREVER_RICK:-$HOME/Sync/rick}"
SCRIPTS="$RICK/M1-SCRIPTS"
INBOX="$RICK/FLEET-INBOX"
DESKTOP="${HOME}/Desktop"
LOG="${HOME}/Library/Logs/go-forever.log"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export LOCAL_FIRST=1

mkdir -p "$(dirname "$LOG")" "$INBOX" "$RICK/STATE"
log(){ printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*" >> "$LOG"; }
step(){ printf '\n▶ %s\n' "$*"; log "$*"; }
ok(){ printf '  ✓ %s\n' "$*"; log "OK: $*"; }

host_norm() {
  local h="${1:-$(hostname -s 2>/dev/null)}"
  h="${h%%.*}"
  echo "$h" | tr '[:upper:]' '[:lower:]'
}

is_carry() {
  local h
  h="$(host_norm)"
  case "$h" in
    macbook-pro-2|macbook-pro-3|carry|watchtower) return 0 ;;
  esac
  return 1
}

write_done_txt() {
  local mode="$1" status="$2"
  cat > "$DESKTOP/★ GO-DONE.txt" <<EOF
★ GO FOREVER — $(date -u +%FT%TZ)
host: $(hostname -s)
mode: $mode
status: $status
log: $LOG
EOF
}

carry_handoff() {
  step "CARRY — compile all sessions · hand to M1 + fleet"
  ROOT=""
  for d in "$HOME/Projects/TMMT" "$HOME/projects/TMMT"; do
    [[ -d "$d" ]] && ROOT="$d" && break
  done
  [[ -n "$ROOT" && -x "$ROOT/scripts/blip/session-sweep-tonight.sh" ]] \
    && bash "$ROOT/scripts/blip/session-sweep-tonight.sh" || true
  for comp in "$SCRIPTS/universal-brain-compile.sh" "$HOME/.config/tmmt/universal-brain-compile.sh"; do
    [[ -x "$comp" ]] && bash "$comp" || true
  done
  [[ -x "$RICK/BRAIN-FEED/compile-master.sh" ]] && bash "$RICK/BRAIN-FEED/compile-master.sh" || true
  date -u +%FT%TZ > "$RICK/AUTORUN.stamp"
  mkdir -p "$INBOX"
  cat > "$INBOX/law-10012-$(date +%Y%m%d-%H%M%S)-compile-fleet-handoff.md" <<EOF
# COMPILE + FLEET — M1 Rick executes
score: 10012
execute_on: m1-rick
priority: immediate

All Claude/Cursor sessions compiled on Carry. M1: run go.sh — builds Brainiac + office Windows fleet.
EOF
  [[ -x "$SCRIPTS/go-carry-mobile.sh" ]] && bash "$SCRIPTS/go-carry-mobile.sh" sleep || true
  write_done_txt "carry-handoff" "sessions compiled · AUTORUN stamped"
  echo "⛔ M1 paste:"
  echo "   git -C ~/projects/TMMT fetch origin docs/test-status-update && bash <(git -C ~/projects/TMMT show origin/docs/test-status-update:scripts/mesh/go.sh)"
}

m1_inline() {
  for inst in "$SCRIPTS/install-rick-command-center.sh" "$HOME/.config/tmmt/install-rick-command-center.sh"; do
    [[ -x "$inst" ]] && bash "$inst" && break
  done
  [[ -x "$SCRIPTS/install-m1-forever.sh" ]] && bash "$SCRIPTS/install-m1-forever.sh" || true
  [[ -x "$SCRIPTS/m1-oneshot-forever.sh" ]] && bash "$SCRIPTS/m1-oneshot-forever.sh" || true
  [[ -x "$SCRIPTS/rick-work-pipeline.sh" ]] && bash "$SCRIPTS/rick-work-pipeline.sh" install && bash "$SCRIPTS/rick-work-pipeline.sh" tick || true
  [[ -x "$SCRIPTS/rick-remote-control.sh" ]] && bash "$SCRIPTS/rick-remote-control.sh" fleet || true
  [[ -x "$SCRIPTS/fleet-oneshot-now.sh" ]] && bash "$SCRIPTS/fleet-oneshot-now.sh" || true
  [[ -x "$SCRIPTS/m1-fleet-executor.sh" ]] && bash "$SCRIPTS/m1-fleet-executor.sh" || true
  [[ -x "$SCRIPTS/m1-brainiac-duo.sh" ]] && bash "$SCRIPTS/m1-brainiac-duo.sh" pulse || true
  [[ -x "$SCRIPTS/m1-status-cards.sh" ]] && bash "$SCRIPTS/m1-status-cards.sh" || true
}

drain_fleet_inbox() {
  local ex="$SCRIPTS/m1-fleet-executor.sh"
  [[ -x "$ex" ]] || return 0
  local n=0
  while find "$INBOX" -maxdepth 1 -name 'law-*.md' -type f 2>/dev/null | grep -q .; do
    bash "$ex" || true
    n=$((n + 1))
    [[ "$n" -ge 50 ]] && break
  done
}

m1_compile_all() {
  step "COMPILE — all chats · Claude · Cursor · vault → brain"
  ROOT=""
  for d in "$HOME/projects/TMMT" "$HOME/Projects/TMMT"; do
    [[ -d "$d" ]] && ROOT="$d" && break
  done
  [[ -n "$ROOT" && -x "$ROOT/scripts/blip/session-sweep-tonight.sh" ]] \
    && bash "$ROOT/scripts/blip/session-sweep-tonight.sh" >> "$LOG" 2>&1 || true
  for comp in "$SCRIPTS/universal-brain-compile.sh" "$HOME/.config/tmmt/universal-brain-compile.sh"; do
    [[ -x "$comp" ]] && bash "$comp" >> "$LOG" 2>&1 && break
  done
  [[ -x "$RICK/BRAIN-FEED/compile-master.sh" ]] && bash "$RICK/BRAIN-FEED/compile-master.sh" >> "$LOG" 2>&1 || true
  [[ -x "$RICK/BRAIN-FEED/compile-corpus.sh" ]] && bash "$RICK/BRAIN-FEED/compile-corpus.sh" >> "$LOG" 2>&1 || true
  ok "brain compiled → BRAIN-FEED + session digests"
}

m1_fleet_all() {
  step "FLEET — Brainiac + office Windows + drain inbox"
  for fleet in "$SCRIPTS/fleet-oneshot-now.sh" "$HOME/.config/tmmt/fleet-oneshot-now.sh"; do
    [[ -x "$fleet" ]] && bash "$fleet" >> "$LOG" 2>&1 && break
  done
  [[ -x "$SCRIPTS/rick-remote-control.sh" ]] && bash "$SCRIPTS/rick-remote-control.sh" fleet >> "$LOG" 2>&1 || true
  drain_fleet_inbox
  ok "fleet dispatched · inbox draining"
}

m1_run() {
  step "GO FOREVER — M1 Rick (compile + fleet + forever)"
  m1_compile_all
  OWN="$SCRIPTS/m1-own-everything-forever.sh"
  if [[ -x "$OWN" ]]; then
    bash "$OWN" || true
  else
    m1_inline
  fi
  m1_fleet_all
  date -u +%FT%TZ > "$RICK/AUTORUN.stamp"
  write_done_txt "m1" "compile + fleet + forever complete"
  echo "★ GO complete — Rick + Brainiac + office building."
  echo "  cat ~/Desktop/★\\ GO-DONE.txt"
}

if is_carry; then carry_handoff; exit 0; fi
m1_run
exit 0
