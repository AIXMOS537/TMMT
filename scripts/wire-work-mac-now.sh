#!/usr/bin/env bash
# One-shot: wire work Mac as command hub (iMessage + HTTP + office spine).
set -euo pipefail

REPO="${TMMT_REPO_ROOT:-$HOME/dev/TMMT}"
log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }

[[ -d "$REPO" ]] || { echo "Missing $REPO"; exit 1; }
cd "$REPO"

log "1/7 — Command hub .env + iMessage watcher"
TMMT_CMDHUB_AUTO=1 TMMT_CMDHUB_SKIP_IMESSAGE_TEST=1 bash "${REPO}/scripts/configure-work-mac-command-hub.sh" || true

log "2/7 — iMessage watcher via Terminal (FDA workaround)"
launchctl bootout "gui/$(id -u)/com.aixmos.tmmt-imessage-command-watcher" 2>/dev/null || true
bash "${REPO}/scripts/start-imessage-watcher-via-terminal.sh" || log "WARN: terminal watcher"
bash "${REPO}/scripts/install-imessage-watcher-login.sh" 2>/dev/null || true

log "3/7 — Remote HTTP command server (iPhone/carry Mac over Tailscale)"
bash "${REPO}/scripts/enable-remote-command-server.sh"

log "4/7 — Office spine services"
bash "${REPO}/scripts/enable-office-autopull.sh" 2>/dev/null || true
bash "${REPO}/scripts/enable-flash-usb-sync.sh" 2>/dev/null || true
bash "${REPO}/scripts/enable-flash-usb-pull.sh" 2>/dev/null || true
# prod-server already owns :3000 — do not start dev-server

log "5/7 — Messages.app for outbound iMessage"
open -g -a Messages 2>/dev/null || true

log "6/7 — Health checks"
sleep 2
curl -sf http://127.0.0.1:3000 >/dev/null && log "TMMT OS :3000 OK" || log "WARN: :3000 down"
curl -sf http://127.0.0.1:9876/health >/dev/null && log "Remote cmd :9876 OK" || log "WARN: :9876 down"

log "7/7 — Desktop card + test iMessage"
bash "${REPO}/scripts/write-work-mac-hub-card.sh" 2>/dev/null || true

BUDDY="$(grep '^IMESSAGE_BUDDY=' "${REPO}/scripts/office-agent-channel/.env" | cut -d= -f2-)"
if [[ -n "$BUDDY" ]]; then
  IMESSAGE_BUDDY="$BUDDY" bash "${REPO}/scripts/office-agent-channel/imessage_send.sh" \
    "TMMT work Mac fully wired. Text TMMT status OR use iPhone Shortcut on Desktop." || true
fi

log "DONE — see ~/Desktop/WORK-MAC-COMMAND-HUB.md"
