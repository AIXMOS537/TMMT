#!/usr/bin/env bash
# go.sh — THE ONLY COMMAND. Forever. M1 executes; Carry handoffs only.
#   bash ~/Sync/rick/go.sh
set -uo pipefail

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
  step "CARRY — handoff to M1"
  date -u +%FT%TZ > "$RICK/AUTORUN.stamp"
  mkdir -p "$INBOX"
  cat > "$INBOX/law-10009-$(date +%Y%m%d-%H%M%S)-carry-go-forever.md" <<EOF
# GO FOREVER — M1 Rick only
execute_on: m1-rick
priority: immediate

bash ~/Sync/rick/go.sh
EOF
  [[ -x "$SCRIPTS/go-carry-mobile.sh" ]] && bash "$SCRIPTS/go-carry-mobile.sh" sleep || true
  write_done_txt "carry-handoff" "AUTORUN stamped"
  echo "⛔ M1 only. Paste: bash ~/Sync/rick/go.sh"
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

m1_run() {
  step "GO FOREVER — M1 Rick"
  OWN="$SCRIPTS/m1-own-everything-forever.sh"
  if [[ -x "$OWN" ]]; then
    bash "$OWN" || true
    [[ -x "$SCRIPTS/fleet-oneshot-now.sh" ]] && bash "$SCRIPTS/fleet-oneshot-now.sh" || true
  else
    m1_inline
  fi
  drain_fleet_inbox
  date -u +%FT%TZ > "$RICK/AUTORUN.stamp"
  write_done_txt "m1" "complete"
  echo "★ GO complete."
}

if is_carry; then carry_handoff; exit 0; fi
m1_run
exit 0
