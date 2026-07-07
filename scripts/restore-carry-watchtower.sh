#!/usr/bin/env bash
# restore-carry-watchtower.sh — undo accidental RUN-M1-FIX-ONCE on Carry.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="$(hostname -s 2>/dev/null | tr '[:upper:]' '[:lower:]')"

say(){ printf '\n▶ %s\n' "$1"; }
ok(){ printf '  ✓ %s\n' "$*"; }

say "Restore Carry Watchtower (was: $HOST)"

# 1. Stop M1 fleet daemon (wrong role on Carry)
M1_PLIST="$HOME/Library/LaunchAgents/com.tmmt.m1-fleet.plist"
if [[ -f "$M1_PLIST" ]]; then
  launchctl unload "$M1_PLIST" 2>/dev/null || true
  mv -f "$M1_PLIST" "$M1_PLIST.disabled-on-carry" 2>/dev/null || true
  ok "M1 fleet daemon stopped (belongs on M1 only)"
fi

# 2. Swarm role back to carry / watchtower
mkdir -p "$ROOT/.swarm"
printf 'carry\n' > "$ROOT/.swarm/role"
printf '%s\n' "$HOST" > "$ROOT/.swarm/machine"
export SWARM_ROLE=carry
ok "role=carry (watchtower)"

# 3. Reinstall correct forever-loop for Carry
if [[ -x "$ROOT/scripts/mesh/install-forever-loop.sh" ]]; then
  bash "$ROOT/scripts/mesh/install-forever-loop.sh" install carry 180
  ok "forever-loop = carry (intake + route, NOT fleet execute)"
fi

# 4. Empire intake + capture (Carry collects, M1 executes)
if [[ -x "$ROOT/scripts/install-carry-watchtower.sh" ]]; then
  bash "$ROOT/scripts/install-carry-watchtower.sh" 2>/dev/null || true
  ok "carry watchtower intake"
fi

# 5. Clear wrong marker so M1 can still run fix-once there
rm -f "$HOME/.config/tmmt/.m1-fix-once.done" 2>/dev/null || true
date -u +%Y-%m-%dT%H:%M:%SZ > "$HOME/.config/tmmt/.carry-watchtower-restored"

cat <<'DONE'

╔══════════════════════════════════════════════════════════════╗
║  CARRY RESTORED — you are Watchtower again                   ║
╠══════════════════════════════════════════════════════════════╣
║  Carry:  collect · route · empire-intake                     ║
║  M1:     execute FLEET-INBOX (run fix-once ON M1 ONLY)       ║
╠══════════════════════════════════════════════════════════════╣
║  On real M1 later: bash ~/Sync/rick/RUN-M1-FIX-ONCE.sh       ║
╚══════════════════════════════════════════════════════════════╝

DONE
