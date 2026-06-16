#!/usr/bin/env bash
# install-desktop — drop double-click icons on the Desktop (macOS) so you never
# need to open a terminal. Creates: TMMT (menu), Booyah, Compass.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DESK="$HOME/Desktop"
[ -d "$DESK" ] || { echo "no Desktop folder found"; exit 0; }

make() { # name  command
  local f="$DESK/$1.command"
  printf '#!/usr/bin/env bash\ncd "%s" 2>/dev/null\n%s\necho; echo "(close this window)"\n' "$ROOT" "$2" > "$f"
  chmod +x "$f"
  echo "✓ $f"
}

ROLE="${ROLE:-}"; [ -z "$ROLE" ] && [ -f "$ROOT/.swarm/role" ] && ROLE="$(tr -d '[:space:]' < "$ROOT/.swarm/role")"
[ -z "$ROLE" ] && ROLE=operator

make "TMMT"    'bash "'"$ROOT"'/scripts/menu"'
make "Compass" 'bash "'"$ROOT"'/scripts/compass"'
if [ "$ROLE" = "owner" ]; then
  make "Booyah"  'bash "'"$ROOT"'/scripts/hailmary" booyah'
  make "Onboard" 'bash "'"$ROOT"'/scripts/aixmos" onboard'
else
  make "Work"    'bash "'"$ROOT"'/scripts/tmmt" go 2'
fi
echo
echo "Done. Double-click any icon on your Desktop. (First time: right-click → Open.)"
