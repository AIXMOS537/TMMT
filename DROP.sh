#!/usr/bin/env bash
# DROP.sh — THE ONE FILE. ONE COMMAND. FOREVER.
#   bash ~/Desktop/DROP.sh
#   bash ~/Desktop/DROP.sh --stop
#   bash ~/Desktop/DROP.sh --full
set -uo pipefail
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; C=$'\033[36m'; B=$'\033[1m'; X=$'\033[0m'
say(){ printf '%b▸ %s%b\n' "$C" "$*" "$X"; }
ok(){ printf '  %s✓%s %s\n' "$G" "$X" "$*"; }
die(){ printf '%b✗ %s%b\n' "$R" "$*" "$X" >&2; exit 1; }
MODE="${1:-}"
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
find_tmmt() {
  local d
  for d in "$HOME/Projects/TMMT" "$HOME/projects/TMMT" "$HOME/TMMT" "$HOME/Sync/rick/TMMT"; do
    [[ -f "$d/scripts/tmmt" ]] && { printf '%s' "$d"; return 0; }
  done
  return 1
}
install_words() {
  local BIN="$HOME/.local/bin" ROOT="$1"
  mkdir -p "$BIN"
  wrap() {
    local name="$1" rel="$2"
    [[ -f "$ROOT/$rel" ]] || return 0
    cat > "$BIN/$name" <<WRAP
#!/usr/bin/env bash
set -euo pipefail
for d in "\$HOME/Projects/TMMT" "\$HOME/projects/TMMT"; do
  [[ -f "\$d/$rel" ]] && exec bash "\$d/$rel" "\$@"
done
exit 1
WRAP
    chmod +x "$BIN/$name"
  }
  wrap drop DROP.sh
  wrap x scripts/x
  wrap order scripts/serve.sh
  wrap serve scripts/serve.sh
  wrap fleet-up scripts/fleet-up.sh
  wrap go scripts/go
  wrap tmmt scripts/tmmt
  wrap menu scripts/menu
  [[ -f "$ROOT/scripts/m1-stop-loop.sh" ]] && wrap m1-stop scripts/m1-stop-loop.sh
  ok "words → ~/.local/bin"
}
TMMT="$(find_tmmt)" || { say "Cloning TMMT…"; mkdir -p "$HOME/Projects"; git clone https://github.com/AIXMOS537/TMMT.git "$HOME/Projects/TMMT" 2>/dev/null || die "No TMMT"; TMMT="$HOME/Projects/TMMT"; }
cd "$TMMT" || die "cannot cd $TMMT"
if [[ "$MODE" == "--stop" || "$MODE" == "stop" ]]; then
  launchctl unload "$HOME/Library/LaunchAgents/com.tmmt.presence.plist" 2>/dev/null || true
  launchctl unload "$HOME/Library/LaunchAgents/com.aixmos.hailmary.plist" 2>/dev/null || true
  pkill -f 'presence.sh loop' 2>/dev/null || true
  pkill -f hailmary-daemon 2>/dev/null || true
  pkill -f RUN-FLEET-UP 2>/dev/null || true
  mkdir -p "$HOME/.tmmt" && date -u +%FT%TZ > "$HOME/.tmmt/skip-auto-boot"
  ok "loop stopped"; exit 0
fi
ME="$(hostname -s | tr '[:upper:]' '[:lower:]')"
ROLE="carry"
[[ -f "$TMMT/.swarm/machine" ]] && ROLE="$(tr -d '[:space:]' < "$TMMT/.swarm/machine")"
[[ "$ME" == *tmmt* || "$ME" == *rick* ]] && ROLE="rick"
printf '\n%b╔══════════════════════════════════════════════════════════╗%b\n' "$B" "$X"
printf '%b║  DROP — ONE FILE FOREVER                                  ║%b\n' "$B" "$X"
printf '%b╚══════════════════════════════════════════════════════════╝%b\n' "$B" "$X"
say "$ME · $ROLE · $TMMT"
install_words "$TMMT"
cp -f "$SELF" "$TMMT/DROP.sh" 2>/dev/null || true
mkdir -p "$HOME/Sync/rick" 2>/dev/null
cp -f "$SELF" "$HOME/Sync/rick/DROP.sh" 2>/dev/null || true
chmod +x "$TMMT/DROP.sh" "$HOME/Sync/rick/DROP.sh" 2>/dev/null || true
if [[ "$ROLE" == "rick" ]]; then
  [[ "$MODE" == "--full" ]] && rm -f "$HOME/.tmmt/skip-auto-boot" 2>/dev/null
  [[ "$MODE" == "--full" && -x "$HOME/Sync/rick/RUN-FLEET-UP.sh" ]] && bash "$HOME/Sync/rick/RUN-FLEET-UP.sh" --full && exit 0
  [[ -x "$TMMT/scripts/lib/mesh-plate-restore.sh" ]] && bash "$TMMT/scripts/lib/mesh-plate-restore.sh" 2>/dev/null || true
  [[ -x "$HOME/Sync/rick/RUN-FLEET-UP.sh" ]] && bash "$HOME/Sync/rick/RUN-FLEET-UP.sh" 2>/dev/null || true
  [[ -x "$TMMT/scripts/serve.sh" ]] && bash "$TMMT/scripts/serve.sh" owner 2>/dev/null || true
  printf '\n%b✅ DROP M1 light.%b\n\n' "$G" "$X"; exit 0
fi
[[ -x "$TMMT/scripts/lib/mesh-plate-restore.sh" ]] && bash "$TMMT/scripts/lib/mesh-plate-restore.sh" 2>/dev/null || true
[[ -x "$TMMT/scripts/fleet-up.sh" ]] && bash "$TMMT/scripts/fleet-up.sh" 2>/dev/null || true
[[ "$MODE" == "--full" && -x "$TMMT/scripts/hailmary" ]] && bash "$TMMT/scripts/hailmary" booyah 2>/dev/null || true
[[ -x "$TMMT/scripts/serve.sh" ]] && bash "$TMMT/scripts/serve.sh" owner 2>/dev/null || true
printf '\n%b✅ DROP DONE.%b\n  x · order\n\n' "$G" "$X"
