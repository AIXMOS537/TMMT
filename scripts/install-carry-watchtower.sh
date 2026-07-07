#!/usr/bin/env bash
# install-carry-watchtower.sh — Carry M5: capture everything · route to M1 · emergency-only pings.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
TMMT_CFG="$HOME/.config/tmmt"
mkdir -p "$TMMT_CFG" "$HOME/Library/Logs"

say(){ printf '\n▶ %s\n' "$1"; }
ok(){ printf '  ✓ %s\n' "$*"; }
warn(){ printf '  ! %s\n' "$*"; }

say "1/5 Capture engine (voice · photos · iCloud drops)"
if [[ -x "$ROOT/scripts/install-capture-engine.sh" ]]; then
  bash "$ROOT/scripts/install-capture-engine.sh" || warn "capture partial — install ffmpeg/whisper manually"
  ok "voice-inbox launchd"
else
  echo "  ! install-capture-engine.sh missing"
fi

say "2/5 Carry watcher (Rick STATE → notifications)"
WATCH="$HOME/Sync/rick/carry-watcher"
if [[ -x "$WATCH/INSTALL-ON-CARRY.command" ]]; then
  bash "$WATCH/INSTALL-ON-CARRY.command" || true
  ok "carry-watcher every 5 min"
fi

say "3/5 Empire intake loop (ClickUp · vault · inbox → M1)"
chmod +x "$ROOT/scripts/mesh/empire-intake.sh" 2>/dev/null || true
PLIST="$HOME/Library/LaunchAgents/com.tmmt.empire-intake.plist"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.tmmt.empire-intake</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$ROOT/scripts/mesh/empire-intake.sh</string>
  </array>
  <key>StartInterval</key><integer>120</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/empire-intake.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/empire-intake.log</string>
</dict></plist>
PLIST
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load -w "$PLIST" 2>/dev/null && ok "empire-intake every 2 min"

say "4/5 Forever loop + autopilot"
bash "$ROOT/scripts/forever-up.sh" carry 2>/dev/null || \
  bash "$ROOT/scripts/mesh/install-forever-loop.sh" install carry 180 2>/dev/null || true
ok "forever-loop daemon"

say "5/5 ClickUp bridge"
if [[ -f "$TMMT_CFG/clickup.env" ]] && ! grep -q '^CLICKUP_API_TOKEN=' "$ROOT/.env.local" 2>/dev/null; then
  tok="$(grep '^CLICKUP_TOKEN=' "$TMMT_CFG/clickup.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
  if [[ -n "$tok" ]]; then
    echo "CLICKUP_API_TOKEN=$tok" >> "$ROOT/.env.local"
    ok "CLICKUP_API_TOKEN bridged from clickup.env"
  fi
fi

bash "$ROOT/scripts/mesh/empire-intake.sh" 2>/dev/null || true

cat <<'DONE'

╔══════════════════════════════════════════════════════════════════╗
║  CARRY WATCHTOWER LIVE                                           ║
╠══════════════════════════════════════════════════════════════════╣
║  Collects: voice · photos · iCloud · ClickUp · catch · vault     ║
║  Routes:   → M1 FLEET-INBOX (Rick executes)                      ║
║  Pings you: EMERGENCY / URGENT only                              ║
╠══════════════════════════════════════════════════════════════════╣
║  Send to M1:  bash scripts/send-to-m1.sh                        ║
║  Drop work:   tmmt work "..."                                    ║
║  Logs:        tail -f ~/Library/Logs/empire-intake.log           ║
╚══════════════════════════════════════════════════════════════════╝

DONE
