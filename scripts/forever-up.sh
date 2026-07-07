#!/usr/bin/env bash
# forever-up.sh — ONE command: install the full autonomous mesh loop on THIS device.
# No typing after this. Agents sync, dispatch, probe, log to watchtower — owner urgent only.
#
#   bash scripts/forever-up.sh              # detect role + install all daemons
#   bash scripts/forever-up.sh carry        # force role
#   bash scripts/forever-up.sh status
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/scripts/lib/swarm-common.sh" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/scripts/lib/swarm-common.sh" 2>/dev/null || true
fi
type ok >/dev/null 2>&1 || ok(){ printf '  ✓ %s\n' "$*"; }
type warn >/dev/null 2>&1 || warn(){ printf '  ! %s\n' "$*" >&2; }
type say >/dev/null 2>&1 || say(){ printf '%s\n' "$*"; }

ROLE="${1:-}"
[[ -z "$ROLE" && -f "$ROOT/.swarm/role" ]] && ROLE="$(tr -d '[:space:]' < "$ROOT/.swarm/role")"
[[ -z "$ROLE" ]] && ROLE=carry
case "$ROLE" in
  status) exec bash "$ROOT/scripts/mesh/forever-loop.sh" status ;;
  owner) ROLE=carry ;;
esac

if [[ -f "$ROOT/.swarm/DARK" ]]; then
  say "⛔ DARK — forever-up blocked. Lift: bash scripts/godark lift"
  exit 1
fi

say ""
say "╔══════════════════════════════════════════════════════════════╗"
say "║  F O R E V E R   U P  —  autonomous mesh · zero typing       ║"
say "╚══════════════════════════════════════════════════════════════╝"
say "role: $ROLE · repo: $ROOT"
say ""

# 1. One-word commands
[[ -x "$ROOT/scripts/lib/install-oneshot-bin.sh" ]] && bash "$ROOT/scripts/lib/install-oneshot-bin.sh"
ok "one-word commands → ~/.local/bin"

# 2. Canon + AI brief
[[ -x "$ROOT/scripts/oneshot-generate.sh" ]] && bash "$ROOT/scripts/oneshot-generate.sh"
ok "ONE-SHOT-AI.md regenerated"

# 3. Fleet staging
[[ -x "$ROOT/scripts/fleet-up.sh" ]] && bash "$ROOT/scripts/fleet-up.sh"
ok "mesh-plate staged"

# 4. Role marker
mkdir -p "$ROOT/.swarm"
printf '%s\n' "$ROLE" > "$ROOT/.swarm/role"
export SWARM_ROLE="$ROLE"

# 5. Forever loop LaunchAgent (replaces bare presence-only loop)
if [[ "$(uname -s)" == "Darwin" && -x "$ROOT/scripts/mesh/install-forever-loop.sh" ]]; then
  # Retire legacy presence-only agent (forever-loop includes presence beats)
  launchctl unload "$HOME/Library/LaunchAgents/com.tmmt.presence.plist" 2>/dev/null || true
  rm -f "$HOME/Library/LaunchAgents/com.tmmt.presence.plist"
  bash "$ROOT/scripts/mesh/install-forever-loop.sh" install "$ROLE" 180
  ok "forever-loop daemon (sync · dispatch · probe · log)"
fi

# 6. Router (Overdrive task runner) — dynamic repo path
if [[ "$(uname -s)" == "Darwin" && -f "$ROOT/scripts/router.ts" ]]; then
  PLIST="$HOME/Library/LaunchAgents/com.tmmt.router.plist"
  cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.tmmt.router</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>cd "${ROOT}" &amp;&amp; exec ./scripts/router up</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>WorkingDirectory</key><string>${ROOT}</string>
  <key>StandardOutPath</key><string>/tmp/tmmt-router.log</string>
  <key>StandardErrorPath</key><string>/tmp/tmmt-router.err</string>
</dict></plist>
PLIST
  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load -w "$PLIST" 2>/dev/null && ok "overdrive router daemon" || warn "router load skipped"
fi

# 7. Memory sync (if vault configured)
if [[ -n "${HAILMARY_VAULT:-}" && -x "$ROOT/scripts/mesh/memory-sync.sh" ]]; then
  bash "$ROOT/scripts/mesh/memory-sync.sh" install 300 2>/dev/null && ok "memory-sync daemon" || true
fi

# 8. HAILMARY keepalive (Ollama + memory API)
if [[ -x "$ROOT/scripts/hailmary-autostart.sh" ]]; then
  bash "$ROOT/scripts/hailmary-autostart.sh" 2>/dev/null && ok "hailmary keepalive" || true
fi

# 9. Voice inbox (if capture dirs exist)
if [[ -d "$HOME/.tmmt/inbox" && -x "$ROOT/scripts/install-capture-engine.sh" ]]; then
  bash "$ROOT/scripts/install-capture-engine.sh" 2>/dev/null && ok "voice-inbox watcher" || true
fi

# 10. Owner control board wrapper
mkdir -p "$HOME/.watchtower"
cat > "$HOME/.watchtower/tmmt" <<'WRAP'
#!/usr/bin/env bash
set -uo pipefail
for d in "$HOME/Projects/TMMT" "$HOME/projects/TMMT" "$HOME/TMMT"; do
  [[ -f "$d/scripts/control-board.sh" ]] && exec bash "$d/scripts/control-board.sh" "$@"
done
echo "✗ TMMT not found" >&2
exit 1
WRAP
chmod +x "$HOME/.watchtower/tmmt"
ok "control board → tmmt"

# 11. First tick now
bash "$ROOT/scripts/mesh/forever-loop.sh" tick 2>/dev/null || true
ok "initial tick complete"

say ""
say "══════════════════════════════════════════════════════════════"
say "  FOREVER UP COMPLETE — agents run as a team, no typing."
say "══════════════════════════════════════════════════════════════"
say "  watchtower     — League + health + agent inbox"
say "  tmmt           — owner control board"
say "  tail -f $ROOT/.swarm/forever-loop.log"
say ""
say "  Owner ping: URGENT/EMERGENCY only (config/notify-policy.json)"
say "  Canon: docs/GO-LIVE-CANON.md · docs/FOREVER-LOOP.md"
say ""
